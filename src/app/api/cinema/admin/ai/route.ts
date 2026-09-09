import { AI_PROVIDERS, AI_VOICE_MODES, maskAiConfig, parseAiConfig } from '@/cinema/aiConfig';
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
