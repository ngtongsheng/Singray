import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, stat, unlink, writeFile } from 'node:fs/promises'
import { basename, dirname, join, resolve, sep } from 'node:path'
import { promisify } from 'node:util'
import { shell } from 'electron'
import type { RecordingItem } from '../shared/types'
import { songDir } from './library'
import { managedFfmpegDir, pipelineSpawnOptions } from './pipelineEnv'
import { getSettings } from './settings'

const execFileAsync = promisify(execFile)
const EXT = /^[a-z0-9]+$/i
const REC_EXT = /\.(webm|wav)$/i
/** Recording filenames are unique timestamps and files are write-once, so a
 *  filename → durationSec cache never goes stale and needs no invalidation. */
const DURATIONS_FILE = 'durations.json'

type DurationCache = Record<string, number>

async function readDurationCache(dir: string): Promise<DurationCache> {
  try {
    return JSON.parse(await readFile(join(dir, DURATIONS_FILE), 'utf-8')) as DurationCache
  } catch {
    return {}
  }
}

async function writeDurationCache(dir: string, cache: DurationCache): Promise<void> {
  await writeFile(join(dir, DURATIONS_FILE), JSON.stringify(cache), 'utf-8').catch(() => {})
}

function ffprobePath(): string {
  const name = process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe'
  const managed = join(managedFfmpegDir(), name)
  return existsSync(managed) ? managed : 'ffprobe'
}

async function probeDurationSec(filePath: string): Promise<number | null> {
  try {
    const { stdout } = await execFileAsync(
      ffprobePath(),
      ['-v', 'quiet', '-print_format', 'json', '-show_format', filePath],
      { env: pipelineSpawnOptions().env }
    )
    const data = JSON.parse(stdout) as { format?: { duration?: string } }
    const dur = Number(data?.format?.duration)
    return Number.isFinite(dur) && dur > 0 ? dur : null
  } catch {
    return null
  }
}

/** Saves a stream-bus recording (R3.REC1) to `<song>/recordings/<ISO-timestamp>.<ext>`. */
export async function saveRecording(
  songId: string,
  bytes: ArrayBuffer,
  ext: string
): Promise<string> {
  if (!EXT.test(ext)) throw new Error(`invalid recording extension: ${ext}`)
  const dir = join(songDir(songId), 'recordings')
  await mkdir(dir, { recursive: true })
  const filename = `${new Date().toISOString().replace(/[:.]/g, '-')}.${ext}`
  const file = join(dir, filename)
  await writeFile(file, Buffer.from(bytes))
  // Probe once here so listSongRecordings() never has to ffprobe this file.
  const durationSec = await probeDurationSec(file)
  if (durationSec !== null) {
    const cache = await readDurationCache(dir)
    cache[filename] = durationSec
    await writeDurationCache(dir, cache)
  }
  return file
}

async function listSongRecordings(songId: string): Promise<RecordingItem[]> {
  const dir = join(songDir(songId), 'recordings')
  let files: string[]
  try {
    files = (await readdir(dir)).filter((f) => REC_EXT.test(f))
  } catch {
    return []
  }
  const cache = await readDurationCache(dir)
  let cacheDirty = false
  const items = await Promise.all(
    files.map(async (filename) => {
      const path = join(dir, filename)
      const cached = cache[filename]
      const [info, durationSec] = await Promise.all([
        stat(path).catch(() => null),
        cached !== undefined ? cached : probeDurationSec(path) // legacy take, no cache entry yet
      ])
      if (cached === undefined && durationSec !== null) {
        cache[filename] = durationSec
        cacheDirty = true
      }
      return {
        path,
        songId,
        url: `karaoke://${songId}/recordings/${filename}`,
        filename,
        timestamp: info?.mtime.toISOString() ?? new Date(0).toISOString(),
        durationSec
      }
    })
  )
  if (cacheDirty) await writeDurationCache(dir, cache)
  return items
}

/** Lists recordings for a song (or all songs). Sorted newest first. */
export async function listRecordings(songId?: string): Promise<RecordingItem[]> {
  if (songId) {
    const items = await listSongRecordings(songId)
    return items.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
  }
  const { libraryDir } = getSettings()
  let entries: import('node:fs').Dirent[]
  try {
    entries = await readdir(libraryDir, { withFileTypes: true })
  } catch {
    return []
  }
  const songIds = entries.filter((e) => e.isDirectory()).map((e) => e.name)
  const all = await Promise.all(songIds.map(listSongRecordings))
  return all.flat().sort((a, b) => b.timestamp.localeCompare(a.timestamp))
}

function assertRecordingPath(filePath: string): void {
  const resolved = resolve(filePath)
  const libraryRoot = resolve(getSettings().libraryDir) + sep
  if (!resolved.startsWith(libraryRoot)) throw new Error('recording path outside library dir')
  if (!REC_EXT.test(resolved)) throw new Error('invalid recording file extension')
}

/** Permanently deletes a recording file. */
export async function deleteRecording(path: string): Promise<void> {
  assertRecordingPath(path)
  await unlink(path)
  const dir = dirname(path)
  const filename = basename(path)
  const cache = await readDurationCache(dir)
  if (filename in cache) {
    delete cache[filename]
    await writeDurationCache(dir, cache)
  }
}

/** Opens the folder containing a recording in the system file manager. */
export function revealRecording(path: string): void {
  assertRecordingPath(path)
  shell.showItemInFolder(path)
}
