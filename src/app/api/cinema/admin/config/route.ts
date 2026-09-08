import { parseHatcheryConfig } from '@/cinema/feedConfig';
import { rejectExternalRequest } from '@/server/cinema/openai';
import { maskConfig, mergePasswords, readConfig, writeConfig } from '@/server/cinema/hatcheryConfig';
import { feedService } from '@/server/cinema/feedRunner';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Admin screen: read the masked configuration (passwords never leave the server). */
export function GET(request: Request) {
  const rejected = rejectExternalRequest(request); if (rejected) return rejected;
  const { config, error } = readConfig();
  return Response.json({ ...maskConfig(config), ...(error ? { error } : {}) }, { headers: { 'Cache-Control': 'no-store' } });
}

/** Admin screen: replace the configuration; empty passwords keep the ones on file. */
export async function PUT(request: Request) {
  const rejected = rejectExternalRequest(request); if (rejected) return rejected;
  let raw: unknown;
  try { raw = await request.json(); } catch { return Response.json({ error: 'JSON 본문이 필요합니다.' }, { status: 400 }); }
  const parsed = parseHatcheryConfig(raw);
  if (!parsed.ok) return Response.json({ error: parsed.reason }, { status: 400 });
  const merged = mergePasswords(parsed.config, readConfig().config);
  try { writeConfig(merged); } catch (error) { return Response.json({ error: `설정을 저장하지 못했습니다: ${(error as Error).message}` }, { status: 500 }); }
  feedService(() => readConfig().config).invalidate();
  return Response.json(maskConfig(merged));
}
