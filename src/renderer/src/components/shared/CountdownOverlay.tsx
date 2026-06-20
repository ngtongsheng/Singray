interface Props {
  /** Seconds remaining — display as ceiling integer (3, 2, 1). */
  seconds: number
}

/** Full-stage countdown overlay for the lead-in to the first lyric word (#71, #65). */
function CountdownOverlay({ seconds }: Props): React.JSX.Element {
  const value = Math.max(1, Math.ceil(seconds))
  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
      <span
        key={value}
        className="select-none font-lyric text-9xl font-bold leading-none text-foreground/80 drop-shadow-lg"
      >
        {value}
      </span>
    </div>
  )
}

export default CountdownOverlay
