/**
 * AI assistant configuration: provider, model, key, generation settings and operator instructions.
 * Stored inside the server-only hatchery config file; the AI settings screen (/cinema/ai) edits it.
 * Environment variables (OPENAI_*) remain the fallback when nothing is saved.
 */
export type AiProviderId = 'openai' | 'chatgpt' | 'anthropic' | 'gemini';
/** How the operator talks to HATCHERY: OpenAI's realtime voice session, or the browser's own speech with the text model. */
export type AiVoiceMode = 'realtime' | 'browser';
export const AI_VOICE_MODES: readonly { id: AiVoiceMode; label: string; hint: string }[] = [
  { id: 'realtime', label: 'OpenAI Realtime 음성', hint: 'OpenAI API 키 필요 · 음성 모델 과금 · 끼어들기 가능' },
  { id: 'browser', label: '브라우저 음성 + 텍스트 모델', hint: '브라우저 음성 인식·합성 · 어떤 프로바이더든 텍스트 모델로 답변 · 저렴' },
];

export interface AiProvider {
  id: AiProviderId;
  label: string;
  /** Suggested chat models; the screen also accepts a custom model id. */
  models: readonly string[];
  keyHint: string;
  /** Only OpenAI backs the realtime voice session. */
  realtime: boolean;
  /** `key`: an API key is saved; `codex`: reuse the Codex CLI's ChatGPT login (no key). */
  auth: 'key' | 'codex';
  docs: string;
}

export const AI_PROVIDERS: readonly AiProvider[] = [
  { id: 'openai', label: 'OpenAI API', models: ['gpt-4.1-mini', 'gpt-4.1', 'gpt-5-mini', 'gpt-5'], keyHint: 'sk-…',
    realtime: true, auth: 'key', docs: 'https://platform.openai.com/api-keys' },
  // Only the models the ChatGPT account is entitled to on the Codex backend (checked 2026-09); others answer 400.
  { id: 'chatgpt', label: 'ChatGPT 구독 (Codex 로그인)', models: ['gpt-6-astra', 'gpt-5.5'], keyHint: 'API 키 불필요',
    realtime: false, auth: 'codex', docs: 'https://developers.openai.com/codex/cli' },
  { id: 'anthropic', label: 'Anthropic Claude', models: ['claude-sonnet-5', 'claude-opus-5', 'claude-haiku-4-5-20251001'], keyHint: 'sk-ant-…',
    realtime: false, auth: 'key', docs: 'https://console.anthropic.com/settings/keys' },
  { id: 'gemini', label: 'Google Gemini', models: ['gemini-2.5-flash', 'gemini-2.5-pro'], keyHint: 'AIza…',
    realtime: false, auth: 'key', docs: 'https://aistudio.google.com/apikey' },
];

export interface AiConfig {
  provider: AiProviderId;
  model: string;
  apiKey: string;
  /** 0–2; providers that cap at 1 receive the value clamped. */
  temperature: number;
  maxOutputTokens: number;
  /** Operator directives appended to the built-in HATCHERY instructions. */
  instructions: string;
  /** OpenAI realtime voice model; ignored by other providers. */
  realtimeModel: string;
  voiceMode: AiVoiceMode;
}

export const AI_LIMITS = { temperature: { min: 0, max: 2 }, maxOutputTokens: { min: 64, max: 8000 }, instructions: 4000 } as const;

export const DEFAULT_AI_CONFIG: AiConfig = {
  provider: 'openai', model: 'gpt-4.1-mini', apiKey: '', temperature: 0.7, maxOutputTokens: 800, instructions: '', realtimeModel: 'gpt-realtime-2.1-mini',
  voiceMode: 'realtime',
};
export const isAiVoiceMode = (value: unknown): value is AiVoiceMode => AI_VOICE_MODES.some(mode => mode.id === value);

export const isAiProvider = (value: unknown): value is AiProviderId => AI_PROVIDERS.some(provider => provider.id === value);
export const aiProvider = (id: AiProviderId) => AI_PROVIDERS.find(provider => provider.id === id) ?? AI_PROVIDERS[0];

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

export function parseAiConfig(input: unknown): { ok: true; config: AiConfig } | { ok: false; reason: string } {
  if (!isRecord(input)) return { ok: false, reason: 'AI 설정은 객체여야 합니다.' };
  const { provider, model, apiKey, temperature, maxOutputTokens, instructions, realtimeModel, voiceMode } = input;
  if (!isAiProvider(provider)) return { ok: false, reason: `지원하지 않는 AI 프로바이더입니다: ${String(provider)}` };
  if (typeof model !== 'string' || !model.trim()) return { ok: false, reason: '모델 이름이 필요합니다.' };
  if (!/^[\w.:/-]{1,120}$/.test(model.trim())) return { ok: false, reason: '모델 이름에 쓸 수 없는 문자가 있습니다.' };
  const temp = temperature === undefined ? DEFAULT_AI_CONFIG.temperature : Number(temperature);
  if (!Number.isFinite(temp) || temp < AI_LIMITS.temperature.min || temp > AI_LIMITS.temperature.max) return { ok: false, reason: `temperature는 ${AI_LIMITS.temperature.min}~${AI_LIMITS.temperature.max} 사이여야 합니다.` };
  const tokens = maxOutputTokens === undefined ? DEFAULT_AI_CONFIG.maxOutputTokens : Number(maxOutputTokens);
  if (!Number.isInteger(tokens) || tokens < AI_LIMITS.maxOutputTokens.min || tokens > AI_LIMITS.maxOutputTokens.max) return { ok: false, reason: `최대 출력 토큰은 ${AI_LIMITS.maxOutputTokens.min}~${AI_LIMITS.maxOutputTokens.max} 사이의 정수여야 합니다.` };
  if (instructions !== undefined && typeof instructions !== 'string') return { ok: false, reason: '프롬프트 지시어는 문자열이어야 합니다.' };
  if (typeof instructions === 'string' && instructions.length > AI_LIMITS.instructions) return { ok: false, reason: `프롬프트 지시어는 ${AI_LIMITS.instructions}자 이하여야 합니다.` };
  if (apiKey !== undefined && typeof apiKey !== 'string') return { ok: false, reason: 'API 키는 문자열이어야 합니다.' };
  if (realtimeModel !== undefined && typeof realtimeModel !== 'string') return { ok: false, reason: '실시간 음성 모델은 문자열이어야 합니다.' };
  if (voiceMode !== undefined && !isAiVoiceMode(voiceMode)) return { ok: false, reason: `지원하지 않는 음성 방식입니다: ${String(voiceMode)}` };
  return { ok: true, config: {
    provider, model: model.trim(), apiKey: typeof apiKey === 'string' ? apiKey.trim() : '',
    temperature: Math.round(temp * 100) / 100, maxOutputTokens: tokens,
    instructions: typeof instructions === 'string' ? instructions.trim() : '',
    realtimeModel: typeof realtimeModel === 'string' && realtimeModel.trim() ? realtimeModel.trim() : DEFAULT_AI_CONFIG.realtimeModel,
    voiceMode: isAiVoiceMode(voiceMode) ? voiceMode : DEFAULT_AI_CONFIG.voiceMode,
  } };
}

/** What the settings screen receives: the key replaced by a presence flag and where it comes from. */
export type AiKeySource = 'config' | 'env' | 'codex' | 'none';
export type MaskedAiConfig = Omit<AiConfig, 'apiKey'> & { hasApiKey: boolean; keySource: AiKeySource };

export function maskAiConfig(config: AiConfig | undefined, envKey: boolean, codexLogin = false): MaskedAiConfig {
  const base = config ?? DEFAULT_AI_CONFIG;
  const { apiKey, ...rest } = base;
  if (base.provider === 'chatgpt') return { ...rest, hasApiKey: codexLogin, keySource: codexLogin ? 'codex' : 'none' };
  const fromConfig = apiKey.length > 0;
  // The environment key only stands in for OpenAI; other providers must save a key.
  const fromEnv = !fromConfig && envKey && base.provider === 'openai';
  return { ...rest, hasApiKey: fromConfig || fromEnv, keySource: fromConfig ? 'config' : fromEnv ? 'env' : 'none' };
}

/** An incoming config with an empty key keeps the key already on file for the same provider. */
export function mergeAiKey(incoming: AiConfig, current: AiConfig | undefined): AiConfig {
  if (incoming.apiKey || !current || current.provider !== incoming.provider) return incoming;
  return { ...incoming, apiKey: current.apiKey };
}
