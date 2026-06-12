import { useEffect, useRef, useState } from 'react'
import type { Language, SongListItem } from '../../../shared/types'
import { Button, Dialog, Input, Select } from './ui'

interface Props {
  song: SongListItem
  onClose: () => void
}

const LANGUAGES: { value: Language; label: string }[] = [
  { value: 'zh', label: '中文' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
  { value: 'unknown', label: 'Unknown' }
]

function EditMetaDialog({ song, onClose }: Props): React.JSX.Element {
  const [title, setTitle] = useState(song.title)
  const [artist, setArtist] = useState(song.artist)
  const [language, setLanguage] = useState<Language>(song.language)
  const [saving, setSaving] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  const save = async (): Promise<void> => {
    if (!title.trim()) return
    setSaving(true)
    try {
      await window.singray.library.updateMeta(song.id, {
        title: title.trim(),
        artist: artist.trim(),
        language
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog label="Edit song details" width="w-[420px]" onClose={onClose}>
      <h2 className="font-semibold text-base">Edit details</h2>

      <div className="mt-4 flex flex-col gap-3">
        <label className="block">
          <span className="mb-1 block text-text-dim text-xs">Title</span>
          <Input ref={titleRef} value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-text-dim text-xs">Artist</span>
          <Input value={artist} onChange={(e) => setArtist(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-text-dim text-xs">Language</span>
          <Select value={language} onChange={(e) => setLanguage(e.target.value as Language)}>
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </Select>
        </label>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <Button size="md" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" size="md" onClick={save} disabled={!title.trim() || saving}>
          Save
        </Button>
      </div>
    </Dialog>
  )
}

export default EditMetaDialog
