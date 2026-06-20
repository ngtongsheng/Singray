import { Search } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useLibraryContext } from '../../context/LibraryContext'
import { Input } from '../ui'

/** Library search box; "/" focuses it from anywhere outside an input. */
function SearchInput(): React.JSX.Element {
  const { t } = useTranslation()
  const { query, setQuery } = useLibraryContext()
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault()
        ref.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="app-no-drag w-72">
      <Input
        ref={ref}
        uiSize="sm"
        icon={<Search className="size-4 text-muted-foreground" />}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('library.searchPlaceholder')}
      />
    </div>
  )
}

export default SearchInput
