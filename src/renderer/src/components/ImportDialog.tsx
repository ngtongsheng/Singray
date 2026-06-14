import { FolderOpen, Loader2, Search } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  type Language,
  type LanguageDef,
  MEDIA_EXTENSIONS,
  type ProbeResult,
  type SearchResult
} from '../../../shared/types'
import { useAsync } from '../hooks/useAsync'
import { detectLanguage } from '../lib/detectLanguage'
import { stripIpcError } from '../lib/stripIpcError'
import { Button, Dialog, Field, IconButton, Input, Select, Stack, Tabs, Text } from './ui'
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
  const [url, setUrl] = useState('')
  const [filePath, setFilePath] = useState<string | null>(null)
  const [probing, setProbing] = useState(false)
  const [probeError, setProbeError] = useState<string | null>(null)
  const [probed, setProbed] = useState<ProbeResult | null>(null)
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [language, setLanguage] = useState<Language>('unknown')
  const [languages, setLanguages] = useState<LanguageDef[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [query, setQuery] = useState('')
  const search = useAsync((q: string) => window.singray.import.search(q), { resetOnRun: true })
  const [mode, setMode] = useState<SourceMode>('youtube')
  const [dragOver, setDragOver] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const probeSeq = useRef(0)

  useEffect(() => {
    searchRef.current?.focus()
    window.singray.settings.get().then((s) => setLanguages(s.languages))
  }, [])

  const runSearch = (): void => {
    const q = query.trim()
    if (!q || search.loading) return
    void search.run(q)
  }

  const pickResult = (r: SearchResult): void => {
    search.reset()
    setUrl(r.url)
  }

  /** Shared prefill: probe result → form, with LLM enrichment (heuristic fallback in main). */
  const prefill = useCallback(
    async (result: ProbeResult, seq: number): Promise<void> => {
      if (seq !== probeSeq.current) return
      setProbed(result)
      const detected = detectLanguage(result.title, languages)
      if (detected) setLanguage(detected)
      const enriched = await window.singray.llm.enrichProbe(result)
      if (seq !== probeSeq.current) return
      setTitle(enriched.title)
      setArtist(enriched.artist)
    },
    [languages]
  )

  /** Shared local-file flow (R3.7 picker, ADD2 drop): probe the file → same prefill flow. */
  const loadFile = async (path: string): Promise<void> => {
    setUrl('')
    search.reset()
    setProbeError(null)
    setFilePath(path)
    const seq = ++probeSeq.current
    setProbing(true)
    try {
      await prefill(await window.singray.import.probeFile(path), seq)
    } catch (err) {
      if (seq !== probeSeq.current) return
      setProbed(null)
      setProbeError(
        (err as Error).message.replace(/^Error invoking remote method '[^']+': Error: /, '')
      )
    } finally {
      if (seq === probeSeq.current) setProbing(false)
    }
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
      setFilePath(null)
      setProbed(null)
      setProbeError(t('import.unsupportedFile'))
      return
    }
    void loadFile(path)
  }

  useEffect(() => {
    const trimmed = url.trim()
    if (!/^https?:\/\/\S+$/.test(trimmed)) {
      if (!filePath) {
        setProbed(null)
        setProbeError(null)
      }
      return
    }
    setFilePath(null) // a typed URL takes precedence over a previously picked file
    const seq = ++probeSeq.current
    setProbing(true)
    setProbeError(null)
    const timer = setTimeout(() => {
      window.singray.import
        .probe(trimmed)
        .then((result) => prefill(result, seq))
        .catch((err: Error) => {
          if (seq !== probeSeq.current) return
          setProbed(null)
          setProbeError(err.message.replace(/^Error invoking remote method '[^']+': Error: /, ''))
        })
        .finally(() => {
          if (seq === probeSeq.current) setProbing(false)
        })
    }, 400)
    return () => clearTimeout(timer)
  }, [url, filePath, prefill])

  const submit = async (): Promise<void> => {
    if (!probed || !title.trim()) return
    setSubmitting(true)
    try {
      await window.singray.import.start({
        url: filePath ? '' : url.trim(),
        title: title.trim(),
        artist: artist.trim(),
        language,
        youtubeTitle: probed.title,
        ...(filePath ? { filePath } : {})
      })
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog label={t('import.title')} width="w-[640px]" onClose={onClose}>
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
                {search.error && (
                  <Text variant="error" className="mt-1">
                    {stripIpcError(search.error)}
                  </Text>
                )}
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
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=…"
                  trailing={probing && <Loader2 className="size-4 animate-spin text-text-dim" />}
                />
                {probeError && (
                  <Text variant="error" className="mt-1">
                    {probeError}
                  </Text>
                )}
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
              {filePath && (
                <Text as="span" variant="hint" className="min-w-0 truncate">
                  {filePath.split(/[\\/]/).pop()}
                </Text>
              )}
              {probeError && <Text variant="error">{probeError}</Text>}
              {probing && <Loader2 className="size-4 animate-spin text-text-dim" />}
            </Stack>
          )}

          {probed && (
            <Stack gap={4}>
              <div className="w-56 shrink-0">
                <div className="aspect-video overflow-hidden rounded-card bg-surface">
                  {probed.thumbnailUrl && (
                    <img src={probed.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <Text variant="hint" className="mt-2 line-clamp-2">
                  {probed.title}
                </Text>
              </div>
              <Stack direction="column" gap={3} className="flex-1">
                <Field label={t('common.title')}>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                </Field>
                <Field label={t('common.artist')}>
                  <Input value={artist} onChange={(e) => setArtist(e.target.value)} />
                </Field>
                <Field label={t('common.language')}>
                  <Select
                    value={language}
                    onChange={(v) => setLanguage(v as Language)}
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

        <Stack justify="end" gap={3}>
          <Button size="md" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={submit}
            disabled={!probed || !title.trim() || submitting}
          >
            {t('import.add')}
          </Button>
        </Stack>
      </Stack>
    </Dialog>
  )
}

export default ImportDialog
