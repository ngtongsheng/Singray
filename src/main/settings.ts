import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import type { Settings } from '../shared/types'

function defaults(): Settings {
  return {
    libraryDir: join(app.getPath('home'), 'Karaoke'),
    pythonPath: join(app.getAppPath(), 'pipeline', '.venv', 'Scripts', 'python.exe'),
    monitorDeviceId: '',
    streamDeviceId: '',
    audioOutputMode: 'single'
  }
}

function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

let cache: Settings | null = null

export function getSettings(): Settings {
  if (cache) return cache
  let stored: Partial<Settings> = {}
  try {
    stored = JSON.parse(readFileSync(settingsPath(), 'utf-8')) as Partial<Settings>
  } catch {
    // missing or corrupt file → defaults
  }
  cache = { ...defaults(), ...stored }
  return cache
}

export function setSettings(patch: Partial<Settings>): Settings {
  const next = { ...getSettings(), ...patch }
  cache = next
  mkdirSync(app.getPath('userData'), { recursive: true })
  writeFileSync(settingsPath(), JSON.stringify(next, null, 2), 'utf-8')
  return next
}
