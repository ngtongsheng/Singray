// Audio engine (SPEC §9). Single mode: one AudioContext, two buffer sources
// (instrumental + vocals) started sample-synced, per-stem gain nodes, master
// clock derived from AudioContext.currentTime. Dual mode (§9.2/§9.3): a second
// AudioContext routed to the stream device via setSinkId carries an
// instrumental-only mirror; both contexts schedule their sources against the
// same wall-clock instant (getOutputTimestamp correlation), a 5s watchdog
// estimates inter-context drift and hard-resyncs the stream side past 25ms.
// Pause/seek tears down and rebuilds sources at the target position on both
// contexts (§9.3.4 — sources are cheap; key changes will reuse this path).

/** Seconds of gain ramp on vocal toggle / volume moves — click-free, still feels instant. */
const RAMP = 0.03
/** Scheduling headroom, single mode — both sources start on the same render quantum. */
const START_DELAY_SINGLE = 0.05
/** Scheduling headroom, dual mode (§9.3.2) — two contexts need wall-clock alignment slack. */
const START_DELAY_DUAL = 0.15
/** Headroom when hard-resyncing only the stream context. */
const RESYNC_DELAY = 0.05
/** Drift watchdog period (§9.3.3). */
const DRIFT_CHECK_MS = 5000
/** Hard-resync threshold (§9.3.3). */
const DRIFT_LIMIT_MS = 25

export interface AudioRouting {
  mode: 'single' | 'dual'
  monitorDeviceId: string
  streamDeviceId: string
}

interface SinkableContext extends AudioContext {
  setSinkId(id: string): Promise<void>
}

/** Map a performance.now() instant onto a context's timeline (uses the output
 *  timestamp correlation so device latency is accounted for on both sides). */
function ctxTimeAtWall(ctx: AudioContext, wallMs: number): number {
  const ts = ctx.getOutputTimestamp()
  if (ts.contextTime !== undefined && ts.performanceTime !== undefined && ts.performanceTime > 0) {
    return ts.contextTime + (wallMs - ts.performanceTime) / 1000
  }
  // Context hasn't rendered yet — fall back to the raw clock.
  return ctx.currentTime + (wallMs - performance.now()) / 1000
}

export class AudioEngine {
  private ctx: AudioContext
  /** Stream-device context (dual mode only) — instrumental-only mirror, no vocal graph at all. */
  private streamCtx: AudioContext | null
  private instrBuf: AudioBuffer
  private vocalBuf: AudioBuffer
  private gainInstr: GainNode
  private gainVocal: GainNode
  private gainInstrStream: GainNode | null = null
  private srcInstr: AudioBufferSourceNode | null = null
  private srcVocal: AudioBufferSourceNode | null = null
  private srcInstrStream: AudioBufferSourceNode | null = null
  /** Invalidates onended handlers from torn-down sources. */
  private generation = 0
  /** Song position (s) at the moment sources were started, or the parked position when paused. */
  private offset = 0
  /** ctx.currentTime at which the current sources were scheduled to start. */
  private startedAt = 0
  private streamOffset = 0
  private streamStartedAt = 0
  private driftTimer: number | null = null
  private _playing = false
  private _vocalOn = true
  private _vocalVolume = 1
  private _instrVolume = 1
  /** Fired once when playback reaches the end of the song naturally. */
  onEnded: (() => void) | null = null
  /** Non-fatal routing problem (e.g. saved stream device gone → degraded to single). */
  routingWarning: string | null = null
  /** Last watchdog drift estimate, stream minus monitor, ms. */
  lastDriftMs: number | null = null
  /** Drift trace + resync count, kept for diagnostics/verification. */
  driftLog: { pos: number; ms: number }[] = []
  resyncCount = 0

  private constructor(
    ctx: AudioContext,
    streamCtx: AudioContext | null,
    instrBuf: AudioBuffer,
    vocalBuf: AudioBuffer
  ) {
    this.ctx = ctx
    this.streamCtx = streamCtx
    this.instrBuf = instrBuf
    this.vocalBuf = vocalBuf
    this.gainInstr = ctx.createGain()
    this.gainVocal = ctx.createGain()
    this.gainInstr.connect(ctx.destination)
    this.gainVocal.connect(ctx.destination)
    if (streamCtx) {
      this.gainInstrStream = streamCtx.createGain()
      this.gainInstrStream.connect(streamCtx.destination)
    }
  }

  /** Fetch + decode both stems (decoded once; sources are built per play/seek).
   *  Dual mode opens the stream context here; a failing stream sink degrades to
   *  single mode with `routingWarning` set rather than blocking playback. */
  static async load(songId: string, routing?: AudioRouting): Promise<AudioEngine> {
    const ctx = new AudioContext()
    let streamCtx: AudioContext | null = null
    let warning: string | null = null
    try {
      if (routing?.mode === 'dual') {
        if (routing.monitorDeviceId) {
          await (ctx as SinkableContext).setSinkId(routing.monitorDeviceId)
        }
        streamCtx = new AudioContext()
        try {
          if (routing.streamDeviceId) {
            await (streamCtx as SinkableContext).setSinkId(routing.streamDeviceId)
          }
        } catch (err) {
          void streamCtx.close()
          streamCtx = null
          warning = `Stream output unavailable (${err instanceof Error ? err.message : String(err)}) — playing on monitor only.`
        }
      }
      const [instrBuf, vocalBuf] = await Promise.all(
        (['instrumental', 'vocals'] as const).map(async (track) => {
          const res = await fetch(window.singray.audio.url(songId, track))
          if (!res.ok) throw new Error(`${track} fetch ${res.status}`)
          return ctx.decodeAudioData(await res.arrayBuffer())
        })
      )
      if (instrBuf === undefined || vocalBuf === undefined) throw new Error('decode failed')
      const engine = new AudioEngine(ctx, streamCtx, instrBuf, vocalBuf)
      engine.routingWarning = warning
      return engine
    } catch (err) {
      void ctx.close()
      void streamCtx?.close()
      throw err
    }
  }

  get duration(): number {
    return this.instrBuf.duration
  }

  get playing(): boolean {
    return this._playing
  }

  get dual(): boolean {
    return this.streamCtx !== null
  }

  /** Authoritative playback position in seconds (master clock = monitor context, SPEC §7.3/§9.3.1). */
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
    this.startDriftWatchdog()
  }

  pause(): void {
    if (!this._playing) return
    this.offset = this.position
    this._playing = false
    this.stopDriftWatchdog()
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
    if (this.gainInstrStream) this.ramp(this.gainInstrStream, this._instrVolume, this.streamCtx)
  }

  /** Tear down everything; the engine is unusable afterwards. */
  dispose(): void {
    this.stopDriftWatchdog()
    this.stopSources()
    this._playing = false
    void this.ctx.close()
    void this.streamCtx?.close()
  }

  /** Estimate stream-vs-monitor playhead difference (ms) at a common wall instant. */
  measureDrift(): number | null {
    if (!this.streamCtx || !this._playing) return null
    const now = performance.now()
    const monitorPos = this.offset + (ctxTimeAtWall(this.ctx, now) - this.startedAt)
    const streamPos =
      this.streamOffset + (ctxTimeAtWall(this.streamCtx, now) - this.streamStartedAt)
    return (streamPos - monitorPos) * 1000
  }

  /** Build fresh sources and start all of them against one wall-clock instant.
   *  Within the monitor context the two stems share the same `when` (sample-synced
   *  by construction); the stream context maps that instant onto its own timeline. */
  private startSources(offset: number): void {
    const gen = ++this.generation
    const headroom = this.streamCtx ? START_DELAY_DUAL : START_DELAY_SINGLE
    const startWall = performance.now() + headroom * 1000
    const when = Math.max(ctxTimeAtWall(this.ctx, startWall), this.ctx.currentTime)
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
      this.stopDriftWatchdog()
      this.stopSources()
      this.onEnded?.()
    }
    this.srcInstr.start(when, offset)
    this.srcVocal.start(when, offset)
    this.startedAt = when
    if (this.streamCtx && this.gainInstrStream) {
      this.startStreamSource(this.streamCtx, offset, startWall)
    }
  }

  private startStreamSource(streamCtx: AudioContext, offset: number, startWall: number): void {
    if (!this.gainInstrStream) return
    const src = streamCtx.createBufferSource()
    src.buffer = this.instrBuf
    src.connect(this.gainInstrStream)
    const when = Math.max(ctxTimeAtWall(streamCtx, startWall), streamCtx.currentTime)
    src.start(when, offset)
    this.srcInstrStream = src
    this.streamStartedAt = when
    this.streamOffset = offset
  }

  /** §9.3.3: stop only the stream source and restart it at the master position.
   *  Inaudible to the performer; a one-time blip on stream is acceptable. */
  private resyncStream(): void {
    const streamCtx = this.streamCtx
    if (!streamCtx || !this._playing) return
    if (this.srcInstrStream) {
      const src = this.srcInstrStream
      src.onended = null
      try {
        src.stop()
      } catch {
        // never started — fine
      }
      src.disconnect()
      this.srcInstrStream = null
    }
    const startWall = performance.now() + RESYNC_DELAY * 1000
    // Master position at the instant the new stream source will actually start.
    const masterAtStart = this.offset + (ctxTimeAtWall(this.ctx, startWall) - this.startedAt)
    if (masterAtStart >= this.duration) return
    this.startStreamSource(streamCtx, masterAtStart, startWall)
    this.resyncCount++
  }

  private startDriftWatchdog(): void {
    if (!this.streamCtx || this.driftTimer !== null) return
    this.driftTimer = window.setInterval(() => {
      const drift = this.measureDrift()
      if (drift === null) return
      this.lastDriftMs = drift
      this.driftLog.push({
        pos: Math.round(this.position * 10) / 10,
        ms: Math.round(drift * 100) / 100
      })
      if (Math.abs(drift) > DRIFT_LIMIT_MS) this.resyncStream()
    }, DRIFT_CHECK_MS)
  }

  private stopDriftWatchdog(): void {
    if (this.driftTimer !== null) {
      window.clearInterval(this.driftTimer)
      this.driftTimer = null
    }
  }

  private stopSources(): void {
    this.generation++
    for (const src of [this.srcInstr, this.srcVocal, this.srcInstrStream]) {
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
    this.srcInstrStream = null
  }

  private ramp(node: GainNode, target: number, ctx: AudioContext | null = this.ctx): void {
    if (!ctx) return
    const now = ctx.currentTime
    node.gain.cancelScheduledValues(now)
    node.gain.setValueAtTime(node.gain.value, now)
    node.gain.linearRampToValueAtTime(target, now + RAMP)
  }
}
