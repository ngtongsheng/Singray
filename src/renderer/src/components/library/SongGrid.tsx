import { motion } from 'motion/react'
import { useLibraryContext } from '../../context/LibraryContext'
import { usePrefersReducedMotion } from '../../lib/motionPresets'
import { Grid } from '../ui'
import SongCard from './SongCard'

/** Grid view of songs, with entrance stagger (SPEC §10.5). */
function SongGrid(): React.JSX.Element {
  const { filteredSongs, imports } = useLibraryContext()
  const reduced = usePrefersReducedMotion()
  return (
    <Grid minItemWidth={220} autoRows="min" gap={4} className="pb-12">
      {filteredSongs.map((song, i) => (
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
