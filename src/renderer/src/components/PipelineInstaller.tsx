import { CheckCircle2, Circle, Download, Loader2, XCircle } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { InstallEvent, InstallStep, PipelineStatus } from '../../../shared/types'
import { Button, Stack } from './ui'

const STEPS: InstallStep[] = ['uv', 'venv', 'torch', 'deps', 'ffmpeg', 'verify']
const STEP_KEY: Record<InstallStep, string> = {
  uv: 'stepUv',
  venv: 'stepVenv',
  torch: 'stepTorch',
  deps: 'stepDeps',
  ffmpeg: 'stepFfmpeg',
  verify: 'stepVerify'
}

interface Props {
  /** Called once an install finishes and the pipeline reports ready. */
  onReady?: () => void
}

function strip(msg: string): string {
  return msg.replace(/^Error invoking remote method '[^']+': Error: /, '')
}

export default function PipelineInstaller({ onReady }: Props): React.JSX.Element {
  const { t } = useTranslation()
  const [status, setStatus] = useState<PipelineStatus | null>(null)
  const [events, setEvents] = useState<Map<InstallStep, InstallEvent>>(new Map())
  const [installing, setInstalling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback((): void => {
    window.singray.pipeline.status().then(setStatus)
  }, [])

  useEffect(() => {
    refresh()
    return window.singray.pipeline.onInstallProgress((e) => {
      setEvents((prev) => {
        const next = new Map(prev)
        next.set(e.step, e)
        return next
      })
    })
  }, [refresh])

  const install = async (): Promise<void> => {
    setError(null)
    setEvents(new Map())
    setInstalling(true)
    try {
      await window.singray.pipeline.install()
      refresh()
      const s = await window.singray.pipeline.status()
      setStatus(s)
      if (s.ready) onReady?.()
    } catch (err) {
      setError(strip((err as Error).message))
    } finally {
      setInstalling(false)
    }
  }

  const cancel = (): void => {
    void window.singray.pipeline.cancelInstall()
  }

  const chip = (label: string, ok: boolean, detail: string): React.JSX.Element => (
    <span className="flex items-center gap-1.5 text-xs">
      {ok ? (
        <CheckCircle2 className="size-3.5 text-success" />
      ) : (
        <XCircle className="size-3.5 text-danger" />
      )}
      <span className="text-text-dim">
        {label}: {detail}
      </span>
    </span>
  )

  if (!status) return <span className="text-text-dim text-xs">{t('common.loading')}</span>

  return (
    <Stack direction="column" gap={3}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {chip(
          t('settings.setup.python'),
          status.python,
          status.python ? t('settings.setup.detected') : t('settings.setup.missing')
        )}
        {chip(
          t('settings.setup.ffmpeg'),
          status.ffmpeg,
          status.ffmpegSource === 'path'
            ? t('settings.setup.onPath')
            : status.ffmpegSource === 'managed'
              ? t('settings.setup.managed')
              : t('settings.setup.missing')
        )}
        <span className="flex items-center gap-1.5 text-text-dim text-xs">
          {t('settings.setup.gpu')}:{' '}
          {status.gpu ? t('settings.setup.detected') : t('settings.setup.missing')}
        </span>
      </div>

      <span className="text-text-dim text-xs">
        {status.gpu ? t('settings.setup.gpuCuda') : t('settings.setup.cpuOnly')}
      </span>

      {(installing || events.size > 0) && (
        <ul className="flex flex-col gap-1.5 rounded-control border border-border p-3">
          {STEPS.map((step) => {
            const ev = events.get(step)
            const st = ev?.status
            return (
              <li key={step} className="flex items-center gap-2 text-xs">
                {st === 'done' ? (
                  <CheckCircle2 className="size-3.5 shrink-0 text-success" />
                ) : st === 'error' ? (
                  <XCircle className="size-3.5 shrink-0 text-danger" />
                ) : st === 'start' || st === 'progress' ? (
                  <Loader2 className="size-3.5 shrink-0 animate-spin text-accent" />
                ) : (
                  <Circle className="size-3.5 shrink-0 text-text-dim/40" />
                )}
                <span className={st ? 'text-text' : 'text-text-dim/60'}>
                  {t(`settings.setup.${STEP_KEY[step]}`)}
                </span>
                {ev?.pct !== undefined && (
                  <span className="text-text-dim tabular-nums">{Math.round(ev.pct * 100)}%</span>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {error && (
        <span className="flex items-center gap-1.5 text-danger text-xs">
          <XCircle className="size-3.5 shrink-0" />{' '}
          {t('settings.setup.failedMsg', { message: error })}
        </span>
      )}

      <Stack gap={2}>
        {installing ? (
          <Button variant="secondary" size="md" onClick={cancel}>
            {t('settings.setup.cancel')}
          </Button>
        ) : (
          <Button size="md" onClick={install}>
            <Download className="size-4" strokeWidth={1.5} />
            {status.ready ? t('settings.setup.reinstall') : t('settings.setup.install')}
          </Button>
        )}
        {installing && (
          <span className="flex items-center gap-1.5 text-text-dim text-xs">
            <Loader2 className="size-3.5 animate-spin" /> {t('settings.setup.installing')}
          </span>
        )}
      </Stack>
    </Stack>
  )
}
