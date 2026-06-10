import { ipcMain } from 'electron'
import type { ImportRequest, Lyrics, Settings, SongMeta } from '../shared/types'
import { cancelImport, retryImport, startImport } from './importQueue'
import { deleteSong, listSongs, updateMeta } from './library'
import { probe } from './pipeline'
import { getSettings, setSettings } from './settings'

function notImplemented(channel: string): never {
  throw new Error(`${channel}: not implemented yet`)
}

/** Registers all IPC handlers (SPEC §8). Lyrics/import are stubs until Phase 1–2. */
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

  ipcMain.handle('lyrics:get', (): Lyrics | null => null)
  ipcMain.handle('lyrics:save', (): void => notImplemented('lyrics:save'))

  ipcMain.handle('import:probe', (_e, url: string) => probe(url))
  ipcMain.handle('import:start', (_e, req: ImportRequest) => startImport(req))
  ipcMain.handle('import:retry', (_e, id: string) => retryImport(id))
}
