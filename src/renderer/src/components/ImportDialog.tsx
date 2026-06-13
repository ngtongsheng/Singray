import { FolderOpen, Loader2, Search } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Language, LanguageDef, ProbeResult, SearchResult } from '../../../shared/types'
import { Button, Dialog, IconButton, Input, Select } from './ui'

interface Props {
  onClose: () => void
}

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
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [results, setResults] = useState<SearchResult[] | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const probeSeq = useRef(0)

  useEffect(() => {
    searchRef.current?.focus()
    window.singray.settings.get().then((s) => setLanguages(s.languages))
  }, [])

  const runSearch = async (): Promise<void> => {
    const q = query.trim()
    if (!q || searching) return
    setSearching(true)
    setSearchError(null)
    setResults(null)
    try {
      setResults(await window.singray.import.search(q))
    } catch (err) {
      setSearchError(
        (err as Error).message.replace(/^Error invoking remote method '[^']+': Error: /, '')
      )
    } finally {
      setSearching(false)
    }
  }

  const pickResult = (r: SearchResult): void => {
    setResults(null)
    setSearchError(null)
    setUrl(r.url)
  }

  /** Shared prefill: probe result → form, with LLM enrichment (heuristic fallback in main). */
  const prefill = useCallback(async (result: ProbeResult, seq: number): Promise<void> => {
    if (seq !== probeSeq.current) return
    setProbed(result)
    const enriched = await window.singray.llm.enrichProbe(result)
    if (seq !== probeSeq.current) return
    setTitle(enriched.title)
    setArtist(enriched.artist)
  }, [])

  /** "From file" (R3.7): native picker → probe the local file → same prefill flow. */
  const pickFile = async (): Promise<void> => {
    const path = await window.singray.import.pickFile()
    if (!path) return
    setUrl('')
    setResults(null)
    setSearchError(null)
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
      <h2 className="font-semibold text-base">{t('import.title')}</h2>

      <label className="mt-4 block">
        <span className="mb-1 block text-text-dim text-xs">{t('import.searchLabel')}</span>
        <div className="flex gap-2">
          <Input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runSearch()}
            placeholder={t('import.searchPlaceholder')}
            trailing={searching && <Loader2 className="size-4 animate-spin text-text-dim" />}
          />
          <IconButton
            aria-label={t('import.searchLabel')}
            onClick={runSearch}
            disabled={!query.trim() || searching}
          >
            <Search className="size-4" />
          </IconButton>
        </div>
        {searchError && <p className="mt-1 text-danger text-xs">{searchError}</p>}
      </label>

      {results && (
        <ul className="mt-2 max-h-64 divide-y divide-border overflow-y-auto rounded-card border border-border">
          {results.length === 0 && (
            <li className="px-3 py-4 text-center text-text-dim text-xs">{t('import.noResults')}</li>
          )}
          {results.map((r) => (
            <li key={r.url}>
              <Button
                variant="bare"
                size="bare"
                onClick={() => pickResult(r)}
                className="flex w-full items-center gap-3 px-2 py-2 text-left hover:bg-surface"
              >
                <div className="aspect-video w-24 shrink-0 overflow-hidden rounded bg-surface">
                  {r.thumbnailUrl && (
                    <img src={r.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{r.title}</p>
                  <p className="truncate text-text-dim text-xs">
                    {r.channel}
                    {r.duration > 0 && ` · ${formatDuration(r.duration)}`}
                  </p>
                </div>
              </Button>
            </li>
          ))}
        </ul>
      )}

      <label className="mt-4 block">
        <span className="mb-1 block text-text-dim text-xs">{t('import.urlLabel')}</span>
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=…"
          trailing={probing && <Loader2 className="size-4 animate-spin text-text-dim" />}
        />
        {probeError && <p className="mt-1 text-danger text-xs">{probeError}</p>}
      </label>

      <div className="mt-3 flex items-center gap-2">
        <Button onClick={pickFile}>
          <FolderOpen className="size-4" strokeWidth={1.5} /> {t('import.fromFile')}
        </Button>
        {filePath && (
          <span className="min-w-0 truncate text-text-dim text-xs">
            {filePath.split(/[\\/]/).pop()}
          </span>
        )}
      </div>

      {probed && (
        <div className="mt-4 flex gap-4">
          <div className="w-56 shrink-0">
            <div className="aspect-video overflow-hidden rounded-card bg-surface">
              {probed.thumbnailUrl && (
                <img src={probed.thumbnailUrl} alt="" className="h-full w-full object-cover" />
              )}
            </div>
            <p className="mt-2 line-clamp-2 text-text-dim text-xs">{probed.title}</p>
          </div>
          <div className="flex flex-1 flex-col gap-3">
            <label className="block">
              <span className="mb-1 block text-text-dim text-xs">{t('common.title')}</span>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1 block text-text-dim text-xs">{t('common.artist')}</span>
              <Input value={artist} onChange={(e) => setArtist(e.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1 block text-text-dim text-xs">{t('common.language')}</span>
              <Select value={language} onChange={(e) => setLanguage(e.target.value)}>
                {languages.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
                {!languages.some((l) => l.code === 'unknown') && (
                  <option value="unknown">{t('common.unknown')}</option>
                )}
              </Select>
            </label>
          </div>
        </div>
      )}

      <div className="mt-6 flex justify-end gap-3">
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
      </div>
    </Dialog>
  )
}

export default ImportDialog
