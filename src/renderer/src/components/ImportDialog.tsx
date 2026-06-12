import { Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { Language, LanguageDef, ProbeResult } from '../../../shared/types'
import { parseYoutubeTitle } from '../lib/parseTitle'
import { Button, Dialog, Input, Select } from './ui'

interface Props {
  onClose: () => void
}

function ImportDialog({ onClose }: Props): React.JSX.Element {
  const [url, setUrl] = useState('')
  const [probing, setProbing] = useState(false)
  const [probeError, setProbeError] = useState<string | null>(null)
  const [probed, setProbed] = useState<ProbeResult | null>(null)
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [language, setLanguage] = useState<Language>('unknown')
  const [languages, setLanguages] = useState<LanguageDef[]>([])
  const [submitting, setSubmitting] = useState(false)
  const urlRef = useRef<HTMLInputElement>(null)
  const probeSeq = useRef(0)

  useEffect(() => {
    urlRef.current?.focus()
    window.singray.settings.get().then((s) => setLanguages(s.languages))
  }, [])

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
    <Dialog label="Add song" width="w-[640px]" onClose={onClose}>
      <h2 className="font-semibold text-base">Add song</h2>

      <label className="mt-4 block">
        <span className="mb-1 block text-text-dim text-xs">YouTube URL</span>
        <Input
          ref={urlRef}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=…"
          trailing={probing && <Loader2 className="size-4 animate-spin text-text-dim" />}
        />
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
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1 block text-text-dim text-xs">Artist</span>
              <Input value={artist} onChange={(e) => setArtist(e.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1 block text-text-dim text-xs">Language</span>
              <Select value={language} onChange={(e) => setLanguage(e.target.value)}>
                {languages.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
                {!languages.some((l) => l.code === 'unknown') && (
                  <option value="unknown">Unknown</option>
                )}
              </Select>
            </label>
          </div>
        </div>
      )}

      <div className="mt-6 flex justify-end gap-3">
        <Button size="md" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="md"
          onClick={submit}
          disabled={!probed || !title.trim() || submitting}
        >
          Add
        </Button>
      </div>
    </Dialog>
  )
}

export default ImportDialog
