import { useCallback, useRef, useState } from 'react'

export interface UseAsync<T, A extends unknown[]> {
  data: T | null
  loading: boolean
  error: string | null
  /** Run the async fn; resolves to its result, or `undefined` if it threw. */
  run: (...args: A) => Promise<T | undefined>
  /** Clear data/error/loading back to the initial state. */
  reset: () => void
}

/**
 * One-shot async request state for IPC calls (R3.DX2): `{ data, loading, error, run }`.
 * `fn` is read through a ref so `run`/`reset` are stable regardless of fn identity
 * (safe to use as an effect dependency). On error, `data` is preserved (a failed
 * refresh keeps the last good value); pass `{ resetOnRun: true }` to clear it at the
 * start of each run instead.
 */
export function useAsync<T, A extends unknown[]>(
  fn: (...args: A) => Promise<T>,
  opts?: { resetOnRun?: boolean }
): UseAsync<T, A> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fnRef = useRef(fn)
  fnRef.current = fn
  const resetOnRun = opts?.resetOnRun ?? false

  const run = useCallback(
    async (...args: A): Promise<T | undefined> => {
      setLoading(true)
      setError(null)
      if (resetOnRun) setData(null)
      try {
        const result = await fnRef.current(...args)
        setData(result)
        return result
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
        return undefined
      } finally {
        setLoading(false)
      }
    },
    [resetOnRun]
  )

  const reset = useCallback(() => {
    setData(null)
    setError(null)
    setLoading(false)
  }, [])

  return { data, loading, error, run, reset }
}
