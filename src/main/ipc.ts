import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import {
  type ImportRequest,
  type InstallEvent,
  type LrclibQuery,
  type Lyrics,
  MEDIA_EXTENSIONS,
  type ProbeResult,
  type Settings,
  type SongMeta
} from '../shared/types'
import { cancelInstall, installPipeline, pipelineStatus } from './bootstrap'
import { cleanLyrics, cleanMeta, enrichProbe } from './enrich'
import { cancelImport, retryImport, startImport } from './importQueue'
import { deleteSong, getLyrics, listSongs, openSongFolder, saveLyrics, updateMeta } from './library'
import { listLlmModels, testLlm } from './llm'
import { findLyrics } from './lyricsFinder'
import { alignLyrics, listPipelineModels, probe, probeFile, searchYoutube } from './pipeline'
import { saveRecording } from './recordings'
import { getSettings, setSettings } from './settings'

/** Registers all IPC handlers (SPEC §8). */
export function registerIpc(): void {
  ipcMain.handle('settings:get', (): Settings => getSettings())
  ipcMain.handle('settings:set', (_e, patch: Partial<Settings>): Settings => setSettings(patch))

  ipcMain.handle('library:list', () => listSongs())
  ipcMain.handle('library:delete', (_e, id: string) => {
    cancelImport(id)
    return deleteSong(id)
  })
  ipcMain.handle('library:updateMeta', (_e, id: string, patch: Partial<SongMeta>) =>
    updateMeta(id, patch)
  )
  ipcMain.handle('library:openFolder', (_e, id: string) => openSongFolder(id))

  ipcMain.handle('lyrics:get', (_e, id: string) => getLyrics(id))
  ipcMain.handle('lyrics:save', (_e, id: string, lyrics: Lyrics) => saveLyrics(id, lyrics))
  ipcMain.handle('lyrics:align', (_e, id: string, text: string) => alignLyrics(id, text))
  ipcMain.handle('lyrics:findLyrics', (_e, query: LrclibQuery) => findLyrics(query))

  ipcMain.handle('llm:test', () => testLlm())
  ipcMain.handle('llm:listModels', (_e, baseUrl: string, apiKey: string) =>
    listLlmModels(baseUrl, apiKey)
  )
  ipcMain.handle('llm:enrichProbe', (_e, probe: ProbeResult) => enrichProbe(probe))
  ipcMain.handle(
    'llm:cleanMeta',
    (_e, input: { title: string; artist: string; youtubeTitle: string }) => cleanMeta(input)
  )
  ipcMain.handle('llm:cleanLyrics', (_e, input: { text: string; language: string }) =>
    cleanLyrics(input)
  )

  ipcMain.handle('import:probe', (_e, url: string) => probe(url))
  ipcMain.handle('import:probeFile', (_e, path: string) => probeFile(path))
  ipcMain.handle('import:pickFile', async () => {
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
  ipcMain.handle('import:search', (_e, query: string) => searchYoutube(query))
  ipcMain.handle('import:start', (_e, req: ImportRequest) => startImport(req))
  ipcMain.handle('import:retry', (_e, id: string) => retryImport(id))

  ipcMain.handle('pipeline:listModels', (_e, force?: boolean) => listPipelineModels(force ?? false))

  ipcMain.handle('pipeline:status', () => pipelineStatus())
  ipcMain.handle('pipeline:install', (e) => {
    const emit = (ev: InstallEvent): void => {
      if (!e.sender.isDestroyed()) e.sender.send('pipeline:install:progress', ev)
    }
    return installPipeline(emit)
  })
  ipcMain.handle('pipeline:cancelInstall', () => cancelInstall())

  ipcMain.handle('window:minimize', (e) => BrowserWindow.fromWebContents(e.sender)?.minimize())
  ipcMain.handle('window:toggleMaximize', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  })
  ipcMain.handle('window:close', (e) => BrowserWindow.fromWebContents(e.sender)?.close())
  ipcMain.handle(
    'window:isMaximized',
    (e) => BrowserWindow.fromWebContents(e.sender)?.isMaximized() ?? false
  )
  ipcMain.handle('window:openExternal', (_e, url: string) => shell.openExternal(url))

  ipcMain.handle('recordings:save', (_e, songId: string, bytes: ArrayBuffer, ext: string) =>
    saveRecording(songId, bytes, ext)
  )
}
