import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import AppHeader from './components/shared/AppHeader'
import { useAppContext } from './context/AppContext'
import { assertNever } from './lib/assertNever'
import { usePrefersReducedMotion } from './lib/motionPresets'
import Library from './screens/Library'
import LyricCreator from './screens/LyricCreator'
import PipelineSetup from './screens/PipelineSetup'
import Player from './screens/Player'
import Settings from './screens/Settings'

function App(): React.JSX.Element {
  const { view } = useAppContext()
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
  } else {
    switch (view.name) {
      case 'settings':
        screen = <Settings />
        key = 'settings'
        break
      case 'creator':
        screen = <LyricCreator song={view.song} />
        key = `creator:${view.song.id}`
        break
      case 'player':
        screen = <Player song={view.song} />
        key = `player:${view.song.id}`
        break
      case 'library':
        screen = <Library initialArtistFilter={view.artistFilter} />
        key = 'library'
        break
      default:
        assertNever(view)
    }
  }

  // View transitions (R2.2, SPEC §10.5): quick fade + breath of scale, exit ≈ 70%
  // of enter. mode="wait" so the outgoing screen (and its audio engine) unmounts
  // before the next one mounts. Reduced motion: instant switch.
  return (
    <MotionConfig reducedMotion="user">
      <div className="relative h-full">
        <AppHeader />
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
      </div>
    </MotionConfig>
  )
}

export default App
