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
  loadFile: (path: string) => Promise<void>
}

export interface MediaProbeOptions {
  languages: LanguageDef[]
  /** Called when probe prefills metadata so the caller can own title/artist/language state. */
  onPrefill: (data: { title: string; artist: string; language: Language }) => void
}

/**
 * Probe-and-prefill state machine for ImportDialog's YouTube/file flows:
 * race-guarded against the URL debounce and a file pick landing out of order
 * via a monotonic `probeSeq` (only the latest probe's result is applied).
 */
export function useMediaProbe({ languages, onPrefill }: MediaProbeOptions): MediaProbe {
  const [url, setUrl] = useState('')
  const [filePath, setFilePath] = useState<string | null>(null)
  const [probing, setProbing] = useState(false)
  const [probeError, setProbeError] = useState<string | null>(null)
  const [probed, setProbed] = useState<ProbeResult | null>(null)
  const probeSeq = useRef(0)
  const onPrefillRef = useRef(onPrefill)
  onPrefillRef.current = onPrefill

  /** Shared prefill: probe result → form, with LLM enrichment (heuristic fallback in main). */
  const prefill = useCallback(
    async (result: ProbeResult, seq: number): Promise<void> => {
      if (seq !== probeSeq.current) return
      setProbed(result)
      const detected = detectLanguage(result.title, languages)
      const enriched = await window.singray.llm.enrichProbe(result)
      if (seq !== probeSeq.current) return
      onPrefillRef.current({
        title: enriched.title,
        artist: enriched.artist,
        language: detected ?? 'unknown'
      })
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
    loadFile
  }
}
