import { Mic2 } from 'lucide-react'
import WindowControls from './WindowControls'

/** Row 1 (NAV1): app branding + drag region + custom window controls, on every screen. */
function AppHeader(): React.JSX.Element {
  return (
    <header className="app-drag flex h-9 shrink-0 items-center bg-bg">
      <div className="flex items-center gap-2 pl-4">
        <Mic2 className="size-4 text-accent" strokeWidth={1.5} />
        <span className="font-semibold text-sm">Singray</span>
      </div>
      <div className="flex-1" />
      <WindowControls />
    </header>
  )
}

export default AppHeader
