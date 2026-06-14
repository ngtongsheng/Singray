import { useEffect, useRef } from 'react'
import { Button, Dialog, Stack } from './ui'

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
    <Dialog alert label={title} width="w-[400px]" onClose={onCancel}>
      <Stack direction="column" gap={6}>
        <div>
          <h2 className="font-semibold text-base">{title}</h2>
          <p className="mt-2 text-sm text-text-dim">{body}</p>
        </div>
        <Stack justify="end" gap={3}>
          <Button ref={cancelRef} size="md" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="danger" size="md" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </Stack>
      </Stack>
    </Dialog>
  )
}

export default ConfirmDialog
