export type DiffOp =
  | { type: 'same'; line: string }
  | { type: 'removed'; line: string }
  | { type: 'added'; line: string }

/**
 * AIC1: line-level LCS diff for the cleanup preview. Lines present in both `before` and
 * `after` (in order) are `same`; lines only in `before` are `removed`, only in `after` are
 * `added`. Used to render a single unified column instead of two separate panes.
 */
export function diffLines(before: string[], after: string[]): DiffOp[] {
  const n = before.length
  const m = after.length
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      const row = dp[i] as number[]
      row[j] =
        before[i] === after[j]
          ? ((dp[i + 1] as number[])[j + 1] as number) + 1
          : Math.max((dp[i + 1] as number[])[j] as number, row[j + 1] as number)
    }
  }

  const ops: DiffOp[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    const a = before[i] as string
    const b = after[j] as string
    if (a === b) {
      ops.push({ type: 'same', line: a })
      i++
      j++
    } else if (((dp[i + 1] as number[])[j] as number) >= ((dp[i] as number[])[j + 1] as number)) {
      ops.push({ type: 'removed', line: a })
      i++
    } else {
      ops.push({ type: 'added', line: b })
      j++
    }
  }
  while (i < n) {
    ops.push({ type: 'removed', line: before[i] as string })
    i++
  }
  while (j < m) {
    ops.push({ type: 'added', line: after[j] as string })
    j++
  }
  return ops
}
