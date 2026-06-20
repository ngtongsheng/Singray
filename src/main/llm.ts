import {
  AnthropicMessagesResponseSchema,
  ChatCompletionResponseSchema,
  GeminiGenerateContentResponseSchema,
  GeminiModelsResponseSchema,
  ListModelsResponseSchema
} from '../shared/schemas'
import type { LlmProvider, LlmTestResult } from '../shared/types'
import { getSettings } from './settings'

/**
 * Multi-provider chat client (R3.1 + issue #61). `chat`/`listLlmModels` dispatch on the
 * configured provider preset — Ollama/OpenAI/OpenRouter share an OpenAI-compatible `/v1`
 * shape, Anthropic and Gemini each need their own endpoint + auth header + response shape.
 * Errors are rewritten into messages a settings screen can show.
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatOptions {
  /** Hard cap on the round-trip; default 30s (local models can be slow to load). */
  timeoutMs?: number
  temperature?: number
  /**
   * Ask reasoning models to skip thinking (`reasoning_effort: "none"`, honored by
   * Ollama's /v1) — without it a thinking model burns the whole enrichment budget
   * on hidden tokens. Servers that reject the param get one retry without it.
   * OpenAI-compatible providers only; ignored for Anthropic/Gemini.
   */
  noReasoning?: boolean
}

const DEFAULT_TIMEOUT_MS = 30_000
const MODELS_TIMEOUT_MS = 5_000
/** Generous cap so lyric cleanup (can run long) isn't cut off; this is a personal app, not metered. */
const ANTHROPIC_MAX_TOKENS = 4096

const PROVIDER_DEFAULTS: Record<LlmProvider, { baseUrl: string; requiresKey: boolean }> = {
  ollama: { baseUrl: 'http://localhost:11434/v1', requiresKey: false },
  openai: { baseUrl: 'https://api.openai.com/v1', requiresKey: true },
  anthropic: { baseUrl: 'https://api.anthropic.com', requiresKey: true },
  gemini: { baseUrl: 'https://generativelanguage.googleapis.com/v1beta', requiresKey: true },
  openrouter: { baseUrl: 'https://openrouter.ai/api/v1', requiresKey: true }
}

/** Ollama's base URL is user-editable; cloud providers use a fixed, hidden base URL. */
function resolveBaseUrl(provider: LlmProvider, settingsBaseUrl: string): string {
  if (provider !== 'ollama') return PROVIDER_DEFAULTS[provider].baseUrl
  const trimmed = settingsBaseUrl.trim().replace(/\/+$/, '')
  if (!trimmed) throw new Error('Set the Ollama base URL in Settings first.')
  try {
    new URL(trimmed)
  } catch {
    throw new Error(`"${trimmed}" is not a valid URL.`)
  }
  return trimmed
}

function friendlyNetworkError(err: unknown, baseUrl: string, timeoutMs: number): Error {
  if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
    return new Error(
      `No response within ${Math.round(timeoutMs / 1000)}s from ${baseUrl} — server down or model still loading?`
    )
  }
  const cause = (err as { cause?: { code?: string } }).cause
  const code = cause?.code ?? ''
  if (code === 'ECONNREFUSED')
    return new Error(`Cannot reach ${baseUrl} — connection refused. Is the server running?`)
  if (code === 'ENOTFOUND') return new Error(`Cannot reach ${baseUrl} — host not found.`)
  if (code) return new Error(`Cannot reach ${baseUrl} (${code}).`)
  return new Error(`Request to ${baseUrl} failed: ${err instanceof Error ? err.message : err}`)
}

/** Pulls the human-readable message out of an OpenAI/Anthropic/Gemini-style error body. */
async function friendlyHttpError(res: Response, model: string): Promise<Error> {
  let detail = ''
  try {
    const body = (await res.json()) as { error?: { message?: string } | string }
    detail = typeof body.error === 'string' ? body.error : (body.error?.message ?? '')
  } catch {
    // non-JSON body — status line is all we have
  }
  if (res.status === 401 || res.status === 403)
    return new Error(`Endpoint rejected the API key (HTTP ${res.status}). ${detail}`.trim())
  if (res.status === 404 && !detail)
    return new Error(`HTTP 404 — wrong base URL, or model "${model}" not found.`)
  return new Error(detail ? `Server error: ${detail}` : `Server returned HTTP ${res.status}.`)
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  baseUrlForError: string
): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
  } catch (err) {
    throw friendlyNetworkError(err, baseUrlForError, timeoutMs)
  }
}

// --- OpenAI-compatible (Ollama, OpenAI, OpenRouter) ---

async function chatOpenAiCompat(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  opts: ChatOptions,
  timeoutMs: number
): Promise<string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`

  const request = async (noReasoning: boolean): Promise<Response> =>
    fetchWithTimeout(
      `${baseUrl}/chat/completions`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          messages,
          stream: false,
          ...(opts.temperature !== undefined && { temperature: opts.temperature }),
          ...(noReasoning && { reasoning_effort: 'none' })
        })
      },
      timeoutMs,
      baseUrl
    )

  let res = await request(opts.noReasoning ?? false)
  // Strict providers 400 on reasoning_effort for non-reasoning models — retry plain.
  if (opts.noReasoning && res.status === 400) res = await request(false)
  if (!res.ok) throw await friendlyHttpError(res, model)

  let raw: unknown
  try {
    raw = await res.json()
  } catch {
    throw new Error('Endpoint returned non-JSON — not an OpenAI-compatible /v1 URL?')
  }
  const parsed = ChatCompletionResponseSchema.safeParse(raw)
  const content = parsed.success ? parsed.data.choices[0]?.message?.content : undefined
  if (typeof content !== 'string')
    throw new Error('Unexpected response shape — not an OpenAI-compatible /v1 URL?')
  return content
}

async function listOpenAiCompatModels(baseUrl: string, apiKey: string): Promise<string[]> {
  const headers: Record<string, string> = {}
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`
  const res = await fetchWithTimeout(`${baseUrl}/models`, { headers }, MODELS_TIMEOUT_MS, baseUrl)
  if (!res.ok) throw await friendlyHttpError(res, '')
  const parsed = ListModelsResponseSchema.safeParse(await res.json())
  return (parsed.success ? parsed.data.data : []).map((m) => m.id).sort()
}

// --- Anthropic ---

async function chatAnthropic(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  opts: ChatOptions,
  timeoutMs: number
): Promise<string> {
  const system = messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n\n')
  const conversation = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role, content: m.content }))

  const res = await fetchWithTimeout(
    `${baseUrl}/v1/messages`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        max_tokens: ANTHROPIC_MAX_TOKENS,
        messages: conversation,
        ...(system && { system }),
        ...(opts.temperature !== undefined && { temperature: opts.temperature })
      })
    },
    timeoutMs,
    baseUrl
  )
  if (!res.ok) throw await friendlyHttpError(res, model)

  let raw: unknown
  try {
    raw = await res.json()
  } catch {
    throw new Error('Endpoint returned non-JSON — not an Anthropic Messages API URL?')
  }
  const parsed = AnthropicMessagesResponseSchema.safeParse(raw)
  const text = parsed.success ? parsed.data.content.find((c) => c.type === 'text')?.text : undefined
  if (typeof text !== 'string') throw new Error('Unexpected response shape from Anthropic.')
  return text
}

async function listAnthropicModels(baseUrl: string, apiKey: string): Promise<string[]> {
  const res = await fetchWithTimeout(
    `${baseUrl}/v1/models`,
    { headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' } },
    MODELS_TIMEOUT_MS,
    baseUrl
  )
  if (!res.ok) throw await friendlyHttpError(res, '')
  const parsed = ListModelsResponseSchema.safeParse(await res.json())
  return (parsed.success ? parsed.data.data : []).map((m) => m.id).sort()
}

// --- Gemini ---

async function chatGemini(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  opts: ChatOptions,
  timeoutMs: number
): Promise<string> {
  const system = messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n\n')
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }))

  const res = await fetchWithTimeout(
    `${baseUrl}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        ...(system && { systemInstruction: { parts: [{ text: system }] } }),
        ...(opts.temperature !== undefined && {
          generationConfig: { temperature: opts.temperature }
        })
      })
    },
    timeoutMs,
    baseUrl
  )
  if (!res.ok) throw await friendlyHttpError(res, model)

  let raw: unknown
  try {
    raw = await res.json()
  } catch {
    throw new Error('Endpoint returned non-JSON — not a Gemini generateContent URL?')
  }
  const parsed = GeminiGenerateContentResponseSchema.safeParse(raw)
  const parts = parsed.success ? parsed.data.candidates[0]?.content?.parts : undefined
  const text = parts?.map((p) => p.text ?? '').join('')
  if (!text) throw new Error('Unexpected response shape from Gemini.')
  return text
}

async function listGeminiModels(baseUrl: string, apiKey: string): Promise<string[]> {
  const res = await fetchWithTimeout(
    `${baseUrl}/models?key=${encodeURIComponent(apiKey)}`,
    {},
    MODELS_TIMEOUT_MS,
    baseUrl
  )
  if (!res.ok) throw await friendlyHttpError(res, '')
  const parsed = GeminiModelsResponseSchema.safeParse(await res.json())
  const models = parsed.success ? parsed.data.models : []
  return models
    .filter((m) => m.supportedGenerationMethods.includes('generateContent'))
    .map((m) => m.name.replace(/^models\//, ''))
    .sort()
}

// --- Dispatch ---

/** Sends a chat request to the endpoint configured in settings; resolves with the reply text. */
export async function chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<string> {
  const { llmProvider, llmBaseUrl, llmModel, llmApiKey } = getSettings()
  const model = llmModel.trim()
  if (!model) throw new Error('Set a model name in Settings first.')
  const apiKey = llmApiKey.trim()
  const cfg = PROVIDER_DEFAULTS[llmProvider]
  if (cfg.requiresKey && !apiKey) throw new Error('Set an API key in Settings first.')
  const baseUrl = resolveBaseUrl(llmProvider, llmBaseUrl)
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS

  switch (llmProvider) {
    case 'anthropic':
      return chatAnthropic(baseUrl, apiKey, model, messages, opts, timeoutMs)
    case 'gemini':
      return chatGemini(baseUrl, apiKey, model, messages, opts, timeoutMs)
    default:
      return chatOpenAiCompat(baseUrl, apiKey, model, messages, opts, timeoutMs)
  }
}

/** Lists available models for the given provider preset; returns sorted model IDs. */
export async function listLlmModels(
  provider: LlmProvider,
  baseUrl: string,
  apiKey: string
): Promise<string[]> {
  const cfg = PROVIDER_DEFAULTS[provider]
  const key = apiKey.trim()
  if (cfg.requiresKey && !key) throw new Error('Set an API key in Settings first.')
  const base = resolveBaseUrl(provider, baseUrl)

  switch (provider) {
    case 'anthropic':
      return listAnthropicModels(base, key)
    case 'gemini':
      return listGeminiModels(base, key)
    default:
      return listOpenAiCompatModels(base, key)
  }
}

/** Settings "Test" button: tiny round-trip proving provider + model + key all work. */
export async function testLlm(): Promise<LlmTestResult> {
  const started = Date.now()
  const reply = await chat([{ role: 'user', content: 'Reply with the single word: pong' }], {
    temperature: 0
  })
  return {
    model: getSettings().llmModel.trim(),
    reply: reply.trim().slice(0, 80),
    ms: Date.now() - started
  }
}
