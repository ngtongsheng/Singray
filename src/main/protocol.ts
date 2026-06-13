import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { protocol } from 'electron'
import { getSettings } from './settings'

const MIME: Record<string, string> = {
  '.m4a': 'audio/mp4',
  '.flac': 'audio/flac',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.json': 'application/json'
}

const SONG_ID = /^[a-z0-9-]+$/i
const FILE_NAME = /^[\w-]+\.[a-z0-9]+$/i
/** Extensionless stem requests (R3.8) resolve to whichever encode exists, flac first. */
const BARE_TRACK = /^(original|instrumental|vocals)$/
const STEM_EXTS = ['flac', 'm4a'] as const

/** First of `names` that exists as a file in `dir`, with its size. */
async function firstExisting(
  dir: string,
  names: string[]
): Promise<{ path: string; size: number } | null> {
  for (const name of names) {
    const path = join(dir, name)
    try {
      const info = await stat(path)
      if (info.isFile()) return { path, size: info.size }
    } catch {
      // try next extension
    }
  }
  return null
}

/** Must run before app.whenReady(). */
export function registerKaraokeScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'karaoke',
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
        corsEnabled: true
      }
    }
  ])
}

/**
 * karaoke://<songId>/<file> → <libraryDir>/<songId>/<file>, with HTTP range
 * support so <audio> seeking and Web Audio fetch both work (SPEC §8).
 */
export function registerKaraokeHandler(): void {
  protocol.handle('karaoke', async (request) => {
    const url = new URL(request.url)
    const songId = url.hostname
    const requested = url.pathname.replace(/^\//, '')
    if (!SONG_ID.test(songId) || !(FILE_NAME.test(requested) || BARE_TRACK.test(requested))) {
      return new Response('Bad request', { status: 400 })
    }

    const dir = join(getSettings().libraryDir, songId)
    let filePath: string
    let size: number
    if (BARE_TRACK.test(requested)) {
      // Resolve a stem to whichever encode exists (mixed flac/m4a library, R3.8).
      const found = await firstExisting(
        dir,
        STEM_EXTS.map((e) => `${requested}.${e}`)
      )
      if (!found) return new Response('Not found', { status: 404 })
      filePath = found.path
      size = found.size
    } else {
      filePath = join(dir, requested)
      try {
        const info = await stat(filePath)
        if (!info.isFile()) return new Response('Not found', { status: 404 })
        size = info.size
      } catch {
        return new Response('Not found', { status: 404 })
      }
    }

    const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase()
    const baseHeaders: Record<string, string> = {
      'Content-Type': MIME[ext] ?? 'application/octet-stream',
      'Accept-Ranges': 'bytes',
      // Renderer origin differs from karaoke:// (http://localhost in dev, file/app in prod),
      // so renderer fetch() — e.g. waveform decode — needs CORS on top of supportFetchAPI.
      'Access-Control-Allow-Origin': '*'
    }

    const range = request.headers.get('range')
    const match = range ? /^bytes=(\d*)-(\d*)$/.exec(range) : null
    if (match) {
      const start = match[1] ? Number.parseInt(match[1], 10) : 0
      const end = match[2] ? Math.min(Number.parseInt(match[2], 10), size - 1) : size - 1
      if (start > end || start >= size) {
        return new Response('Range not satisfiable', {
          status: 416,
          headers: { 'Content-Range': `bytes */${size}` }
        })
      }
      const stream = Readable.toWeb(
        createReadStream(filePath, { start, end })
      ) as ReadableStream<Uint8Array>
      return new Response(stream, {
        status: 206,
        headers: {
          ...baseHeaders,
          'Content-Range': `bytes ${start}-${end}/${size}`,
          'Content-Length': String(end - start + 1)
        }
      })
    }

    const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream<Uint8Array>
    return new Response(stream, {
      status: 200,
      headers: { ...baseHeaders, 'Content-Length': String(size) }
    })
  })
}
