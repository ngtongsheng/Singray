import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Settings } from '../../../shared/types'

export const SETTINGS_KEY = ['settings'] as const

export interface UseSettings {
  settings: Settings | null
  patch: (p: Partial<Settings>) => Promise<Settings>
}

export function useSettings(): UseSettings {
  const qc = useQueryClient()
  const { data: settings = null } = useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: () => window.singray.settings.get(),
    staleTime: Infinity
  })
  const { mutateAsync } = useMutation({
    mutationFn: (p: Partial<Settings>) => window.singray.settings.set(p),
    onMutate: async (p) => {
      await qc.cancelQueries({ queryKey: SETTINGS_KEY })
      const prev = qc.getQueryData<Settings>(SETTINGS_KEY)
      if (prev) qc.setQueryData(SETTINGS_KEY, { ...prev, ...p })
      return { prev }
    },
    onError: (_, __, ctx) => {
      if (ctx?.prev) qc.setQueryData(SETTINGS_KEY, ctx.prev)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: SETTINGS_KEY })
  })
  return { settings, patch: mutateAsync }
}
