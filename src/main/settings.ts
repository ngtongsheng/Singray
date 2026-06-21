import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app, safeStorage } from 'electron'
import { LlmProviderSchema, MicFxPresetSchema } from '../shared/schemas'
import type { Settings } from '../shared/types'

function defaults(): Settings {
  return {
    libraryDir: join(app.getPath('home'), 'Karaoke'),
    // Blank = use the app-managed venv (pipelineEnv.ts); effectivePythonPath() falls
    // back to it. A hardcoded path here is wrong on every platform but the one it
    // names, and stale even on Windows (pre-R4.3 in-repo pipeline/.venv).
    pythonPath: '',
    monitorDeviceId: '',
    streamDeviceId: '',
    audioOutputMode: 'single',
    playerBarPinned: true,
    showWaveform: false,
    showBars: false,
    stemFormat: 'flac',
    libraryView: 'grid',
    languages: [
      { code: 'zh', label: '中文' },
      { code: 'en', label: 'English' }
    ],
    uiLanguage: '',
    llmProvider: 'ollama',
    llmBaseUrl: 'http://localhost:11434/v1',
    llmModel: '',
    llmApiKey: '',
    separationModel: '6_HP-Karaoke-UVR.pth',
    recordingFormat: 'webm',
    micDeviceId: '',
    micEnabled: false,
    micMonitor: true,
    micVolume: 1,
    micFxPreset: 'off',
    micFxAmount: 0.3,
    countdownLead: 3
  }
}

function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

/** Decrypts an at-rest llmApiKey. A failed decrypt is treated as a legacy
 *  plaintext key (written before safeStorage support) rather than an error. */
function decryptApiKey(stored: string): { value: string; wasEncrypted: boolean } {
  try {
    return { value: safeStorage.decryptString(Buffer.from(stored, 'base64')), wasEncrypted: true }
  } catch {
    return { value: stored, wasEncrypted: false }
  }
}

function encryptApiKey(plain: string): string {
  // No OS keychain available (e.g. some headless Linux) — fall back to plaintext
  // rather than losing the key.
  return plain && safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(plain).toString('base64')
    : plain
}

function writeToDisk(settings: Settings): void {
  mkdirSync(app.getPath('userData'), { recursive: true })
  const onDisk: Settings = { ...settings, llmApiKey: encryptApiKey(settings.llmApiKey) }
  writeFileSync(settingsPath(), JSON.stringify(onDisk, null, 2), 'utf-8')
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
  if (
    stored.micFxPreset !== undefined &&
    !MicFxPresetSchema.safeParse(stored.micFxPreset).success
  ) {
    delete stored.micFxPreset
  }
  if (
    stored.llmProvider !== undefined &&
    !LlmProviderSchema.safeParse(stored.llmProvider).success
  ) {
    delete stored.llmProvider
  }

  let migrateApiKey = false
  if (stored.llmApiKey) {
    const decrypted = decryptApiKey(stored.llmApiKey)
    stored.llmApiKey = decrypted.value
    // Only migrate when encryption is available now — a decrypt failure while
    // encryption is unavailable means "can't read it yet", not "it's plaintext",
    // and rewriting would clobber the real (still-encrypted) key on disk.
    if (!decrypted.wasEncrypted && safeStorage.isEncryptionAvailable()) migrateApiKey = true
  }

  cache = { ...defaults(), ...stored }
  if (migrateApiKey) writeToDisk(cache) // upgrade a legacy plaintext key to encrypted-at-rest
  return cache
}

export function setSettings(patch: Partial<Settings>): Settings {
  const next = { ...getSettings(), ...patch }
  cache = next
  writeToDisk(next)
  return next
}
