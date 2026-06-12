import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import type { Language, SongListItem } from '../../../shared/types'
import { useMotionPresets } from '../lib/motionPresets'

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

const inputClass =
  'w-full rounded-control border border-border bg-surface px-3 py-2 text-sm placeholder:text-text-dim/60'

function EditMetaDialog({ song, onClose }: Props): React.JSX.Element {
  const [title, setTitle] = useState(song.title)
  const [artist, setArtist] = useState(song.artist)
  const [language, setLanguage] = useState<Language>(song.language)
  const [saving, setSaving] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)
  const { dialogScrim, dialogPanel } = useMotionPresets()

  useEffect(() => {
    titleRef.current?.focus()
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

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
    <motion.div
      {...dialogScrim}
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/50"
    >
      <motion.div
        {...dialogPanel}
        role="dialog"
        aria-modal="true"
        aria-label="Edit song details"
        className="w-[420px] rounded-card border border-border bg-surface-2 p-6 shadow-raised"
      >
        <h2 className="font-semibold text-base">Edit details</h2>

        <div className="mt-4 flex flex-col gap-3">
          <label className="block">
            <span className="mb-1 block text-text-dim text-xs">Title</span>
            <input
              ref={titleRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-text-dim text-xs">Artist</span>
            <input
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-text-dim text-xs">Language</span>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
              className={inputClass}
            >
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-control border border-border px-4 py-2 text-sm hover:bg-surface"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!title.trim() || saving}
            className="rounded-control bg-accent px-4 py-2 font-medium text-sm text-text hover:bg-accent-soft disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

export default EditMetaDialog
