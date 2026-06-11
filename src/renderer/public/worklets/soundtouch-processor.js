// SoundTouch pitch-shift AudioWorklet (SPEC §9.4). Pure pitch shifting only —
// tempo is handled engine-side via AudioBufferSourceNode.playbackRate plus a
// compensating pitch offset sent here, so this processor always consumes and
// produces frames 1:1 on average and the push model stays underrun-free.
//
// Messages in:  { pitch: <semitones> }  — 0 engages true bypass (verbatim copy)
//               { type: 'ping' }        — replies with current state (verification)
// Messages out: { type: 'state', pitch, bypass, latencyFrames }
//
// Lives in public/ (served verbatim): Vite does not bundle AudioWorklet module
// graphs, so this file and its vendored ./soundtouch.js import must be plain JS.
import { SoundTouch } from './soundtouch.js'

/** Cap on internal FIFO backlog — past this the processor drops oldest output
 *  to re-bound latency (guards against slow block-rounding accumulation). */
const MAX_BACKLOG_FRAMES = 16384

class SoundTouchProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.pitch = 0
    this.st = null
    this.framesIn = 0
    this.framesOut = 0
    // Interleave/deinterleave scratch (render quantum is 128 frames).
    this.inter = new Float32Array(128 * 2)
    this.out = new Float32Array(128 * 2)
    this.port.onmessage = (e) => {
      const msg = e.data
      if (msg && typeof msg.pitch === 'number') this.setPitch(msg.pitch)
      if (msg && msg.type === 'ping') this.postState()
    }
  }

  setPitch(semitones) {
    if (semitones === this.pitch) return
    this.pitch = semitones
    if (semitones === 0) {
      // Back to bypass: drop the pipeline so re-engage starts clean.
      this.st = null
      this.framesIn = 0
      this.framesOut = 0
    } else {
      if (!this.st) {
        this.st = new SoundTouch()
        this.framesIn = 0
        this.framesOut = 0
      }
      this.st.pitchSemitones = semitones
    }
    this.postState()
  }

  postState() {
    this.port.postMessage({
      type: 'state',
      pitch: this.pitch,
      bypass: this.st === null,
      latencyFrames: this.framesIn - this.framesOut
    })
  }

  process(inputs, outputs) {
    const input = inputs[0]
    const output = outputs[0]
    if (!input || input.length === 0) return true
    const inL = input[0]
    const inR = input[1] ?? input[0]
    const outL = output[0]
    const outR = output[1] ?? output[0]
    const n = inL.length

    if (this.st === null) {
      // True bypass: verbatim copy, bit-transparent (SPEC §9.4).
      outL.set(inL)
      if (outR !== outL) outR.set(inR)
      return true
    }

    for (let i = 0; i < n; i++) {
      this.inter[i * 2] = inL[i]
      this.inter[i * 2 + 1] = inR[i]
    }
    this.st.inputBuffer.putSamples(this.inter, 0, n)
    this.framesIn += n
    this.st.process()

    const fifo = this.st.outputBuffer
    if (fifo.frameCount > MAX_BACKLOG_FRAMES) {
      const drop = fifo.frameCount - MAX_BACKLOG_FRAMES
      fifo.receive(drop)
      this.framesOut += drop
    }
    if (fifo.frameCount >= n) {
      fifo.receiveSamples(this.out, n)
      this.framesOut += n
      for (let i = 0; i < n; i++) {
        outL[i] = this.out[i * 2]
        outR[i] = this.out[i * 2 + 1]
      }
    }
    // Not enough buffered yet (pipeline warm-up): output stays silent this quantum.
    return true
  }
}

registerProcessor('soundtouch-processor', SoundTouchProcessor)
