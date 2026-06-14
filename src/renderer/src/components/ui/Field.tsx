import type { ReactNode } from 'react'
import { cx } from './cx'
import Text from './Text'

interface FieldProps {
  label: ReactNode
  /** Optional helper text rendered below the control. */
  hint?: ReactNode
  className?: string
  children: ReactNode
}

/** Label + control wrapper (SPEC §10.6: labels above inputs live at the call site). */
function Field({ label, hint, className, children }: FieldProps): React.JSX.Element {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: children is opaque here; callers always pass a form control
    <label className={cx('block', className)}>
      <Text as="span" variant="hint" className="mb-1 block">
        {label}
      </Text>
      {children}
      {hint && (
        <Text as="span" variant="hint" className="mt-1 block">
          {hint}
        </Text>
      )}
    </label>
  )
}

export default Field
