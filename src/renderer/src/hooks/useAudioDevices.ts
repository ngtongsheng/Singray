import { useEffect, useState } from 'react'

interface Result {
  outputs: MediaDeviceInfo[]
  inputs: MediaDeviceInfo[]
}

/** Enumerates audio output/input devices, live-updated on `devicechange` (Settings audio section). */
export function useAudioDevices(): Result {
  const [outputs, setOutputs] = useState<MediaDeviceInfo[]>([])
  const [inputs, setInputs] = useState<MediaDeviceInfo[]>([])

  useEffect(() => {
    const load = (): void => {
      navigator.mediaDevices.enumerateDevices().then((ds) => {
        setOutputs(ds.filter((d) => d.kind === 'audiooutput'))
        setInputs(ds.filter((d: MediaDeviceInfo) => d.kind === 'audioinput'))
      })
    }
    load()
    navigator.mediaDevices.addEventListener('devicechange', load)
    return () => navigator.mediaDevices.removeEventListener('devicechange', load)
  }, [])

  return { outputs, inputs }
}
