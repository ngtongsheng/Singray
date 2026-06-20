import { Headphones } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { usePlayerContext } from '../../context/PlayerContext'
import { Slider, Stack, Toggle } from '../ui'

/** Mic monitor toggle + volume — only rendered while the mic is active. */
function MicMonitor(): React.JSX.Element {
  const { t } = useTranslation()
  const { micMonitor, toggleMicMonitor, micVol, setMicVolume } = usePlayerContext()

  return (
    <Stack
      gap={2}
      className={`h-9 rounded-md border p-0.5 ${micMonitor ? 'border-primary' : 'border-border'}`}
    >
      <Toggle
        variant="ghost"
        size="sm"
        pressed={micMonitor}
        onClick={toggleMicMonitor}
        title={t('player.micMonitorTip')}
        className="shrink-0 whitespace-nowrap"
      >
        <Headphones className="size-4" strokeWidth={1.5} />
        {micMonitor ? t('player.micMonitorOn') : t('player.micMonitorOff')}
      </Toggle>
      <Slider
        min={0}
        max={1}
        step={0.01}
        value={micVol}
        onChange={setMicVolume}
        title={t('player.micVolTip')}
        className="h-full w-12"
      />
    </Stack>
  )
}

export default MicMonitor
