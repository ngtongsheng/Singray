import type { ChildProcess } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { BrowserWindow } from 'electron'
import {
  type ImportProgress,
  type ImportRequest,
  type ImportStage,
  isImportPipelineLine,
  type JobId,
  type SongId,
  type SongMeta
} from '../shared/types'
import { notifyLibraryChanged } from './library'
import { pipelineScript } from './pipeline'
import { effectivePythonPath, pipelineSpawnOptions } from './pipelineEnv'
import { getSettings } from './settings'
import { lastStderrLine, spawnLines } from './spawnLines'

interface Job {
  jobId: JobId
  songId: SongId
  /** YouTube URL for a download import; empty when importing a local file. */
  url: string
  /** Local media path for a "From file" import (R3.7); null for URL imports. */
  filePath: string | null
}

const queue: Job[] = []
let active: Job | null = null
let activeProc: ChildProcess | null = null

function broadcast(progress: ImportProgress): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('import:progress', progress)
  }
}

function sendProgress(job: Job, stage: Exclude<ImportStage, 'error'>, progress: number): void {
  broadcast({ jobId: job.jobId, songId: job.songId, stage, progress })
}

function sendError(job: Job, message: string): void {
  broadcast({ jobId: job.jobId, songId: job.songId, stage: 'error', progress: 0, message })
}

function generateSongId(): SongId {
  const now = new Date()
  const pad = (n: number): string => String(n).padStart(2, '0')
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  const rand = randomUUID().slice(0, 4)
  return `${date}-${time}-${rand}` as SongId
}

function songDir(songId: string): string {
  return join(getSettings().libraryDir, songId)
}

export async function startImport(req: ImportRequest): Promise<string> {
  const songId = generateSongId()
  const jobId = randomUUID() as JobId

  const meta: SongMeta = {
    schemaVersion: 1,
    id: songId,
    title: req.title,
    artist: req.artist,
    language: req.language,
    youtubeUrl: req.url,
    youtubeTitle: req.youtubeTitle,
    durationSec: 0,
    addedAt: new Date().toISOString(),
    favorite: false,
    tags: [],
    playCount: 0,
    lastPlayedAt: null,
    sings: [],
    sourceFile: req.filePath || null,
    separationModel: getSettings().separationModel || '6_HP-Karaoke-UVR.pth',
    enrichment: null
  }
  await mkdir(songDir(songId), { recursive: true })
  await writeFile(join(songDir(songId), 'meta.json'), JSON.stringify(meta, null, 2), 'utf-8')

  enqueue({ jobId, songId, url: req.url, filePath: req.filePath || null })
  notifyLibraryChanged()
  return jobId
}

export async function retryImport(songId: string): Promise<void> {
  const id = songId as SongId
  const dir = songDir(id)
  const meta = JSON.parse(await readFile(join(dir, 'meta.json'), 'utf-8')) as SongMeta
  await rm(join(dir, 'error.json'), { force: true })
  enqueue({
    jobId: randomUUID() as JobId,
    songId: id,
    url: meta.youtubeUrl,
    filePath: meta.sourceFile ?? null
  })
  notifyLibraryChanged()
}

/** Drops a song from the queue; kills the pipeline if it is the active job. */
export function cancelImport(songId: string): void {
  const idx = queue.findIndex((j) => j.songId === songId)
  if (idx >= 0) queue.splice(idx, 1)
  if (active?.songId === songId) {
    activeProc?.kill()
  }
}

function enqueue(job: Job): void {
  queue.push(job)
  sendProgress(job, 'queued', 0)
  pump()
}

function pump(): void {
  if (active || queue.length === 0) return
  const job = queue.shift()
  if (!job) return
  active = job
  run(job)
}

async function failJob(job: Job, dir: string, message: string): Promise<void> {
  await writeFile(
    join(dir, 'error.json'),
    JSON.stringify({ message, at: new Date().toISOString() }, null, 2),
    'utf-8'
  ).catch(() => {})
  sendError(job, message)
  notifyLibraryChanged()
}

function releaseSlot(): void {
  active = null
  activeProc = null
  pump()
}

function run(job: Job): void {
  const dir = songDir(job.songId)
  const source = job.filePath ? ['--file', job.filePath] : ['--url', job.url]
  const settings = getSettings()
  const model = settings.separationModel || '6_HP-Karaoke-UVR.pth'
  let lastError = ''

  spawnLines(
    effectivePythonPath(),
    [
      pipelineScript(),
      'process',
      ...source,
      '--out',
      dir,
      '--model',
      model,
      '--format',
      settings.stemFormat
    ],
    {
      env: pipelineSpawnOptions().env,
      onProc: (p) => {
        activeProc = p
      },
      onLine: (line) => {
        let parsed: unknown
        try {
          parsed = JSON.parse(line)
        } catch {
          return // non-JSON noise, ignore
        }
        if (!isImportPipelineLine(parsed)) return
        if (parsed.stage === 'done') {
          void finalizeDone(job, parsed.durationSec ?? 0)
        } else if (parsed.stage === 'error') {
          lastError = parsed.message
        } else {
          sendProgress(job, parsed.stage, parsed.progress)
        }
      }
    }
  ).then(
    ({ code, stderrTail }) => {
      void (async () => {
        if (code !== 0) {
          await failJob(
            job,
            dir,
            lastError || lastStderrLine(stderrTail) || `pipeline exited ${code}`
          )
        }
        releaseSlot()
      })()
    },
    (err) => {
      void (async () => {
        await failJob(job, dir, (err as Error).message || 'pipeline failed to start')
        releaseSlot()
      })()
    }
  )
}

async function finalizeDone(job: Job, durationSec: number): Promise<void> {
  const metaPath = join(songDir(job.songId), 'meta.json')
  try {
    const meta = JSON.parse(await readFile(metaPath, 'utf-8')) as SongMeta
    meta.durationSec = durationSec
    await writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8')
  } catch {
    // meta gone (song deleted mid-import) — nothing to finalize
  }
  sendProgress(job, 'done', 1)
  notifyLibraryChanged()
}
