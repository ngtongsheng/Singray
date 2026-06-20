import { X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Input, Stack } from '../ui'

interface Props {
  value: string[]
  onChange: (artists: string[]) => void
  /** Distinct artist names already in the library, for the type-ahead dropdown. */
  suggestions: string[]
}

/** Multi-select artist input (#63): chips + free text, with existing-artist suggestions. */
function ArtistChips({ value, onChange, suggestions }: Props): React.JSX.Element {
  const { t } = useTranslation()
  const [text, setText] = useState('')

  const add = (name: string): void => {
    const trimmed = name.trim()
    setText('')
    if (!trimmed || value.some((a) => a.toLowerCase() === trimmed.toLowerCase())) return
    onChange([...value, trimmed])
  }

  const remove = (name: string): void => onChange(value.filter((a) => a !== name))

  const matches = text.trim()
    ? suggestions.filter(
        (s) =>
          s.toLowerCase().includes(text.trim().toLowerCase()) &&
          !value.some((a) => a.toLowerCase() === s.toLowerCase())
      )
    : []

  return (
    <Stack direction="column" gap={1.5}>
      {value.length > 0 && (
        <Stack gap={1.5} wrap>
          {value.map((artist) => (
            <span
              key={artist}
              className="flex items-center gap-1 rounded-full border border-input bg-card py-1 pl-2.5 pr-1.5 text-sm"
            >
              {artist}
              <button
                type="button"
                onClick={() => remove(artist)}
                title={t('common.remove', { label: artist })}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-3" strokeWidth={1.5} />
              </button>
            </span>
          ))}
        </Stack>
      )}
      <div className="relative">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add(text)
            } else if (e.key === 'Backspace' && !text && value.length > 0) {
              remove(value[value.length - 1] as string)
            }
          }}
          onBlur={() => add(text)}
          placeholder={t('common.addArtist')}
        />
        {matches.length > 0 && (
          <div className="absolute top-full z-10 w-full pt-1">
            <ul className="overflow-hidden rounded-md border border-border bg-popover shadow-md">
              {matches.slice(0, 6).map((m) => (
                <li key={m}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => add(m)}
                    className="block w-full px-3 py-1.5 text-left text-sm hover:bg-card"
                  >
                    {m}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Stack>
  )
}

export default ArtistChips
