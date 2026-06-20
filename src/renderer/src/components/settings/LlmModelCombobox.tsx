import { Check } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSettingsContext } from '../../context/SettingsContext'
import { Input, Popover, PopoverAnchor, PopoverContent } from '../ui'

/** Editable combobox (Radix Popover): type freely or pick from the fetched model list. */
function LlmModelCombobox(): React.JSX.Element {
  const { settings, patch, llmModels } = useSettingsContext()
  const value = settings?.llmModel ?? ''
  const models = llmModels.data ?? []
  const [inputVal, setInputVal] = useState(value)
  const [open, setOpen] = useState(false)

  useEffect(() => setInputVal(value), [value])

  const filtered = inputVal.trim()
    ? models.filter((m) => m.toLowerCase().includes(inputVal.toLowerCase()))
    : models

  const commit = (v: string): void => {
    const trimmed = v.trim()
    if (trimmed !== value) void patch({ llmModel: trimmed })
    setOpen(false)
  }

  const pick = (model: string): void => {
    setInputVal(model)
    if (model !== value) void patch({ llmModel: model })
    setOpen(false)
  }

  return (
    <Popover open={open && filtered.length > 0} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className="relative flex-1">
          <Input
            value={inputVal}
            onChange={(e) => {
              setInputVal(e.target.value)
              setOpen(true)
            }}
            onFocus={() => {
              if (models.length) setOpen(true)
            }}
            onBlur={(e) => {
              const v = e.target.value
              setTimeout(() => commit(v), 150)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setOpen(false)
              if (e.key === 'Enter') {
                commit(inputVal)
                ;(e.target as HTMLInputElement).blur()
              }
            }}
            placeholder="gemma4:12b-it-qat"
          />
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        sideOffset={4}
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="max-h-48 w-[var(--radix-popover-anchor-width)] overflow-y-auto py-1"
      >
        <div role="listbox">
          {filtered.map((model) => (
            <button
              key={model}
              type="button"
              role="option"
              aria-selected={model === value}
              onMouseDown={(e) => {
                e.preventDefault()
                pick(model)
              }}
              className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted${model === value ? ' text-primary' : ''}`}
            >
              <span className="truncate">{model}</span>
              {model === value && <Check className="size-3.5 shrink-0" strokeWidth={2} />}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export default LlmModelCombobox
