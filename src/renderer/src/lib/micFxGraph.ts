export type MicFxPreset = 'off' | 'room' | 'hall' | 'echo' | 'karaoke'

export interface FxGraph {
  dry: GainNode
  wet: GainNode
  fxNodes: AudioNode[]
}

/** Synth decaying-noise IR for ConvolverNode (no bundled audio files). */
function makeIR(ctx: AudioContext, durationSec: number, decay: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * durationSec)
  const buf = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** decay
    }
  }
  return buf
}

/**
 * Build and connect a dry/wet FX graph between src and outputGain for one of
 * the mic FX presets. Returns {dry, wet, fxNodes} — caller stores these for
 * teardown (AudioEngine.rewireMicFx/disableMic).
 */
export function buildFxGraph(
  ctx: AudioContext,
  src: MediaStreamAudioSourceNode,
  out: GainNode,
  preset: MicFxPreset,
  amount: number
): FxGraph {
  const dry = ctx.createGain()
  const wet = ctx.createGain()
  const nodes: AudioNode[] = []

  if (preset === 'off') {
    dry.gain.value = 1
    wet.gain.value = 0
    src.connect(dry)
    dry.connect(out)
    src.connect(wet)
    wet.connect(out)
  } else {
    dry.gain.value = 1 - amount
    wet.gain.value = amount
    src.connect(dry)
    dry.connect(out)

    // Build FX chain; fxFirst = entry point from src, fxLast = exit to wet.
    let fxFirst: AudioNode
    let fxLast: AudioNode

    if (preset === 'room') {
      const conv = ctx.createConvolver()
      conv.buffer = makeIR(ctx, 0.8, 4)
      fxFirst = conv
      fxLast = conv
      nodes.push(conv)
    } else if (preset === 'hall') {
      const conv = ctx.createConvolver()
      conv.buffer = makeIR(ctx, 2.5, 3)
      fxFirst = conv
      fxLast = conv
      nodes.push(conv)
    } else if (preset === 'echo') {
      const delay = ctx.createDelay(1.0)
      delay.delayTime.value = 0.25
      const fb = ctx.createGain()
      fb.gain.value = 0.35
      delay.connect(fb)
      fb.connect(delay)
      fxFirst = delay
      fxLast = delay
      nodes.push(delay, fb)
    } else {
      // karaoke: light reverb + light echo, parallel into a merge gain
      const conv = ctx.createConvolver()
      conv.buffer = makeIR(ctx, 0.8, 5)
      const delay = ctx.createDelay(1.0)
      delay.delayTime.value = 0.2
      const fb = ctx.createGain()
      fb.gain.value = 0.2
      delay.connect(fb)
      fb.connect(delay)
      const split = ctx.createGain()
      split.gain.value = 0.6
      const merge = ctx.createGain()
      merge.gain.value = 1
      split.connect(conv)
      split.connect(delay)
      conv.connect(merge)
      delay.connect(merge)
      fxFirst = split
      fxLast = merge
      nodes.push(split, conv, delay, fb, merge)
    }

    src.connect(fxFirst)
    fxLast.connect(wet)
    wet.connect(out)
  }

  nodes.push(dry, wet)
  return { dry, wet, fxNodes: nodes }
}
