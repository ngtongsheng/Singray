import { FileDown, Loader2, Search, Sparkles, Wand2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useLyricCreatorContext } from '../../context/LyricCreatorContext'
import { Button, Stack, Text } from '../ui'

function parsedEmpty(text: string): boolean {
  return text.trim() === ''
}

/** Row 2 (text step only): find / import LRC / clean / align actions + their errors. */
function TextStepToolbar(): React.JSX.Element {
  const { t } = useTranslation()
  const {
    text,
    loaded,
    aligning,
    cleaning,
    alignError,
    lrcError,
    fileRef,
    onFile,
    openFinder,
    onClean,
    onAlign
  } = useLyricCreatorContext()

  return (
    <Stack direction="column" gap={1} className="border-border border-b px-6 py-2">
      <Stack gap={2}>
        <input
          ref={fileRef}
          type="file"
          accept=".lrc,.txt,text/plain"
          onChange={onFile}
          className="hidden"
        />
        <Button
          onClick={openFinder}
          disabled={!loaded || aligning}
          title={t('finder.findTip')}
          className="font-medium text-text-dim hover:text-text"
        >
          <Search className="size-4" strokeWidth={1.5} /> {t('finder.find')}
        </Button>
        <Button
          onClick={() => fileRef.current?.click()}
          disabled={!loaded || aligning}
          title={t('creator.importLrcTip')}
          className="font-medium text-text-dim hover:text-text"
        >
          <FileDown className="size-4" strokeWidth={1.5} /> {t('creator.importLrc')}
        </Button>
        <Button
          onClick={onClean}
          disabled={!loaded || parsedEmpty(text) || cleaning || aligning}
          title={t('clean.tip')}
          className="font-medium text-text-dim hover:text-text"
        >
          {cleaning ? (
            <>
              <Loader2 className="size-4 animate-spin" strokeWidth={2} /> {t('clean.cleaning')}
            </>
          ) : (
            <>
              <Sparkles className="size-4" strokeWidth={1.5} /> {t('clean.button')}
            </>
          )}
        </Button>
        <Button
          onClick={onAlign}
          disabled={!loaded || parsedEmpty(text) || aligning}
          title={t('creator.alignTip')}
          className="font-medium text-text-dim hover:text-text"
        >
          {aligning ? (
            <>
              <Loader2 className="size-4 animate-spin" strokeWidth={2} /> {t('creator.aligning')}
            </>
          ) : (
            <>
              <Wand2 className="size-4" strokeWidth={1.5} /> {t('creator.align')}
            </>
          )}
        </Button>
      </Stack>
      {(alignError || lrcError) && (
        <>
          {alignError && (
            <Text variant="error">{t('creator.alignFailed', { message: alignError })}</Text>
          )}
          {lrcError && <Text variant="error">{lrcError}</Text>}
        </>
      )}
    </Stack>
  )
}

export default TextStepToolbar
