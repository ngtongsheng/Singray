import { Volume2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { usePlayerContext } from '../../context/PlayerContext'
import { Slider } from '../ui'

function InstrumentalVolume(): React.JSX.Element {
  const { t } = useTranslation()
  const { instrVol, setInstrumentalVolume } = usePlayerContext()

  return (
    <span className="flex items-center gap-2 text-muted-foreground">
      <Volume2 className="size-4" strokeWidth={1.5} />
      <Slider
        min={0}
        max={1}
        step={0.01}
        value={instrVol}
        onChange={setInstrumentalVolume}
        title={t('player.instrVolTip')}
        className="h-11 w-24"
      />
    </span>
  )
}

export default InstrumentalVolume
