import { Loader2, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Language, SongListItem } from '../../../shared/types'
import { useSettings } from '../hooks/useSettings'
import { Button, Dialog, Field, Input, Select, Stack, Text } from './ui'

interface Props {
  song: SongListItem
  onClose: () => void
}

function EditMetaDialog({ song, onClose }: Props): React.JSX.Element {
  const { t } = useTranslation()
  const [title, setTitle] = useState(song.title)
  const [artist, setArtist] = useState(song.artist)
  const [language, setLanguage] = useState<Language>(song.language)
  const { settings } = useSettings()
  const languages = settings?.languages ?? []
  const [saving, setSaving] = useState(false)
  const [cleaning, setCleaning] = useState(false)
  const [cleanError, setCleanError] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ title: string; artist: string } | null>(null)
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    titleRef.current?.focus()
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
    <Dialog label={t('editMeta.aria')} width="md" onClose={onClose}>
      <Stack direction="column" gap={6}>
        <Stack direction="column" gap={4}>
          <Text as="h2" variant="title">
            {t('editMeta.title')}
          </Text>

          <Stack direction="column" gap={3}>
            <Field label={t('common.title')}>
              <Input ref={titleRef} value={title} onChange={(e) => setTitle(e.target.value)} />
            </Field>
            <Field label={t('common.artist')}>
              <Input value={artist} onChange={(e) => setArtist(e.target.value)} />
            </Field>
            <Field label={t('common.language')}>
              <Select
                value={language}
                onChange={setLanguage}
                options={options.map((l) => ({ value: l.code, label: l.label }))}
              />
            </Field>
          </Stack>

          {(cleanError || preview) && (
            <Stack direction="column" gap={2}>
              {cleanError && <Text variant="error">{cleanError}</Text>}
              {preview &&
                (previewIsNoop ? (
                  <Text variant="hint">{t('editMeta.noChanges')}</Text>
                ) : (
                  <Stack
                    direction="column"
                    gap={2}
                    className="rounded-card border border-border bg-surface p-3"
                  >
                    <Text variant="hint">{t('editMeta.preview')}</Text>
                    <p className="text-sm">
                      {preview.title}
                      {preview.artist && <span className="text-text-dim"> · {preview.artist}</span>}
                    </p>
                    <Stack gap={2}>
                      <Button variant="primary" size="sm" onClick={applyPreview}>
                        {t('editMeta.apply')}
                      </Button>
                      <Button size="sm" onClick={() => setPreview(null)}>
                        {t('editMeta.dismiss')}
                      </Button>
                    </Stack>
                  </Stack>
                ))}
            </Stack>
          )}
        </Stack>

        <Stack justify="between" align="center" gap={3}>
          <Button
            size="md"
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
          <Stack gap={3}>
            <Button size="md" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" size="md" onClick={save} disabled={!title.trim() || saving}>
              {t('common.save')}
            </Button>
          </Stack>
        </Stack>
      </Stack>
    </Dialog>
  )
}

export default EditMetaDialog
