import { contextBridge, ipcRenderer } from 'electron'
import type {
  AlignToken,
  AudioTrack,
  EnrichResult,
  ImportProgress,
  ImportRequest,
  LlmTestResult,
  Lyrics,
  ProbeResult,
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
    align: (id, text) => ipcRenderer.invoke('lyrics:align', id, text) as Promise<AlignToken[]>
  },
  import: {
    probe: (url) => ipcRenderer.invoke('import:probe', url) as Promise<ProbeResult>,
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
  llm: {
    test: () => ipcRenderer.invoke('llm:test') as Promise<LlmTestResult>,
    enrichProbe: (probe) => ipcRenderer.invoke('llm:enrichProbe', probe) as Promise<EnrichResult>,
    cleanMeta: (input) => ipcRenderer.invoke('llm:cleanMeta', input) as Promise<EnrichResult>
  },
  audio: {
    url: (id: string, track: AudioTrack) => `karaoke://${id}/${track}.m4a`,
    thumbUrl: (id: string) => `karaoke://${id}/thumb.jpg`
  },
  onLibraryChanged: (cb) => {
    const listener = (): void => cb()
    ipcRenderer.on('library:changed', listener)
    return () => ipcRenderer.removeListener('library:changed', listener)
  }
}

contextBridge.exposeInMainWorld('singray', api)
