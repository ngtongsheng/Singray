import { useState } from 'react'
import Library from './screens/Library'
import Settings from './screens/Settings'

function App(): React.JSX.Element {
  const [view, setView] = useState<'library' | 'settings'>('library')

  if (view === 'settings') return <Settings onBack={() => setView('library')} />
  return <Library onOpenSettings={() => setView('settings')} />
}

export default App
