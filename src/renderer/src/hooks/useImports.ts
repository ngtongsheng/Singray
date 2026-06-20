import { produce } from 'immer'
import { useEffect, useState } from 'react'
import type { ImportProgress } from '../../../shared/types'

/** Live import progress per songId, fed by main `import:progress` events. */
export function useImports(): Map<string, ImportProgress> {
  const [progress, setProgress] = useState<Map<string, ImportProgress>>(new Map())

  useEffect(() => {
    return window.singray.import.onProgress((p) => {
      setProgress((prev) =>
        produce(prev, (draft) => {
          if (p.stage === 'done' || p.stage === 'error') draft.delete(p.songId)
          else draft.set(p.songId, p)
        })
      )
    })
  }, [])

  return progress
}
