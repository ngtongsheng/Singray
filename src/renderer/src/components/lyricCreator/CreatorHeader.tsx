import { ArrowLeft, Eye, FileText, Keyboard } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useLyricCreatorContext } from '../../context/LyricCreatorContext'
import { IconButton, Segmented, Stack, Text } from '../ui'

/** Row 1: back + title (left), step Segmented (right). */
function CreatorHeader(): React.JSX.Element {
  const { t } = useTranslation()
  const { song, onBack, creatorStep, setCreatorStep } = useLyricCreatorContext()

  return (
    <Stack justify="between" className="w-full">
      <Stack gap={2} align="center" className="min-w-0">
        <IconButton
          onClick={onBack}
          title={t('common.back')}
          className="app-no-drag shrink-0 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" strokeWidth={1.5} />
        </IconButton>
        <Stack gap={2} align="baseline" className="min-w-0">
          <Text as="h1" variant="subtitle" className="truncate">
            {song.title}
          </Text>
          <Text variant="hint" className="hidden truncate sm:inline">
            {t('creator.subtitle', { artist: song.artist })}
          </Text>
        </Stack>
      </Stack>
      <Stack gap={0} align="center" className="app-no-drag shrink-0">
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
      </Stack>
    </Stack>
  )
}

export default CreatorHeader
