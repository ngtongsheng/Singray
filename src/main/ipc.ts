import { ipcMain } from 'electron'
import type { ImportRequest, Lyrics, Settings, SongMeta } from '../shared/types'
import { cancelImport, retryImport, startImport } from './importQueue'
import { deleteSong, getLyrics, listSongs, openSongFolder, saveLyrics, updateMeta } from './library'
import { alignLyrics, probe } from './pipeline'
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

  ipcMain.handle('import:probe', (_e, url: string) => probe(url))
  ipcMain.handle('import:start', (_e, req: ImportRequest) => startImport(req))
  ipcMain.handle('import:retry', (_e, id: string) => retryImport(id))
}
