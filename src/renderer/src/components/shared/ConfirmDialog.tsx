import { useEffect, useRef } from 'react'
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
          <p className="text-sm text-text-dim">{body}</p>
        </Stack>
        <DialogFooter>
          <Button ref={cancelRef} size="md" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="danger" size="md" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </Stack>
    </Dialog>
  )
}

export default ConfirmDialog
