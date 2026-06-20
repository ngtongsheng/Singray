import type { Dirent } from 'node:fs'
import { access, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { BrowserWindow, shell } from 'electron'
import type { ArtworkResult, Lyrics, SongListItem, SongMeta } from '../shared/types'
import { getSettings } from './settings'

const SONG_ID = /^[a-z0-9-]+$/i

function notifyLibraryChanged(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('library:changed')
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function readImportError(songDir: string): Promise<string | null> {
  try {
    const raw = JSON.parse(await readFile(join(songDir, 'error.json'), 'utf-8')) as {
      message?: string
    }
    return raw.message ?? 'import failed'
  } catch {
    return null
  }
}

export function songDir(id: string): string {
  if (!SONG_ID.test(id)) throw new Error(`invalid song id: ${id}`)
  return join(getSettings().libraryDir, id)
}

export async function listSongs(): Promise<SongListItem[]> {
  let entries: Dirent[]
  try {
    entries = await readdir(getSettings().libraryDir, { withFileTypes: true })
  } catch {
    return [] // library dir missing → empty library
  }

  const songs: SongListItem[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const dir = join(getSettings().libraryDir, entry.name)
    try {
      const raw = JSON.parse(await readFile(join(dir, 'meta.json'), 'utf-8')) as SongMeta & {
        artist?: string
      }
      const { artist: legacyArtist, ...meta } = raw
      let thumbVersion = 0
      try {
        const info = await stat(join(dir, 'thumb.jpg'))
        thumbVersion = info.mtimeMs
      } catch {
        // no thumb yet
      }
      songs.push({
        ...meta,
        artists: meta.artists ?? (legacyArtist ? [legacyArtist] : []), // pre-#63 metas have a single `artist` string
        sings: meta.sings ?? [], // pre-R1.5 metas have no sings array
        sourceFile: meta.sourceFile ?? null, // pre-R3.7 metas have no sourceFile
        id: entry.name, // folder name is the id authority
        hasLyrics: await exists(join(dir, 'lyrics.json')),
        error: await readImportError(dir),
        ready:
          (await exists(join(dir, 'original.flac'))) || (await exists(join(dir, 'original.m4a'))),
        thumbVersion
      })
    } catch {
      // no/corrupt meta.json → not a song folder, skip
    }
  }
  songs.sort((a, b) => b.addedAt.localeCompare(a.addedAt))
  return songs
}

export async function openSongFolder(id: string): Promise<void> {
  const err = await shell.openPath(songDir(id))
  if (err) throw new Error(err)
}

export async function deleteSong(id: string): Promise<void> {
  await rm(songDir(id), { recursive: true, force: true })
  notifyLibraryChanged()
}

export async function updateMeta(id: string, patch: Partial<SongMeta>): Promise<SongMeta> {
  const metaPath = join(songDir(id), 'meta.json')
  const meta = JSON.parse(await readFile(metaPath, 'utf-8')) as SongMeta
  // id and schemaVersion are not patchable
  const { id: _id, schemaVersion: _v, ...rest } = patch
  const next: SongMeta = { ...meta, ...rest, id, schemaVersion: 1 }
  await writeFile(metaPath, JSON.stringify(next, null, 2), 'utf-8')
  notifyLibraryChanged()
  return next
}

export async function getLyrics(id: string): Promise<Lyrics | null> {
  try {
    return JSON.parse(await readFile(join(songDir(id), 'lyrics.json'), 'utf-8')) as Lyrics
  } catch {
    return null // missing or corrupt → no lyrics
  }
}

export async function saveLyrics(id: string, lyrics: Lyrics): Promise<void> {
  await writeFile(join(songDir(id), 'lyrics.json'), JSON.stringify(lyrics, null, 2), 'utf-8')
  notifyLibraryChanged() // hasLyrics is derived from this file
}

export async function uploadThumb(id: string, bytes: ArrayBuffer): Promise<void> {
  await writeFile(join(songDir(id), 'thumb.jpg'), Buffer.from(bytes))
  notifyLibraryChanged()
}

export async function fetchArtworkBytes(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Artwork download failed: ${res.status}`)
  return res.arrayBuffer()
}

export async function searchArtwork(query: string): Promise<ArtworkResult[]> {
  const res = await fetch(
    `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=12&media=music`
  )
  if (!res.ok) return []
  const data = (await res.json()) as {
    results: { artworkUrl100: string; trackName: string; artistName: string }[]
  }
  return data.results.map((r) => ({
    artworkUrl: r.artworkUrl100.replace('100x100bb', '600x600bb'),
    trackName: r.trackName,
    artistName: r.artistName
  }))
}

export { notifyLibraryChanged }
