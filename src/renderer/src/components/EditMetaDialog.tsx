import { Loader2, Sparkles } from 'lucide-react'
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
  const [cleaning, setCleaning] = useState(false)
  const [cleanError, setCleanError] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ title: string; artist: string } | null>(null)
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

  const cleanWithAi = async (): Promise<void> => {
    setCleaning(true)
    setCleanError(null)
    setPreview(null)
    try {
      const result = await window.singray.llm.cleanMeta({
        title: title.trim(),
        artist: artist.trim(),
        youtubeTitle: song.youtubeTitle
      })
      setPreview({ title: result.title, artist: result.artist })
    } catch (err) {
      setCleanError(
        (err as Error).message.replace(/^Error invoking remote method '[^']+': Error: /, '')
      )
    } finally {
      setCleaning(false)
    }
  }

  const applyPreview = (): void => {
    if (!preview) return
    setTitle(preview.title)
    if (preview.artist) setArtist(preview.artist)
    setPreview(null)
  }

  // Applying would change nothing → tell the user it's already clean instead.
  const previewIsNoop =
    preview !== null &&
    preview.title === title.trim() &&
    (preview.artist || artist.trim()) === artist.trim()

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

      <div className="mt-3">
        <Button
          size="sm"
          onClick={cleanWithAi}
          disabled={cleaning || !title.trim()}
          title={t('editMeta.cleanTip')}
        >
          {cleaning ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Sparkles className="size-3.5" />
          )}
          {t('editMeta.clean')}
        </Button>
        {cleanError && <p className="mt-2 text-danger text-xs">{cleanError}</p>}
        {preview &&
          (previewIsNoop ? (
            <p className="mt-2 text-text-dim text-xs">{t('editMeta.noChanges')}</p>
          ) : (
            <div className="mt-2 rounded-card border border-border bg-surface p-3">
              <p className="text-text-dim text-xs">{t('editMeta.preview')}</p>
              <p className="mt-1 text-sm">
                {preview.title}
                {preview.artist && <span className="text-text-dim"> · {preview.artist}</span>}
              </p>
              <div className="mt-2 flex gap-2">
                <Button variant="primary" size="sm" onClick={applyPreview}>
                  {t('editMeta.apply')}
                </Button>
                <Button size="sm" onClick={() => setPreview(null)}>
                  {t('editMeta.dismiss')}
                </Button>
              </div>
            </div>
          ))}
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
