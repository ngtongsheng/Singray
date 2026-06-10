import { useEffect, useState } from 'react'
import type { ImportProgress } from '../../../shared/types'

/** Live import progress per songId, fed by main `import:progress` events. */
export function useImports(): Map<string, ImportProgress> {
  const [progress, setProgress] = useState<Map<string, ImportProgress>>(new Map())

  useEffect(() => {
    return window.singray.import.onProgress((p) => {
      setProgress((prev) => {
        const next = new Map(prev)
        if (p.stage === 'done' || p.stage === 'error') next.delete(p.songId)
        else next.set(p.songId, p)
        return next
      })
    })
  }, [])

  return progress
}
