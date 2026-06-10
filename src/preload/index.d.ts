import type { SingrayApi } from '../shared/types'

declare global {
  interface Window {
    singray: SingrayApi
  }
}
