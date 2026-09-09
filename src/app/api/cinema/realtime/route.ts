import { apiFailure, openAiRequest, REALTIME_VOICES, realtimeConfiguration, realtimeRuntime, rejectExternalRequest } from '@/server/cinema/openai';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  const rejected = rejectExternalRequest(request); if (rejected) return rejected;
  const runtime = realtimeRuntime();
  if (!runtime) return Response.json({ error: '실시간 음성은 OpenAI 키가 필요합니다. AI 설정에서 OpenAI 키를 저장하거나 OPENAI_API_KEY를 설정해 주세요.' }, { status: 503 });
  if (!request.headers.get('content-type')?.startsWith('application/sdp')) return Response.json({ error: 'SDP 요청이 필요합니다.' }, { status: 415 });
  if (Number(request.headers.get('content-length')) > 32000) return Response.json({ error: '요청이 너무 큽니다.' }, { status: 413 });
  const sdp = await request.text();
  if (sdp.length > 32000 || !sdp.startsWith('v=0') || !sdp.includes('m=audio')) return Response.json({ error: '음성 연결 요청을 확인해 주세요.' }, { status: 400 });
  const voice = new URL(request.url).searchParams.get('voice') || 'cedar';
  if (!REALTIME_VOICES.some(v => v === voice)) return Response.json({ error: '지원하지 않는 목소리입니다.' }, { status: 400 });
  const body = new FormData(); body.set('sdp', sdp); body.set('session', JSON.stringify(realtimeConfiguration(voice)));
  try {
    const response = await openAiRequest('realtime/calls', body, request.signal, true, runtime.apiKey);
    return new Response(await response.text(), { headers: { 'Content-Type': 'application/sdp', 'Cache-Control': 'no-store' } });
  } catch (error) { return apiFailure(error); }
}
