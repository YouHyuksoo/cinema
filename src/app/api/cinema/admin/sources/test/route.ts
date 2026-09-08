import { parseDataSource } from '@/cinema/feedConfig';
import { rejectExternalRequest } from '@/server/cinema/openai';
import { readConfig } from '@/server/cinema/hatcheryConfig';
import { testOracleSource } from '@/server/cinema/oracleSource';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Body: { sourceId } to test a saved source, or a full source object (empty password → saved one). */
export async function POST(request: Request) {
  const rejected = rejectExternalRequest(request); if (rejected) return rejected;
  let raw: Record<string, unknown>;
  try { raw = await request.json(); } catch { return Response.json({ error: 'JSON 본문이 필요합니다.' }, { status: 400 }); }
  const saved = readConfig().config.sources;
  const candidate = typeof raw?.sourceId === 'string' ? saved.find(source => source.id === raw.sourceId) : undefined;
  const parsed = candidate ? { ok: true as const, source: candidate } : parseDataSource(raw);
  if (!parsed.ok) return Response.json({ error: parsed.reason }, { status: 400 });
  const source = parsed.source.password ? parsed.source : { ...parsed.source, password: saved.find(item => item.id === parsed.source.id)?.password ?? '' };
  if (!source.password) return Response.json({ ok: false, error: '비밀번호가 없습니다.' });
  return Response.json(await testOracleSource(source));
}
