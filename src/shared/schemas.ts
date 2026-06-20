// Zod schemas as source of truth for shared contracts + external API boundaries (issue #23).
// TS types are inferred here; src/shared/types.ts re-exports them for backward compat.
import { z } from 'zod'

// --- Pipeline protocol (SPEC §6.2) ---

export const ImportPipelineLineSchema = z.discriminatedUnion('stage', [
  z.object({ stage: z.literal('queued'), progress: z.number() }),
  z.object({ stage: z.literal('download'), progress: z.number() }),
  z.object({ stage: z.literal('separate'), progress: z.number() }),
  z.object({ stage: z.literal('convert'), progress: z.number() }),
  z.object({ stage: z.literal('done'), durationSec: z.number().optional() }),
  z.object({ stage: z.literal('error'), message: z.string() })
])
export type ImportPipelineLine = z.infer<typeof ImportPipelineLineSchema>
export type ImportStage = ImportPipelineLine['stage']

// --- Mic FX preset ---

export const MicFxPresetSchema = z.enum(['off', 'room', 'hall', 'echo', 'karaoke'])
export type MicFxPreset = z.infer<typeof MicFxPresetSchema>

// --- LLM provider preset (issue #61) ---

export const LlmProviderSchema = z.enum(['ollama', 'openai', 'anthropic', 'gemini', 'openrouter'])
export type LlmProvider = z.infer<typeof LlmProviderSchema>

// --- External: LRCLIB API response item ---
// albumName/duration are nullable in the API; normalised to '' / 0 for consumers.

export const LrclibHitSchema = z.object({
  id: z.number(),
  trackName: z.string().catch(''),
  artistName: z.string().catch(''),
  albumName: z
    .string()
    .nullable()
    .catch(null)
    .transform((v) => v ?? ''),
  duration: z
    .number()
    .nullable()
    .catch(null)
    .transform((v) => v ?? 0),
  instrumental: z.boolean().catch(false),
  plainLyrics: z.string().nullable().catch(null),
  syncedLyrics: z.string().nullable().catch(null)
})
export type LrclibHit = z.infer<typeof LrclibHitSchema>

// --- External: OpenAI-compat /v1/models (also: Anthropic /v1/models — same {data:[{id}]} shape) ---

export const ListModelsResponseSchema = z.object({
  data: z.array(z.object({ id: z.string() })).default([])
})

// --- External: OpenAI-compat /chat/completions ---

export const ChatCompletionResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({ content: z.string() }).optional()
      })
    )
    .default([])
})

// --- External: Anthropic /v1/messages ---

export const AnthropicMessagesResponseSchema = z.object({
  content: z.array(z.object({ type: z.string(), text: z.string().optional() })).default([])
})

// --- External: Gemini /v1beta/models ---

export const GeminiModelsResponseSchema = z.object({
  models: z
    .array(
      z.object({
        name: z.string(),
        supportedGenerationMethods: z.array(z.string()).default([])
      })
    )
    .default([])
})

// --- External: Gemini /v1beta/models/{model}:generateContent ---

export const GeminiGenerateContentResponseSchema = z.object({
  candidates: z
    .array(
      z.object({
        content: z
          .object({ parts: z.array(z.object({ text: z.string().optional() })).default([]) })
          .optional()
      })
    )
    .default([])
})
