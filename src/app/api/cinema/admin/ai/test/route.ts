import { parseAiConfig } from '@/cinema/aiConfig';
import { rejectExternalRequest } from '@/server/cinema/openai';
import { readConfig } from '@/server/cinema/hatcheryConfig';
import { testAiConnection } from '@/server/cinema/aiProviders';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Body: the draft AI settings from the screen. An empty key falls back to the saved key for the
 * same provider, then to OPENAI_API_KEY for OpenAI, so a saved key never travels back to the browser.
 */
export async function POST(request: Request) {
  const rejected = rejectExternalRequest(request); if (rejected) return rejected;
  let raw: unknown;
  try { raw = await request.json(); } catch { return Response.json({ error: 'JSON 본문이 필요합니다.' }, { status: 400 }); }
  const parsed = parseAiConfig(raw);
  if (!parsed.ok) return Response.json({ error: parsed.reason }, { status: 400 });
  if (parsed.config.provider === 'chatgpt') return Response.json(await testAiConnection(parsed.config, request.signal));
  const saved = readConfig().config.ai;
  let apiKey = parsed.config.apiKey;
  if (!apiKey && saved?.provider === parsed.config.provider) apiKey = saved.apiKey;
  if (!apiKey && parsed.config.provider === 'openai') apiKey = process.env.OPENAI_API_KEY?.trim() ?? '';
  if (!apiKey) return Response.json({ ok: false, error: 'API 키가 없습니다. 키를 입력하거나 저장한 뒤 테스트해 주세요.' });
  return Response.json(await testAiConnection({ ...parsed.config, apiKey }, request.signal));
}
