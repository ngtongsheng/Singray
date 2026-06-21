import { zodResolver } from '@hookform/resolvers/zod'
import { clsx as cx } from 'clsx'
import { FolderOpen, Loader2, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { splitArtists } from '../../../../shared/parseTitle'
import { MEDIA_EXTENSIONS, type SearchResult } from '../../../../shared/types'
import { useLibraryContext } from '../../context/LibraryContext'
import { useAsync } from '../../hooks/useAsync'
import { useLibrary } from '../../hooks/useLibrary'
import { useMediaProbe } from '../../hooks/useMediaProbe'
import { useSettings } from '../../hooks/useSettings'
import { stripIpcError } from '../../lib/stripIpcError'
import ArtistChips from '../shared/ArtistChips'
import PipelineRequirementBanner from '../shared/PipelineRequirementBanner'
import {
  AspectRatio,
  Button,
  Dialog,
  DialogFooter,
  Field,
  IconButton,
  Input,
  ScrollArea,
  Segmented,
  Select,
  Stack,
  Text
} from '../ui'

type SourceMode = 'youtube' | 'file'

const importMetaSchema = z.object({
  title: z.string().min(1),
  artists: z.array(z.string()),
  language: z.string()
})
type ImportMetaValues = z.infer<typeof importMetaSchema>

interface Props {
  onClose: () => void
}

function extractYouTubeId(url: string): string | null {
  return url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/)?.[1] ?? null
}

function formatDuration(sec: number): string {
  if (!sec) return ''
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function ImportDialog({ onClose }: Props): React.JSX.Element {
  const { t } = useTranslation()
  const { settings } = useSettings()
  const { songs } = useLibrary()
  const artistSuggestions = useMemo(
    () => [...new Set(songs.flatMap((s) => s.artists))].sort((a, b) => a.localeCompare(b)),
    [songs]
  )
  const languages = settings?.languages ?? []
  const { pipelineStatus } = useLibraryContext()
  const [submitting, setSubmitting] = useState(false)
  const [query, setQuery] = useState('')
  const search = useAsync((q: string) => window.singray.import.search(q), { resetOnRun: true })
  const [mode, setMode] = useState<SourceMode>('youtube')
  const [dragOver, setDragOver] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const {
    control,
    handleSubmit,
    reset: resetMeta,
    watch
  } = useForm<ImportMetaValues>({
    resolver: zodResolver(importMetaSchema),
    defaultValues: { title: '', artists: [], language: 'unknown' },
    mode: 'onChange'
  })

  const onPrefill = useCallback(
    (data: { title: string; artist: string; language: string }) => {
      resetMeta({
        title: data.title,
        artists: data.artist ? splitArtists(data.artist) : [],
        language: data.language
      })
    },
    [resetMeta]
  )

  const probe = useMediaProbe({ languages, onPrefill })

  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  const runSearch = (): void => {
    const q = query.trim()
    if (!q || search.loading) return
    void search.run(q)
  }

  const pickResult = (r: SearchResult): void => {
    search.reset()
    probe.setUrl(r.url)
  }

  const loadFile = async (path: string): Promise<void> => {
    search.reset()
    await probe.loadFile(path)
  }

  const pickFile = async (): Promise<void> => {
    const path = await window.singray.import.pickFile()
    if (!path) return
    await loadFile(path)
  }

  const onDrop = (e: React.DragEvent): void => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (!file) return
    const path = window.singray.import.getPathForFile(file)
    const ext = path.split('.').pop()?.toLowerCase() ?? ''
    if (!(MEDIA_EXTENSIONS as readonly string[]).includes(ext)) {
      probe.setFilePath(null)
      probe.setProbed(null)
      probe.setProbeError(t('import.unsupportedFile'))
      return
    }
    void loadFile(path)
  }

  const onSubmit = handleSubmit(async (data) => {
    if (!probe.probed) return
    setSubmitting(true)
    try {
      await window.singray.import.start({
        url: probe.filePath ? '' : probe.url.trim(),
        title: data.title.trim(),
        artists: data.artists,
        language: data.language,
        youtubeTitle: probe.probed.title,
        ...(probe.filePath ? { filePath: probe.filePath } : {})
      })
      onClose()
    } finally {
      setSubmitting(false)
    }
  })

  const titleVal = watch('title')

  return (
    <Dialog label={t('import.title')} width="2xl" onClose={onClose}>
      <Stack direction="column" gap={6}>
        <Stack direction="column" gap={4}>
          <Text as="h2" variant="title">
            {t('import.title')}
          </Text>

          <PipelineRequirementBanner status={pipelineStatus} />

          <div className="flex justify-center">
            <Segmented<SourceMode>
              value={mode}
              onChange={setMode}
              options={[
                { value: 'youtube', label: t('import.tabYoutube') },
                { value: 'file', label: t('import.tabFile') }
              ]}
            />
          </div>

          {mode === 'youtube' ? (
            <>
              <Field label={t('import.searchLabel')}>
                <Stack direction="column" gap={1}>
                  <Stack gap={2}>
                    <Input
                      ref={searchRef}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && runSearch()}
                      placeholder={t('import.searchPlaceholder')}
                      trailing={
                        search.loading && (
                          <Loader2 className="size-4 animate-spin text-muted-foreground" />
                        )
                      }
                    />
                    <IconButton
                      size="md"
                      aria-label={t('import.searchLabel')}
                      onClick={runSearch}
                      disabled={!query.trim() || search.loading}
                    >
                      <Search className="size-4" />
                    </IconButton>
                  </Stack>
                  {search.error && <Text variant="error">{stripIpcError(search.error)}</Text>}
                </Stack>
              </Field>

              {search.data && (
                <ScrollArea className="h-64 rounded-lg border border-border">
                  <ul className="divide-y divide-border">
                    {search.data.length === 0 && (
                      <li className="px-3 py-4 text-center">
                        <Text variant="hint">{t('import.noResults')}</Text>
                      </li>
                    )}
                    {search.data.map((r) => (
                      <li key={r.url}>
                        <Button
                          variant="bare"
                          size="bare"
                          onClick={() => pickResult(r)}
                          className="flex w-full items-center gap-3 px-2 py-2 text-left hover:bg-card"
                        >
                          <div className="w-24 shrink-0 overflow-hidden rounded bg-card">
                            <AspectRatio ratio={16 / 9}>
                              {r.thumbnailUrl && (
                                <img
                                  src={r.thumbnailUrl}
                                  alt=""
                                  className="absolute inset-0 h-full w-full object-cover"
                                />
                              )}
                            </AspectRatio>
                          </div>
                          <Stack direction="column" gap={1} className="min-w-0 flex-1">
                            <Text variant="item" className="truncate">
                              {r.title}
                            </Text>
                            <Text variant="hint" className="truncate">
                              {r.channel}
                              {r.duration > 0 && ` · ${formatDuration(r.duration)}`}
                            </Text>
                          </Stack>
                        </Button>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              )}

              <Field label={t('import.urlLabel')}>
                <Stack direction="column" gap={1}>
                  <Input
                    value={probe.url}
                    onChange={(e) => probe.setUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=…"
                    trailing={
                      probe.probing && (
                        <Loader2 className="size-4 animate-spin text-muted-foreground" />
                      )
                    }
                  />
                  {probe.probeError && <Text variant="error">{probe.probeError}</Text>}
                </Stack>
              </Field>
            </>
          ) : (
            <Stack
              direction="column"
              gap={2}
              align="center"
              className={cx(
                'rounded-lg border-2 border-dashed p-6 text-center transition-colors',
                dragOver ? 'border-primary bg-primary/5' : 'border-border'
              )}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
            >
              <Button onClick={pickFile}>
                <FolderOpen className="size-4" strokeWidth={1.5} /> {t('import.fromFile')}
              </Button>
              <Text variant="hint">{t('import.dropHint')}</Text>
              {probe.filePath && (
                <Text as="span" variant="hint" className="min-w-0 truncate">
                  {probe.filePath.split(/[\\/]/).pop()}
                </Text>
              )}
              {probe.probeError && <Text variant="error">{probe.probeError}</Text>}
              {probe.probing && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
            </Stack>
          )}

          {probe.probed && (
            <Stack gap={4}>
              <Stack direction="column" gap={2} className="w-56 shrink-0">
                <div className="overflow-hidden rounded-lg bg-card">
                  <AspectRatio ratio={16 / 9}>
                    {(() => {
                      const ytId = !probe.filePath ? extractYouTubeId(probe.url) : null
                      return ytId ? (
                        <iframe
                          className="absolute inset-0 h-full w-full"
                          src={`https://www.youtube-nocookie.com/embed/${ytId}`}
                          allow="autoplay; encrypted-media; picture-in-picture"
                          allowFullScreen
                          title={probe.probed.title}
                        />
                      ) : probe.probed.thumbnailUrl ? (
                        <img
                          src={probe.probed.thumbnailUrl}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      ) : null
                    })()}
                  </AspectRatio>
                </div>
                <Text variant="hint" className="line-clamp-2">
                  {probe.probed.title}
                </Text>
              </Stack>
              <Stack direction="column" gap={3} className="flex-1">
                <Field label={t('common.title')}>
                  <Controller
                    name="title"
                    control={control}
                    render={({ field }) => (
                      <Input value={field.value} onChange={field.onChange} onBlur={field.onBlur} />
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
                        options={[
                          ...languages.map((l) => ({ value: l.code, label: l.label })),
                          ...(languages.some((l) => l.code === 'unknown')
                            ? []
                            : [{ value: 'unknown', label: t('common.unknown') }])
                        ]}
                      />
                    )}
                  />
                </Field>
              </Stack>
            </Stack>
          )}
        </Stack>

        <DialogFooter>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            variant="primary"
            onClick={onSubmit}
            disabled={
              !probe.probed ||
              !titleVal?.trim() ||
              submitting ||
              (pipelineStatus !== null && !pipelineStatus.ready)
            }
          >
            {t('import.add')}
          </Button>
        </DialogFooter>
      </Stack>
    </Dialog>
  )
}

export default ImportDialog
