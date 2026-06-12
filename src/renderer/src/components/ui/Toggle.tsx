import Button, { type ButtonProps } from './Button'

interface ToggleProps extends Omit<ButtonProps, 'active'> {
  pressed: boolean
}

/** Button with on/off semantics: aria-pressed + accent engaged styling. */
function Toggle({ pressed, ...rest }: ToggleProps): React.JSX.Element {
  return <Button aria-pressed={pressed} active={pressed} {...rest} />
}

export default Toggle
