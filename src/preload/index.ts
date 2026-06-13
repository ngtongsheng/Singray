import { contextBridge, ipcRenderer } from 'electron'
import type {
  AlignToken,
  AudioTrack,
  EnrichResult,
  ImportProgress,
  ImportRequest,
  InstallEvent,
  LlmTestResult,
  LrclibHit,
  LrclibQuery,
  Lyrics,
  PipelineStatus,
  ProbeResult,
  SearchResult,
  Settings,
  SingrayApi,
  SongListItem,
  SongMeta
} from '../shared/types'

const api: SingrayApi = {
  library: {
    list: () => ipcRenderer.invoke('library:list') as Promise<SongListItem[]>,
    delete: (id) => ipcRenderer.invoke('library:delete', id) as Promise<void>,
    updateMeta: (id, patch) =>
      ipcRenderer.invoke('library:updateMeta', id, patch) as Promise<SongMeta>,
    openFolder: (id) => ipcRenderer.invoke('library:openFolder', id) as Promise<void>
  },
  lyrics: {
    get: (id) => ipcRenderer.invoke('lyrics:get', id) as Promise<Lyrics | null>,
    save: (id, lyrics) => ipcRenderer.invoke('lyrics:save', id, lyrics) as Promise<void>,
    align: (id, text) => ipcRenderer.invoke('lyrics:align', id, text) as Promise<AlignToken[]>,
    findLyrics: (query: LrclibQuery) =>
      ipcRenderer.invoke('lyrics:findLyrics', query) as Promise<LrclibHit[]>
  },
  import: {
    probe: (url) => ipcRenderer.invoke('import:probe', url) as Promise<ProbeResult>,
    probeFile: (path) => ipcRenderer.invoke('import:probeFile', path) as Promise<ProbeResult>,
    pickFile: () => ipcRenderer.invoke('import:pickFile') as Promise<string | null>,
    search: (query) => ipcRenderer.invoke('import:search', query) as Promise<SearchResult[]>,
    start: (req: ImportRequest) => ipcRenderer.invoke('import:start', req) as Promise<string>,
    retry: (id) => ipcRenderer.invoke('import:retry', id) as Promise<void>,
    onProgress: (cb) => {
      const listener = (_e: unknown, p: ImportProgress): void => cb(p)
      ipcRenderer.on('import:progress', listener)
      return () => ipcRenderer.removeListener('import:progress', listener)
    }
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get') as Promise<Settings>,
    set: (patch) => ipcRenderer.invoke('settings:set', patch) as Promise<Settings>
  },
  pipeline: {
    status: () => ipcRenderer.invoke('pipeline:status') as Promise<PipelineStatus>,
    install: () => ipcRenderer.invoke('pipeline:install') as Promise<void>,
    cancelInstall: () => ipcRenderer.invoke('pipeline:cancelInstall') as Promise<void>,
    onInstallProgress: (cb) => {
      const listener = (_e: unknown, ev: InstallEvent): void => cb(ev)
      ipcRenderer.on('pipeline:install:progress', listener)
      return () => ipcRenderer.removeListener('pipeline:install:progress', listener)
    }
  },
  llm: {
    test: () => ipcRenderer.invoke('llm:test') as Promise<LlmTestResult>,
    enrichProbe: (probe) => ipcRenderer.invoke('llm:enrichProbe', probe) as Promise<EnrichResult>,
    cleanMeta: (input) => ipcRenderer.invoke('llm:cleanMeta', input) as Promise<EnrichResult>,
    cleanLyrics: (input) => ipcRenderer.invoke('llm:cleanLyrics', input) as Promise<string>
  },
  audio: {
    // Extensionless: the protocol handler resolves to flac or m4a per song (R3.8).
    url: (id: string, track: AudioTrack) => `karaoke://${id}/${track}`,
    thumbUrl: (id: string) => `karaoke://${id}/thumb.jpg`
  },
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize') as Promise<void>,
    toggleMaximize: () => ipcRenderer.invoke('window:toggleMaximize') as Promise<void>,
    close: () => ipcRenderer.invoke('window:close') as Promise<void>,
    isMaximized: () => ipcRenderer.invoke('window:isMaximized') as Promise<boolean>,
    onMaximizedChange: (cb) => {
      const listener = (_e: unknown, maximized: boolean): void => cb(maximized)
      ipcRenderer.on('window:maximized-changed', listener)
      return () => ipcRenderer.removeListener('window:maximized-changed', listener)
    }
  },
  onLibraryChanged: (cb) => {
    const listener = (): void => cb()
    ipcRenderer.on('library:changed', listener)
    return () => ipcRenderer.removeListener('library:changed', listener)
  }
}

contextBridge.exposeInMainWorld('singray', api)
