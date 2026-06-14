// Single source of truth for types shared by main / preload / renderer (SPEC §8).

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
  /** Stage visual: whole-song waveform with playhead, live analyser bars, or none. */
  stageVisual: 'off' | 'waveform' | 'bars'
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

export type ImportStage = 'queued' | 'download' | 'separate' | 'convert' | 'done' | 'error'

export interface ImportProgress {
  jobId: string
  songId: string
  stage: ImportStage
  /** 0..1 within the current stage. */
  progress: number
  /** Present when stage = "error". */
  message?: string
}

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

/** One LRCLIB candidate (R3.5). `syncedLyrics` is an LRC string when present. */
export interface LrclibHit {
  id: number
  trackName: string
  artistName: string
  albumName: string
  duration: number
  instrumental: boolean
  plainLyrics: string | null
  syncedLyrics: string | null
}

export type AudioTrack = 'original' | 'instrumental' | 'vocals'

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

/** Progress event streamed from the bootstrapper to the install UI (R4.3). */
export interface InstallEvent {
  step: InstallStep
  status: 'start' | 'progress' | 'done' | 'error'
  /** 0..1 within the step, when known (downloads). */
  pct?: number
  message?: string
}

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
  window: {
    /** Custom titlebar controls (NAV1): replace the native min/max/close. */
    minimize(): void
    toggleMaximize(): void
    close(): void
    isMaximized(): Promise<boolean>
    onMaximizedChange(cb: (maximized: boolean) => void): () => void
  }
  onLibraryChanged(cb: () => void): () => void
}
