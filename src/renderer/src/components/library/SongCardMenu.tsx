import { Folder, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { SongListItem } from '../../../../shared/types'
import { Menu, MenuItem } from '../ui'

interface Props {
  song: SongListItem
  onDelete: (song: SongListItem) => void
  origin: 'top left' | 'top right'
  className: string
  trigger: (open: boolean, toggle: (e: React.MouseEvent) => void) => React.ReactNode
}

/** Open-folder/delete menu shared by SongCard and SongRow. */
function SongCardMenu({ song, onDelete, origin, className, trigger }: Props): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <Menu origin={origin} className={className} trigger={trigger}>
      <MenuItem onSelect={() => window.singray.library.openFolder(song.id)}>
        <Folder className="size-3.5" strokeWidth={1.5} /> {t('card.openFolder')}
      </MenuItem>
      <MenuItem danger onSelect={() => onDelete(song)}>
        <Trash2 className="size-3.5" strokeWidth={1.5} /> {t('common.delete')}
      </MenuItem>
    </Menu>
  )
}

export default SongCardMenu
