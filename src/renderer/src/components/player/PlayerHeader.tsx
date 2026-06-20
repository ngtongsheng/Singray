import {
  ArrowLeft,
  AudioWaveform,
  BarChart3,
  Info,
  Mic,
  MoreVertical,
  Pencil,
  Type
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { usePlayerContext } from '../../context/PlayerContext'
import SettingsButton from '../library/SettingsButton'
import TitleArtist from '../shared/TitleArtist'
import { Button, IconButton, Menu, MenuItem, Stack, Text } from '../ui'

/** Titlebar row: back + title/artist (left), stage toggles + edit actions + more menu (right). */
function PlayerHeader(): React.JSX.Element {
  const { t } = useTranslation()
  const {
    song,
    onExit,
    onArtistClick,
    error,
    lyrics,
    onEditLyrics,
    showWaveform,
    toggleWaveform,
    showBars,
    toggleBars,
    openEditMeta,
    openDetails,
    onRecordings
  } = usePlayerContext()

  return (
    <Stack justify="between" className="w-full">
      <Stack gap={3}>
        <IconButton
          onClick={onExit}
          title={t('common.backEsc')}
          aria-label={t('common.backEsc')}
          className="app-no-drag text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" strokeWidth={1.5} />
        </IconButton>
        <TitleArtist
          title={song.title}
          label={
            <Text as="span" variant="hint">
              {t('player.nowPlaying')}
            </Text>
          }
          artists={song.artists}
          onArtistClick={onArtistClick}
        />
      </Stack>
      {!error && (
        <Stack gap={3}>
          <Button
            variant="secondary"
            active={showWaveform}
            onClick={toggleWaveform}
            title={t('player.stageVisual.waveform')}
            className="app-no-drag"
          >
            <AudioWaveform className="size-4" strokeWidth={1.5} />
          </Button>
          <Button
            variant="secondary"
            active={showBars}
            onClick={toggleBars}
            title={t('player.stageVisual.bars')}
            className="app-no-drag"
          >
            <BarChart3 className="size-4" strokeWidth={1.5} />
          </Button>
          <Button
            variant="secondary"
            onClick={openEditMeta}
            title={t('editMeta.title')}
            className="app-no-drag"
          >
            <Pencil className="size-4" strokeWidth={1.5} /> {t('editMeta.title')}
          </Button>
          <Button
            variant="secondary"
            onClick={() => onEditLyrics(song)}
            title={lyrics ? t('player.editLyrics') : t('player.addLyrics')}
            className="app-no-drag"
          >
            <Type className="size-4" strokeWidth={1.5} />{' '}
            {lyrics ? t('player.editLyrics') : t('player.addLyrics')}
          </Button>
          <Menu
            origin="top right"
            className="w-44 overflow-hidden"
            trigger={(open, toggle) => (
              <IconButton
                size="md"
                variant="secondary"
                active={open}
                onClick={toggle}
                title={t('player.moreActions')}
                className="app-no-drag"
              >
                <MoreVertical className="size-4" strokeWidth={1.5} />
              </IconButton>
            )}
          >
            <MenuItem onSelect={onRecordings}>
              <Mic className="size-3.5" strokeWidth={1.5} /> {t('player.viewRecordings')}
            </MenuItem>
            <MenuItem onSelect={openDetails}>
              <Info className="size-3.5" strokeWidth={1.5} /> {t('player.songDetails')}
            </MenuItem>
          </Menu>
          <SettingsButton />
        </Stack>
      )}
    </Stack>
  )
}

export default PlayerHeader
