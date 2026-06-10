import { useState } from 'react'
import type { SongListItem } from '../../shared/types'
import Library from './screens/Library'
import LyricCreator from './screens/LyricCreator'
import Settings from './screens/Settings'

type View = { name: 'library' } | { name: 'settings' } | { name: 'creator'; song: SongListItem }

function App(): React.JSX.Element {
  const [view, setView] = useState<View>({ name: 'library' })

  if (view.name === 'settings') return <Settings onBack={() => setView({ name: 'library' })} />
  if (view.name === 'creator')
    return <LyricCreator song={view.song} onBack={() => setView({ name: 'library' })} />
  return (
    <Library
      onOpenSettings={() => setView({ name: 'settings' })}
      onEditLyrics={(song) => setView({ name: 'creator', song })}
    />
  )
}

export default App
