import type { LlmTestResult } from '../shared/types'
import { getSettings } from './settings'

/**
 * OpenAI-compatible chat client (R3.1, SPEC §12).
 * Plain fetch against `<llmBaseUrl>/chat/completions` — covers Ollama, LM Studio,
 * and hosted providers. Errors are rewritten into messages a settings screen can show.
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatOptions {
  /** Hard cap on the round-trip; default 30s (local models can be slow to load). */
  timeoutMs?: number
  temperature?: number
}

const DEFAULT_TIMEOUT_MS = 30_000

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

/** Pulls the human-readable message out of an OpenAI-style error body, else falls back to status. */
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

/** Sends a chat completion request to the endpoint configured in settings; resolves with the reply text. */
export async function chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<string> {
  const { llmBaseUrl, llmModel, llmApiKey } = getSettings()
  const baseUrl = llmBaseUrl.trim().replace(/\/+$/, '')
  const model = llmModel.trim()
  if (!baseUrl) throw new Error('Set the LLM base URL in Settings first.')
  if (!model) throw new Error('Set a model name in Settings first.')
  try {
    new URL(baseUrl)
  } catch {
    throw new Error(`"${baseUrl}" is not a valid URL.`)
  }

  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (llmApiKey.trim()) headers.Authorization = `Bearer ${llmApiKey.trim()}`

  let res: Response
  try {
    res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        ...(opts.temperature !== undefined && { temperature: opts.temperature })
      }),
      signal: AbortSignal.timeout(timeoutMs)
    })
  } catch (err) {
    throw friendlyNetworkError(err, baseUrl, timeoutMs)
  }
  if (!res.ok) throw await friendlyHttpError(res, model)

  let content: unknown
  try {
    const body = (await res.json()) as { choices?: { message?: { content?: unknown } }[] }
    content = body.choices?.[0]?.message?.content
  } catch {
    throw new Error('Endpoint returned non-JSON — not an OpenAI-compatible /v1 URL?')
  }
  if (typeof content !== 'string')
    throw new Error('Unexpected response shape — not an OpenAI-compatible /v1 URL?')
  return content
}

/** Settings "Test" button: tiny round-trip proving URL + model + key all work. */
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
