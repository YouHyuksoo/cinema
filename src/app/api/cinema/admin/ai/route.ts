import { AI_PROVIDERS, AI_VOICE_MODES, DEFAULT_AI_CONFIG, aiProvider, isAiProvider, isAiVoiceMode, maskAiConfig, mergeAiKey, parseAiConfig } from '@/cinema/aiConfig';
import { rejectExternalRequest } from '@/server/cinema/openai';
import { mergePasswords, readConfig, writeConfig } from '@/server/cinema/hatcheryConfig';
import { codexLoginStatus } from '@/server/cinema/codexAuth';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const envKey = () => Boolean(process.env.OPENAI_API_KEY?.trim());

/** AI settings screen: the saved settings with the key masked, plus the provider catalogue. */
export function GET(request: Request) {
  const rejected = rejectExternalRequest(request); if (rejected) return rejected;
  const { config, error } = readConfig();
  const codex = codexLoginStatus();
  return Response.json({ ai: maskAiConfig(config.ai, envKey(), codex.ok), saved: config.ai !== undefined, providers: AI_PROVIDERS, voiceModes: AI_VOICE_MODES,
    codexLogin: codex, ...(error ? { error } : {}) }, { headers: { 'Cache-Control': 'no-store' } });
}

/**
 * Main-screen quick switches: the voice mode, and/or the provider with an optional model. Everything
 * else (keys, prompt, sampling) stays; a provider's key comes back out of the vault when it is re-selected.
 */
export async function PATCH(request: Request) {
  const rejected = rejectExternalRequest(request); if (rejected) return rejected;
  let raw: { voiceMode?: unknown; provider?: unknown; model?: unknown };
  try { raw = await request.json(); } catch { return Response.json({ error: 'JSON 본문이 필요합니다.' }, { status: 400 }); }
  if (raw?.voiceMode !== undefined && !isAiVoiceMode(raw.voiceMode)) return Response.json({ error: '음성 방식은 realtime 또는 browser여야 합니다.' }, { status: 400 });
  if (raw?.provider !== undefined && !isAiProvider(raw.provider)) return Response.json({ error: `지원하지 않는 AI 프로바이더입니다: ${String(raw.provider)}` }, { status: 400 });
  if (raw?.model !== undefined && typeof raw.model !== 'string') return Response.json({ error: '모델 이름은 문자열이어야 합니다.' }, { status: 400 });
  if (raw?.voiceMode === undefined && raw?.provider === undefined && raw?.model === undefined) return Response.json({ error: '바꿀 항목이 없습니다.' }, { status: 400 });
  const current = readConfig().config;
  // Without saved settings the environment OpenAI key stays in charge: the block only records the change.
  const base = current.ai ?? DEFAULT_AI_CONFIG;
  const provider = isAiProvider(raw.provider) ? raw.provider : base.provider;
  // A new provider starts on the first model of its catalogue unless the request names one.
  const model = typeof raw.model === 'string' && raw.model.trim() ? raw.model : provider === base.provider ? base.model : aiProvider(provider).models[0];
  const parsed = parseAiConfig({ ...base, provider, model, apiKey: '', voiceMode: isAiVoiceMode(raw.voiceMode) ? raw.voiceMode : base.voiceMode });
  if (!parsed.ok) return Response.json({ error: parsed.reason }, { status: 400 });
  const ai = mergeAiKey(parsed.config, current.ai);
  try { writeConfig({ ...current, ai }); } catch (error) { return Response.json({ error: `설정을 저장하지 못했습니다: ${(error as Error).message}` }, { status: 500 }); }
  return Response.json({ ai: maskAiConfig(ai, envKey(), codexLoginStatus().ok), saved: true });
}

/** Replace the AI settings only; an empty key keeps the one on file for the same provider. */
export async function PUT(request: Request) {
  const rejected = rejectExternalRequest(request); if (rejected) return rejected;
  let raw: unknown;
  try { raw = await request.json(); } catch { return Response.json({ error: 'JSON 본문이 필요합니다.' }, { status: 400 }); }
  const parsed = parseAiConfig(raw);
  if (!parsed.ok) return Response.json({ error: parsed.reason }, { status: 400 });
  const current = readConfig().config;
  const merged = mergePasswords({ ...current, ai: parsed.config }, current);
  try { writeConfig(merged); } catch (error) { return Response.json({ error: `설정을 저장하지 못했습니다: ${(error as Error).message}` }, { status: 500 }); }
  return Response.json({ ai: maskAiConfig(merged.ai, envKey(), codexLoginStatus().ok), saved: true });
}
