import * as SelectPrimitive from '@radix-ui/react-select'
import { Check, ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export interface SelectOption<T extends string> {
  value: T
  label: ReactNode
}

interface SelectProps<T extends string> {
  value: T
  onChange: (value: T) => void
  options: readonly SelectOption<T>[]
  /** md = full-width form field; sm = compact inline control. */
  uiSize?: 'sm' | 'md'
  disabled?: boolean
  className?: string
  title?: string
  'aria-label'?: string
}

/** Radix Select: native a11y (typeahead, roving focus, ARIA) keyed to the brand tokens. */
function Select<T extends string>({
  value,
  onChange,
  options,
  uiSize = 'md',
  disabled,
  className,
  title,
  'aria-label': ariaLabel
}: SelectProps<T>): React.JSX.Element {
  return (
    <SelectPrimitive.Root value={value} onValueChange={(v) => onChange(v as T)} disabled={disabled}>
      <SelectPrimitive.Trigger
        title={title}
        aria-label={ariaLabel}
        className={cn(
          'flex items-center gap-2 rounded-md border border-border bg-card text-left text-sm outline-none focus-visible:border-primary disabled:opacity-50',
          uiSize === 'md' ? 'w-full justify-between px-3 py-2' : 'px-2 py-1 text-muted-foreground',
          className
        )}
      >
        <SelectPrimitive.Value className="truncate" />
        <SelectPrimitive.Icon asChild>
          <ChevronDown className="size-4 shrink-0 opacity-60" strokeWidth={1.5} />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={4}
          className="z-30 max-h-60 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border border-border bg-card py-1 shadow-raised data-[state=closed]:animate-[pop-out_100ms_ease-in] data-[state=open]:animate-[pop-in_120ms_ease-out]"
        >
          <SelectPrimitive.Viewport>
            {options.map((opt) => (
              <SelectPrimitive.Item
                key={opt.value}
                value={opt.value}
                className="flex w-full cursor-default items-center justify-between gap-2 px-3 py-1.5 text-left text-sm outline-none data-[highlighted]:bg-muted data-[state=checked]:text-primary"
              >
                <SelectPrimitive.ItemText>{opt.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator>
                  <Check className="size-3.5 shrink-0" strokeWidth={2} />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}

export default Select
