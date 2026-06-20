import { type ChildProcess, spawn } from 'node:child_process'
import { createInterface } from 'node:readline'

export interface SpawnLinesOptions {
  env?: NodeJS.ProcessEnv
  onLine?: (line: string) => void
  onProc?: (proc: ChildProcess) => void
}

export interface SpawnLinesResult {
  code: number
  stderrTail: string
}

/**
 * Spawn a process, stream stdout line-by-line to `onLine`, and capture the
 * last ~2000 chars of stderr. Resolves with the exit code + stderr tail;
 * rejects only on a spawn-level error (e.g. ENOENT). Callers decide what
 * counts as success from `code`/`stderrTail`/whatever `onLine` collected.
 */
export function spawnLines(
  exe: string,
  args: string[],
  opts: SpawnLinesOptions = {}
): Promise<SpawnLinesResult> {
  return new Promise((resolve, reject) => {
    const proc = spawn(exe, args, { windowsHide: true, env: opts.env ?? process.env })
    opts.onProc?.(proc)
    let stderrTail = ''
    const rl = createInterface({ input: proc.stdout })
    rl.on('line', (line) => opts.onLine?.(line))
    proc.stderr?.on('data', (d: Buffer) => {
      stderrTail = (stderrTail + d.toString()).slice(-2000)
    })
    proc.on('error', reject)
    proc.on('close', (code) => resolve({ code: code ?? 0, stderrTail }))
  })
}

/** Last non-empty line of a captured stderr tail, for error messages. */
export function lastStderrLine(tail: string): string {
  return tail.trim().split('\n').pop() ?? ''
}
