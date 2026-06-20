import { clsx as cx } from 'clsx'
import type { ReactNode } from 'react'

interface Props {
  title: string
  children: ReactNode
  className?: string
}

/** Bordered fieldset group for a settings page section. */
function SettingsSection({ title, children, className }: Props): React.JSX.Element {
  return (
    <fieldset className={cx('rounded-lg border border-border p-4', className)}>
      <legend className="px-1 font-medium text-sm">{title}</legend>
      {children}
    </fieldset>
  )
}

export default SettingsSection
