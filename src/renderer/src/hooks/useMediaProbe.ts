import { useCallback, useEffect, useRef, useState } from 'react'
import type { Language, LanguageDef, ProbeResult } from '../../../shared/types'
import { detectLanguage } from '../lib/detectLanguage'
import { stripIpcError } from '../lib/stripIpcError'

export interface MediaProbe {
  url: string
  setUrl: (url: string) => void
  filePath: string | null
  setFilePath: (path: string | null) => void
  probing: boolean
  probeError: string | null
  setProbeError: (message: string | null) => void
  probed: ProbeResult | null
  setProbed: (probed: ProbeResult | null) => void
  title: string
  setTitle: (title: string) => void
  artist: string
  setArtist: (artist: string) => void
  language: Language
  setLanguage: (language: Language) => void
  loadFile: (path: string) => Promise<void>
}

/**
 * Probe-and-prefill state machine for ImportDialog's YouTube/file flows:
 * race-guarded against the URL debounce and a file pick landing out of order
 * via a monotonic `probeSeq` (only the latest probe's result is applied).
 */
export function useMediaProbe(languages: LanguageDef[]): MediaProbe {
  const [url, setUrl] = useState('')
  const [filePath, setFilePath] = useState<string | null>(null)
  const [probing, setProbing] = useState(false)
  const [probeError, setProbeError] = useState<string | null>(null)
  const [probed, setProbed] = useState<ProbeResult | null>(null)
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [language, setLanguage] = useState<Language>('unknown')
  const probeSeq = useRef(0)

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
    setProbeError(null)
    setFilePath(path)
    const seq = ++probeSeq.current
    setProbing(true)
    try {
      await prefill(await window.singray.import.probeFile(path), seq)
    } catch (err) {
      if (seq !== probeSeq.current) return
      setProbed(null)
      setProbeError(stripIpcError((err as Error).message))
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
          setProbeError(stripIpcError(err.message))
        })
        .finally(() => {
          if (seq === probeSeq.current) setProbing(false)
        })
    }, 400)
    return () => clearTimeout(timer)
  }, [url, filePath, prefill])

  return {
    url,
    setUrl,
    filePath,
    setFilePath,
    probing,
    probeError,
    setProbeError,
    probed,
    setProbed,
    title,
    setTitle,
    artist,
    setArtist,
    language,
    setLanguage,
    loadFile
  }
}
