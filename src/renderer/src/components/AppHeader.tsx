import { Mic2 } from 'lucide-react'
import { Stack } from './ui'
import WindowControls from './WindowControls'

/**
 * Row 1 (NAV1/NAV3): app branding + drag region + custom window controls.
 * Floats over content with the shared header gradient scrim — no solid fill.
 */
function AppHeader(): React.JSX.Element {
  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-1/3 bg-gradient-to-b from-bg to-transparent" />
      <Stack as="header" justify="between" className="app-drag absolute inset-x-0 top-0 z-30 h-9">
        <Stack gap={2} className="pl-6">
          <Mic2 className="size-4 text-accent" strokeWidth={1.5} />
          <span className="font-semibold text-sm">Singray</span>
        </Stack>
        <WindowControls />
      </Stack>
    </>
  )
}

export default AppHeader
