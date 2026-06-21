import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAudioDevices } from '../../hooks/useAudioDevices'
import { useSettings } from '../../hooks/useSettings'
import type { AudioEngine, MediaWarningReason } from '../../lib/audioEngine'
import { Button, Dialog, Field, Segmented, Select, Stack, Text } from '../ui'

interface Props {
  engine: AudioEngine
  onStart: () => void
  onClose: () => void
}

const COUNTDOWN_OPTIONS = [0, 3, 5] as const

/** Live mic level bar driven by rAF reading the engine's mic analyser directly
 *  into the DOM (no React state) — same pattern as Soundwave's canvas loop. */
function LevelMeter({ analyser }: { analyser: AnalyserNode | null }): React.JSX.Element {
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!analyser) return
    const data = new Uint8Array(analyser.fftSize)
    let raf = 0
    const tick = (): void => {
      analyser.getByteTimeDomainData(data)
      let peak = 0
      for (const v of data) peak = Math.max(peak, Math.abs(v - 128))
      if (barRef.current)
        barRef.current.style.width = `${Math.min(100, Math.round((peak / 128) * 100))}%`
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [analyser])

  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-card">
      <div ref={barRef} className="h-full w-0 bg-primary" />
    </div>
  )
}

/** Pre-record prep (R5.65): mic pick + live level check + optional countdown
 *  before the take actually starts. */
function PreRecordDialog({ engine, onStart, onClose }: Props): React.JSX.Element {
  const { t } = useTranslation()
  const { settings, patch } = useSettings()
  const { inputs } = useAudioDevices()
  const [deviceId, setDeviceId] = useState(settings?.micDeviceId ?? '')
  const [countdown, setCountdown] = useState<number>(3)
  const [count, setCount] = useState<number | null>(null)
  const [micAnalyser, setMicAnalyser] = useState<AnalyserNode | null>(engine.micAnalyser)
  const [micWarning, setMicWarning] = useState<MediaWarningReason | null>(engine.micWarning)

  // Always (re)enable the mic for the prep check — recording needs it whether
  // or not the user has left "mic enabled" on in Settings. enableMic mutates
  // the engine instance directly (no React state), so mirror its result here
  // once it resolves or the analyser/warning below would never update.
  useEffect(() => {
    let live = true
    void engine.enableMic(deviceId || undefined).then(() => {
      if (live) {
        setMicAnalyser(engine.micAnalyser)
        setMicWarning(engine.micWarning)
      }
    })
    return () => {
      live = false
    }
  }, [engine, deviceId])

  useEffect(() => {
    if (count === null) return
    if (count === 0) {
      onStart()
      return
    }
    const id = setTimeout(() => setCount((c) => (c === null ? null : c - 1)), 1000)
    return () => clearTimeout(id)
  }, [count, onStart])

  const begin = (): void => {
    if (countdown === 0) onStart()
    else setCount(countdown)
  }

  const counting = count !== null

  return (
    <Dialog label={t('player.recordPrep.aria')} width="sm" onClose={onClose}>
      <Stack direction="column" gap={6}>
        <Text as="h2" variant="title">
          {t('player.recordPrep.title')}
        </Text>

        {counting ? (
          <Text as="p" variant="title" className="py-6 text-center text-5xl tabular-nums">
            {count}
          </Text>
        ) : (
          <Stack direction="column" gap={4}>
            <Field label={t('settings.micDevice')}>
              <Select
                value={deviceId}
                onChange={setDeviceId}
                options={[
                  { value: '', label: t('settings.systemDefault') },
                  ...inputs.map((d) => ({
                    value: d.deviceId,
                    label: d.label || t('settings.inputN', { id: d.deviceId.slice(0, 8) })
                  }))
                ]}
                className="w-full"
              />
            </Field>
            <LevelMeter analyser={micAnalyser} />
            {micWarning && <Text variant="error">{t(`player.micWarning.${micWarning}`)}</Text>}
            <Field label={t('player.recordPrep.countdown')}>
              <Segmented
                value={String(countdown)}
                onChange={(v) => setCountdown(Number(v))}
                options={COUNTDOWN_OPTIONS.map((n) => ({
                  value: String(n),
                  label: n === 0 ? t('player.recordPrep.none') : `${n}s`
                }))}
              />
            </Field>
          </Stack>
        )}

        <Stack justify="end" gap={3}>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          {!counting && (
            <Button
              variant="primary"
              onClick={() => {
                void patch({ micDeviceId: deviceId })
                begin()
              }}
            >
              {t('player.recordPrep.start')}
            </Button>
          )}
        </Stack>
      </Stack>
    </Dialog>
  )
}

export default PreRecordDialog
