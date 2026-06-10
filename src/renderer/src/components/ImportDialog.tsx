import { Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { Language, ProbeResult } from '../../../shared/types'
import { parseYoutubeTitle } from '../lib/parseTitle'

interface Props {
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

function ImportDialog({ onClose }: Props): React.JSX.Element {
  const [url, setUrl] = useState('')
  const [probing, setProbing] = useState(false)
  const [probeError, setProbeError] = useState<string | null>(null)
  const [probed, setProbed] = useState<ProbeResult | null>(null)
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [language, setLanguage] = useState<Language>('unknown')
  const [submitting, setSubmitting] = useState(false)
  const urlRef = useRef<HTMLInputElement>(null)
  const probeSeq = useRef(0)

  useEffect(() => {
    urlRef.current?.focus()
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const trimmed = url.trim()
    if (!/^https?:\/\/\S+$/.test(trimmed)) {
      setProbed(null)
      setProbeError(null)
      return
    }
    const seq = ++probeSeq.current
    setProbing(true)
    setProbeError(null)
    const timer = setTimeout(() => {
      window.singray.import
        .probe(trimmed)
        .then((result) => {
          if (seq !== probeSeq.current) return
          setProbed(result)
          if (result.track && result.artist) {
            setTitle(result.track)
            setArtist(result.artist)
          } else {
            const parsed = parseYoutubeTitle(result.title)
            setTitle(parsed.title)
            setArtist(parsed.artist || result.channel)
          }
        })
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
  }, [url])

  const submit = async (): Promise<void> => {
    if (!probed || !title.trim()) return
    setSubmitting(true)
    try {
      await window.singray.import.start({
        url: url.trim(),
        title: title.trim(),
        artist: artist.trim(),
        language,
        youtubeTitle: probed.title
      })
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Add song"
        className="w-[640px] rounded-card border border-border bg-surface-2 p-6 shadow-raised"
      >
        <h2 className="font-semibold text-base">Add song</h2>

        <label className="mt-4 block">
          <span className="mb-1 block text-text-dim text-xs">YouTube URL</span>
          <div className="relative">
            <input
              ref={urlRef}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=…"
              className={inputClass}
            />
            {probing && (
              <Loader2 className="-translate-y-1/2 absolute top-1/2 right-3 size-4 animate-spin text-text-dim" />
            )}
          </div>
          {probeError && <p className="mt-1 text-danger text-xs">{probeError}</p>}
        </label>

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
                <span className="mb-1 block text-text-dim text-xs">Title</span>
                <input
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
          </div>
        )}

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
            onClick={submit}
            disabled={!probed || !title.trim() || submitting}
            className="rounded-control bg-accent px-4 py-2 font-medium text-sm text-text hover:bg-accent-soft disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  )
}

export default ImportDialog
