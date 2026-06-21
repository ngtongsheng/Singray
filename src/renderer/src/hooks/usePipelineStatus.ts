import { useEffect, useState } from 'react'
import type { PipelineStatus } from '../../../shared/types'

/**
 * Fresh pipeline status fetched on mount — never cached, so a point of use
 * (e.g. the import dialog) reflects drift since the first-run gate (ffmpeg
 * removed, etc.) instead of trusting a stale snapshot.
 */
export function usePipelineStatus(): PipelineStatus | null {
  const [status, setStatus] = useState<PipelineStatus | null>(null)

  useEffect(() => {
    let live = true
    void window.singray.pipeline.status().then((s) => {
      if (live) setStatus(s)
    })
    return () => {
      live = false
    }
  }, [])

  return status
}
