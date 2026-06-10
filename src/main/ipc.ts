import { ipcMain } from 'electron'
import type { ImportRequest, Lyrics, Settings, SongMeta } from '../shared/types'
import { deleteSong, listSongs, updateMeta } from './library'
import { getSettings, setSettings } from './settings'

function notImplemented(channel: string): never {
  throw new Error(`${channel}: not implemented yet`)
}

/** Registers all IPC handlers (SPEC §8). Lyrics/import are stubs until Phase 1–2. */
export function registerIpc(): void {
  ipcMain.handle('settings:get', (): Settings => getSettings())
  ipcMain.handle('settings:set', (_e, patch: Partial<Settings>): Settings => setSettings(patch))

  ipcMain.handle('library:list', () => listSongs())
  ipcMain.handle('library:delete', (_e, id: string) => deleteSong(id))
  ipcMain.handle('library:updateMeta', (_e, id: string, patch: Partial<SongMeta>) =>
    updateMeta(id, patch)
  )

  ipcMain.handle('lyrics:get', (): Lyrics | null => null)
  ipcMain.handle('lyrics:save', (): void => notImplemented('lyrics:save'))

  ipcMain.handle('import:probe', (_e, _url: string) => notImplemented('import:probe'))
  ipcMain.handle('import:start', (_e, _req: ImportRequest) => notImplemented('import:start'))
  ipcMain.handle('import:retry', (_e, _id: string) => notImplemented('import:retry'))
}
