import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { songDir } from './library'

const EXT = /^[a-z0-9]+$/i

/** Saves a stream-bus recording (R3.REC1) to `<song>/recordings/<ISO-timestamp>.<ext>`. */
export async function saveRecording(
  songId: string,
  bytes: ArrayBuffer,
  ext: string
): Promise<string> {
  if (!EXT.test(ext)) throw new Error(`invalid recording extension: ${ext}`)
  const dir = join(songDir(songId), 'recordings')
  await mkdir(dir, { recursive: true })
  const file = join(dir, `${new Date().toISOString().replace(/[:.]/g, '-')}.${ext}`)
  await writeFile(file, Buffer.from(bytes))
  return file
}
