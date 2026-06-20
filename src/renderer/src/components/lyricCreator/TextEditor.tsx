import { useTranslation } from 'react-i18next'
import { useLyricCreatorContext } from '../../context/LyricCreatorContext'
import { Stack, Text } from '../ui'

/** Rows 3+4 (text step): free-text textarea + hint footer. */
function TextEditor(): React.JSX.Element {
  const { t } = useTranslation()
  const { text, setText, loaded, hasTiming } = useLyricCreatorContext()

  return (
    <>
      <Stack direction="column" gap={0} className="flex-1">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={!loaded}
          spellCheck={false}
          placeholder={t('creator.placeholder')}
          className="outline-none min-h-0 flex-1 resize-none overflow-y-auto bg-card p-6 font-lyric text-base leading-7 placeholder:text-muted-foreground/40"
        />
      </Stack>
      <div className="border-border border-t px-6 py-2">
        <Text variant="hint">
          {t('creator.hint')}
          {hasTiming && <span className="text-accent-soft">{t('creator.hintTimed')}</span>}
        </Text>
      </div>
    </>
  )
}

export default TextEditor
