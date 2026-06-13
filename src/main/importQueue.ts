import { type ChildProcess, spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { BrowserWindow } from 'electron'
import type { ImportProgress, ImportRequest, ImportStage, SongMeta } from '../shared/types'
import { notifyLibraryChanged } from './library'
import { pipelineScript } from './pipeline'
import { getSettings } from './settings'

interface Job {
  jobId: string
  songId: string
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

function sendProgress(job: Job, stage: ImportStage, progress: number, message?: string): void {
  broadcast({ jobId: job.jobId, songId: job.songId, stage, progress, message })
}

function generateSongId(): string {
  const now = new Date()
  const pad = (n: number): string => String(n).padStart(2, '0')
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  const rand = randomUUID().slice(0, 4)
  return `${date}-${time}-${rand}`
}

function songDir(songId: string): string {
  return join(getSettings().libraryDir, songId)
}

export async function startImport(req: ImportRequest): Promise<string> {
  const songId = generateSongId()
  const jobId = randomUUID()

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
    separationModel: '6_HP-Karaoke-UVR',
    enrichment: null
  }
  await mkdir(songDir(songId), { recursive: true })
  await writeFile(join(songDir(songId), 'meta.json'), JSON.stringify(meta, null, 2), 'utf-8')

  enqueue({ jobId, songId, url: req.url, filePath: req.filePath || null })
  notifyLibraryChanged()
  return jobId
}

export async function retryImport(songId: string): Promise<void> {
  const dir = songDir(songId)
  const meta = JSON.parse(await readFile(join(dir, 'meta.json'), 'utf-8')) as SongMeta
  await rm(join(dir, 'error.json'), { force: true })
  enqueue({ jobId: randomUUID(), songId, url: meta.youtubeUrl, filePath: meta.sourceFile ?? null })
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

function run(job: Job): void {
  const dir = songDir(job.songId)
  const source = job.filePath ? ['--file', job.filePath] : ['--url', job.url]
  const proc = spawn(
    getSettings().pythonPath,
    [pipelineScript(), 'process', ...source, '--out', dir, '--format', getSettings().stemFormat],
    { windowsHide: true }
  )
  activeProc = proc
  let lastError = ''
  let stderrTail = ''

  const rl = createInterface({ input: proc.stdout })
  rl.on('line', (line) => {
    let msg: {
      stage: string
      progress?: number
      message?: string
      durationSec?: number
    }
    try {
      msg = JSON.parse(line)
    } catch {
      return // non-JSON noise, ignore
    }
    if (msg.stage === 'done') {
      void finalizeDone(job, msg.durationSec ?? 0)
    } else if (msg.stage === 'error') {
      lastError = msg.message ?? 'import failed'
    } else {
      sendProgress(job, msg.stage as ImportStage, msg.progress ?? 0)
    }
  })

  proc.stderr?.on('data', (d: Buffer) => {
    stderrTail = (stderrTail + d.toString()).slice(-2000)
  })

  proc.on('close', (code) => {
    void (async () => {
      if (code !== 0) {
        const message =
          lastError || stderrTail.trim().split('\n').pop() || `pipeline exited ${code}`
        await writeFile(
          join(dir, 'error.json'),
          JSON.stringify({ message, at: new Date().toISOString() }, null, 2),
          'utf-8'
        ).catch(() => {})
        sendProgress(job, 'error', 0, message)
        notifyLibraryChanged()
      }
      active = null
      activeProc = null
      pump()
    })()
  })
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
