import { Plus, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettingsContext } from '../../context/SettingsContext'
import { Button, IconButton, Input, SettingsSection, Stack, Text } from '../ui'

function LanguagesSection(): React.JSX.Element | null {
  const { t } = useTranslation()
  const { settings, patch } = useSettingsContext()
  const [newCode, setNewCode] = useState('')
  const [newLabel, setNewLabel] = useState('')
  if (!settings) return null

  const newCodeClean = newCode.trim().toLowerCase()
  const codeTaken = settings.languages.some((l) => l.code === newCodeClean)

  const addLanguage = (): void => {
    if (!newCodeClean || !newLabel.trim() || codeTaken) return
    void patch({
      languages: [...settings.languages, { code: newCodeClean, label: newLabel.trim() }]
    })
    setNewCode('')
    setNewLabel('')
  }

  const removeLanguage = (code: string): void => {
    void patch({ languages: settings.languages.filter((l) => l.code !== code) })
  }

  return (
    <SettingsSection title={t('settings.languages')}>
      <Stack direction="column" gap={2}>
        {settings.languages.map((l) => (
          <Stack key={l.code} gap={3} className="rounded-control border border-border px-3 py-1.5">
            <span className="w-12 text-text-dim text-xs tabular-nums">{l.code}</span>
            <span className="flex-1 text-sm">{l.label}</span>
            <IconButton
              variant="ghost"
              size="xs"
              onClick={() => removeLanguage(l.code)}
              title={t('settings.remove', { label: l.label })}
              className="text-text-dim hover:text-text"
            >
              <X className="size-3.5" strokeWidth={1.5} />
            </IconButton>
          </Stack>
        ))}
        <Stack gap={2}>
          <div className="w-24">
            <Input
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              placeholder="ja"
              aria-label={t('settings.langCode')}
            />
          </div>
          <Input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addLanguage()
            }}
            placeholder="日本語"
            aria-label={t('settings.langLabel')}
          />
          <Button
            size="md"
            onClick={addLanguage}
            disabled={!newCodeClean || !newLabel.trim() || codeTaken}
            title={
              codeTaken
                ? t('settings.codeTaken', { code: newCodeClean })
                : t('settings.addLanguageTip')
            }
            className="shrink-0"
          >
            <Plus className="size-4" strokeWidth={1.5} /> {t('settings.add')}
          </Button>
        </Stack>
        <Text variant="hint">{t('settings.languagesHelp')}</Text>
      </Stack>
    </SettingsSection>
  )
}

export default LanguagesSection
