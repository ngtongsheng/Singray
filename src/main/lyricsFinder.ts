// LRCLIB lyric finder (R3.5, SPEC §6.2): free keyless lyric database. Searches by
// track/artist, returns candidates with synced (LRC) and/or plain lyrics. Fetched
// in main (renderer CSP blocks cross-origin), rewritten into friendly errors.

import type { LrclibHit, LrclibQuery } from '../shared/types'

const BASE = 'https://lrclib.net/api'
const TIMEOUT_MS = 12_000
/** LRCLIB asks clients to identify themselves. */
const USER_AGENT = 'Singray (https://github.com/ngtongsheng/singray)'
const MAX_HITS = 8

interface RawHit {
  id: number
  trackName: string
  artistName: string
  albumName: string | null
  duration: number | null
  instrumental: boolean
  plainLyrics: string | null
  syncedLyrics: string | null
}

function toHit(r: RawHit): LrclibHit {
  return {
    id: r.id,
    trackName: r.trackName ?? '',
    artistName: r.artistName ?? '',
    albumName: r.albumName ?? '',
    duration: r.duration ?? 0,
    instrumental: r.instrumental ?? false,
    plainLyrics: r.plainLyrics || null,
    syncedLyrics: r.syncedLyrics || null
  }
}

/**
 * Search LRCLIB for a song. Tries structured track/artist params, falling back to
 * a free-text query. Hits are ranked: synced lyrics first, then closeness to the
 * known duration. Instrumentals and lyric-less rows are dropped.
 */
export async function findLyrics(q: LrclibQuery): Promise<LrclibHit[]> {
  const params = new URLSearchParams()
  if (q.title.trim()) params.set('track_name', q.title.trim())
  if (q.artist.trim()) params.set('artist_name', q.artist.trim())
  // No structured terms → free query so the picker is never empty-by-construction.
  if (![...params.keys()].length) params.set('q', `${q.title} ${q.artist}`.trim())

  let res: Response
  try {
    res = await fetch(`${BASE}/search?${params}`, {
      headers: { 'User-Agent': USER_AGENT, 'Lrclib-Client': USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS)
    })
  } catch (err) {
    if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError'))
      throw new Error('LRCLIB did not respond in time — check your connection.')
    const code = (err as { cause?: { code?: string } }).cause?.code
    throw new Error(`Could not reach LRCLIB${code ? ` (${code})` : ''} — check your connection.`)
  }
  if (!res.ok) throw new Error(`LRCLIB returned HTTP ${res.status}.`)

  let raw: RawHit[]
  try {
    raw = (await res.json()) as RawHit[]
  } catch {
    throw new Error('LRCLIB returned an unexpected response.')
  }
  if (!Array.isArray(raw)) return []

  const dur = q.durationSec || 0
  return raw
    .filter((r) => !r.instrumental && (r.syncedLyrics || r.plainLyrics))
    .map(toHit)
    .sort((a, b) => {
      // Synced beats plain; within a tier, closest duration wins.
      const synced = Number(!!b.syncedLyrics) - Number(!!a.syncedLyrics)
      if (synced !== 0) return synced
      if (!dur) return 0
      return Math.abs(a.duration - dur) - Math.abs(b.duration - dur)
    })
    .slice(0, MAX_HITS)
}
