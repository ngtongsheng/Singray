import { motion } from 'motion/react'
import type { ImportProgress, SongListItem } from '../../../shared/types'
import { usePrefersReducedMotion } from '../lib/motionPresets'
import SongRow from './SongRow'
import { Stack } from './ui'

interface Props {
  songs: SongListItem[]
  imports: Map<string, ImportProgress>
}

/** List view of songs, with entrance stagger (SPEC §10.5). */
function SongRowList({ songs, imports }: Props): React.JSX.Element {
  const reduced = usePrefersReducedMotion()
  return (
    <Stack direction="column" gap={2} className="pb-12">
      {songs.map((song, i) => (
        <motion.div
          key={song.id}
          initial={reduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut', delay: Math.min(i * 0.03, 0.45) }}
        >
          <SongRow song={song} importing={imports.get(song.id)} />
        </motion.div>
      ))}
    </Stack>
  )
}

export default SongRowList
