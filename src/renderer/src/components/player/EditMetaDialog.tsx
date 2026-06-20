import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import type { Language, SongListItem } from '../../../../shared/types'
import { useLibrary } from '../../hooks/useLibrary'
import { useSettings } from '../../hooks/useSettings'
import ArtistChips from '../shared/ArtistChips'
import { Button, Dialog, Field, Input, Select, Stack, Text } from '../ui'

const editMetaSchema = z.object({
  title: z.string().min(1),
  artists: z.array(z.string()),
  language: z.string()
})
type EditMetaValues = z.infer<typeof editMetaSchema>

interface Props {
  song: SongListItem
  onClose: () => void
}

function EditMetaDialog({ song, onClose }: Props): React.JSX.Element {
  const { t } = useTranslation()
  const { settings } = useSettings()
  const { songs } = useLibrary()
  const artistSuggestions = useMemo(
    () => [...new Set(songs.flatMap((s) => s.artists))].sort((a, b) => a.localeCompare(b)),
    [songs]
  )
  const languages = settings?.languages ?? []
  const [saving, setSaving] = useState(false)
  const [cleaning, setCleaning] = useState(false)
  const [cleanError, setCleanError] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ title: string; artist: string } | null>(null)

  const { control, handleSubmit, setValue, watch, formState } = useForm<EditMetaValues>({
    resolver: zodResolver(editMetaSchema),
    defaultValues: { title: song.title, artists: song.artists, language: song.language },
    mode: 'onChange'
  })

  const titleVal = watch('title')
  const artistsVal = watch('artists')

  const options = useMemo(() => {
    const opts = [...languages]
    if (!opts.some((l) => l.code === song.language) && song.language !== 'unknown')
      opts.push({ code: song.language, label: song.language })
    if (!opts.some((l) => l.code === 'unknown'))
      opts.push({ code: 'unknown', label: t('common.unknown') })
    return opts
  }, [languages, song.language, t])

  const primaryArtist = artistsVal[0]?.trim() ?? ''

  const cleanWithAi = async (): Promise<void> => {
    setCleaning(true)
    setCleanError(null)
    setPreview(null)
    try {
      const result = await window.singray.llm.cleanMeta({
        title: titleVal.trim(),
        artist: primaryArtist,
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
    setValue('title', preview.title)
    // AI cleanup only knows the primary artist — replaces the whole list with it.
    if (preview.artist) setValue('artists', [preview.artist])
    setPreview(null)
  }

  const previewIsNoop =
    preview !== null &&
    preview.title === titleVal.trim() &&
    (preview.artist || primaryArtist) === primaryArtist

  const onSubmit = handleSubmit(async (data) => {
    setSaving(true)
    try {
      await window.singray.library.updateMeta(song.id, {
        title: data.title.trim(),
        artists: data.artists,
        language: data.language as Language
      })
      onClose()
    } finally {
      setSaving(false)
    }
  })

  return (
    <Dialog label={t('editMeta.aria')} width="md" onClose={onClose}>
      <Stack direction="column" gap={6}>
        <Stack direction="column" gap={4}>
          <Text as="h2" variant="title">
            {t('editMeta.title')}
          </Text>

          <Stack direction="column" gap={3}>
            <Field label={t('common.title')}>
              <Controller
                name="title"
                control={control}
                render={({ field }) => (
                  <Input
                    autoFocus
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                )}
              />
            </Field>
            <Field label={t('common.artist')}>
              <Controller
                name="artists"
                control={control}
                render={({ field }) => (
                  <ArtistChips
                    value={field.value}
                    onChange={field.onChange}
                    suggestions={artistSuggestions}
                  />
                )}
              />
            </Field>
            <Field label={t('common.language')}>
              <Controller
                name="language"
                control={control}
                render={({ field }) => (
                  <Select<string>
                    value={field.value}
                    onChange={field.onChange}
                    options={options.map((l) => ({ value: l.code, label: l.label }))}
                  />
                )}
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
                    className="rounded-lg border border-border bg-card p-3"
                  >
                    <Text variant="hint">{t('editMeta.preview')}</Text>
                    <p className="text-sm">
                      {preview.title}
                      {preview.artist && (
                        <span className="text-muted-foreground"> · {preview.artist}</span>
                      )}
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
            onClick={cleanWithAi}
            disabled={cleaning || !titleVal?.trim()}
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
            <Button onClick={onClose}>{t('common.cancel')}</Button>
            <Button variant="primary" onClick={onSubmit} disabled={!formState.isValid || saving}>
              {t('common.save')}
            </Button>
          </Stack>
        </Stack>
      </Stack>
    </Dialog>
  )
}

export default EditMetaDialog
