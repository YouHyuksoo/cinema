import { resolveJarvisCommand } from '@/cinema/jarvisCommands';
import { ChatBody, aiProviderId, answerWithOpenAi, apiFailure, openAiConfigured, realtimeRuntime, rejectExternalRequest, textModel, realtimeModel } from '@/server/cinema/openai';
import { savedAiConfig } from '@/server/cinema/aiProviders';
import { aiProvider } from '@/cinema/aiConfig';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export function GET() {
  const configured = openAiConfigured();
  const voiceMode = savedAiConfig()?.voiceMode ?? 'realtime';
  const realtimeAvailable = realtimeRuntime() !== null;
  return Response.json({ aiConfigured: configured, mode: configured ? aiProviderId() : 'local', provider: configured ? aiProviderId() : null,
    providerLabel: configured ? aiProvider(aiProviderId()).label : null, textModel: textModel(), realtimeModel: realtimeAvailable ? realtimeModel() : null,
    realtimeAvailable, voiceMode, /** true when the browser should open the realtime voice session instead of its own speech engine */
    useRealtime: configured && realtimeAvailable && voiceMode === 'realtime' },
  { headers: { 'Cache-Control': 'no-store' } });
}
export async function POST(request: Request) {
  const rejected = rejectExternalRequest(request); if (rejected) return rejected;
  if (Number(request.headers.get('content-length')) > 48000) return Response.json({ error: '요청이 너무 큽니다.' }, { status: 413 });
  let raw: unknown;
  try {
    const body = await request.text();
    if (body.length > 48000) return Response.json({ error: '요청이 너무 큽니다.' }, { status: 413 });
    raw = JSON.parse(body);
  } catch { return Response.json({ error: '질문을 확인해 주세요.' }, { status: 400 }); }
  const parsed = ChatBody.safeParse(raw);
  if (!parsed.success) return Response.json({ error: '질문은 1~1200자로 입력해 주세요.' }, { status: 400 });
  const local = resolveJarvisCommand(parsed.data.message);
  if (local) return Response.json(local);
  if (!openAiConfigured()) return Response.json({ source: 'unavailable', reply: 'AI 키가 설정되지 않았습니다. 큐브 메뉴의 AI 설정에서 프로바이더와 키를 저장하면 자유 대화를 쓸 수 있습니다. 현장 요약과 연출 열기는 지금도 사용할 수 있습니다.' });
  try { return Response.json(await answerWithOpenAi(parsed.data, request.signal)); }
  catch (error) { return apiFailure(error); }
}
