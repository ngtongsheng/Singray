import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { ImportProgress, InstallEvent, IpcChannel, IpcMap, SingrayApi } from '../shared/types'

function invoke<C extends IpcChannel>(
  channel: C,
  ...args: IpcMap[C]['args']
): Promise<IpcMap[C]['result']> {
  return ipcRenderer.invoke(channel, ...args)
}

const api: SingrayApi = {
  library: {
    list: () => invoke('library:list'),
    delete: (id) => invoke('library:delete', id),
    updateMeta: (id, patch) => invoke('library:updateMeta', id, patch),
    openFolder: (id) => invoke('library:openFolder', id)
  },
  lyrics: {
    get: (id) => invoke('lyrics:get', id),
    save: (id, lyrics) => invoke('lyrics:save', id, lyrics),
    align: (id, text) => invoke('lyrics:align', id, text),
    findLyrics: (query) => invoke('lyrics:findLyrics', query)
  },
  import: {
    probe: (url) => invoke('import:probe', url),
    probeFile: (path) => invoke('import:probeFile', path),
    pickFile: () => invoke('import:pickFile'),
    getPathForFile: (file) => webUtils.getPathForFile(file),
    search: (query) => invoke('import:search', query),
    start: (req) => invoke('import:start', req),
    retry: (id) => invoke('import:retry', id),
    onProgress: (cb) => {
      const listener = (_e: unknown, p: ImportProgress): void => cb(p)
      ipcRenderer.on('import:progress', listener)
      return () => ipcRenderer.removeListener('import:progress', listener)
    }
  },
  settings: {
    get: () => invoke('settings:get'),
    set: (patch) => invoke('settings:set', patch)
  },
  pipeline: {
    status: () => invoke('pipeline:status'),
    install: () => invoke('pipeline:install'),
    cancelInstall: () => invoke('pipeline:cancelInstall'),
    onInstallProgress: (cb) => {
      const listener = (_e: unknown, ev: InstallEvent): void => cb(ev)
      ipcRenderer.on('pipeline:install:progress', listener)
      return () => ipcRenderer.removeListener('pipeline:install:progress', listener)
    },
    listModels: (force) => invoke('pipeline:listModels', force)
  },
  llm: {
    test: () => invoke('llm:test'),
    listModels: (baseUrl, apiKey) => invoke('llm:listModels', baseUrl, apiKey),
    enrichProbe: (probe) => invoke('llm:enrichProbe', probe),
    cleanMeta: (input) => invoke('llm:cleanMeta', input),
    cleanLyrics: (input) => invoke('llm:cleanLyrics', input)
  },
  audio: {
    // Extensionless: the protocol handler resolves to flac or m4a per song (R3.8).
    url: (id, track) => `karaoke://${id}/${track}`,
    thumbUrl: (id) => `karaoke://${id}/thumb.jpg`
  },
  recordings: {
    save: (songId, bytes, ext) => invoke('recordings:save', songId, bytes, ext)
  },
  window: {
    minimize: () => invoke('window:minimize'),
    toggleMaximize: () => invoke('window:toggleMaximize'),
    close: () => invoke('window:close'),
    isMaximized: () => invoke('window:isMaximized'),
    openExternal: (url) => invoke('window:openExternal', url),
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
