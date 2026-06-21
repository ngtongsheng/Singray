import { computePeaks } from './computePeaks'
import type { MicFxPreset } from './micFxGraph'
import { buildFxGraph } from './micFxGraph'
import { setSink } from './sinkable'

// Audio engine (SPEC §9). Single mode: one AudioContext, two buffer sources
// (instrumental + vocals) started sample-synced, per-stem gain nodes, master
// clock derived from AudioContext.currentTime. Dual mode (§9.2/§9.3): a second
// AudioContext routed to the stream device via setSinkId carries an
// instrumental-only mirror; both contexts schedule their sources against the
// same wall-clock instant (getOutputTimestamp correlation), a 5s watchdog
// estimates inter-context drift and hard-resyncs the stream side past 25ms.
// Pause/seek tears down and rebuilds sources at the target position on both
// contexts (§9.3.4 — sources are cheap; tempo changes reuse this path).
//
// Pitch & tempo (§9.4): every stem routes through a SoundTouch AudioWorklet
// (true bypass at neutral). The worklet is push-model and therefore must stay
// 1:1 in frame count, so tempo is implemented as source.playbackRate (which
// also transposes by 12·log2(tempo) semitones) plus a compensating pitch
// offset in the worklet — net effect: tempo change at constant pitch. The
// user's key change adds on top. Master clock scales: position advances at
// tempo × wall rate.

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
/** Tempo bounds (SPEC §9.1 / S5.2 control range). */
const TEMPO_MIN = 0.75
const TEMPO_MAX = 1.25
/** Key change bounds, semitones. */
const PITCH_MIN = -6
const PITCH_MAX = 6
/** Max wait for a worklet's ping echo before pingWorklets() gives up on it. */
const PING_TIMEOUT_MS = 1000
/** AudioWorklet module path — relative to index.html (public/ is served verbatim). */
const WORKLET_URL = 'worklets/soundtouch-processor.js'
/** Mic monitor-leg headroom (~+12dB) — getUserMedia capture is unboosted (no AGC), so the
 *  raw signal needs gain to be audible over speakers at the slider's unity max. Record/stream
 *  legs stay unboosted so captured takes don't clip. */
const MIC_MONITOR_BOOST = 4

export type { MicFxPreset } from './micFxGraph'

export interface AudioRouting {
  mode: 'single' | 'dual'
  monitorDeviceId: string
  streamDeviceId: string
}

/** State echo from the worklet (see soundtouch-processor.js). */
export interface WorkletState {
  type: 'state'
  /** Ping echo id; unsolicited posts carry null. */
  id: number | null
  pitch: number
  bypass: boolean
  latencyFrames: number
}

function isWorkletState(x: unknown): x is WorkletState {
  return typeof x === 'object' && x !== null && (x as { type?: unknown }).type === 'state'
}

let pingSeq = 0

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
  private recordDest: MediaStreamAudioDestinationNode | null = null
  private mediaRecorder: MediaRecorder | null = null
  private recordedChunks: Blob[] = []
  private _recording = false
  /** Fired with the captured Blob when a mid-dispose recording is force-flushed (§14.8). */
  onRecordingFlushed: ((blob: Blob) => void) | null = null
  private stInstr: AudioWorkletNode
  private stVocal: AudioWorkletNode
  private stInstrStream: AudioWorkletNode | null = null
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
  /** Accumulated seconds actually played this session — seeks don't add (R1.5 sing gate). */
  private playedAccum = 0
  /** Song position where the current playing stretch began. */
  private stretchStart = 0
  private _playing = false
  private _vocalOn = true
  private _vocalVolume = 1
  private _instrVolume = 1
  private _pitchSemitones = 0
  private _tempo = 1
  /** Shifter latency (s) while engaged — display clock subtracts it so lyrics track what's heard. */
  private latencySec = 0
  private latencyTimer: number | null = null
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
    // Recording tap (R3.REC1): lives on the monitor context so recording works
    // in single mode (no mixer / earphone user) too. Captures instrumental +
    // mic (record leg, added pre monitor-toggle in enableMic), never the guide
    // vocal. It is a MediaStreamAudioDestinationNode, not wired to any speaker,
    // so it never leaks audio. The dual-mode stream device is a separate
    // broadcast feed (see below), not the recording source.
    this.recordDest = ctx.createMediaStreamDestination()
    this.gainInstr.connect(this.recordDest)
    // Per-stem SoundTouch worklets sit between source and gain; they idle in
    // true bypass until pitch/tempo leaves neutral (§9.4). Persistent across
    // source rebuilds — only sources are torn down.
    this.stInstr = AudioEngine.createWorklet(ctx)
    this.stVocal = AudioEngine.createWorklet(ctx)
    this.stInstr.connect(this.gainInstr)
    this.stVocal.connect(this.gainVocal)
    if (streamCtx) {
      // Dual mode broadcast feed only: instrumental + mic mirrored to the
      // distinct stream device (virtual cable / OBS). Not tapped for recording.
      this.gainInstrStream = streamCtx.createGain()
      this.gainInstrStream.connect(streamCtx.destination)
      this.stInstrStream = AudioEngine.createWorklet(streamCtx)
      this.stInstrStream.connect(this.gainInstrStream)
    }
  }

  private static createWorklet(ctx: AudioContext): AudioWorkletNode {
    return new AudioWorkletNode(ctx, 'soundtouch-processor', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [2]
    })
  }

  /** Fetch + decode both stems (decoded once; sources are built per play/seek).
   *  Dual mode opens the stream context here; a failing stream sink degrades to
   *  single mode with `routingWarning` set rather than blocking playback. */
  static async load(songId: string, routing?: AudioRouting): Promise<AudioEngine> {
    const ctx = new AudioContext({ latencyHint: 'interactive' })
    let streamCtx: AudioContext | null = null
    let warning: string | null = null
    try {
      if (routing?.mode === 'dual') {
        await setSink(ctx, routing.monitorDeviceId)
        // A second audible context is only meaningful when the stream device is
        // a real, distinct sink. Empty (= system default) or same-as-monitor
        // would just dump the mic onto the listener's own output — the
        // monitor-toggle-can't-silence-it leak. Degrade to single in that case;
        // recording still works (tap is on the monitor context).
        const distinctStream =
          routing.streamDeviceId !== '' && routing.streamDeviceId !== routing.monitorDeviceId
        if (distinctStream) {
          streamCtx = new AudioContext({ latencyHint: 'interactive' })
          try {
            await setSink(streamCtx, routing.streamDeviceId)
          } catch (err) {
            await streamCtx.close()
            streamCtx = null
            warning = `Stream output unavailable (${err instanceof Error ? err.message : String(err)}) — playing on monitor only.`
          }
        } else {
          warning =
            'No distinct stream device set — broadcasting to monitor only. Recording to file still works.'
        }
      }
      const [instrBuf, vocalBuf] = await Promise.all(
        (['instrumental', 'vocals'] as const).map(async (track) => {
          const res = await fetch(window.singray.audio.url(songId, track))
          if (!res.ok) throw new Error(`${track} fetch ${res.status}`)
          return ctx.decodeAudioData(await res.arrayBuffer())
        })
      )
      await ctx.audioWorklet.addModule(WORKLET_URL)
      if (streamCtx) await streamCtx.audioWorklet.addModule(WORKLET_URL)
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

  /** Recording (R3.REC1) taps the monitor context, so it works in single mode too. */
  get canRecord(): boolean {
    return this.recordDest !== null
  }

  get recording(): boolean {
    return this._recording
  }

  /** Authoritative playback position in seconds (master clock = monitor context, SPEC §7.3/§9.3.1).
   *  Song position advances at tempo × wall rate (playbackRate drives the sources). */
  get position(): number {
    if (!this._playing) return this.offset
    const elapsed = Math.max(0, this.ctx.currentTime - this.startedAt)
    return Math.min(this.offset + elapsed * this._tempo, this.duration)
  }

  /** Position of the audio currently audible — lyric clock (§7.3). Subtracts the
   *  shifter's pipeline latency while pitch/tempo is engaged (worklet-reported). */
  get displayPosition(): number {
    return Math.max(0, this.position - this.latencySec)
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

  get pitchSemitones(): number {
    return this._pitchSemitones
  }

  get tempo(): number {
    return this._tempo
  }

  /** Seconds of song content actually played this session. Position jumps from
   *  seeking never inflate it: each playing stretch contributes position deltas only. */
  get playedSeconds(): number {
    if (!this._playing) return this.playedAccum
    return this.playedAccum + Math.max(0, this.position - this.stretchStart)
  }

  /** Close the current playing stretch into the accumulator. */
  private bankStretch(): void {
    if (this._playing) this.playedAccum += Math.max(0, this.position - this.stretchStart)
  }

  play(): void {
    if (this._playing) return
    if (this.offset >= this.duration) this.offset = 0
    this.stretchStart = this.offset
    this.startSources(this.offset)
    this._playing = true
    this.startDriftWatchdog()
  }

  pause(): void {
    if (!this._playing) return
    this.bankStretch()
    this.offset = this.position
    this._playing = false
    this.stopDriftWatchdog()
    this.stopSources()
  }

  seek(t: number): void {
    const target = Math.min(Math.max(t, 0), this.duration)
    this.bankStretch() // bank against the pre-seek position before offset moves
    this.offset = target
    this.stretchStart = target
    if (this._playing) {
      this.stopSources()
      this.startSources(target)
    }
  }

  private analyser: AnalyserNode | null = null
  private peaksCache: Float32Array | null = null

  /** Max-abs peak buckets of the full mix (both stems), normalized 0..1 — stage
   *  waveform source. Buffers are already decoded, so this is a pure CPU pass; cached. */
  peaks(perSec = 50): Float32Array {
    if (this.peaksCache) return this.peaksCache
    this.peaksCache = computePeaks([this.instrBuf, this.vocalBuf], this.duration, perSec)
    return this.peaksCache
  }

  /** Analyser tapped off the monitor mix (both stem gains), for stage visuals (R1.4).
   *  Pure tap — not wired to the destination, audio path unchanged. Cached so
   *  repeated toggles don't stack taps; dies with the context on dispose. */
  createMonitorAnalyser(): AnalyserNode {
    if (this.analyser) return this.analyser
    const a = this.ctx.createAnalyser()
    a.fftSize = 2048
    a.smoothingTimeConstant = 0.82
    this.gainInstr.connect(a)
    this.gainVocal.connect(a)
    this.analyser = a
    return a
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

  /** Key change in semitones, clamped ±6 (§9.1). Applied to every stem worklet in both contexts. */
  setPitchSemitones(n: number): void {
    this._pitchSemitones = Math.min(Math.max(Math.round(n), PITCH_MIN), PITCH_MAX)
    this.pushWorkletParams()
  }

  /** Playback tempo, clamped [0.75, 1.25]. Rebuilds sources (playbackRate is baked
   *  into position bookkeeping at start) and re-compensates worklet pitch. */
  setTempo(t: number): void {
    const tempo = Math.min(Math.max(t, TEMPO_MIN), TEMPO_MAX)
    if (tempo === this._tempo) return
    if (this._playing) {
      this.offset = this.position
      this.stopSources()
      this._tempo = tempo
      this.pushWorkletParams()
      this.startSources(this.offset)
    } else {
      this._tempo = tempo
      this.pushWorkletParams()
    }
  }

  /** Effective worklet pitch: user key change minus the transposition playbackRate causes. */
  private get effectivePitch(): number {
    const compensation = this._tempo === 1 ? 0 : -12 * Math.log2(this._tempo)
    return this._pitchSemitones + compensation
  }

  private pushWorkletParams(): void {
    const msg = { pitch: this.effectivePitch }
    this.stInstr.port.postMessage(msg)
    this.stVocal.port.postMessage(msg)
    this.stInstrStream?.port.postMessage(msg)
    // Refresh the display-clock latency estimate once the pipeline has warmed up.
    if (this.latencyTimer !== null) window.clearTimeout(this.latencyTimer)
    if (this.effectivePitch === 0) {
      this.latencySec = 0
      this.latencyTimer = null
    } else {
      this.latencyTimer = window.setTimeout(() => {
        this.latencyTimer = null
        void this.pingWorklets().then(([state]) => {
          if (state && this.effectivePitch !== 0) {
            this.latencySec = state.latencyFrames / this.ctx.sampleRate
          }
        })
      }, 500)
    }
  }

  /** Round-trip state from every worklet (diagnostics/verification). A worklet that
   *  never echoes (errored, port stuck) resolves `null` after PING_TIMEOUT_MS instead
   *  of hanging Promise.all forever and leaking its message listener. */
  pingWorklets(): Promise<(WorkletState | null)[]> {
    const nodes = [this.stInstr, this.stVocal, this.stInstrStream].filter(
      (n): n is AudioWorkletNode => n !== null
    )
    return Promise.all(
      nodes.map(
        (node) =>
          new Promise<WorkletState | null>((resolve) => {
            const id = ++pingSeq
            const onMsg = (e: MessageEvent): void => {
              const state = e.data
              // Match on id: stale unsolicited states (id null) queue up on a
              // not-yet-started port and would otherwise resolve the ping early.
              if (isWorkletState(state) && state.id === id) {
                window.clearTimeout(timer)
                node.port.removeEventListener('message', onMsg)
                resolve(state)
              }
            }
            const timer = window.setTimeout(() => {
              node.port.removeEventListener('message', onMsg)
              resolve(null)
            }, PING_TIMEOUT_MS)
            node.port.addEventListener('message', onMsg)
            node.port.start()
            node.port.postMessage({ type: 'ping', id })
          })
      )
    )
  }

  // ─── Mic graph (R3.MIC1-3) ───────────────────────────────────────────────
  // One MediaStream (getUserMedia), one MediaStreamAudioSourceNode per context.
  // Bypasses SoundTouch; survives play/pause/seek/tempo rebuilds.
  // MIC2: on the monitor context one FX chain (micFxOut) fans out to two legs —
  // gainMicMon (toggle + volume → speakers) and gainMicRec (volume only →
  // recordDest), so muting the monitor never drops the mic from the recording.
  // gainMicStr is the dual-mode broadcast leg (volume only → stream device).
  // MIC3: dry/wet FX crossfade inserted between src and micFxOut/gainMicStr.
  private micStream: MediaStream | null = null
  private micGeneration = 0
  private srcMicMon: MediaStreamAudioSourceNode | null = null
  private srcMicStr: MediaStreamAudioSourceNode | null = null
  private micFxOut: GainNode | null = null
  private gainMicMon: GainNode | null = null
  private gainMicRec: GainNode | null = null
  private gainMicStr: GainNode | null = null
  private fxNodesMon: AudioNode[] = []
  private fxNodesStr: AudioNode[] = []
  private _micAnalyser: AnalyserNode | null = null
  private _micMonitor = true
  private _micVolume = 1
  private _micFxPreset: MicFxPreset = 'off'
  private _micFxAmount = 0.3
  /** Non-fatal mic problem (permission denied, no device). */
  micWarning: string | null = null
  /** Set by dispose() — lets a pending enableMic() (getUserMedia) resolving after
   *  teardown stop its tracks immediately instead of wiring nodes onto a closed context. */
  private disposed = false

  get micEnabled(): boolean {
    return this.micStream !== null
  }
  /** Tapped off micFxOut (post-FX, pre monitor/record gain) — live for the pre-record level meter (R5.65). */
  get micAnalyser(): AnalyserNode | null {
    return this._micAnalyser
  }
  get micMonitor(): boolean {
    return this._micMonitor
  }
  get micVolume(): number {
    return this._micVolume
  }
  get micFxPreset(): MicFxPreset {
    return this._micFxPreset
  }
  get micFxAmount(): number {
    return this._micFxAmount
  }

  /** Disconnect and clear all FX nodes for one context leg. */
  private teardownFxLeg(nodes: AudioNode[]): void {
    for (const n of nodes) {
      try {
        n.disconnect()
      } catch {
        /* already disconnected */
      }
    }
  }

  /** Rebuild mic FX graph for both active context legs (used by setMicFx). */
  private rewireMicFx(): void {
    if (this.srcMicMon && this.micFxOut) {
      try {
        this.srcMicMon.disconnect()
      } catch {
        /* ok */
      }
      this.teardownFxLeg(this.fxNodesMon)
      this.fxNodesMon = buildFxGraph(
        this.ctx,
        this.srcMicMon,
        this.micFxOut,
        this._micFxPreset,
        this._micFxAmount
      ).fxNodes
    }
    if (this.srcMicStr && this.gainMicStr && this.streamCtx) {
      try {
        this.srcMicStr.disconnect()
      } catch {
        /* ok */
      }
      this.teardownFxLeg(this.fxNodesStr)
      this.fxNodesStr = buildFxGraph(
        this.streamCtx,
        this.srcMicStr,
        this.gainMicStr,
        this._micFxPreset,
        this._micFxAmount
      ).fxNodes
    }
  }

  async enableMic(deviceId?: string): Promise<void> {
    this.disableMic()
    this.micWarning = null
    const micGen = ++this.micGeneration
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          ...(deviceId ? { deviceId } : {})
        }
      })
      if (micGen !== this.micGeneration) {
        for (const track of stream.getTracks()) track.stop()
        return
      }
      if (this.disposed) {
        for (const track of stream.getTracks()) track.stop()
        return
      }
      this.micStream = stream
      const trackRate = stream.getAudioTracks()[0]?.getSettings().sampleRate
      if (trackRate && trackRate !== this.ctx.sampleRate) {
        console.warn(
          `Mic capture rate (${trackRate}Hz) differs from AudioContext rate (${this.ctx.sampleRate}Hz) — ` +
            'OS is resampling, which adds monitor latency. Match Windows Sound > device properties > ' +
            "Advanced > Default Format to the mic's native rate to avoid this."
        )
      }

      // Monitor context: one FX chain (→ micFxOut) fanning out to the monitor
      // leg (toggle-gated → speakers) and the record leg (always on → recordDest).
      this.micFxOut = this.ctx.createGain()
      this._micAnalyser = this.ctx.createAnalyser()
      this._micAnalyser.fftSize = 1024
      this.micFxOut.connect(this._micAnalyser)
      this.gainMicMon = this.ctx.createGain()
      this.gainMicMon.gain.value = this._micMonitor ? this._micVolume * MIC_MONITOR_BOOST : 0
      this.micFxOut.connect(this.gainMicMon)
      this.gainMicMon.connect(this.ctx.destination)
      this.gainMicRec = this.ctx.createGain()
      this.gainMicRec.gain.value = this._micVolume
      this.micFxOut.connect(this.gainMicRec)
      if (this.recordDest) this.gainMicRec.connect(this.recordDest)
      this.srcMicMon = this.ctx.createMediaStreamSource(stream)
      this.fxNodesMon = buildFxGraph(
        this.ctx,
        this.srcMicMon,
        this.micFxOut,
        this._micFxPreset,
        this._micFxAmount
      ).fxNodes

      // Stream leg: dual-mode broadcast feed to the distinct stream device only.
      if (this.streamCtx) {
        this.gainMicStr = this.streamCtx.createGain()
        this.gainMicStr.gain.value = this._micVolume
        this.gainMicStr.connect(this.streamCtx.destination)
        this.srcMicStr = this.streamCtx.createMediaStreamSource(stream)
        this.fxNodesStr = buildFxGraph(
          this.streamCtx,
          this.srcMicStr,
          this.gainMicStr,
          this._micFxPreset,
          this._micFxAmount
        ).fxNodes
      }
    } catch (err) {
      this.micWarning = `Mic unavailable: ${err instanceof Error ? err.message : String(err)}`
    }
  }

  /** Mute/unmute the monitor leg only. In single mode (no stream context) this fully silences the mic. */
  setMicMonitor(on: boolean): void {
    this._micMonitor = on
    if (this.gainMicMon) this.ramp(this.gainMicMon, on ? this._micVolume * MIC_MONITOR_BOOST : 0)
  }

  /** Set mic volume on all legs, click-free ramp. Monitor leg only ramped when monitor is on;
   *  record and broadcast legs always track volume so the take is captured at full level. */
  setMicVolume(v: number): void {
    this._micVolume = Math.min(Math.max(v, 0), 1)
    if (this.gainMicMon && this._micMonitor)
      this.ramp(this.gainMicMon, this._micVolume * MIC_MONITOR_BOOST)
    if (this.gainMicRec) this.ramp(this.gainMicRec, this._micVolume)
    if (this.gainMicStr) this.ramp(this.gainMicStr, this._micVolume, this.streamCtx)
  }

  /** Switch FX preset and/or amount. Rebuilds the FX chain if mic is active. */
  setMicFx(preset: MicFxPreset, amount: number): void {
    this._micFxPreset = preset
    this._micFxAmount = Math.min(Math.max(amount, 0), 1)
    if (this.micEnabled) this.rewireMicFx()
  }

  disableMic(): void {
    this.micGeneration++
    if (this.micStream) {
      for (const track of this.micStream.getTracks()) track.stop()
      this.micStream = null
    }
    try {
      this.srcMicMon?.disconnect()
    } catch {
      /* ok */
    }
    try {
      this.srcMicStr?.disconnect()
    } catch {
      /* ok */
    }
    this.teardownFxLeg(this.fxNodesMon)
    this.teardownFxLeg(this.fxNodesStr)
    for (const node of [
      this.micFxOut,
      this.gainMicMon,
      this.gainMicRec,
      this.gainMicStr,
      this._micAnalyser
    ]) {
      try {
        node?.disconnect()
      } catch {
        /* ok */
      }
    }
    this.srcMicMon = null
    this.srcMicStr = null
    this.micFxOut = null
    this.gainMicMon = null
    this.gainMicRec = null
    this.gainMicStr = null
    this._micAnalyser = null
    this.fxNodesMon = []
    this.fxNodesStr = []
  }

  /** Starts capturing the monitor bus (instrumental + mic record leg + FX, no guide vocal). */
  startRecording(): void {
    if (!this.recordDest || this._recording) return
    const mr = new MediaRecorder(this.recordDest.stream, { mimeType: 'audio/webm;codecs=opus' })
    this.recordedChunks = []
    mr.ondataavailable = (e) => {
      if (e.data.size > 0) this.recordedChunks.push(e.data)
    }
    mr.start()
    this.mediaRecorder = mr
    this._recording = true
  }

  /** Stops recording and resolves the captured take, or null if nothing was recording. */
  stopRecording(): Promise<Blob | null> {
    const mr = this.mediaRecorder
    if (!mr || !this._recording) return Promise.resolve(null)
    return new Promise((resolve) => {
      mr.onstop = () => {
        this._recording = false
        this.mediaRecorder = null
        const blob = new Blob(this.recordedChunks, { type: mr.mimeType })
        this.recordedChunks = []
        resolve(blob)
      }
      mr.stop()
    })
  }

  /** Tear down everything; the engine is unusable afterwards. */
  dispose(): void {
    this.disposed = true
    if (this.latencyTimer !== null) window.clearTimeout(this.latencyTimer)
    this.stopDriftWatchdog()
    this.stopSources()
    this.disableMic()
    this._playing = false
    const closeContexts = (): void => {
      void this.ctx.close()
      void this.streamCtx?.close()
    }
    // §14.8: flush a mid-record exit before tearing down the monitor context —
    // closing it immediately would cut MediaRecorder's stream off before it can flush.
    if (this._recording) {
      void this.stopRecording().then((blob) => {
        if (blob) this.onRecordingFlushed?.(blob)
        closeContexts()
      })
    } else {
      closeContexts()
    }
  }

  /** Estimate stream-vs-monitor playhead difference (ms) at a common wall instant. */
  measureDrift(): number | null {
    if (!this.streamCtx || !this._playing) return null
    const now = performance.now()
    const monitorPos = this.offset + (ctxTimeAtWall(this.ctx, now) - this.startedAt) * this._tempo
    const streamPos =
      this.streamOffset + (ctxTimeAtWall(this.streamCtx, now) - this.streamStartedAt) * this._tempo
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
    this.srcInstr.playbackRate.value = this._tempo
    this.srcInstr.connect(this.stInstr)
    this.srcVocal = this.ctx.createBufferSource()
    this.srcVocal.buffer = this.vocalBuf
    this.srcVocal.playbackRate.value = this._tempo
    this.srcVocal.connect(this.stVocal)
    // Natural end of the (longer) instrumental stem ends playback; stale handlers
    // from rebuilt sources are filtered by generation.
    this.srcInstr.onended = () => {
      if (gen !== this.generation || !this._playing) return
      this.bankStretch()
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
    if (!this.stInstrStream) return
    const src = streamCtx.createBufferSource()
    src.buffer = this.instrBuf
    src.playbackRate.value = this._tempo
    src.connect(this.stInstrStream)
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
    const masterAtStart =
      this.offset + (ctxTimeAtWall(this.ctx, startWall) - this.startedAt) * this._tempo
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

/** PCM16 WAV container around a decoded AudioBuffer's interleaved channel data. */
function encodeWavPcm16(buf: AudioBuffer): Blob {
  const numCh = buf.numberOfChannels
  const bytesPerSample = 2
  const blockAlign = numCh * bytesPerSample
  const dataSize = buf.length * blockAlign
  const out = new ArrayBuffer(44 + dataSize)
  const view = new DataView(out)
  let offset = 0
  const writeStr = (s: string): void => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset++, s.charCodeAt(i))
  }
  writeStr('RIFF')
  view.setUint32(offset, 36 + dataSize, true)
  offset += 4
  writeStr('WAVE')
  writeStr('fmt ')
  view.setUint32(offset, 16, true)
  offset += 4
  view.setUint16(offset, 1, true) // PCM
  offset += 2
  view.setUint16(offset, numCh, true)
  offset += 2
  view.setUint32(offset, buf.sampleRate, true)
  offset += 4
  view.setUint32(offset, buf.sampleRate * blockAlign, true)
  offset += 4
  view.setUint16(offset, blockAlign, true)
  offset += 2
  view.setUint16(offset, 16, true)
  offset += 2
  writeStr('data')
  view.setUint32(offset, dataSize, true)
  offset += 4
  const channels = Array.from({ length: numCh }, (_, ch) => buf.getChannelData(ch))
  for (let i = 0; i < buf.length; i++) {
    for (const data of channels) {
      const s = Math.max(-1, Math.min(1, data[i] ?? 0))
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
      offset += 2
    }
  }
  return new Blob([out], { type: 'audio/wav' })
}

/** R3.SET4/REC1: `recordingFormat: 'wav'` decodes the recorded webm/opus take and
 *  re-encodes it as PCM16 WAV (no native MediaRecorder WAV support). */
export async function encodeRecordingAsWav(blob: Blob): Promise<Blob> {
  const ctx = new AudioContext()
  try {
    const buf = await ctx.decodeAudioData(await blob.arrayBuffer())
    return encodeWavPcm16(buf)
  } finally {
    await ctx.close()
  }
}
