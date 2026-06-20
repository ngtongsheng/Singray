import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Dialog, DialogFooter, Stack, Text } from '../ui'

interface Props {
  title: string
  body: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}

/** Modal confirm: Esc cancels, focus starts on Cancel, destructive action in danger color. */
function ConfirmDialog({
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel
}: Props): React.JSX.Element {
  const { t } = useTranslation()
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    cancelRef.current?.focus()
  }, [])

  return (
    <Dialog alert label={title} width="sm" onClose={onCancel}>
      <Stack direction="column" gap={6}>
        <Stack direction="column" gap={2}>
          <Text as="h2" variant="title">
            {title}
          </Text>
          <p className="text-sm text-muted-foreground">{body}</p>
        </Stack>
        <DialogFooter>
          <Button ref={cancelRef} onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </Stack>
    </Dialog>
  )
}

export default ConfirmDialog
