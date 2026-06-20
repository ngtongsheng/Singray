#!/usr/bin/env node
/**
 * Design-system gate (SPEC §10.2): flags Tailwind class usage that bypasses
 * the token system — non-token color utilities, margin utilities (gap is the
 * sanctioned spacing tool), and arbitrary `[...]` values. Scans every string
 * literal under src/renderer/src, not just className= attrs, since several
 * ui/ primitives keep class lists in lookup objects (Stack.tsx GAP, etc).
 *
 * Suppress a line that has a deliberate, justified exception with a trailing
 * `// design-allow: <reason>` comment.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join } from 'node:path'

const ROOT = join(import.meta.dirname, '..', 'src', 'renderer', 'src')
const EXTS = new Set(['.tsx', '.ts'])

const TW_COLORS = [
  'red',
  'orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'emerald',
  'teal',
  'cyan',
  'sky',
  'blue',
  'indigo',
  'violet',
  'purple',
  'fuchsia',
  'pink',
  'rose',
  'slate',
  'gray',
  'zinc',
  'neutral',
  'stone',
  'black',
  'white'
]
const COLOR_PREFIXES = [
  'bg',
  'text',
  'border',
  'ring',
  'fill',
  'stroke',
  'divide',
  'outline',
  'accent',
  'caret',
  'decoration',
  'shadow',
  'from',
  'via',
  'to'
]
const colorRe = new RegExp(
  `^-?(?:${COLOR_PREFIXES.join('|')})-(?:${TW_COLORS.join('|')})(?:-[0-9]+)?$`
)
const marginRe = /^-?(?:m|mt|mb|ml|mr)-[a-z0-9.]+$/
const marginXyRe = /^-?(?:mx|my)-[a-z0-9.]+$/
const arbitraryRe = /^[a-z0-9:_/-]+-\[.+\]$/i
const hexRe = /#[0-9a-fA-F]{3,8}\b/g

// Charset a plausible Tailwind class token can use (incl. variants: hover:, sm:, [&>p]:).
const classTokenRe = /^[a-zA-Z0-9:_/.[\]#!%-]+$/

const STRING_LITERAL_RE = /'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"/g

function listFiles(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    const st = statSync(path)
    if (st.isDirectory()) out.push(...listFiles(path))
    else if (EXTS.has(extname(name))) out.push(path)
  }
  return out
}

function tokensFromLiteral(literal) {
  const inner = literal.slice(1, -1)
  if (!inner.trim()) return null
  const tokens = inner.split(/\s+/).filter(Boolean)
  if (tokens.some((t) => !classTokenRe.test(t))) return null
  return tokens
}

const violations = []

for (const file of listFiles(ROOT)) {
  // shadcn/Radix primitives under ui/ need arbitrary values
  // (w-[--radix-popover-trigger-width], data-[state=open]:…) and margin utilities
  // (ml-auto, mt-*) that stock shadcn source uses — both forbidden elsewhere.
  const inUi = file.replace(/\\/g, '/').includes('/components/ui/')
  const text = readFileSync(file, 'utf8')
  const lines = text.split('\n')
  lines.forEach((line, i) => {
    if (line.includes('design-allow')) return
    const lineNo = i + 1

    for (const m of line.matchAll(hexRe)) {
      violations.push(`${file}:${lineNo}: raw hex color "${m[0]}" — use a --color-* token`)
    }

    for (const m of line.matchAll(STRING_LITERAL_RE)) {
      const tokens = tokensFromLiteral(m[0])
      if (!tokens) continue
      for (const token of tokens) {
        const bare = token.replace(/^[a-z0-9:[\]&>~]+:/i, '') // strip variant prefixes (hover:, sm:, etc)
        if (colorRe.test(bare)) {
          violations.push(
            `${file}:${lineNo}: non-token color class "${token}" — use a design-system color token`
          )
        }
        if (marginRe.test(bare) && !inUi) {
          violations.push(
            `${file}:${lineNo}: margin class "${token}" — use gap (Stack/Grid) instead of margin`
          )
        }
        if (marginXyRe.test(bare) && !inUi && bare !== 'mx-auto' && bare !== 'my-auto') {
          violations.push(
            `${file}:${lineNo}: margin class "${token}" — only mx-auto/my-auto allowed, use gap otherwise`
          )
        }
        if (arbitraryRe.test(bare) && !inUi) {
          violations.push(
            `${file}:${lineNo}: arbitrary value "${token}" — avoid unless no token/scale fits; add // design-allow: <reason> if unavoidable`
          )
        }
      }
    }
  })
}

if (violations.length > 0) {
  console.error(`Design-system check failed: ${violations.length} violation(s)\n`)
  for (const v of violations) console.error(v)
  process.exit(1)
}
console.log('Design-system check passed.')
