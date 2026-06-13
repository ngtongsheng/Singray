import { Copy, Minus, Square, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cx } from './ui/cx'

const BTN =
  'app-no-drag flex h-full w-11 items-center justify-center text-text-dim transition-colors hover:bg-surface-2 hover:text-text'

/** Custom caption buttons (NAV1): replace the dropped native min/max/close overlay. */
function WindowControls(): React.JSX.Element {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    window.singray.window.isMaximized().then(setMaximized)
    return window.singray.window.onMaximizedChange(setMaximized)
  }, [])

  return (
    <div className="flex h-full items-stretch">
      <button
        type="button"
        aria-label="Minimize"
        onClick={() => window.singray.window.minimize()}
        className={BTN}
      >
        <Minus className="size-4" strokeWidth={1.5} />
      </button>
      <button
        type="button"
        aria-label={maximized ? 'Restore' : 'Maximize'}
        onClick={() => window.singray.window.toggleMaximize()}
        className={BTN}
      >
        {maximized ? (
          <Copy className="size-3.5 -scale-x-100" strokeWidth={1.5} />
        ) : (
          <Square className="size-3.5" strokeWidth={1.5} />
        )}
      </button>
      <button
        type="button"
        aria-label="Close"
        onClick={() => window.singray.window.close()}
        className={cx(BTN, 'hover:bg-danger hover:text-text')}
      >
        <X className="size-4" strokeWidth={1.5} />
      </button>
    </div>
  )
}

export default WindowControls
