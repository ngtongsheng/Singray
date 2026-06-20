import { ArrowLeft, Eye, FileText, Keyboard } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useLyricCreatorContext } from '../../context/LyricCreatorContext'
import SettingsButton from '../library/SettingsButton'
import TitleArtist from '../shared/TitleArtist'
import { IconButton, Segmented, Stack, Text } from '../ui'

/** Row 1: back + title (left), step Segmented (right). */
function CreatorHeader(): React.JSX.Element {
  const { t } = useTranslation()
  const { song, onBack, creatorStep, setCreatorStep } = useLyricCreatorContext()

  return (
    <Stack justify="between" className="w-full">
      <Stack gap={2} align="center" className="min-w-0">
        <IconButton
          size="md"
          onClick={onBack}
          title={t('common.back')}
          className="app-no-drag shrink-0 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" strokeWidth={1.5} />
        </IconButton>
        <TitleArtist
          title={song.title}
          label={<Text variant="hint">{t('creator.lyricsLabel')}</Text>}
          artists={song.artists}
        />
      </Stack>
      <Stack gap={3} align="center" className="app-no-drag shrink-0">
        <Segmented
          value={creatorStep}
          onChange={setCreatorStep}
          options={[
            {
              value: 'text',
              label: (
                <>
                  <FileText className="size-4" strokeWidth={1.5} /> {t('creator.stepText')}
                </>
              )
            },
            {
              value: 'tap',
              label: (
                <>
                  <Keyboard className="size-4" strokeWidth={1.5} /> {t('creator.stepTap')}
                </>
              )
            },
            {
              value: 'review',
              label: (
                <>
                  <Eye className="size-4" strokeWidth={1.5} /> {t('creator.stepReview')}
                </>
              )
            }
          ]}
        />
        <SettingsButton />
      </Stack>
    </Stack>
  )
}

export default CreatorHeader
