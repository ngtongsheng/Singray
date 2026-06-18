import type { ReactNode } from 'react'
import { Stack } from '../ui'

/**
 * Per-screen page header (row 2, NAV2/NAV3): floats under the app's AppHeader
 * (row 1), sharing its gradient scrim. Interactive children must carry
 * `app-no-drag`.
 */
function Titlebar({ children }: { children?: ReactNode }): React.JSX.Element {
  return (
    <Stack as="header" gap={3} className="app-drag absolute inset-x-0 top-9 z-30 h-10 px-6">
      {children}
    </Stack>
  )
}

export default Titlebar
