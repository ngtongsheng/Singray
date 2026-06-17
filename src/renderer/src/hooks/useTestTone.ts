import { useState } from 'react'
import type { Settings } from '../../../shared/types'
import { setSink } from '../lib/sinkable'

/** Play a short sine tone on a specific output device ('' = system default). */
async function playTestTone(deviceId: string, freq: number): Promise<void> {
  const ctx = new AudioContext()
  try {
    await setSink(ctx, deviceId)
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.02)
    gain.gain.setValueAtTime(0.25, ctx.currentTime + 0.8)
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 1)
    await new Promise<void>((resolve) => {
      osc.onended = () => resolve()
    })
  } finally {
    void ctx.close()
  }
}

interface Result {
  toneBusy: 'monitor' | 'stream' | null
  toneError: string | null
  testTone: (which: 'monitor' | 'stream') => Promise<void>
}

/** Two-pitch ear-check (440Hz monitor / 660Hz stream) so misrouting is obvious by ear (R0.1). */
export function useTestTone(settings: Settings | null): Result {
  const [toneBusy, setToneBusy] = useState<'monitor' | 'stream' | null>(null)
  const [toneError, setToneError] = useState<string | null>(null)

  const testTone = async (which: 'monitor' | 'stream'): Promise<void> => {
    if (!settings || toneBusy) return
    setToneBusy(which)
    setToneError(null)
    try {
      await playTestTone(
        which === 'monitor' ? settings.monitorDeviceId : settings.streamDeviceId,
        which === 'monitor' ? 440 : 660
      )
    } catch (err) {
      setToneError(err instanceof Error ? err.message : String(err))
    } finally {
      setToneBusy(null)
    }
  }

  return { toneBusy, toneError, testTone }
}
