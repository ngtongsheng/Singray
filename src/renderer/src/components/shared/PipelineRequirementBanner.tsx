import { AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { PipelineStatus } from '../../../../shared/types'
import { useAppContext } from '../../context/AppContext'
import { Button, Stack, Text } from '../ui'

interface Props {
  status: PipelineStatus | null
}

/**
 * Inline warning at a pipeline job's point of use: the first-run setup gate
 * can be skipped for the session, so an enqueue action re-checks status here
 * instead of trusting that snapshot. Missing python/ffmpeg is blocking (the
 * job will fail); no GPU is advisory (it'll just run slower on CPU).
 */
function PipelineRequirementBanner({ status }: Props): React.JSX.Element | null {
  const { t } = useTranslation()
  const { goSettings } = useAppContext()
  if (!status || (status.ready && status.gpu)) return null

  return (
    <Stack direction="column" gap={1.5} className="rounded-md border border-border p-3">
      {!status.python && (
        <Stack gap={2} align="center">
          <AlertTriangle className="size-3.5 shrink-0 text-destructive" />
          <Text as="span" variant="error">
            {t('import.pythonMissing')}
          </Text>
        </Stack>
      )}
      {!status.ffmpeg && (
        <Stack gap={2} align="center">
          <AlertTriangle className="size-3.5 shrink-0 text-destructive" />
          <Text as="span" variant="error">
            {t('import.ffmpegMissing')}
          </Text>
        </Stack>
      )}
      {status.ready && !status.gpu && (
        <Stack gap={2} align="center">
          <AlertTriangle className="size-3.5 shrink-0 text-warning" />
          <Text as="span" variant="error" className="text-warning">
            {t('import.gpuMissing')}
          </Text>
        </Stack>
      )}
      <Button
        variant="bare"
        size="bare"
        onClick={goSettings}
        className="self-start text-muted-foreground text-xs underline hover:text-foreground"
      >
        {t('library.emptyPipelineLink')}
      </Button>
    </Stack>
  )
}

export default PipelineRequirementBanner
