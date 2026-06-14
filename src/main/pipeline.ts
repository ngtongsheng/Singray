import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { app } from 'electron'
import type { AlignToken, ProbeResult, SearchResult } from '../shared/types'
import { songDir } from './library'
import { effectivePythonPath, pipelineEnvDir, pipelineSpawnOptions } from './pipelineEnv'

export function pipelineScript(): string {
  return join(app.getAppPath(), 'pipeline', 'pipeline.py')
}

/** Runs `pipeline.py probe --url <url>`, resolves with the one-line JSON result. */
export function probe(url: string): Promise<ProbeResult> {
  return runProbe(['probe', '--url', url])
}

/** Probe a local media file (`probe --file <path>`): duration + tag title/artist (R3.7). */
export function probeFile(path: string): Promise<ProbeResult> {
  return runProbe(['probe', '--file', path])
}

function runProbe(args: string[]): Promise<ProbeResult> {
  return new Promise((resolve, reject) => {
    const proc = spawn(effectivePythonPath(), [pipelineScript(), ...args], pipelineSpawnOptions())
    let stdout = ''
    let stderr = ''
    proc.stdout.on('data', (d: Buffer) => {
      stdout += d.toString()
    })
    proc.stderr.on('data', (d: Buffer) => {
      stderr += d.toString()
    })
    proc.on('error', reject)
    proc.on('close', (code) => {
      const lastLine = stdout.trim().split('\n').pop() ?? ''
      try {
        const parsed = JSON.parse(lastLine) as ProbeResult & { message?: string }
        if (code === 0) resolve(parsed)
        else reject(new Error(parsed.message ?? stderr))
      } catch {
        reject(new Error(stderr.trim() || `probe exited with code ${code}`))
      }
    })
  })
}

/** Runs `pipeline.py search --query <q>`, collects the JSON-lines hits. */
export function searchYoutube(query: string): Promise<SearchResult[]> {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      effectivePythonPath(),
      [pipelineScript(), 'search', '--query', query],
      pipelineSpawnOptions()
    )
    const results: SearchResult[] = []
    let lastError = ''
    let stderrTail = ''

    const rl = createInterface({ input: proc.stdout })
    rl.on('line', (line) => {
      let msg: (SearchResult & { stage?: string; message?: string }) | null
      try {
        msg = JSON.parse(line)
      } catch {
        return // non-JSON noise, ignore
      }
      if (msg?.stage === 'error') lastError = msg.message ?? 'search failed'
      else if (msg?.url) results.push(msg)
    })
    proc.stderr?.on('data', (d: Buffer) => {
      stderrTail = (stderrTail + d.toString()).slice(-2000)
    })
    proc.on('error', reject)
    proc.on('close', (code) => {
      if (code === 0 && !lastError) resolve(results)
      else
        reject(
          new Error(
            lastError || stderrTail.trim().split('\n').pop() || `search exited with code ${code}`
          )
        )
    })
  })
}

/** Cache path for the model list (populated on first query, refreshed on demand). */
function modelCachePath(): string {
  return join(pipelineEnvDir(), '.model-cache.json')
}

/**
 * List available separation models from audio-separator's registry.
 * Caches to a JSON file so the UI can show the list quickly.
 * Pass `force=true` to re-query the pipeline (ignoring cache).
 */
export async function listPipelineModels(force = false): Promise<string[]> {
  if (!force) {
    try {
      const raw = await readFile(modelCachePath(), 'utf-8')
      const cached = JSON.parse(raw) as { models: string[] }
      if (cached.models?.length) return cached.models
    } catch {
      // cache missing or corrupt — re-query
    }
  }

  try {
    const result = await new Promise<string[]>((resolve, reject) => {
      const proc = spawn(
        effectivePythonPath(),
        [pipelineScript(), 'list-models'],
        pipelineSpawnOptions()
      )
      let models: string[] | null = null
      let stderrTail = ''
      const rl = createInterface({ input: proc.stdout })
      rl.on('line', (line) => {
        try {
          const msg = JSON.parse(line) as { stage: string; models?: string[]; message?: string }
          if (msg.stage === 'done' && msg.models) models = msg.models
        } catch {
          // non-JSON noise, ignore
        }
      })
      proc.stderr?.on('data', (d: Buffer) => {
        stderrTail = (stderrTail + d.toString()).slice(-2000)
      })
      proc.on('error', reject)
      proc.on('close', (code) => {
        if (code === 0 && models) resolve(models)
        else reject(new Error(stderrTail.trim().split('\n').pop() || 'list-models failed'))
      })
    })
    // Cache the result
    await mkdir(pipelineEnvDir(), { recursive: true })
    await writeFile(modelCachePath(), JSON.stringify({ models: result }, null, 2), 'utf-8')
    return result
  } catch {
    // Fallback: return just the default model
    return ['6_HP-Karaoke-UVR.pth']
  }
}

/**
 * Runs `pipeline.py align --song <dir> --text <tmpfile>` (SPEC §6.6).
 * Resolves with the token list from the final "done" line; rejects on any
 * failure (caller treats alignment as best-effort and falls back to tap mode).
 */
export async function alignLyrics(id: string, text: string): Promise<AlignToken[]> {
  const dir = songDir(id)
  const tmp = join(app.getPath('temp'), `singray-align-${randomUUID()}.txt`)
  await writeFile(tmp, text, 'utf-8')

  try {
    return await new Promise<AlignToken[]>((resolve, reject) => {
      const proc = spawn(
        effectivePythonPath(),
        [pipelineScript(), 'align', '--song', dir, '--text', tmp],
        pipelineSpawnOptions()
      )
      let tokens: AlignToken[] | null = null
      let lastError = ''
      let stderrTail = ''

      const rl = createInterface({ input: proc.stdout })
      rl.on('line', (line) => {
        let msg: { stage: string; tokens?: AlignToken[]; message?: string }
        try {
          msg = JSON.parse(line)
        } catch {
          return // non-JSON noise, ignore
        }
        if (msg.stage === 'done' && msg.tokens) tokens = msg.tokens
        else if (msg.stage === 'error') lastError = msg.message ?? 'alignment failed'
      })
      proc.stderr?.on('data', (d: Buffer) => {
        stderrTail = (stderrTail + d.toString()).slice(-2000)
      })
      proc.on('error', reject)
      proc.on('close', (code) => {
        if (code === 0 && tokens) resolve(tokens)
        else
          reject(
            new Error(
              lastError || stderrTail.trim().split('\n').pop() || `align exited with code ${code}`
            )
          )
      })
    })
  } finally {
    await rm(tmp, { force: true })
  }
}
