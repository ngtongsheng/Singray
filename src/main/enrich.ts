import { parseYoutubeTitle } from '../shared/parseTitle'
import type { EnrichResult, ProbeResult } from '../shared/types'
import { chat } from './llm'

/**
 * LLM metadata enrichment (R3.2, SPEC §12): cleans raw YouTube titles/artists
 * into karaoke-library values ("黑洞裡 Official Music Video" → "黑洞裡",
 * "Khalil Fong (方大同)" → "方大同"). The import path races the model against a
 * short budget and silently falls back to the heuristic parser; the explicit
 * "Clean up with AI" button surfaces errors instead.
 */

/** Import prefill must not feel slower than the old heuristic — short leash. */
const PROBE_BUDGET_MS = 3_000

const SYSTEM_PROMPT = `You clean song metadata for a karaoke library. Given raw YouTube video info, extract the clean song title and performing artist.

Rules:
- title: the song name only. Strip decoration such as "Official Music Video", "MV", "Official Audio", "Lyric Video", "(Live)", "【官方MV】", "官方完整版", quality tags (4K, HD), and bracketed translations or romanizations of the same name.
- artist: the performer, not the channel suffix ("- Topic", "Official", "VEVO"). When the same artist is written in two scripts, prefer the native/local name: "Khalil Fong (方大同)" → "方大同", "IU (아이유)" → "아이유".
- Never translate. Keep the song title in its original language and script.
- If a field cannot be improved, return it unchanged.

Respond with only a JSON object, no other text: {"title":"...","artist":"..."}`

/** Pulls {title, artist} out of a model reply, tolerating code fences and chatter. */
function parseEnrichReply(reply: string): { title: string; artist: string } {
  const match = reply.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('Model reply contained no JSON object.')
  let parsed: unknown
  try {
    parsed = JSON.parse(match[0])
  } catch {
    throw new Error('Model reply was not valid JSON.')
  }
  const { title, artist } = parsed as { title?: unknown; artist?: unknown }
  if (typeof title !== 'string' || !title.trim())
    throw new Error('Model reply was missing a title.')
  return { title: title.trim(), artist: typeof artist === 'string' ? artist.trim() : '' }
}

/** The pre-LLM prefill logic: probe tags when present, else title parsing (SPEC §5.1). */
export function heuristicEnrich(probe: ProbeResult): EnrichResult {
  if (probe.track && probe.artist)
    return { title: probe.track, artist: probe.artist, source: 'heuristic' }
  const parsed = parseYoutubeTitle(probe.title)
  return { title: parsed.title, artist: parsed.artist || probe.channel, source: 'heuristic' }
}

async function cleanWithLlm(
  input: Record<string, string>,
  timeoutMs?: number
): Promise<{ title: string; artist: string }> {
  const reply = await chat(
    [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: JSON.stringify(input) }
    ],
    { temperature: 0, noReasoning: true, ...(timeoutMs !== undefined && { timeoutMs }) }
  )
  return parseEnrichReply(reply)
}

/**
 * Import prefill: LLM under a ~3s budget, heuristic on any failure
 * (unreachable, slow, unconfigured, garbage reply). Never rejects.
 */
export async function enrichProbe(probe: ProbeResult): Promise<EnrichResult> {
  try {
    const input: Record<string, string> = { videoTitle: probe.title, channel: probe.channel }
    if (probe.track) input.trackTag = probe.track
    if (probe.artist) input.artistTag = probe.artist
    const cleaned = await cleanWithLlm(input, PROBE_BUDGET_MS)
    return { ...cleaned, source: 'llm' }
  } catch {
    return heuristicEnrich(probe)
  }
}

/**
 * Edit-meta "Clean up with AI": cleans the song's current values, with the raw
 * upload title as context. No fallback — rejects with a readable message.
 */
export async function cleanMeta(input: {
  title: string
  artist: string
  youtubeTitle: string
}): Promise<EnrichResult> {
  const payload: Record<string, string> = {
    currentTitle: input.title,
    currentArtist: input.artist
  }
  if (input.youtubeTitle) payload.originalUploadTitle = input.youtubeTitle
  const cleaned = await cleanWithLlm(payload)
  return { ...cleaned, source: 'llm' }
}

const LYRICS_PROMPT = `You clean song lyrics for a karaoke app. Given raw pasted lyrics, return only the singable lyric lines.

Rules:
- Remove section headers such as [Verse], [Chorus], [Intro], [Bridge], [Hook], (副歌), (主歌).
- Remove credit / metadata lines: 作詞/作曲/編曲/監製/和聲, "Lyrics by", "Composed by", "Produced by", title or artist headers, album names, contributor and translation credits.
- Keep every actual sung line in its original language and script. Never translate, never rephrase, never add or reorder lines.
- One lyric line per row. Collapse runs of blank lines to a single blank line (a real instrumental break). Trim trailing spaces.
- Respond with only the cleaned lyrics as plain text — no commentary, no code fences.`

/**
 * Lyric cleanup "Clean up with AI" (R3.6): strips section tags / credits, normalizes
 * blank lines, preserves language. No fallback — rejects with a readable message.
 */
export async function cleanLyrics(input: { text: string; language: string }): Promise<string> {
  const reply = await chat(
    [
      { role: 'system', content: LYRICS_PROMPT },
      { role: 'user', content: input.text }
    ],
    { temperature: 0, noReasoning: true, timeoutMs: 60_000 }
  )
  // Tolerate a model that wraps the answer in a code fence despite instructions.
  return reply
    .replace(/^\s*```[a-z]*\n?/i, '')
    .replace(/\n?```\s*$/, '')
    .trim()
}
