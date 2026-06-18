import { Minus, Plus, SlidersHorizontal } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { usePlayerContext } from '../../context/PlayerContext'
import { Button, Grid, IconButton, Popover, Slider, Stack, Text, Toggle } from '../ui'

const TEMPO_PRESETS = [0.75, 0.85, 0.9, 0.95, 1, 1.05, 1.1, 1.25]
const MIC_FX_PRESETS = ['room', 'hall', 'echo', 'karaoke'] as const

/** Key/tempo/mic-FX popover + its trigger button. */
function TunePopover(): React.JSX.Element {
  const { t } = useTranslation()
  const {
    tuneOpen,
    toggleTune,
    tuneRef,
    keyVal,
    stepKey,
    tempoVal,
    changeTempo,
    micActive,
    micFxPreset,
    micFxAmount,
    setMicFx
  } = usePlayerContext()

  return (
    <div className="relative" ref={tuneRef}>
      <Popover
        open={tuneOpen}
        origin="bottom right"
        className="right-0 bottom-full -translate-y-2 w-max p-3"
      >
        <Stack direction="column" gap={3}>
          <Stack direction="column" gap={2}>
            <Text as="span" variant="hint">
              {t('player.keyLabel')}
            </Text>
            <Stack
              gap={1}
              justify="between"
              className={`h-11 w-full rounded-control border px-2 ${
                keyVal !== 0 ? 'border-accent text-accent' : 'border-border text-text-dim'
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
                className="px-2 py-0.5 text-text-dim text-xs hover:text-text"
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
                    className="px-2 py-0.5 text-text-dim text-xs hover:text-text"
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
                    onChange={(e) => setMicFx(micFxPreset, Number(e.target.value))}
                    title={t('player.micFxAmountTip')}
                    className="h-8 w-full"
                  />
                )}
              </Stack>
            </>
          )}
        </Stack>
      </Popover>
      <Button
        size="lg"
        active={tuneOpen || tempoVal !== 1 || keyVal !== 0 || (micActive && micFxPreset !== 'off')}
        onClick={toggleTune}
        aria-expanded={tuneOpen}
        title={t('player.tuneTip')}
        className="tabular-nums"
      >
        <SlidersHorizontal className="size-4" strokeWidth={1.5} />
      </Button>
    </div>
  )
}

export default TunePopover
