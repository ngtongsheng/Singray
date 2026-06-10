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

export type ImportStage = 'download' | 'separate' | 'convert' | 'done' | 'error'

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
}

export type AudioTrack = 'original' | 'instrumental' | 'vocals'

/** Renderer-facing API exposed by the preload bridge. */
export interface SingrayApi {
  library: {
    list(): Promise<SongListItem[]>
    delete(id: string): Promise<void>
    updateMeta(id: string, patch: Partial<SongMeta>): Promise<SongMeta>
  }
  lyrics: {
    get(id: string): Promise<Lyrics | null>
    save(id: string, lyrics: Lyrics): Promise<void>
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
