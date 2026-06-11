// Single source of truth for types shared by main / preload / renderer (SPEC §8).

export type Language = 'zh' | 'en' | 'ja' | 'ko' | 'unknown'

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
  playCount: number
  lastPlayedAt: string | null
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
}

export interface ProbeResult {
  title: string
  channel: string
  track: string | null
  artist: string | null
  duration: number
  thumbnailUrl: string
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
  }
  import: {
    probe(url: string): Promise<ProbeResult>
    start(req: ImportRequest): Promise<string>
    retry(id: string): Promise<void>
    onProgress(cb: (p: ImportProgress) => void): () => void
  }
  settings: {
    get(): Promise<Settings>
    set(patch: Partial<Settings>): Promise<Settings>
  }
  audio: {
    url(id: string, track: AudioTrack): string
    thumbUrl(id: string): string
  }
  onLibraryChanged(cb: () => void): () => void
}
