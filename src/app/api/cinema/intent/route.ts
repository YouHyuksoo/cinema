import { z } from 'zod';
import { rejectExternalRequest } from '@/server/cinema/openai';
import { decideCommand } from '@/server/cinema/commandDecision';
import { typesafeStatus } from '@/server/cinema/typesafeClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const bodySchema = z.object({ message: z.string().trim().min(1).max(1200),
  screenState: z.object({ scene: z.string().max(80).optional(), playing: z.boolean().optional(), menu: z.boolean().optional(),
    turbineMenu: z.boolean().optional(), cubeMenu: z.boolean().optional(), pieStyle: z.string().max(40).optional() }).optional() });
export function GET(request: Request) {
  return rejectExternalRequest(request) ?? Response.json(typesafeStatus(), { headers: { 'Cache-Control': 'no-store' } });
}
export async function POST(request: Request) {
  const rejected = rejectExternalRequest(request); if (rejected) return rejected;
  if (Number(request.headers.get('content-length')) > 8000) return Response.json({ error: '요청이 너무 큽니다.' }, { status: 413 });
  let raw: unknown;
  try {
    const text = await request.text();
    if (text.length > 8000) return Response.json({ error: '요청이 너무 큽니다.' }, { status: 413 });
    raw = JSON.parse(text);
  } catch { return Response.json({ error: '명령을 확인해 주세요.' }, { status: 400 }); }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return Response.json({ error: '명령은 1~1200자로 입력해 주세요.' }, { status: 400 });
  try { return Response.json(await decideCommand(parsed.data, request.signal), { headers: { 'Cache-Control': 'no-store' } }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'TypeSafe 연결에 실패했습니다.' }, { status: 502 }); }
}
