/** Heuristic split of a raw YouTube title into {artist, title} (SPEC §5.1). */
export function parseYoutubeTitle(raw: string): { artist: string; title: string } {
  // Strip common decoration: (Official Video), 【官方MV】, [MV], etc.
  const cleaned = raw
    .replace(
      /[([【「][^)\]】」]*(official|mv|video|lyric|audio|4k|hd|官方|高清|歌词)[^)\]】」]*[)\]】」]/gi,
      ''
    )
    .trim()

  // 「song」 quoted form: artist 「song」
  const quoted = /^(.*?)\s*[「『]([^」』]+)[」』]/.exec(cleaned)
  if (quoted?.[1] && quoted[2]) {
    return { artist: quoted[1].trim(), title: quoted[2].trim() }
  }

  // artist - title (first dash family separator wins)
  const dash = /^(.*?)\s*[-–—|]\s*(.+)$/.exec(cleaned)
  if (dash?.[1] && dash[2]) {
    return { artist: dash[1].trim(), title: dash[2].trim() }
  }

  return { artist: '', title: cleaned }
}

/** Splits a combined artist credit ("Bruno Mars, Anderson .Paak, Silk Sonic") into separate names. */
export function splitArtists(raw: string): string[] {
  return raw
    .split(/\s*,\s*|\s*&\s*|\s+(?:feat\.?|ft\.?|featuring)\s+|\s+[xX]\s+|\s*\/\s*/)
    .map((a) => a.trim())
    .filter(Boolean)
}
