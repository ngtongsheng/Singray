import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app } from 'electron'
import type { AlignToken, ProbeResult, SearchResult } from '../shared/types'
import { songDir } from './library'
import { effectivePythonPath, pipelineEnvDir, pipelineSpawnOptions } from './pipelineEnv'
import { lastStderrLine, spawnLines } from './spawnLines'

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
  let lastLine = ''
  return spawnLines(effectivePythonPath(), [pipelineScript(), ...args], {
    env: pipelineSpawnOptions().env,
    onLine: (line) => {
      if (line.trim()) lastLine = line
    }
  }).then(({ code, stderrTail }) => {
    let parsed: (ProbeResult & { message?: string }) | undefined
    try {
      parsed = JSON.parse(lastLine)
    } catch {
      // non-JSON output — fall through to the stderr-based error below
    }
    if (code === 0 && parsed) return parsed
    if (parsed?.message) throw new Error(parsed.message)
    throw new Error(lastStderrLine(stderrTail) || `probe exited with code ${code}`)
  })
}

/** Runs `pipeline.py search --query <q>`, collects the JSON-lines hits. */
export function searchYoutube(query: string): Promise<SearchResult[]> {
  const results: SearchResult[] = []
  let lastError = ''
  return spawnLines(effectivePythonPath(), [pipelineScript(), 'search', '--query', query], {
    env: pipelineSpawnOptions().env,
    onLine: (line) => {
      let msg: (SearchResult & { stage?: string; message?: string }) | null
      try {
        msg = JSON.parse(line)
      } catch {
        return // non-JSON noise, ignore
      }
      if (msg?.stage === 'error') lastError = msg.message ?? 'search failed'
      else if (msg?.url) results.push(msg)
    }
  }).then(({ code, stderrTail }) => {
    if (code === 0 && !lastError) return results
    throw new Error(lastError || lastStderrLine(stderrTail) || `search exited with code ${code}`)
  })
}

/** Cache path for the model list (populated on first query, refreshed on demand). */
function modelCachePath(): string {
  return join(pipelineEnvDir(), '.model-cache.json')
}

/**
 * List available separation models from the pipeline (local dir + registry).
 * Caches to a JSON file so the UI can show the list quickly.
 * Pass `force=true` to re-query the pipeline (ignoring cache).
 * Errors propagate to the caller so `useAsync` preserves the last good value.
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

  let models: string[] | null = null
  const { code, stderrTail } = await spawnLines(
    effectivePythonPath(),
    [pipelineScript(), 'list-models'],
    {
      env: pipelineSpawnOptions().env,
      onLine: (line) => {
        try {
          const msg = JSON.parse(line) as { stage: string; models?: string[]; message?: string }
          if (msg.stage === 'done' && msg.models) models = msg.models
        } catch {
          // non-JSON noise, ignore
        }
      }
    }
  )
  if (!(code === 0 && models)) throw new Error(lastStderrLine(stderrTail) || 'list-models failed')

  // Cache the result
  await mkdir(pipelineEnvDir(), { recursive: true })
  await writeFile(modelCachePath(), JSON.stringify({ models }, null, 2), 'utf-8')
  return models
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
    let tokens: AlignToken[] | null = null
    let lastError = ''
    const { code, stderrTail } = await spawnLines(
      effectivePythonPath(),
      [pipelineScript(), 'align', '--song', dir, '--text', tmp],
      {
        env: pipelineSpawnOptions().env,
        onLine: (line) => {
          let msg: { stage: string; tokens?: AlignToken[]; message?: string }
          try {
            msg = JSON.parse(line)
          } catch {
            return // non-JSON noise, ignore
          }
          if (msg.stage === 'done' && msg.tokens) tokens = msg.tokens
          else if (msg.stage === 'error') lastError = msg.message ?? 'alignment failed'
        }
      }
    )
    if (code === 0 && tokens) return tokens
    throw new Error(lastError || lastStderrLine(stderrTail) || `align exited with code ${code}`)
  } finally {
    await rm(tmp, { force: true })
  }
}
