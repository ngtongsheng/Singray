import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { protocol } from 'electron'
import { getSettings } from './settings'

const MIME: Record<string, string> = {
  '.m4a': 'audio/mp4',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.json': 'application/json'
}

const SONG_ID = /^[a-z0-9-]+$/i
const FILE_NAME = /^[\w-]+\.[a-z0-9]+$/i

/** Must run before app.whenReady(). */
export function registerKaraokeScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'karaoke',
      privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
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
    const fileName = url.pathname.replace(/^\//, '')
    if (!SONG_ID.test(songId) || !FILE_NAME.test(fileName)) {
      return new Response('Bad request', { status: 400 })
    }

    const filePath = join(getSettings().libraryDir, songId, fileName)
    let size: number
    try {
      const info = await stat(filePath)
      if (!info.isFile()) return new Response('Not found', { status: 404 })
      size = info.size
    } catch {
      return new Response('Not found', { status: 404 })
    }

    const ext = fileName.slice(fileName.lastIndexOf('.')).toLowerCase()
    const baseHeaders: Record<string, string> = {
      'Content-Type': MIME[ext] ?? 'application/octet-stream',
      'Accept-Ranges': 'bytes'
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
