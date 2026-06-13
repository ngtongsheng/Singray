import { Check, ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { cx } from './cx'
import Popover from './Popover'

export interface SelectOption {
  value: string
  label: ReactNode
}

interface SelectProps {
  value: string
  onChange: (value: string) => void
  options: readonly SelectOption[]
  /** md = full-width form field; sm = compact inline control. */
  uiSize?: 'sm' | 'md'
  disabled?: boolean
  className?: string
  title?: string
  'aria-label'?: string
}

/** Custom popover-based select (UI1): no native dropdown chrome, full keyboard nav. */
function Select({
  value,
  onChange,
  options,
  uiSize = 'md',
  disabled,
  className,
  title,
  'aria-label': ariaLabel
}: SelectProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const current = options.find((o) => o.value === value)

  useEffect(() => {
    if (!open) return
    setHighlight(
      Math.max(
        0,
        options.findIndex((o) => o.value === value)
      )
    )
    const onDown = (e: MouseEvent): void => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, options, value])

  const select = (opt: SelectOption | undefined): void => {
    if (!opt) return
    onChange(opt.value)
    setOpen(false)
  }

  const onKeyDown = (e: React.KeyboardEvent): void => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        if (!open) setOpen(true)
        else setHighlight((h) => Math.min(h + 1, options.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        if (!open) setOpen(true)
        else setHighlight((h) => Math.max(h - 1, 0))
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        if (open) select(options[highlight])
        else setOpen(true)
        break
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        title={title}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        className={cx(
          'flex items-center gap-2 rounded-control border border-border bg-surface text-left text-sm disabled:opacity-50',
          uiSize === 'md' ? 'w-full justify-between px-3 py-2' : 'px-2 py-1 text-text-dim',
          className
        )}
      >
        <span className="truncate">{current?.label ?? ''}</span>
        <ChevronDown className="size-4 shrink-0 opacity-60" strokeWidth={1.5} />
      </button>
      <Popover
        open={open}
        origin="top"
        className={cx(
          'top-full mt-1 max-h-60 overflow-y-auto py-1',
          uiSize === 'md' ? 'inset-x-0' : 'right-0 min-w-[10rem]'
        )}
      >
        <div role="listbox">
          {options.map((opt, i) => (
            <button
              key={opt.value}
              type="button"
              role="option"
              aria-selected={opt.value === value}
              onMouseEnter={() => setHighlight(i)}
              onClick={() => select(opt)}
              className={cx(
                'flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm',
                i === highlight ? 'bg-surface-2' : '',
                opt.value === value ? 'text-accent' : ''
              )}
            >
              <span className="truncate">{opt.label}</span>
              {opt.value === value && <Check className="size-3.5 shrink-0" strokeWidth={2} />}
            </button>
          ))}
        </div>
      </Popover>
    </div>
  )
}

export default Select
