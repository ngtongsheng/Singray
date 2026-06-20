import { parseYoutubeTitle } from '../shared/parseTitle'
import type { CleanMetaResult, EnrichResult, ProbeResult } from '../shared/types'
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

const CLEAN_META_PROMPT = `You clean song metadata for a karaoke library. Given the song's current title and a list of its artists (plus the raw original upload title for context, when given), extract the clean song title and clean performer names.

Rules:
- title: the song name only. Strip decoration such as "Official Music Video", "MV", "Official Audio", "Lyric Video", "(Live)", "【官方MV】", "官方完整版", quality tags (4K, HD), and bracketed translations or romanizations of the same name.
- artists: one cleaned name per input artist, same order, same count — never merge two artists into one entry, never drop one, never add one. Strip channel suffixes ("- Topic", "Official", "VEVO"). When an artist is written in two scripts, prefer the native/local name: "Khalil Fong (方大同)" → "方大同", "IU (아이유)" → "아이유".
- Never translate. Keep names and the title in their original language and script.
- If a field cannot be improved, return it unchanged.

Respond with only a JSON object, no other text: {"title":"...","artists":["...", ...]}`

/** Pulls {title, artists} out of a model reply, tolerating code fences and chatter. */
function parseCleanMetaReply(reply: string, expectedArtistCount: number): CleanMetaResult {
  const match = reply.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('Model reply contained no JSON object.')
  let parsed: unknown
  try {
    parsed = JSON.parse(match[0])
  } catch {
    throw new Error('Model reply was not valid JSON.')
  }
  const { title, artists } = parsed as { title?: unknown; artists?: unknown }
  if (typeof title !== 'string' || !title.trim())
    throw new Error('Model reply was missing a title.')
  if (!Array.isArray(artists) || artists.some((a) => typeof a !== 'string'))
    throw new Error('Model reply had a malformed artists list.')
  const cleaned = (artists as string[]).map((a) => a.trim())
  if (cleaned.length !== expectedArtistCount)
    throw new Error('Model reply changed the number of artists.')
  return { title: title.trim(), artists: cleaned }
}

/**
 * Edit-meta "Clean up with AI": cleans the song's current values, with the raw
 * upload title as context. No fallback — rejects with a readable message.
 */
export async function cleanMeta(input: {
  title: string
  artists: string[]
  youtubeTitle: string
}): Promise<CleanMetaResult> {
  const payload: Record<string, unknown> = {
    currentTitle: input.title,
    currentArtists: input.artists
  }
  if (input.youtubeTitle) payload.originalUploadTitle = input.youtubeTitle
  const reply = await chat(
    [
      { role: 'system', content: CLEAN_META_PROMPT },
      { role: 'user', content: JSON.stringify(payload) }
    ],
    { temperature: 0, noReasoning: true }
  )
  return parseCleanMetaReply(reply, input.artists.length)
}

const LYRICS_PROMPT = `You clean song lyrics for a karaoke app. Given raw pasted lyrics, return only the singable lyric lines.

Rules:
- Remove section headers such as [Verse], [Chorus], [Intro], [Bridge], [Hook], (副歌), (主歌).
- Remove credit / metadata lines: 作詞/作曲/編曲/監製/和聲, "Lyrics by", "Composed by", "Produced by", title or artist headers, album names, contributor and translation credits.
- CRITICAL: Keep EVERY actual sung line, verbatim, in its original language and script. Never translate, never rephrase, never reorder, never merge or split lines, never drop a repeated line — choruses repeat on purpose, keep each repetition. If you are unsure whether a line is a sung lyric or metadata, KEEP it; when in doubt, keep the line.
- One lyric line per row. Collapse runs of blank lines to a single blank line (a real instrumental break). Trim trailing spaces.
- Respond with only the cleaned lyrics as plain text — no commentary, no code fences.

Example input:
[Verse 1]
作詞：王力宏 作曲：王力宏
日出 日落 我看著時間流逝
你的微笑 還在我心裡

[Chorus]
我愛你 我愛你
我愛你 我愛你

Example output:
日出 日落 我看著時間流逝
你的微笑 還在我心裡

我愛你 我愛你
我愛你 我愛你`

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
