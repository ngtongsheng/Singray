import type { ChildProcess } from 'node:child_process'
import { createWriteStream, existsSync } from 'node:fs'
import { chmod, copyFile, mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline as streamPipeline } from 'node:stream/promises'
import type { InstallEvent, InstallStep, PipelineStatus } from '../shared/types'
import {
  ffmpegOnPath,
  managedFfmpegDir,
  managedFfmpegPresent,
  managedPythonPath,
  pipelineEnvDir,
  uvBin,
  uvDir,
  venvDir
} from './pipelineEnv'
import { getSettings } from './settings'
import { lastStderrLine, spawnLines } from './spawnLines'

// Pinned to match pipeline/setup.ps1 (SPEC §2.1). The +cu128 tag is load-bearing
// on GPU machines — a bare ==2.8.0 is "satisfied" by a CPU build.
const TORCH = ['torch==2.8.0', 'torchvision==0.23.0', 'torchaudio==2.8.0']
const CUDA_INDEX = 'https://download.pytorch.org/whl/cu128'
const CPU_INDEX = 'https://download.pytorch.org/whl/cpu'
const PY_VERSION = '3.13'

type Emit = (e: InstallEvent) => void

// ── install state (resume across restarts) ──────────────────────────────────

interface InstallState {
  steps: Partial<Record<InstallStep, boolean>>
}

function statePath(): string {
  return join(pipelineEnvDir(), '.install-state.json')
}

async function readState(): Promise<InstallState> {
  try {
    return JSON.parse(await readFile(statePath(), 'utf-8')) as InstallState
  } catch {
    return { steps: {} }
  }
}

async function markStep(step: InstallStep): Promise<void> {
  const state = await readState()
  state.steps[step] = true
  await writeFile(statePath(), JSON.stringify(state, null, 2), 'utf-8')
}

// ── cancellation ─────────────────────────────────────────────────────────────

let installing = false
let cancelled = false
let abort: AbortController | null = null
const liveProcs = new Set<ChildProcess>()

export function cancelInstall(): void {
  cancelled = true
  abort?.abort()
  for (const p of liveProcs) p.kill()
}

// ── platform asset maps ──────────────────────────────────────────────────────

function uvAssetUrl(): string {
  const base = 'https://github.com/astral-sh/uv/releases/latest/download'
  const triple =
    process.platform === 'win32'
      ? 'x86_64-pc-windows-msvc.zip'
      : process.platform === 'darwin'
        ? `${process.arch === 'arm64' ? 'aarch64' : 'x86_64'}-apple-darwin.tar.gz`
        : 'x86_64-unknown-linux-gnu.tar.gz'
  return `${base}/uv-${triple}`
}

/**
 * ffmpeg static-build source. Windows/Linux ship a single archive containing
 * both binaries; macOS (evermeet) serves one zip per tool (R5.1).
 */
type FfmpegAsset =
  | { kind: 'archive'; url: string }
  | { kind: 'binaries'; urls: Record<'ffmpeg' | 'ffprobe', string> }

function ffmpegAsset(): FfmpegAsset {
  if (process.platform === 'win32')
    return {
      kind: 'archive',
      url: 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip'
    }
  if (process.platform === 'linux')
    return {
      kind: 'archive',
      url: 'https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz'
    }
  // darwin: evermeet.cx serves single-binary zips per tool.
  return {
    kind: 'binaries',
    urls: {
      ffmpeg: 'https://evermeet.cx/ffmpeg/getrelease/ffmpeg/zip',
      ffprobe: 'https://evermeet.cx/ffmpeg/getrelease/ffprobe/zip'
    }
  }
}

// ── primitives ───────────────────────────────────────────────────────────────

function throwIfCancelled(): void {
  if (cancelled) throw new Error('Install cancelled')
}

/** Stream a download to `dest`, writing to `<dest>.part` first so an interrupted
 *  transfer never looks complete (clean retry). Reports byte progress. */
async function download(url: string, dest: string, emit: (pct?: number) => void): Promise<void> {
  throwIfCancelled()
  abort = new AbortController()
  const res = await fetch(url, { signal: abort.signal, redirect: 'follow' })
  if (!res.ok || !res.body) throw new Error(`Download failed (${res.status}) for ${url}`)
  const total = Number(res.headers.get('content-length') ?? 0)
  let received = 0
  const part = `${dest}.part`
  const out = createWriteStream(part)
  const reader = res.body.getReader()
  const source = new Readable({
    async read() {
      try {
        const { done, value } = await reader.read()
        if (done) {
          this.push(null)
          return
        }
        received += value.byteLength
        if (total) emit(received / total)
        this.push(Buffer.from(value))
      } catch (err) {
        this.destroy(err as Error)
      }
    }
  })
  await streamPipeline(source, out)
  throwIfCancelled()
  await rename(part, dest)
}

/** Extract a .zip / .tar.gz / .tar.xz using bsdtar (ships with Windows 10+, macOS, Linux). */
async function extract(archive: string, destDir: string): Promise<void> {
  await mkdir(destDir, { recursive: true })
  await run('tar', ['-xf', archive, '-C', destDir])
}

/** Recursively find the first file whose basename matches `name` (with platform exe suffix). */
async function findBinary(dir: string, name: string): Promise<string | null> {
  const target = process.platform === 'win32' ? `${name}.exe` : name
  let entries: import('node:fs').Dirent[]
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return null
  }
  for (const e of entries) {
    const full = join(dir, e.name)
    if (e.isDirectory()) {
      const found = await findBinary(full, name)
      if (found) return found
    } else if (e.name === target) {
      return full
    }
  }
  return null
}

/** Spawn a command, reject on non-zero exit; tracked for cancellation. */
function run(
  exe: string,
  args: string[],
  opts: { env?: NodeJS.ProcessEnv; onLine?: (line: string) => void } = {}
): Promise<void> {
  throwIfCancelled()
  let proc: ChildProcess | undefined
  return spawnLines(exe, args, {
    env: opts.env ?? process.env,
    onLine: opts.onLine,
    onProc: (p) => {
      proc = p
      liveProcs.add(p)
    }
  }).then(
    ({ code, stderrTail }) => {
      if (proc) liveProcs.delete(proc)
      if (code === 0) return
      if (cancelled) throw new Error('Install cancelled')
      throw new Error(lastStderrLine(stderrTail) || `${exe} exited with code ${code}`)
    },
    (err) => {
      if (proc) liveProcs.delete(proc)
      throw err
    }
  )
}

/** nvidia-smi present → install CUDA wheels. */
function hasNvidiaGpu(): Promise<boolean> {
  return run('nvidia-smi', ['-L'])
    .then(() => true)
    .catch(() => false)
}

// ── status ───────────────────────────────────────────────────────────────────

export async function pipelineStatus(): Promise<PipelineStatus> {
  const override = getSettings().pythonPath.trim()
  const overrideOk = !!override && existsSync(override)
  const managedOk = existsSync(managedPythonPath())
  const python = overrideOk || managedOk
  const onPath = ffmpegOnPath()
  const managedFf = managedFfmpegPresent()
  return {
    ready: python && (onPath || managedFf),
    python,
    ffmpeg: onPath || managedFf,
    gpu: await hasNvidiaGpu(),
    pythonSource: overrideOk ? 'override' : managedOk ? 'managed' : 'none',
    ffmpegSource: onPath ? 'path' : managedFf ? 'managed' : 'none',
    installing
  }
}

// ── install steps ──────────────────────────────────────────────────────────

async function stepUv(emit: Emit): Promise<void> {
  if (existsSync(uvBin())) return
  emit({ step: 'uv', status: 'start', message: 'Downloading uv…' })
  await mkdir(uvDir(), { recursive: true })
  const url = uvAssetUrl()
  const archive = join(uvDir(), url.endsWith('.zip') ? 'uv.zip' : 'uv.tar.gz')
  await download(url, archive, (pct) => emit({ step: 'uv', status: 'progress', pct }))
  await extract(archive, uvDir())
  const bin = await findBinary(uvDir(), 'uv')
  if (!bin) throw new Error('uv binary not found after extraction')
  if (bin !== uvBin()) {
    await copyFile(bin, uvBin())
    if (process.platform !== 'win32') await chmod(uvBin(), 0o755)
  }
  await rm(archive, { force: true })
}

async function stepVenv(emit: Emit): Promise<void> {
  if (existsSync(managedPythonPath())) return
  emit({ step: 'venv', status: 'start', message: `Installing Python ${PY_VERSION}…` })
  // uv venv downloads a managed CPython if none is found, then builds the venv.
  await run(uvBin(), ['venv', '--python', PY_VERSION, venvDir()], {
    env: { ...process.env, UV_PYTHON_INSTALL_DIR: join(pipelineEnvDir(), 'python') }
  })
}

async function stepTorch(emit: Emit, gpu: boolean): Promise<void> {
  emit({
    step: 'torch',
    status: 'start',
    message: gpu ? 'Installing PyTorch (CUDA 12.8)…' : 'Installing PyTorch (CPU)…'
  })
  await run(
    uvBin(),
    [
      'pip',
      'install',
      '--python',
      managedPythonPath(),
      ...TORCH,
      '--index-url',
      gpu ? CUDA_INDEX : CPU_INDEX
    ],
    { onLine: (line) => emit({ step: 'torch', status: 'progress', message: line }) }
  )
}

async function stepDeps(emit: Emit, gpu: boolean): Promise<void> {
  emit({ step: 'deps', status: 'start', message: 'Installing audio-separator, yt-dlp, whisperx…' })
  await run(
    uvBin(),
    [
      'pip',
      'install',
      '--python',
      managedPythonPath(),
      `audio-separator[${gpu ? 'gpu' : 'cpu'}]==0.44.2`,
      'yt-dlp==2026.6.9',
      'whisperx==3.8.6'
    ],
    { onLine: (line) => emit({ step: 'deps', status: 'progress', message: line }) }
  )
}

async function installFfmpegBinary(tool: 'ffmpeg' | 'ffprobe', url: string): Promise<void> {
  const dir = managedFfmpegDir()
  const archive = join(dir, `${tool}.zip`)
  await download(url, archive, () => {})
  const tmp = join(dir, `extract-${tool}`)
  await extract(archive, tmp)
  const bin = await findBinary(tmp, tool)
  if (!bin) throw new Error(`${tool} not found in archive`)
  const out = join(dir, tool)
  await copyFile(bin, out)
  await chmod(out, 0o755)
  await rm(archive, { force: true })
  await rm(tmp, { recursive: true, force: true })
}

async function stepFfmpeg(emit: Emit): Promise<void> {
  // Don't short-circuit on ffmpegOnPath(): a packaged macOS app launched from
  // Finder doesn't inherit the login-shell PATH, so a system ffmpeg visible at
  // install time may be invisible at runtime (#128). The managed copy is the
  // only source we control end-to-end, so always install it (idempotent on the
  // managed binary alone).
  if (managedFfmpegPresent()) return
  emit({ step: 'ffmpeg', status: 'start', message: 'Downloading ffmpeg…' })
  const dir = managedFfmpegDir()
  await mkdir(dir, { recursive: true })
  const asset = ffmpegAsset()
  if (asset.kind === 'binaries') {
    // macOS: one zip per tool (evermeet).
    await installFfmpegBinary('ffmpeg', asset.urls.ffmpeg)
    await installFfmpegBinary('ffprobe', asset.urls.ffprobe)
    return
  }
  const archive = join(dir, asset.url.endsWith('.zip') ? 'ffmpeg.zip' : 'ffmpeg.tar.xz')
  await download(asset.url, archive, (pct) => emit({ step: 'ffmpeg', status: 'progress', pct }))
  const tmp = join(dir, 'extract')
  await extract(archive, tmp)
  for (const tool of ['ffmpeg', 'ffprobe']) {
    const bin = await findBinary(tmp, tool)
    if (!bin) throw new Error(`${tool} not found in ffmpeg archive`)
    const out = join(dir, process.platform === 'win32' ? `${tool}.exe` : tool)
    await copyFile(bin, out)
    if (process.platform !== 'win32') await chmod(out, 0o755)
  }
  await rm(archive, { force: true })
  await rm(tmp, { recursive: true, force: true })
}

async function stepVerify(emit: Emit, gpu: boolean): Promise<void> {
  emit({ step: 'verify', status: 'start', message: 'Verifying install…' })
  // Confirm torch imports (and CUDA is live on GPU boxes).
  const check = gpu
    ? "import torch; assert torch.cuda.is_available(), 'CUDA not available'; print('cuda', torch.cuda.get_device_name(0))"
    : 'import torch; print(torch.__version__)'
  await run(managedPythonPath(), ['-c', check], {
    onLine: (line) => emit({ step: 'verify', status: 'progress', message: line })
  })
}

/**
 * Whether a recorded step's artifact is still on disk, for steps with a cheap
 * check. Returns `null` for steps without one (torch/deps install into the venv
 * with no single sentinel file — we trust their recorded flag). Guards against a
 * stale `.install-state.json` claiming a step done after its output was removed
 * or never produced — e.g. ffmpeg marked done with no managed binary (#128).
 */
function artifactPresent(step: InstallStep): boolean | null {
  switch (step) {
    case 'uv':
      return existsSync(uvBin())
    case 'venv':
      return existsSync(managedPythonPath())
    case 'ffmpeg':
      return managedFfmpegPresent()
    default:
      return null
  }
}

/**
 * Guided install of the whole pipeline env (R4.3). Idempotent + resumable: each
 * completed step is recorded and skipped on a re-run, and downloads write to a
 * `.part` file so an interrupted transfer is re-fetched cleanly.
 */
export async function installPipeline(emit: Emit): Promise<void> {
  if (installing) throw new Error('Install already running')
  installing = true
  cancelled = false
  try {
    await mkdir(pipelineEnvDir(), { recursive: true })
    const state = await readState()
    const gpu = await hasNvidiaGpu()

    const steps: [InstallStep, () => Promise<void>][] = [
      ['uv', () => stepUv(emit)],
      ['venv', () => stepVenv(emit)],
      ['torch', () => stepTorch(emit, gpu)],
      ['deps', () => stepDeps(emit, gpu)],
      ['ffmpeg', () => stepFfmpeg(emit)],
      ['verify', () => stepVerify(emit, gpu)]
    ]

    for (const [name, fn] of steps) {
      throwIfCancelled()
      // Skip a recorded step only when its artifact is actually still present;
      // a stale flag whose output is gone (artifactPresent === false) re-runs.
      if (state.steps[name] && name !== 'verify' && artifactPresent(name) !== false) {
        emit({ step: name, status: 'done', message: 'Already installed' })
        continue
      }
      try {
        await fn()
        await markStep(name)
        emit({ step: name, status: 'done' })
      } catch (err) {
        emit({ step: name, status: 'error', message: (err as Error).message })
        throw err
      }
    }
  } finally {
    installing = false
  }
}
