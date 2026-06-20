import { Minus, Plus, SlidersHorizontal } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { usePlayerContext } from '../../context/PlayerContext'
import {
  Button,
  Grid,
  IconButton,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Slider,
  Stack,
  Text,
  Toggle
} from '../ui'

const TEMPO_PRESETS = [0.75, 0.85, 0.9, 0.95, 1, 1.05, 1.1, 1.25]
const MIC_FX_PRESETS = ['room', 'hall', 'echo', 'karaoke'] as const

/** Key/tempo/mic-FX popover + its trigger button. */
function TunePopover(): React.JSX.Element {
  const { t } = useTranslation()
  const {
    tuneOpen,
    setTuneOpen,
    keyVal,
    stepKey,
    tempoVal,
    changeTempo,
    vocalVol,
    setVocalVolume,
    micActive,
    micVol,
    setMicVolume,
    micFxPreset,
    micFxAmount,
    setMicFx
  } = usePlayerContext()

  return (
    <Popover open={tuneOpen} onOpenChange={setTuneOpen}>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          active={
            tuneOpen || tempoVal !== 1 || keyVal !== 0 || (micActive && micFxPreset !== 'off')
          }
          title={t('player.tuneTip')}
          aria-label={t('player.tuneTip')}
          className="app-no-drag tabular-nums"
        >
          <SlidersHorizontal className="size-4" strokeWidth={1.5} />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" sideOffset={8} className="w-max p-3">
        <Stack direction="column" gap={3}>
          <Stack direction="column" gap={2}>
            <Text as="span" variant="hint">
              {t('player.keyLabel')}
            </Text>
            <Stack
              gap={1}
              justify="between"
              className={`h-11 w-full rounded-md border px-2 ${
                keyVal !== 0 ? 'border-primary text-primary' : 'border-border text-muted-foreground'
              }`}
            >
              <IconButton
                variant="ghost"
                size="xs"
                onClick={() => stepKey(-1)}
                disabled={keyVal <= -6}
                title={t('player.keyDownTip')}
              >
                <Minus className="size-4" strokeWidth={1.5} />
              </IconButton>
              <span className="whitespace-nowrap text-center text-sm tabular-nums">
                {t('player.key', { value: keyVal > 0 ? `+${keyVal}` : keyVal })}
              </span>
              <IconButton
                variant="ghost"
                size="xs"
                onClick={() => stepKey(1)}
                disabled={keyVal >= 6}
                title={t('player.keyUpTip')}
              >
                <Plus className="size-4" strokeWidth={1.5} />
              </IconButton>
            </Stack>
          </Stack>

          <div className="h-px bg-border" />

          <Stack direction="column" gap={2}>
            <Stack justify="between">
              <Text as="span" variant="hint">
                {t('player.tempo')}
              </Text>
              <Button
                size="bare"
                onClick={() => changeTempo(1)}
                className="px-2 py-0.5 text-muted-foreground text-xs hover:text-foreground"
              >
                {t('common.reset')}
              </Button>
            </Stack>
            <Grid cols={4} gap={1}>
              {TEMPO_PRESETS.map((tp) => (
                <Toggle
                  key={tp}
                  size="bare"
                  pressed={tempoVal === tp}
                  onClick={() => changeTempo(tp)}
                  className="px-2 py-1.5 text-sm tabular-nums"
                >
                  {tp.toFixed(2)}×
                </Toggle>
              ))}
            </Grid>
          </Stack>

          <div className="h-px bg-border" />
          <Stack direction="column" gap={2}>
            <Text as="span" variant="hint">
              {t('player.guideVol')}
            </Text>
            <Slider
              min={0}
              max={1}
              step={0.01}
              value={vocalVol}
              onChange={setVocalVolume}
              className="h-8 w-full"
            />
          </Stack>

          {micActive && (
            <>
              <div className="h-px bg-border" />
              <Stack direction="column" gap={2}>
                <Text as="span" variant="hint">
                  {t('player.micMonitorVol')}
                </Text>
                <Slider
                  min={0}
                  max={1}
                  step={0.01}
                  value={micVol}
                  onChange={setMicVolume}
                  className="h-8 w-full"
                />
              </Stack>
            </>
          )}

          {micActive && (
            <>
              <div className="h-px bg-border" />
              <Stack direction="column" gap={2}>
                <Stack justify="between">
                  <Text as="span" variant="hint">
                    {t('player.micFxLabel')}
                  </Text>
                  <Button
                    size="bare"
                    onClick={() => setMicFx('off', micFxAmount)}
                    className="px-2 py-0.5 text-muted-foreground text-xs hover:text-foreground"
                  >
                    {t('common.reset')}
                  </Button>
                </Stack>
                <Grid cols={4} gap={1}>
                  {MIC_FX_PRESETS.map((p) => (
                    <Toggle
                      key={p}
                      size="bare"
                      pressed={micFxPreset === p}
                      onClick={() => setMicFx(p, micFxAmount)}
                      className="px-2 py-1.5 text-sm"
                    >
                      {t(`player.micPreset.${p}`)}
                    </Toggle>
                  ))}
                </Grid>
                {micFxPreset !== 'off' && (
                  <Slider
                    min={0}
                    max={1}
                    step={0.01}
                    value={micFxAmount}
                    onChange={(v) => setMicFx(micFxPreset, v)}
                    title={t('player.micFxAmountTip')}
                    className="h-8 w-full"
                  />
                )}
              </Stack>
            </>
          )}
        </Stack>
      </PopoverContent>
    </Popover>
  )
}

export default TunePopover
