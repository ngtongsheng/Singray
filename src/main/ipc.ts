import type { IpcMainInvokeEvent } from 'electron'
import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { type InstallEvent, type IpcChannel, type IpcMap, MEDIA_EXTENSIONS } from '../shared/types'
import { cancelInstall, installPipeline, pipelineStatus } from './bootstrap'
import { cleanLyrics, cleanMeta, enrichProbe } from './enrich'
import { cancelImport, retryImport, startImport } from './importQueue'
import {
  deleteSong,
  getLyrics,
  listSongs,
  openSongFolder,
  saveLyrics,
  searchArtwork,
  setThumbFromUrl,
  updateMeta,
  uploadThumb
} from './library'
import { listLlmModels, testLlm } from './llm'
import { findLyrics } from './lyricsFinder'
import { alignLyrics, listPipelineModels, probe, probeFile, searchYoutube } from './pipeline'
import { deleteRecording, listRecordings, revealRecording, saveRecording } from './recordings'
import { getSettings, setSettings } from './settings'

function handle<C extends IpcChannel>(
  channel: C,
  listener: (
    e: IpcMainInvokeEvent,
    ...args: IpcMap[C]['args']
  ) => IpcMap[C]['result'] | Promise<IpcMap[C]['result']>
): void {
  ipcMain.handle(channel, listener)
}

/** Registers all IPC handlers (SPEC §8). */
export function registerIpc(): void {
  handle('settings:get', () => getSettings())
  handle('settings:set', (_e, patch) => setSettings(patch))

  handle('library:list', () => listSongs())
  handle('library:delete', (_e, id) => {
    cancelImport(id)
    return deleteSong(id)
  })
  handle('library:updateMeta', (_e, id, patch) => updateMeta(id, patch))
  handle('library:openFolder', (_e, id) => openSongFolder(id))
  handle('library:uploadThumb', (_e, id, bytes) => uploadThumb(id, bytes))
  handle('library:setThumbFromUrl', (_e, id, url) => setThumbFromUrl(id, url))
  handle('library:searchArtwork', (_e, query) => searchArtwork(query))

  handle('lyrics:get', (_e, id) => getLyrics(id))
  handle('lyrics:save', (_e, id, lyrics) => saveLyrics(id, lyrics))
  handle('lyrics:align', (_e, id, text) => alignLyrics(id, text))
  handle('lyrics:findLyrics', (_e, query) => findLyrics(query))

  handle('llm:test', () => testLlm())
  handle('llm:listModels', (_e, provider, baseUrl, apiKey) =>
    listLlmModels(provider, baseUrl, apiKey)
  )
  handle('llm:enrichProbe', (_e, probe) => enrichProbe(probe))
  handle('llm:cleanMeta', (_e, input) => cleanMeta(input))
  handle('llm:cleanLyrics', (_e, input) => cleanLyrics(input))

  handle('import:probe', (_e, url) => probe(url))
  handle('import:probeFile', (_e, path) => probeFile(path))
  handle('import:pickFile', async () => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    const result = await dialog.showOpenDialog(win as BrowserWindow, {
      title: 'Import audio or video file',
      properties: ['openFile'],
      filters: [
        { name: 'Media', extensions: [...MEDIA_EXTENSIONS] },
        { name: 'All files', extensions: ['*'] }
      ]
    })
    return result.canceled ? null : (result.filePaths[0] ?? null)
  })
  handle('import:search', (_e, query) => searchYoutube(query))
  handle('import:start', (_e, req) => startImport(req))
  handle('import:retry', (_e, id) => retryImport(id))

  handle('pipeline:listModels', (_e, force) => listPipelineModels(force ?? false))

  handle('pipeline:status', () => pipelineStatus())
  handle('pipeline:install', (e) => {
    const emit = (ev: InstallEvent): void => {
      if (!e.sender.isDestroyed()) e.sender.send('pipeline:install:progress', ev)
    }
    return installPipeline(emit)
  })
  handle('pipeline:cancelInstall', () => cancelInstall())

  handle('window:minimize', (e) => BrowserWindow.fromWebContents(e.sender)?.minimize())
  handle('window:toggleMaximize', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  })
  handle('window:close', (e) => BrowserWindow.fromWebContents(e.sender)?.close())
  handle(
    'window:isMaximized',
    (e) => BrowserWindow.fromWebContents(e.sender)?.isMaximized() ?? false
  )
  handle('window:openExternal', (_e, url) => shell.openExternal(url))

  handle('recordings:save', (_e, songId, bytes, ext) => saveRecording(songId, bytes, ext))
  handle('recordings:list', (_e, songId) => listRecordings(songId))
  handle('recordings:delete', (_e, path) => deleteRecording(path))
  handle('recordings:reveal', (_e, path) => revealRecording(path))
}
