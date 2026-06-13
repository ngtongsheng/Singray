import type { ReactNode } from 'react'

/**
 * Per-screen page header (row 2, NAV2): drag region under the app's AppHeader
 * (row 1) carrying back/title/page controls. Interactive children must carry
 * `app-no-drag`.
 */
function Titlebar({ children }: { children?: ReactNode }): React.JSX.Element {
  return (
    <header className="app-drag relative z-10 flex h-10 shrink-0 items-center gap-3 border-border border-b bg-bg pl-4 pr-4">
      {children}
    </header>
  )
}

export default Titlebar
