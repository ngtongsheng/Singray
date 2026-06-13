import { existsSync } from 'node:fs'
import { delimiter, join } from 'node:path'
import { app } from 'electron'
import { getSettings } from './settings'

/**
 * App-managed pipeline environment (R4.3). The bootstrapper installs python +
 * deps + ffmpeg under userData so a fresh machine needs no manual setup; the
 * `pythonPath` setting becomes an advanced override only.
 */
export function pipelineEnvDir(): string {
  return join(app.getPath('userData'), 'pipeline-env')
}

export function uvDir(): string {
  return join(pipelineEnvDir(), 'uv')
}

export function uvBin(): string {
  return join(uvDir(), process.platform === 'win32' ? 'uv.exe' : 'uv')
}

export function venvDir(): string {
  return join(pipelineEnvDir(), 'venv')
}

/** Interpreter inside the managed venv. */
export function managedPythonPath(): string {
  return process.platform === 'win32'
    ? join(venvDir(), 'Scripts', 'python.exe')
    : join(venvDir(), 'bin', 'python')
}

export function managedFfmpegDir(): string {
  return join(pipelineEnvDir(), 'ffmpeg')
}

function ffmpegExe(): string {
  return process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
}

/** True when ffmpeg is reachable on the system PATH. */
export function ffmpegOnPath(): boolean {
  const path = process.env.PATH ?? ''
  return path.split(delimiter).some((dir) => dir && existsSync(join(dir, ffmpegExe())))
}

export function managedFfmpegPresent(): boolean {
  return existsSync(join(managedFfmpegDir(), ffmpegExe()))
}

/**
 * Interpreter the pipeline should run with: an existing advanced override wins,
 * else the managed venv. Falls back to the override/managed path even when
 * missing so the spawn fails with a readable ENOENT rather than silently.
 */
export function effectivePythonPath(): string {
  const override = getSettings().pythonPath.trim()
  if (override && existsSync(override)) return override
  const managed = managedPythonPath()
  if (existsSync(managed)) return managed
  return override || managed
}

/**
 * Spawn options for pipeline child processes: hides the console window on
 * Windows and prepends the managed ffmpeg dir to PATH when ffmpeg isn't already
 * on the system PATH (so the pipeline finds the bootstrapped binary).
 */
export function pipelineSpawnOptions(): { windowsHide: true; env: NodeJS.ProcessEnv } {
  const env: NodeJS.ProcessEnv = { ...process.env }
  if (!ffmpegOnPath() && managedFfmpegPresent()) {
    env.PATH = managedFfmpegDir() + delimiter + (env.PATH ?? '')
  }
  return { windowsHide: true, env }
}
