import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Language, LanguageDef, SongListItem } from '../../../shared/types'
import { Button, Dialog, Input, Select } from './ui'

interface Props {
  song: SongListItem
  onClose: () => void
}

function EditMetaDialog({ song, onClose }: Props): React.JSX.Element {
  const { t } = useTranslation()
  const [title, setTitle] = useState(song.title)
  const [artist, setArtist] = useState(song.artist)
  const [language, setLanguage] = useState<Language>(song.language)
  const [languages, setLanguages] = useState<LanguageDef[]>([])
  const [saving, setSaving] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    titleRef.current?.focus()
    window.singray.settings.get().then((s) => setLanguages(s.languages))
  }, [])

  // The song's current language stays selectable even if it was removed from Settings.
  const options = useMemo(() => {
    const opts = [...languages]
    if (!opts.some((l) => l.code === song.language) && song.language !== 'unknown')
      opts.push({ code: song.language, label: song.language })
    if (!opts.some((l) => l.code === 'unknown'))
      opts.push({ code: 'unknown', label: t('common.unknown') })
    return opts
  }, [languages, song.language, t])

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
    <Dialog label={t('editMeta.aria')} width="w-[420px]" onClose={onClose}>
      <h2 className="font-semibold text-base">{t('editMeta.title')}</h2>

      <div className="mt-4 flex flex-col gap-3">
        <label className="block">
          <span className="mb-1 block text-text-dim text-xs">{t('common.title')}</span>
          <Input ref={titleRef} value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-text-dim text-xs">{t('common.artist')}</span>
          <Input value={artist} onChange={(e) => setArtist(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-text-dim text-xs">{t('common.language')}</span>
          <Select value={language} onChange={(e) => setLanguage(e.target.value)}>
            {options.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </Select>
        </label>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <Button size="md" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button variant="primary" size="md" onClick={save} disabled={!title.trim() || saving}>
          {t('common.save')}
        </Button>
      </div>
    </Dialog>
  )
}

export default EditMetaDialog
