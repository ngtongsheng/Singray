import { Mic, MicOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { usePlayerContext } from '../../context/PlayerContext'
import { Slider, Stack, Toggle } from '../ui'

function VocalGuide(): React.JSX.Element {
  const { t } = useTranslation()
  const { vocalOn, toggleVocal, vocalVol, setVocalVolume } = usePlayerContext()

  return (
    <Stack
      gap={2}
      className={`h-11 rounded-control border px-2 ${vocalOn ? 'border-accent' : 'border-border'}`}
    >
      <Toggle
        variant="ghost"
        pressed={vocalOn}
        onClick={toggleVocal}
        title={t('player.guideTip')}
        className="shrink-0 whitespace-nowrap"
      >
        {vocalOn ? (
          <Mic className="size-4" strokeWidth={1.5} />
        ) : (
          <MicOff className="size-4" strokeWidth={1.5} />
        )}
        {vocalOn ? t('player.guideOn') : t('player.guideOff')}
      </Toggle>
      <Slider
        min={0}
        max={1}
        step={0.01}
        value={vocalVol}
        onChange={(e) => setVocalVolume(Number(e.target.value))}
        title={t('player.guideVolTip')}
        className="h-8 w-12"
      />
    </Stack>
  )
}

export default VocalGuide
