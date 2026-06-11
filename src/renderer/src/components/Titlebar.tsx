import type { ReactNode } from 'react'

/**
 * Frameless-window titlebar (R2.1): drag region that doubles as the persistent
 * app header on every screen. Native caption buttons (min/max/close, snap
 * layouts) render in the OS overlay at the top-right; the bar reserves that
 * strip via the WCO titlebar-area env vars. Interactive children must carry
 * `app-no-drag`.
 */
function Titlebar({ children }: { children?: ReactNode }): React.JSX.Element {
  return (
    <header
      className="app-drag relative z-10 flex h-10 shrink-0 items-center gap-3 border-border border-b bg-bg pl-4"
      style={{
        paddingRight: 'calc(100% - env(titlebar-area-x, 0px) - env(titlebar-area-width, 100%))'
      }}
    >
      {children}
    </header>
  )
}

export default Titlebar
