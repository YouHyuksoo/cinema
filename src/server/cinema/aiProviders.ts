import { AI_LIMITS, DEFAULT_AI_CONFIG, aiProvider, type AiConfig, type AiProviderId } from '@/cinema/aiConfig';
import { readConfig } from './hatcheryConfig';
import { codexAccessTokens, codexLoginStatus, type CodexTokens } from './codexAuth';

/** Resolved settings the assistant actually runs with: saved config first, OPENAI_* environment as fallback. */
export interface AiRuntime extends AiConfig { keySource: 'config' | 'env' | 'codex' }
export interface ChatTurn { role: 'user' | 'assistant'; content: string }

const envKey = () => process.env.OPENAI_API_KEY?.trim() ?? '';

/** Saved AI settings without the key resolution; `undefined` when nothing was saved. */
export function savedAiConfig(): AiConfig | undefined { return readConfig().config.ai; }

export function resolveAiRuntime(): AiRuntime | null {
  const saved = savedAiConfig();
  if (saved?.provider === 'chatgpt') return codexLoginStatus().ok ? { ...saved, apiKey: '', keySource: 'codex' } : null;
  if (saved?.apiKey) return { ...saved, keySource: 'config' };
  const key = envKey();
  if (!key) return null;
  // No saved key: the environment backs OpenAI, keeping the saved model/instructions when the provider matches.
  const base = saved?.provider === 'openai' ? saved : {
    ...DEFAULT_AI_CONFIG, model: process.env.OPENAI_TEXT_MODEL || DEFAULT_AI_CONFIG.model,
    realtimeModel: process.env.OPENAI_REALTIME_MODEL || DEFAULT_AI_CONFIG.realtimeModel,
  };
  return { ...base, provider: 'openai', apiKey: key, keySource: 'env' };
}

export class AiProviderFailure extends Error {
  constructor(public provider: AiProviderId, public status: number, detail?: string) {
    super(status === 429 ? `${aiProvider(provider).label} 사용 한도 또는 잔액을 확인해 주세요.`
      : status === 401 || status === 403 ? `${aiProvider(provider).label} 키 또는 모델 접근 권한을 확인해 주세요.`
      : status === 404 || (status === 400 && /model/i.test(detail ?? '')) ? `${aiProvider(provider).label}에서 모델을 쓸 수 없습니다${detail ? ` (${detail})` : ''}.`
      : `${aiProvider(provider).label} 연결에 실패했습니다${detail ? ` (${detail})` : ''}. 잠시 후 다시 시도해 주세요.`);
  }
}

export interface ProviderRequest { url: string; init: RequestInit }

/** Codex backend endpoint the ChatGPT login is entitled to; it speaks the Responses API but only streams. */
export const CODEX_RESPONSES_URL = 'https://chatgpt.com/backend-api/codex/responses';

/** Pure request builder per provider, so the wire format is testable without a network. */
export function buildChatRequest(runtime: AiConfig, system: string, turns: ChatTurn[], maxOutputTokens = runtime.maxOutputTokens, codex?: CodexTokens): ProviderRequest {
  const temperature = Math.max(AI_LIMITS.temperature.min, Math.min(AI_LIMITS.temperature.max, runtime.temperature));
  switch (runtime.provider) {
    case 'chatgpt':
      // Reasoning models on the Codex backend reject sampling fields; keep the payload to what the CLI sends.
      return { url: CODEX_RESPONSES_URL, init: { method: 'POST',
        headers: { Authorization: `Bearer ${codex?.accessToken ?? ''}`, 'chatgpt-account-id': codex?.accountId ?? '', 'OpenAI-Beta': 'responses=experimental',
          originator: 'codex_cli_rs', 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify({ model: runtime.model, instructions: system, store: false, stream: true,
          input: turns.map(turn => ({ type: 'message', role: turn.role, content: [{ type: turn.role === 'assistant' ? 'output_text' : 'input_text', text: turn.content }] })) }) } };
    case 'anthropic':
      return { url: 'https://api.anthropic.com/v1/messages', init: { method: 'POST',
        headers: { 'x-api-key': runtime.apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: runtime.model, max_tokens: maxOutputTokens, temperature: Math.min(1, temperature), system,
          messages: turns.map(turn => ({ role: turn.role, content: turn.content })) }) } };
    case 'gemini':
      return { url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(runtime.model)}:generateContent`, init: { method: 'POST',
        headers: { 'x-goog-api-key': runtime.apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] },
          contents: turns.map(turn => ({ role: turn.role === 'assistant' ? 'model' : 'user', parts: [{ text: turn.content }] })),
          generationConfig: { temperature, maxOutputTokens } }) } };
    case 'mistral':
      return { url: 'https://api.mistral.ai/v1/chat/completions', init: { method: 'POST',
        headers: { Authorization: `Bearer ${runtime.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: runtime.model, temperature, max_tokens: maxOutputTokens,
          messages: [{ role: 'system', content: system }, ...turns] }) } };
    default:
      return { url: 'https://api.openai.com/v1/responses', init: { method: 'POST',
        headers: { Authorization: `Bearer ${runtime.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: runtime.model, store: false, max_output_tokens: maxOutputTokens, temperature, instructions: system,
          input: turns.map(turn => ({ role: turn.role, content: turn.content })) }) } };
  }
}

/** Collect the final text from a Responses SSE stream: the completed response if present, else the concatenated deltas. */
export function extractSseText(stream: string): string {
  let completed: unknown; const deltas: string[] = [];
  for (const line of stream.split(/\r?\n/)) {
    if (!line.startsWith('data:')) continue;
    const payload = line.slice(5).trim();
    if (!payload || payload === '[DONE]') continue;
    try {
      const event = JSON.parse(payload) as { type?: string; delta?: string; response?: unknown };
      if (event.type === 'response.output_text.delta' && typeof event.delta === 'string') deltas.push(event.delta);
      if (event.type === 'response.completed' && event.response) completed = event.response;
    } catch { /* keep-alive or partial line */ }
  }
  // The Codex backend's completed event often carries no text; the deltas are the reliable source.
  const final = completed ? extractChatText('openai', completed) : '';
  return final || deltas.join('').trim();
}

/** Plain-text reply out of each provider's response shape. */
export function extractChatText(provider: AiProviderId, data: unknown): string {
  const body = (data ?? {}) as Record<string, unknown>;
  if (provider === 'anthropic') {
    const content = Array.isArray(body.content) ? body.content as { type?: string; text?: string }[] : [];
    return content.filter(part => part.type === 'text').map(part => part.text ?? '').join('\n').trim();
  }
  if (provider === 'gemini') {
    const candidates = Array.isArray(body.candidates) ? body.candidates as { content?: { parts?: { text?: string }[] } }[] : [];
    return candidates.flatMap(candidate => candidate.content?.parts ?? []).map(part => part.text ?? '').join('\n').trim();
  }
  if (provider === 'mistral') {
    const choices = Array.isArray(body.choices) ? body.choices as { message?: { content?: string | { type?: string; text?: string }[] } }[] : [];
    const content = choices[0]?.message?.content;
    if (typeof content === 'string') return content.trim();
    return (Array.isArray(content) ? content : []).filter(part => part.type === 'text').map(part => part.text ?? '').join('\n').trim();
  }
  const output = Array.isArray(body.output) ? body.output as { type?: string; content?: { type?: string; text?: string; refusal?: string }[] }[] : [];
  return output.filter(item => item.type === 'message').flatMap(item => item.content ?? [])
    .map(part => part.type === 'output_text' ? part.text ?? '' : part.type === 'refusal' ? part.refusal ?? '' : '').join('\n').trim();
}

async function failureDetail(response: Response): Promise<string | undefined> {
  try {
    const body = await response.json() as { error?: { message?: string } | string; detail?: string; message?: string };
    // OpenAI: error.message; Codex backend: detail; Gemini/Anthropic also use error.message.
    const message = typeof body.error === 'string' ? body.error : body.error?.message ?? body.detail ?? body.message;
    return message ? message.slice(0, 160) : undefined;
  } catch { return undefined; }
}

/** One chat completion through the configured provider; throws AiProviderFailure on HTTP errors. */
export async function chatWithProvider(runtime: AiConfig, system: string, turns: ChatTurn[], signal: AbortSignal, maxOutputTokens?: number): Promise<string> {
  const codex = runtime.provider === 'chatgpt' ? await codexAccessTokens(signal) : undefined;
  const { url, init } = buildChatRequest(runtime, system, turns, maxOutputTokens, codex);
  const response = await fetch(url, { ...init, signal: AbortSignal.any([signal, AbortSignal.timeout(60000)]), cache: 'no-store' });
  if (!response.ok) throw new AiProviderFailure(runtime.provider, response.status, await failureDetail(response));
  if (runtime.provider === 'chatgpt') return extractSseText(await response.text());
  return extractChatText(runtime.provider, await response.json());
}

export type AiTestResult = { ok: true; elapsedMs: number; provider: AiProviderId; model: string; reply: string } | { ok: false; error: string };

/** Round trip with a tiny prompt so the screen can prove the key, model and network work. */
export async function testAiConnection(runtime: AiConfig, signal: AbortSignal): Promise<AiTestResult> {
  const started = Date.now();
  try {
    const reply = await chatWithProvider(runtime, '당신은 HATCHERY 연결 테스트 응답기입니다. 어떤 입력에도 "확인"이라는 한 단어로만 답하세요.',
      [{ role: 'user', content: '연결 테스트' }], signal, 32);
    return { ok: true, elapsedMs: Date.now() - started, provider: runtime.provider, model: runtime.model, reply: reply || '(빈 응답)' };
  } catch (error) {
    if (error instanceof AiProviderFailure) return { ok: false, error: error.message };
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: /abort|timeout/i.test(message) ? '응답 시간이 초과됐습니다.' : /codex/i.test(message) ? message : `연결 오류: ${message}` };
  }
}
