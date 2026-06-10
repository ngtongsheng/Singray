import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { app } from 'electron'
import type { ProbeResult } from '../shared/types'
import { getSettings } from './settings'

export function pipelineScript(): string {
  return join(app.getAppPath(), 'pipeline', 'pipeline.py')
}

/** Runs `pipeline.py probe --url <url>`, resolves with the one-line JSON result. */
export function probe(url: string): Promise<ProbeResult> {
  return new Promise((resolve, reject) => {
    const proc = spawn(getSettings().pythonPath, [pipelineScript(), 'probe', '--url', url], {
      windowsHide: true
    })
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
