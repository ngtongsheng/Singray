import { Loader2, Type } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { usePlayerContext } from '../../context/PlayerContext'
import CountdownOverlay from '../shared/CountdownOverlay'
import LyricRenderer from '../shared/LyricRenderer'
import { Button, Stack } from '../ui'
import Soundwave from './Soundwave'
import StageWaveform from './StageWaveform'

/** Blurred-art background + waveform/bars overlays + lyrics/loading/error content area. */
function PlayerStage(): React.JSX.Element {
  const { t } = useTranslation()
  const {
    song,
    windowHidden,
    playing,
    showWaveform,
    peaks,
    engine,
    showBars,
    analyser,
    error,
    lyrics,
    clock,
    seek,
    onExit,
    onEditLyrics,
    leadInRemaining
  } = usePlayerContext()

  return (
    <>
      {/* Blurred artwork under a scrim + bottom fade — lyric contrast independent of art (§10.6). */}
      <img
        src={window.singray.audio.thumbUrl(song.id)}
        alt=""
        draggable={false}
        className={`animate-ken-burns absolute inset-0 h-full w-full object-cover blur-2xl ${
          windowHidden || !playing ? 'paused' : ''
        }`}
      />
      <div className="absolute inset-0 bg-black/55" />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-1/3 bg-gradient-to-b from-background to-transparent" />
      {/* Bars overlay: below the bottom gradient. */}
      {showBars && analyser && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-40 opacity-75">
          <Soundwave analyser={analyser} playing={playing} />
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 z-1 h-1/3 bg-gradient-to-t from-background to-transparent" />
      {/* Spacer matching the Titlebar (top-9 = 36px + h-10 = 40px). */}
      <div
        className="h-[76px] shrink-0" /* design-allow: exact Titlebar height, no scale token matches */
      />
      {/* Waveform strip: top strip below the header. */}
      {showWaveform && peaks && engine && (
        <div className="relative z-10 h-16 shrink-0">
          <StageWaveform peaks={peaks} duration={engine.duration} clock={clock} />
        </div>
      )}
      {leadInRemaining !== null && <CountdownOverlay seconds={leadInRemaining} />}
      {/* Content area: lyrics / loading / error — fills remaining height. */}
      <div className="relative z-0 min-h-0 flex-1">
        {error ? (
          <Stack direction="column" gap={3} justify="center" align="center" className="h-full">
            <p className="text-destructive">{error}</p>
            <Button onClick={onExit}>{t('common.back')}</Button>
          </Stack>
        ) : !engine ? (
          <Stack gap={2} justify="center" className="h-full text-muted-foreground">
            <Loader2 className="size-5 animate-spin" /> {t('player.loadingStems')}
          </Stack>
        ) : lyrics ? (
          <LyricRenderer lyrics={lyrics} clock={clock} onSeek={seek} />
        ) : (
          <Stack justify="center" className="h-full">
            <Button variant="primary" onClick={() => onEditLyrics(song)}>
              <Type className="size-4" strokeWidth={1.5} /> {t('player.addLyrics')}
            </Button>
          </Stack>
        )}
      </div>
    </>
  )
}

export default PlayerStage
