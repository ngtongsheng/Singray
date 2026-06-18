import { Check } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useSettingsContext } from '../../context/SettingsContext'
import { Input, Popover } from '../ui'

/** Editable combobox for the LLM model field: type freely or pick from the fetched list. */
function LlmModelCombobox(): React.JSX.Element {
  const { settings, patch, llmModels } = useSettingsContext()
  const value = settings?.llmModel ?? ''
  const models = llmModels.data ?? []
  const [inputVal, setInputVal] = useState(value)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent): void => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <div ref={rootRef} className="relative flex-1">
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
      <Popover
        open={open && filtered.length > 0}
        origin="top"
        className="inset-x-0 top-full translate-y-1 max-h-48 overflow-y-auto py-1"
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
              className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-surface-2${model === value ? ' text-accent' : ''}`}
            >
              <span className="truncate">{model}</span>
              {model === value && <Check className="size-3.5 shrink-0" strokeWidth={2} />}
            </button>
          ))}
        </div>
      </Popover>
    </div>
  )
}

export default LlmModelCombobox
