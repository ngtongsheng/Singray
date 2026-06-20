// Single source of truth for types shared by main / preload / renderer (SPEC §8).
// Runtime-validated types live in schemas.ts and are re-exported here for import compat.
import type { ImportPipelineLine, ImportStage, LrclibHit, MicFxPreset } from './schemas'

export type { ImportPipelineLine, ImportStage, LrclibHit, MicFxPreset }

/** File extensions accepted by "From file" import (R3.7 picker filter + ADD2 drop zone). */
export const MEDIA_EXTENSIONS = [
  'mp4',
  'm4a',
  'mp3',
  'flac',
  'wav',
  'ogg',
  'opus',
  'webm',
  'aac',
  'mkv',
  'mov'
] as const

/**
 * Language code from the user-editable list in Settings (R2.4), or 'unknown'.
 * Free-form so removing a language from Settings never invalidates song metas.
 */
export type Language = string

/** One entry of the editable language list (Settings → Languages). */
export interface LanguageDef {
  code: Language
  label: string
}

export interface SongMeta {
  schemaVersion: 1
  id: string
  title: string
  artist: string
  language: Language
  youtubeUrl: string
  youtubeTitle: string
  durationSec: number
  addedAt: string
  favorite: boolean
  tags: string[]
  /** Legacy open-count from MVP (S3.3) — kept as a sort floor, no longer written. */
  playCount: number
  /** Legacy — superseded by the last `sings` entry, no longer written. */
  lastPlayedAt: string | null
  /** ISO timestamps, one appended per session that crosses ≥60% accumulated playback (R1.5). */
  sings: string[]
  /** Local source path for file imports (R3.7); null for URL imports. Used to retry. */
  sourceFile: string | null
  separationModel: string
  enrichment: null
}

/** Library listing payload: meta + per-song derived state the cards need. */
export interface SongListItem extends SongMeta {
  hasLyrics: boolean
  /** Error message from a failed import (error.json), else null. */
  error: string | null
  /** True when original.m4a exists (import finished successfully at some point). */
  ready: boolean
}

export interface LyricUnit {
  text: string
  /** Unit start in seconds; null until stamped/aligned. */
  t: number | null
  /** True when `t` was interpolated from an LRC line/word timestamp, not stamped/aligned (R3.4). */
  estimated?: boolean
}

export interface LyricLine {
  /** Line start in seconds; null for break markers and untimed lines. */
  start: number | null
  end: number | null
  text: string
  units: LyricUnit[]
}

export interface Lyrics {
  schemaVersion: 1
  language: Language
  lines: LyricLine[]
}

export interface Settings {
  libraryDir: string
  pythonPath: string
  monitorDeviceId: string
  streamDeviceId: string
  audioOutputMode: 'single' | 'dual'
  /** Player control bar: pinned (always visible) vs auto-hide after inactivity. */
  playerBarPinned: boolean
  /** Top-strip waveform visualization (whole-song peaks + playhead). */
  showWaveform: boolean
  /** Bottom bars visualization (live analyser). */
  showBars: boolean
  /** Stem encode format for new imports (R3.8): flac = lossless (default), m4a = AAC 256k. */
  stemFormat: 'flac' | 'm4a'
  /** Library Songs view layout (HOME1): grid of cards vs compact rows. */
  libraryView: 'grid' | 'list'
  /** Editable language list (R2.4): drives import form, library filter chips, alignment. */
  languages: LanguageDef[]
  /** UI locale (R2.5): a folder name under src/renderer/locales, or '' = follow OS. */
  uiLanguage: string
  /** OpenAI-compatible chat endpoint base URL (R3.1), e.g. http://localhost:11434/v1 for Ollama. */
  llmBaseUrl: string
  /** Model name passed to the endpoint, e.g. "gemma4:12b-it-qat" or "gpt-4o-mini". */
  llmModel: string
  /** Bearer token for hosted endpoints; '' = none (local Ollama needs no key). */
  llmApiKey: string
  /** UVR separation model filename for new imports (e.g. "6_HP-Karaoke-UVR.pth"). */
  separationModel: string
  /** Container format for R3.REC1 MediaRecorder sessions. */
  recordingFormat: 'webm' | 'wav'
  /** R3.MIC4: audioinput device, '' = system default. */
  micDeviceId: string
  /** R3.MIC4: build mic graph when player loads. */
  micEnabled: boolean
  /** R3.MIC2: monitor leg audible (false = AG06 hardware-monitor case). */
  micMonitor: boolean
  /** R3.MIC2: mic gain 0..1, both legs. */
  micVolume: number
  /** R3.MIC3: FX preset. */
  micFxPreset: MicFxPreset
  /** R3.MIC3: wet/dry 0..1. */
  micFxAmount: number
  /** Lead-in countdown seconds before the first lyric word on play-from-start (0 = off). */
  countdownLead: number
}

/** Cleaned title/artist from metadata enrichment (R3.2). */
export interface EnrichResult {
  title: string
  artist: string
  /** 'llm' when the model produced it; 'heuristic' when the fallback fired (unreachable/slow). */
  source: 'llm' | 'heuristic'
}

/** Result of a successful LLM round-trip test (R3.1). */
export interface LlmTestResult {
  model: string
  reply: string
  ms: number
}

export interface ProbeResult {
  title: string
  channel: string
  track: string | null
  artist: string | null
  duration: number
  thumbnailUrl: string
}

/** One `pipeline.py search` hit (flat extraction — enough to pick from, no full probe yet). */
export interface SearchResult {
  title: string
  channel: string
  duration: number
  thumbnailUrl: string
  url: string
}

/**
 * Branded ids for the import queue (R3.7): both are plain strings on the wire,
 * but the brand stops `jobId`/`songId` — same primitive type, easy to swap at a
 * call site — from being passed to each other's parameter by accident. Cast
 * once where each is minted (importQueue.ts); everywhere else they flow
 * through ordinary string-typed reads (a branded string is still a string).
 */
export type SongId = string & { readonly __brand: 'SongId' }
export type JobId = string & { readonly __brand: 'JobId' }

interface ImportProgressBase {
  jobId: JobId
  songId: SongId
  /** 0..1 within the current stage. */
  progress: number
}

/** Stage carries an error message only when stage = "error" (R3.7 progress events). */
export type ImportProgress =
  | (ImportProgressBase & { stage: Exclude<ImportStage, 'error'> })
  | (ImportProgressBase & { stage: 'error'; message: string })

export interface ImportRequest {
  url: string
  title: string
  artist: string
  language: Language
  /** Raw YouTube title, kept in meta.json for future re-enrichment. */
  youtubeTitle: string
  /** Local media path for a "From file" import (R3.7); omitted/empty for URL imports. */
  filePath?: string
}

/** One aligned token from `pipeline.py align` (SPEC §6.6): CJK char or Latin word. */
export interface AlignToken {
  text: string
  /** Token start in seconds; null when the aligner could not place it. */
  start: number | null
  /** Aligner confidence 0..1; null when unaligned. */
  score: number | null
}

/** What to search LRCLIB with (R3.5) — pulled from the song's meta. */
export interface LrclibQuery {
  title: string
  artist: string
  durationSec: number
}

export type AudioTrack = 'original' | 'instrumental' | 'vocals'

/** One saved performance recording (R3.REC2). */
export interface RecordingItem {
  /** Absolute filesystem path — used for delete/reveal operations. */
  path: string
  songId: string
  /** karaoke:// playback URL. */
  url: string
  /** Basename of the file. */
  filename: string
  /** ISO timestamp derived from file mtime. */
  timestamp: string
  durationSec: number | null
}

/** Pipeline environment readiness (R4.3 bootstrapper). */
export interface PipelineStatus {
  /** Both python + ffmpeg resolvable → imports can run. */
  ready: boolean
  /** Resolved python interpreter exists (managed venv or advanced override). */
  python: boolean
  /** ffmpeg available — on PATH or in the app-managed dir. */
  ffmpeg: boolean
  /** nvidia-smi present → CUDA wheels will be installed. */
  gpu: boolean
  /** Where the interpreter comes from. */
  pythonSource: 'managed' | 'override' | 'none'
  /** Where ffmpeg comes from. */
  ffmpegSource: 'path' | 'managed' | 'none'
  /** An install is currently running. */
  installing: boolean
}

/** One step of the bootstrapper install (R4.3). */
export type InstallStep = 'uv' | 'venv' | 'torch' | 'deps' | 'ffmpeg' | 'verify'

/**
 * Progress event streamed from the bootstrapper to the install UI (R4.3).
 * `start`/`error` always carry a message; `progress` carries pct and/or a log line;
 * `done` carries an optional note (e.g. "Already installed").
 */
export type InstallEvent =
  | { step: InstallStep; status: 'start'; message: string }
  | { step: InstallStep; status: 'progress'; pct?: number; message?: string }
  | { step: InstallStep; status: 'done'; message?: string }
  | { step: InstallStep; status: 'error'; message: string }

/** Renderer-facing API exposed by the preload bridge. */
export interface SingrayApi {
  library: {
    list(): Promise<SongListItem[]>
    delete(id: string): Promise<void>
    updateMeta(id: string, patch: Partial<SongMeta>): Promise<SongMeta>
    openFolder(id: string): Promise<void>
  }
  lyrics: {
    get(id: string): Promise<Lyrics | null>
    save(id: string, lyrics: Lyrics): Promise<void>
    /** Forced alignment of lyric text against the vocals stem (SPEC §6.6). Slow; rejects on failure. */
    align(id: string, text: string): Promise<AlignToken[]>
    /** Search LRCLIB for synced/plain lyrics (R3.5); rejects with a readable message on no network. */
    findLyrics(query: LrclibQuery): Promise<LrclibHit[]>
  }
  import: {
    probe(url: string): Promise<ProbeResult>
    /** Probe a local media file for duration + tag title/artist prefill (R3.7). */
    probeFile(path: string): Promise<ProbeResult>
    /** Native open dialog for a local audio/video file; resolves the path or null if cancelled (R3.7). */
    pickFile(): Promise<string | null>
    /** Resolves a dropped File's absolute filesystem path (ADD2 drag-and-drop). */
    getPathForFile(file: File): string
    /** ytsearch10 for the query; rejects with a readable message on bad query / no network. */
    search(query: string): Promise<SearchResult[]>
    start(req: ImportRequest): Promise<string>
    retry(id: string): Promise<void>
    onProgress(cb: (p: ImportProgress) => void): () => void
  }
  settings: {
    get(): Promise<Settings>
    set(patch: Partial<Settings>): Promise<Settings>
  }
  pipeline: {
    /** Current readiness of the python/ffmpeg environment (R4.3). */
    status(): Promise<PipelineStatus>
    /** Run the guided install (download python via uv, deps, ffmpeg); resolves when done, rejects on failure. */
    install(): Promise<void>
    /** Abort an in-flight install. */
    cancelInstall(): Promise<void>
    /** Subscribe to install progress events; returns an unsubscribe fn. */
    onInstallProgress(cb: (e: InstallEvent) => void): () => void
    /** List available separation models from audio-separator's registry. */
    listModels(force?: boolean): Promise<string[]>
  }
  llm: {
    /** Round-trips a tiny prompt through the configured endpoint; rejects with a readable message. */
    test(): Promise<LlmTestResult>
    /** Lists available models from the configured OpenAI-compat /v1/models endpoint; rejects readably. */
    listModels(baseUrl: string, apiKey: string): Promise<string[]>
    /** Cleans probe metadata for import prefill; falls back to the heuristic parser, never rejects. */
    enrichProbe(probe: ProbeResult): Promise<EnrichResult>
    /** "Clean up with AI" on an existing song; rejects with a readable message. */
    cleanMeta(input: { title: string; artist: string; youtubeTitle: string }): Promise<EnrichResult>
    /** Cleans pasted lyrics (strip section tags/credits, normalize breaks); rejects readably (R3.6). */
    cleanLyrics(input: { text: string; language: string }): Promise<string>
  }
  audio: {
    url(id: string, track: AudioTrack): string
    thumbUrl(id: string): string
  }
  recordings: {
    /** Saves a performance recording (R3.REC1) under the song's recordings/ folder; resolves the saved path. */
    save(songId: string, bytes: ArrayBuffer, ext: string): Promise<string>
    /** Lists recordings for a song, or all recordings across the library if songId is omitted. */
    list(songId?: string): Promise<RecordingItem[]>
    /** Permanently deletes a recording file. */
    delete(path: string): Promise<void>
    /** Opens the folder containing the recording in the system file manager. */
    reveal(path: string): Promise<void>
  }
  window: {
    /** Custom titlebar controls (NAV1): replace the native min/max/close. */
    minimize(): void
    toggleMaximize(): void
    close(): void
    isMaximized(): Promise<boolean>
    onMaximizedChange(cb: (maximized: boolean) => void): () => void
    /** Open a URL in the system default browser (R3.SNG4). */
    openExternal(url: string): void
  }
  onLibraryChanged(cb: () => void): () => void
}

/**
 * Single source of truth for `ipcMain.handle`/`ipcRenderer.invoke` channel signatures
 * (SPEC §8). Both `src/preload/index.ts` and `src/main/ipc.ts` type their wrappers against
 * this map, so a channel/arg/result mismatch between the two ends is a compile error
 * instead of a silent runtime one.
 */
// biome-ignore lint/suspicious/noConfusingVoidType: named alias for "no result", referenced (not redeclared) at each IpcMap entry below
type NoResult = void

export interface IpcMap {
  'settings:get': { args: []; result: Settings }
  'settings:set': { args: [patch: Partial<Settings>]; result: Settings }

  'library:list': { args: []; result: SongListItem[] }
  'library:delete': { args: [id: string]; result: NoResult }
  'library:updateMeta': { args: [id: string, patch: Partial<SongMeta>]; result: SongMeta }
  'library:openFolder': { args: [id: string]; result: NoResult }

  'lyrics:get': { args: [id: string]; result: Lyrics | null }
  'lyrics:save': { args: [id: string, lyrics: Lyrics]; result: NoResult }
  'lyrics:align': { args: [id: string, text: string]; result: AlignToken[] }
  'lyrics:findLyrics': { args: [query: LrclibQuery]; result: LrclibHit[] }

  'llm:test': { args: []; result: LlmTestResult }
  'llm:listModels': { args: [baseUrl: string, apiKey: string]; result: string[] }
  'llm:enrichProbe': { args: [probe: ProbeResult]; result: EnrichResult }
  'llm:cleanMeta': {
    args: [input: { title: string; artist: string; youtubeTitle: string }]
    result: EnrichResult
  }
  'llm:cleanLyrics': { args: [input: { text: string; language: string }]; result: string }

  'import:probe': { args: [url: string]; result: ProbeResult }
  'import:probeFile': { args: [path: string]; result: ProbeResult }
  'import:pickFile': { args: []; result: string | null }
  'import:search': { args: [query: string]; result: SearchResult[] }
  'import:start': { args: [req: ImportRequest]; result: string }
  'import:retry': { args: [id: string]; result: NoResult }

  'pipeline:listModels': { args: [force?: boolean]; result: string[] }
  'pipeline:status': { args: []; result: PipelineStatus }
  'pipeline:install': { args: []; result: NoResult }
  'pipeline:cancelInstall': { args: []; result: NoResult }

  'window:minimize': { args: []; result: NoResult }
  'window:toggleMaximize': { args: []; result: NoResult }
  'window:close': { args: []; result: NoResult }
  'window:isMaximized': { args: []; result: boolean }
  'window:openExternal': { args: [url: string]; result: NoResult }

  'recordings:save': { args: [songId: string, bytes: ArrayBuffer, ext: string]; result: string }
  'recordings:list': { args: [songId?: string]; result: RecordingItem[] }
  'recordings:delete': { args: [path: string]; result: NoResult }
  'recordings:reveal': { args: [path: string]; result: NoResult }
}

export type IpcChannel = keyof IpcMap
