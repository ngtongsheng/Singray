// Single source of truth for types shared by main / preload / renderer (SPEC §8).

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
  onLibraryChanged(cb: () => void): () => void
}
