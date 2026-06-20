import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { usePlayerContext } from '../../context/PlayerContext'
import { Stack, StatusStrip, Text } from '../ui'
import InstrumentalVolume from './InstrumentalVolume'
import MicMonitor from './MicMonitor'
import PinToggle from './PinToggle'
import PlaybackButton from './PlaybackButton'
import RecordButton from './RecordButton'
import SeekBar from './SeekBar'
import TunePopover from './TunePopover'
import VocalGuide from './VocalGuide'

/** Pin/unpin slide (R2.2): bar dips and fades on auto-hide, rises on poke. */
function ControlBar(): React.JSX.Element | null {
  const { t } = useTranslation()
  const { engine, barVisible, micActive, micMonitor, micWarning } = usePlayerContext()
  if (!engine) return null

  return (
    <motion.div
      animate={barVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
      transition={
        barVisible ? { duration: 0.2, ease: 'easeOut' } : { duration: 0.14, ease: 'easeIn' }
      }
      className={`absolute inset-x-0 bottom-0 z-10 ${barVisible ? '' : 'pointer-events-none'}`}
    >
      <Stack
        direction="column"
        gap={2}
        className="bg-gradient-to-t from-black/80 to-transparent px-6 pt-12 pb-5"
      >
        {micWarning && (
          <Text variant="error">{t('player.micWarning', { message: micWarning })}</Text>
        )}
        <Stack gap={4} className="">
          <PlaybackButton />
          <SeekBar engine={engine} seekTip={t('player.seekTip')} />
          <div className="h-4 w-px bg-white/20" />
          <InstrumentalVolume />
          <VocalGuide />
          {micActive && <MicMonitor />}
          <div className="h-4 w-px bg-white/20" />
          <RecordButton />
          <div className="h-4 w-px bg-white/20" />
          <TunePopover />
          <PinToggle />
        </Stack>
      </Stack>
      {micActive && micMonitor && <StatusStrip>{t('player.micLatencyHint')}</StatusStrip>}
    </motion.div>
  )
}

export default ControlBar
