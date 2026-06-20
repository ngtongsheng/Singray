import { AnimatePresence } from 'motion/react'
import type { SongListItem } from '../../../shared/types'
import ControlBar from '../components/player/ControlBar'
import EditMetaDialog from '../components/player/EditMetaDialog'
import PlayerHeader from '../components/player/PlayerHeader'
import PlayerStage from '../components/player/PlayerStage'
import PreRecordDialog from '../components/player/PreRecordDialog'
import SongDetailsDialog from '../components/player/SongDetailsDialog'
import Titlebar from '../components/shared/Titlebar'
import { PlayerProvider, usePlayerContext } from '../context/PlayerContext'

interface Props {
  song: SongListItem
}

function Player({ song }: Props): React.JSX.Element {
  return (
    <PlayerProvider song={song}>
      <PlayerView />
    </PlayerProvider>
  )
}

function PlayerView(): React.JSX.Element {
  const {
    song,
    barVisible,
    editOpen,
    closeEditMeta,
    detailsOpen,
    closeDetails,
    onArtistClick,
    engine,
    recordPrepOpen,
    closeRecordPrep,
    startRecording
  } = usePlayerContext()

  return (
    <div className="relative h-full">
      <Titlebar>
        <PlayerHeader />
      </Titlebar>

      <div
        className={`absolute inset-0 flex flex-col overflow-hidden bg-background ${barVisible ? '' : 'cursor-none'}`}
      >
        <PlayerStage />
        <AnimatePresence>
          {editOpen && <EditMetaDialog song={song} onClose={closeEditMeta} />}
          {detailsOpen && (
            <SongDetailsDialog song={song} onClose={closeDetails} onArtistClick={onArtistClick} />
          )}
          {recordPrepOpen && engine && (
            <PreRecordDialog engine={engine} onStart={startRecording} onClose={closeRecordPrep} />
          )}
        </AnimatePresence>
        <ControlBar />
      </div>
    </div>
  )
}

export default Player
