import type { ReactNode } from 'react'

/**
 * Per-screen page header (row 2, NAV2/NAV3): floats under the app's AppHeader
 * (row 1), sharing its gradient scrim. Interactive children must carry
 * `app-no-drag`.
 */
function Titlebar({ children }: { children?: ReactNode }): React.JSX.Element {
  return (
    <header className="app-drag absolute inset-x-0 top-9 z-30 flex h-10 items-center gap-3 px-4">
      {children}
    </header>
  )
}

export default Titlebar
