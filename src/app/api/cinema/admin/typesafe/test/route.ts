import { z } from 'zod';
import { rejectExternalRequest } from '@/server/cinema/openai';
import { readTypeSafeDraft } from '@/server/cinema/typesafeSettings';
import { resolveTypeSafeRuntime } from '@/server/cinema/typesafeRuntime';
import { requestTypeSafe } from '@/server/cinema/typesafeClient';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const resultSchema = z.object({ model: z.string(), answers: z.object({ connection: z.object({ type: z.literal('noul'), noul: z.number().min(0).max(1) }) }) });
export async function POST(request: Request) {
  const rejected = rejectExternalRequest(request); if (rejected) return rejected;
  const draft = await readTypeSafeDraft(request);
  if (!draft.config) return Response.json({ ok: false, error: draft.error }, { status: 400 });
  const started = performance.now();
  try {
    const response = resultSchema.safeParse(await requestTypeSafe({ connectionTest: true }, {
      connection: { type: 'noul', instructions: 'Is connectionTest true in the provided state?' },
    }, request.signal, resolveTypeSafeRuntime(draft.config)));
    if (!response.success) throw new Error('Jev 연결 테스트 응답이 올바르지 않습니다.');
    return Response.json({ ok: true, model: response.data.model, elapsedMs: Math.round(performance.now() - started) });
  } catch (error) { return Response.json({ ok: false, error: error instanceof Error ? error.message : 'Jev 연결 테스트에 실패했습니다.' }, { status: 502 }); }
}
