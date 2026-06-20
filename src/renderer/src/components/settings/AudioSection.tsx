import { Loader2, Volume2, XCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSettingsContext } from '../../context/SettingsContext'
import { Button, Field, Select, SettingsSection, Stack, Text, Toggle } from '../ui'

function AudioSection(): React.JSX.Element | null {
  const { t } = useTranslation()
  const { settings, patch, outputs, inputs, toneBusy, toneError, testTone } = useSettingsContext()
  if (!settings) return null

  return (
    <SettingsSection title={t('settings.audio')}>
      <Stack direction="column" gap={4}>
        <Field label={t('settings.countdownLead')} hint={t('settings.countdownLeadHelp')}>
          <Select<'0' | '3' | '5'>
            value={String(settings.countdownLead ?? 3) as '0' | '3' | '5'}
            onChange={(v) => patch({ countdownLead: Number(v) })}
            options={[
              { value: '0', label: t('settings.countdownLeadOff') },
              { value: '3', label: t('settings.countdownLead3') },
              { value: '5', label: t('settings.countdownLead5') }
            ]}
            className="w-full"
          />
        </Field>
        <Field label={t('settings.outputMode')} hint={t('settings.modeHelp')}>
          <Select
            value={settings.audioOutputMode}
            onChange={(v) => patch({ audioOutputMode: v })}
            options={[
              { value: 'single', label: t('settings.modeSingle') },
              { value: 'dual', label: t('settings.modeDual') }
            ]}
            className="w-full"
          />
        </Field>

        {(['monitor', 'stream'] as const).map((which) => {
          const value = which === 'monitor' ? settings.monitorDeviceId : settings.streamDeviceId
          const known = value === '' || outputs.some((d) => d.deviceId === value)
          return (
            <Field
              key={which}
              label={which === 'monitor' ? t('settings.monitorDevice') : t('settings.streamDevice')}
            >
              <Stack direction="column" gap={1} className="w-full">
                <Stack gap={2}>
                  <Select
                    value={known ? value : ''}
                    disabled={settings.audioOutputMode === 'single'}
                    onChange={(v) =>
                      patch(which === 'monitor' ? { monitorDeviceId: v } : { streamDeviceId: v })
                    }
                    options={[
                      { value: '', label: t('settings.systemDefault') },
                      ...outputs.map((d) => ({
                        value: d.deviceId,
                        label: d.label || t('settings.outputN', { id: d.deviceId.slice(0, 8) })
                      }))
                    ]}
                    className="flex-1"
                  />
                  <Button
                    onClick={() => testTone(which)}
                    disabled={toneBusy !== null || settings.audioOutputMode === 'single'}
                    title={
                      which === 'monitor'
                        ? t('settings.toneTipMonitor')
                        : t('settings.toneTipStream')
                    }
                    className="shrink-0"
                  >
                    {toneBusy === which ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Volume2 className="size-4" strokeWidth={1.5} />
                    )}
                    {t('settings.test')}
                  </Button>
                </Stack>
                {!known && <Text variant="error">{t('settings.deviceMissing')}</Text>}
              </Stack>
            </Field>
          )
        })}
        <Field label={t('settings.recordingFormat')} hint={t('settings.recordingFormatHelp')}>
          <Select
            value={settings.recordingFormat}
            onChange={(v) => patch({ recordingFormat: v })}
            options={[
              { value: 'webm', label: t('settings.recordingWebm') },
              { value: 'wav', label: t('settings.recordingWav') }
            ]}
            className="w-full"
          />
        </Field>
        {toneError && (
          <Text variant="error" className="flex items-center gap-1.5">
            <XCircle className="size-3.5" /> {toneError}
          </Text>
        )}
        <Field label={t('settings.micDevice')} hint={t('settings.micDeviceHelp')}>
          <Stack direction="column" gap={2}>
            <Select
              value={settings.micDeviceId}
              onChange={(v) => patch({ micDeviceId: v })}
              options={[
                { value: '', label: t('settings.systemDefault') },
                ...inputs.map((d) => ({
                  value: d.deviceId,
                  label: d.label || t('settings.inputN', { id: d.deviceId.slice(0, 8) })
                }))
              ]}
              className="w-full"
            />
            <Toggle
              pressed={settings.micEnabled}
              onClick={() => patch({ micEnabled: !settings.micEnabled })}
              title={t('settings.micEnableHelp')}
            >
              {t('settings.micEnable')}
            </Toggle>
          </Stack>
        </Field>
      </Stack>
    </SettingsSection>
  )
}

export default AudioSection
