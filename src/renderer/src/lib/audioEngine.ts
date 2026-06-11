// Audio engine v1 (SPEC §9, single-output mode). One AudioContext, two buffer
// sources (instrumental + vocals) started sample-synced, per-stem gain nodes,
// master clock derived from AudioContext.currentTime. Pause/seek tears down and
// rebuilds sources at the target position (§9.3.4 — sources are cheap, and the
// same rebuild path later serves the dual-context engine and key changes).

/** Seconds of gain ramp on vocal toggle / volume moves — click-free, still feels instant. */
const RAMP = 0.03
/** Scheduling headroom so both sources start on the same render quantum. */
const START_DELAY = 0.05

export class AudioEngine {
  private ctx: AudioContext
  private instrBuf: AudioBuffer
  private vocalBuf: AudioBuffer
  private gainInstr: GainNode
  private gainVocal: GainNode
  private srcInstr: AudioBufferSourceNode | null = null
  private srcVocal: AudioBufferSourceNode | null = null
  /** Invalidates onended handlers from torn-down sources. */
  private generation = 0
  /** Song position (s) at the moment sources were started, or the parked position when paused. */
  private offset = 0
  /** ctx.currentTime at which the current sources were scheduled to start. */
  private startedAt = 0
  private _playing = false
  private _vocalOn = true
  private _vocalVolume = 1
  private _instrVolume = 1
  /** Fired once when playback reaches the end of the song naturally. */
  onEnded: (() => void) | null = null

  private constructor(ctx: AudioContext, instrBuf: AudioBuffer, vocalBuf: AudioBuffer) {
    this.ctx = ctx
    this.instrBuf = instrBuf
    this.vocalBuf = vocalBuf
    this.gainInstr = ctx.createGain()
    this.gainVocal = ctx.createGain()
    this.gainInstr.connect(ctx.destination)
    this.gainVocal.connect(ctx.destination)
  }

  /** Fetch + decode both stems (decoded once; sources are built per play/seek). */
  static async load(songId: string): Promise<AudioEngine> {
    const ctx = new AudioContext()
    try {
      const [instrBuf, vocalBuf] = await Promise.all(
        (['instrumental', 'vocals'] as const).map(async (track) => {
          const res = await fetch(window.singray.audio.url(songId, track))
          if (!res.ok) throw new Error(`${track} fetch ${res.status}`)
          return ctx.decodeAudioData(await res.arrayBuffer())
        })
      )
      if (instrBuf === undefined || vocalBuf === undefined) throw new Error('decode failed')
      return new AudioEngine(ctx, instrBuf, vocalBuf)
    } catch (err) {
      void ctx.close()
      throw err
    }
  }

  get duration(): number {
    return this.instrBuf.duration
  }

  get playing(): boolean {
    return this._playing
  }

  /** Authoritative playback position in seconds (master clock, SPEC §7.3). */
  get position(): number {
    if (!this._playing) return this.offset
    const elapsed = Math.max(0, this.ctx.currentTime - this.startedAt)
    return Math.min(this.offset + elapsed, this.duration)
  }

  get vocalOn(): boolean {
    return this._vocalOn
  }

  get vocalVolume(): number {
    return this._vocalVolume
  }

  get instrumentalVolume(): number {
    return this._instrVolume
  }

  play(): void {
    if (this._playing) return
    if (this.offset >= this.duration) this.offset = 0
    this.startSources(this.offset)
    this._playing = true
  }

  pause(): void {
    if (!this._playing) return
    this.offset = this.position
    this._playing = false
    this.stopSources()
  }

  seek(t: number): void {
    const target = Math.min(Math.max(t, 0), this.duration)
    this.offset = target
    if (this._playing) {
      this.stopSources()
      this.startSources(target)
    }
  }

  setVocal(on: boolean): void {
    this._vocalOn = on
    this.ramp(this.gainVocal, on ? this._vocalVolume : 0)
  }

  setVocalVolume(v: number): void {
    this._vocalVolume = Math.min(Math.max(v, 0), 1)
    if (this._vocalOn) this.ramp(this.gainVocal, this._vocalVolume)
  }

  setInstrumentalVolume(v: number): void {
    this._instrVolume = Math.min(Math.max(v, 0), 1)
    this.ramp(this.gainInstr, this._instrVolume)
  }

  /** Tear down everything; the engine is unusable afterwards. */
  dispose(): void {
    this.stopSources()
    this._playing = false
    void this.ctx.close()
  }

  /** Build fresh sources and start both on the same context timestamp (sample-synced). */
  private startSources(offset: number): void {
    const gen = ++this.generation
    const when = this.ctx.currentTime + START_DELAY
    this.srcInstr = this.ctx.createBufferSource()
    this.srcInstr.buffer = this.instrBuf
    this.srcInstr.connect(this.gainInstr)
    this.srcVocal = this.ctx.createBufferSource()
    this.srcVocal.buffer = this.vocalBuf
    this.srcVocal.connect(this.gainVocal)
    // Natural end of the (longer) instrumental stem ends playback; stale handlers
    // from rebuilt sources are filtered by generation.
    this.srcInstr.onended = () => {
      if (gen !== this.generation || !this._playing) return
      this.offset = this.duration
      this._playing = false
      this.stopSources()
      this.onEnded?.()
    }
    this.srcInstr.start(when, offset)
    this.srcVocal.start(when, offset)
    this.startedAt = when
  }

  private stopSources(): void {
    this.generation++
    for (const src of [this.srcInstr, this.srcVocal]) {
      if (!src) continue
      src.onended = null
      try {
        src.stop()
      } catch {
        // never started / already stopped — fine
      }
      src.disconnect()
    }
    this.srcInstr = null
    this.srcVocal = null
  }

  private ramp(node: GainNode, target: number): void {
    const now = this.ctx.currentTime
    node.gain.cancelScheduledValues(now)
    node.gain.setValueAtTime(node.gain.value, now)
    node.gain.linearRampToValueAtTime(target, now + RAMP)
  }
}
