import { useEffect, useState } from 'react'
import type { Settings as SettingsModel } from '../../../shared/types'

/**
 * Single source for app settings (R3.DX1). A module-level cache is shared by
 * every consumer so a patch in one screen is reflected the next time another
 * screen mounts — no per-screen refetch. Optimistic: a patch updates the cache
 * (and all live subscribers) before the IPC round-trip resolves.
 */
let cache: SettingsModel | null = null
let inflight: Promise<SettingsModel> | null = null
const subscribers = new Set<(s: SettingsModel) => void>()

function emit(s: SettingsModel): void {
  cache = s
  for (const cb of subscribers) cb(s)
}

function load(): Promise<SettingsModel> {
  if (cache) return Promise.resolve(cache)
  if (!inflight) {
    inflight = window.singray.settings.get().then((s) => {
      inflight = null
      emit(s)
      return s
    })
  }
  return inflight
}

/** Patch settings, optimistically updating every live consumer. */
export async function patchSettings(p: Partial<SettingsModel>): Promise<SettingsModel> {
  if (cache) emit({ ...cache, ...p })
  const next = await window.singray.settings.set(p)
  emit(next)
  return next
}

export interface UseSettings {
  settings: SettingsModel | null
  patch: (p: Partial<SettingsModel>) => Promise<SettingsModel>
}

export function useSettings(): UseSettings {
  const [settings, setSettings] = useState<SettingsModel | null>(cache)

  useEffect(() => {
    subscribers.add(setSettings)
    if (cache) setSettings(cache)
    else void load()
    return () => {
      subscribers.delete(setSettings)
    }
  }, [])

  return { settings, patch: patchSettings }
}
