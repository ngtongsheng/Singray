import { motion } from 'motion/react'
import type { ImportProgress, SongListItem } from '../../../shared/types'
import { usePrefersReducedMotion } from '../lib/motionPresets'
import SongCard from './SongCard'
import { Grid } from './ui'

interface Props {
  songs: SongListItem[]
  imports: Map<string, ImportProgress>
}

/** Grid view of songs, with entrance stagger (SPEC §10.5). */
function SongGrid({ songs, imports }: Props): React.JSX.Element {
  const reduced = usePrefersReducedMotion()
  return (
    <Grid minItemWidth={220} autoRows="min" gap={4} className="pb-12">
      {songs.map((song, i) => (
        <motion.div
          key={song.id}
          initial={reduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut', delay: Math.min(i * 0.03, 0.45) }}
        >
          <SongCard song={song} importing={imports.get(song.id)} />
        </motion.div>
      ))}
    </Grid>
  )
}

export default SongGrid
