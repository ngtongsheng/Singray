import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import type { SongListItem } from '../../shared/types'
import { usePrefersReducedMotion } from './lib/motionPresets'
import Library from './screens/Library'
import LyricCreator from './screens/LyricCreator'
import PipelineSetup from './screens/PipelineSetup'
import Player from './screens/Player'
import Settings from './screens/Settings'

type View =
  | { name: 'library' }
  | { name: 'settings' }
  | { name: 'creator'; song: SongListItem }
  | { name: 'player'; song: SongListItem }

function App(): React.JSX.Element {
  const [view, setView] = useState<View>({ name: 'library' })
  const reduced = usePrefersReducedMotion()
  // First-run gate (R4.3): show pipeline setup until installed or skipped this session.
  // null = still checking; true/false = whether the gate should show.
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null)

  useEffect(() => {
    window.singray.pipeline.status().then((s) => setNeedsSetup(!s.ready))
  }, [])

  let screen: React.JSX.Element
  let key: string
  if (needsSetup === null) {
    screen = <div className="h-full" />
    key = 'boot'
  } else if (needsSetup) {
    screen = (
      <PipelineSetup onReady={() => setNeedsSetup(false)} onSkip={() => setNeedsSetup(false)} />
    )
    key = 'pipeline-setup'
  } else if (view.name === 'settings') {
    screen = <Settings onBack={() => setView({ name: 'library' })} />
    key = 'settings'
  } else if (view.name === 'creator') {
    screen = (
      <LyricCreator song={view.song} onBack={() => setView({ name: 'player', song: view.song })} />
    )
    key = `creator:${view.song.id}`
  } else if (view.name === 'player') {
    screen = (
      <Player
        song={view.song}
        onExit={() => setView({ name: 'library' })}
        onEditLyrics={(song) => setView({ name: 'creator', song })}
      />
    )
    key = `player:${view.song.id}`
  } else {
    screen = (
      <Library
        onOpenSettings={() => setView({ name: 'settings' })}
        onSing={(song) => setView({ name: 'player', song })}
      />
    )
    key = 'library'
  }

  // View transitions (R2.2, SPEC §10.5): quick fade + breath of scale, exit ≈ 70%
  // of enter. mode="wait" so the outgoing screen (and its audio engine) unmounts
  // before the next one mounts. Reduced motion: instant switch.
  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={key}
          className="h-full"
          initial={reduced ? false : { opacity: 0, scale: 0.985 }}
          animate={{ opacity: 1, scale: 1, transition: { duration: 0.2, ease: 'easeOut' } }}
          exit={
            reduced
              ? undefined
              : { opacity: 0, scale: 0.985, transition: { duration: 0.14, ease: 'easeIn' } }
          }
        >
          {screen}
        </motion.div>
      </AnimatePresence>
    </MotionConfig>
  )
}

export default App
