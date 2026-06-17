import { FolderOpen, Loader2, Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MEDIA_EXTENSIONS, type SearchResult } from '../../../shared/types'
import { useAsync } from '../hooks/useAsync'
import { useMediaProbe } from '../hooks/useMediaProbe'
import { useSettings } from '../hooks/useSettings'
import { stripIpcError } from '../lib/stripIpcError'
import {
  Button,
  Dialog,
  DialogFooter,
  Field,
  IconButton,
  Input,
  Select,
  Stack,
  Tabs,
  Text
} from './ui'
import { cx } from './ui/cx'

interface Props {
  onClose: () => void
}

type SourceMode = 'youtube' | 'file'

function formatDuration(sec: number): string {
  if (!sec) return ''
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function ImportDialog({ onClose }: Props): React.JSX.Element {
  const { t } = useTranslation()
  const { settings } = useSettings()
  const languages = settings?.languages ?? []
  const probe = useMediaProbe(languages)
  const [submitting, setSubmitting] = useState(false)
  const [query, setQuery] = useState('')
  const search = useAsync((q: string) => window.singray.import.search(q), { resetOnRun: true })
  const [mode, setMode] = useState<SourceMode>('youtube')
  const [dragOver, setDragOver] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

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

  const submit = async (): Promise<void> => {
    if (!probe.probed || !probe.title.trim()) return
    setSubmitting(true)
    try {
      await window.singray.import.start({
        url: probe.filePath ? '' : probe.url.trim(),
        title: probe.title.trim(),
        artist: probe.artist.trim(),
        language: probe.language,
        youtubeTitle: probe.probed.title,
        ...(probe.filePath ? { filePath: probe.filePath } : {})
      })
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog label={t('import.title')} width="2xl" onClose={onClose}>
      <Stack direction="column" gap={6}>
        <Stack direction="column" gap={4}>
          <Text as="h2" variant="title">
            {t('import.title')}
          </Text>

          <Tabs
            tabs={[
              { id: 'youtube', label: t('import.tabYoutube') },
              { id: 'file', label: t('import.tabFile') }
            ]}
            active={mode}
            onChange={setMode}
          />

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
                        search.loading && <Loader2 className="size-4 animate-spin text-text-dim" />
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
                <ul className="max-h-64 divide-y divide-border overflow-y-auto rounded-card border border-border">
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
                        className="flex w-full items-center gap-3 px-2 py-2 text-left hover:bg-surface"
                      >
                        <div className="aspect-video w-24 shrink-0 overflow-hidden rounded bg-surface">
                          {r.thumbnailUrl && (
                            <img
                              src={r.thumbnailUrl}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm">{r.title}</p>
                          <Text variant="hint" className="truncate">
                            {r.channel}
                            {r.duration > 0 && ` · ${formatDuration(r.duration)}`}
                          </Text>
                        </div>
                      </Button>
                    </li>
                  ))}
                </ul>
              )}

              <Field label={t('import.urlLabel')}>
                <Stack direction="column" gap={1}>
                  <Input
                    value={probe.url}
                    onChange={(e) => probe.setUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=…"
                    trailing={
                      probe.probing && <Loader2 className="size-4 animate-spin text-text-dim" />
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
                'rounded-card border-2 border-dashed p-6 text-center transition-colors',
                dragOver ? 'border-accent bg-accent/5' : 'border-border'
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
              {probe.probing && <Loader2 className="size-4 animate-spin text-text-dim" />}
            </Stack>
          )}

          {probe.probed && (
            <Stack gap={4}>
              <Stack direction="column" gap={2} className="w-56 shrink-0">
                <div className="aspect-video overflow-hidden rounded-card bg-surface">
                  {probe.probed.thumbnailUrl && (
                    <img
                      src={probe.probed.thumbnailUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
                <Text variant="hint" className="line-clamp-2">
                  {probe.probed.title}
                </Text>
              </Stack>
              <Stack direction="column" gap={3} className="flex-1">
                <Field label={t('common.title')}>
                  <Input value={probe.title} onChange={(e) => probe.setTitle(e.target.value)} />
                </Field>
                <Field label={t('common.artist')}>
                  <Input value={probe.artist} onChange={(e) => probe.setArtist(e.target.value)} />
                </Field>
                <Field label={t('common.language')}>
                  <Select
                    value={probe.language}
                    onChange={probe.setLanguage}
                    options={[
                      ...languages.map((l) => ({ value: l.code, label: l.label })),
                      ...(languages.some((l) => l.code === 'unknown')
                        ? []
                        : [{ value: 'unknown', label: t('common.unknown') }])
                    ]}
                  />
                </Field>
              </Stack>
            </Stack>
          )}
        </Stack>

        <DialogFooter>
          <Button size="md" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={submit}
            disabled={!probe.probed || !probe.title.trim() || submitting}
          >
            {t('import.add')}
          </Button>
        </DialogFooter>
      </Stack>
    </Dialog>
  )
}

export default ImportDialog
