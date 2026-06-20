import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, X } from 'lucide-react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { useSettingsContext } from '../../context/SettingsContext'
import { Button, IconButton, Input, SettingsSection, Stack, Text } from '../ui'

const addLangSchema = z.object({
  code: z.string().min(1),
  label: z.string().min(1)
})
type AddLangValues = z.infer<typeof addLangSchema>

function LanguagesSection(): React.JSX.Element | null {
  const { t } = useTranslation()
  const { settings, patch } = useSettingsContext()

  const { control, handleSubmit, setError, reset, formState } = useForm<AddLangValues>({
    resolver: zodResolver(addLangSchema),
    defaultValues: { code: '', label: '' },
    mode: 'onChange'
  })

  if (!settings) return null

  const removeLanguage = (code: string): void => {
    void patch({ languages: settings.languages.filter((l) => l.code !== code) })
  }

  const onAdd = handleSubmit((data) => {
    const cleanCode = data.code.trim().toLowerCase()
    if (settings.languages.some((l) => l.code === cleanCode)) {
      setError('code', { message: t('settings.codeTaken', { code: cleanCode }) })
      return
    }
    void patch({
      languages: [...settings.languages, { code: cleanCode, label: data.label.trim() }]
    })
    reset()
  })

  return (
    <SettingsSection title={t('settings.languages')}>
      <Stack direction="column" gap={2}>
        {settings.languages.map((l) => (
          <Stack key={l.code} gap={3} className="rounded-md border border-border px-3 py-1.5">
            <Text as="span" variant="hint" className="w-12 tabular-nums">
              {l.code}
            </Text>
            <span className="flex-1 text-sm">{l.label}</span>
            <IconButton
              variant="ghost"
              size="xs"
              onClick={() => removeLanguage(l.code)}
              title={t('settings.remove', { label: l.label })}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" strokeWidth={1.5} />
            </IconButton>
          </Stack>
        ))}
        <Stack gap={2}>
          <div className="w-24">
            <Controller
              name="code"
              control={control}
              render={({ field }) => (
                <Input
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  placeholder="ja"
                  aria-label={t('settings.langCode')}
                />
              )}
            />
          </div>
          <Controller
            name="label"
            control={control}
            render={({ field }) => (
              <Input
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void onAdd(e)
                }}
                placeholder="日本語"
                aria-label={t('settings.langLabel')}
              />
            )}
          />
          <Button
            onClick={onAdd}
            disabled={!formState.isValid}
            title={formState.errors.code?.message ?? t('settings.addLanguageTip')}
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
