import { z } from 'zod';
import { jarvisOverview } from '@/cinema/jarvisCommands';
import { jarvisMainData } from '@/cinema/jarvisMainData';
import { FILM_CHAPTERS } from '@/cinema/filmProgram';
import { JARVIS_REALTIME_VOICES } from '@/cinema/jarvisAudio';
import { DEFAULT_FILM_SCENE_DATA } from '@/cinema/filmSceneData';
import { describeHatcheryPatch, hatcheryObjectCatalog, SET_SCENE_OBJECT_VALUES_TOOL, toolCallToPatch } from '@/cinema/hatcheryTargets';
import type { JarvisReply } from '@/cinema/jarvisCommands';
import { AiProviderFailure, chatWithProvider, resolveAiRuntime } from './aiProviders';

/** True when any provider can answer: a saved key on /cinema/ai, or OPENAI_API_KEY in the environment. */
export const openAiConfigured = () => resolveAiRuntime() !== null;
export const textModel = () => resolveAiRuntime()?.model ?? (process.env.OPENAI_TEXT_MODEL || 'gpt-4.1-mini');
export const aiProviderId = () => resolveAiRuntime()?.provider ?? 'openai';
/** The realtime voice session is OpenAI-only: it needs an OpenAI key from the saved config or the environment. */
export function realtimeRuntime(): { apiKey: string; model: string } | null {
  const runtime = resolveAiRuntime();
  if (runtime?.provider === 'openai') return { apiKey: runtime.apiKey, model: runtime.realtimeModel };
  const key = process.env.OPENAI_API_KEY?.trim();
  return key ? { apiKey: key, model: process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime-2.1-mini' } : null;
}
export const realtimeModel = () => realtimeRuntime()?.model ?? (process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime-2.1-mini');
export const REALTIME_VOICES = JARVIS_REALTIME_VOICES;
/** Built-in instructions plus the operator's directives saved on the AI settings screen. */
export function jarvisInstructions() {
  const extra = resolveAiRuntime()?.instructions.trim();
  return extra ? `${baseInstructions()}\n\n운영자 추가 지시:\n${extra}` : baseInstructions();
}
function baseInstructions() {
  return `당신은 제조 모니터링 HUD의 AI 보조자 HATCHERY입니다. 한국어로 간결하게 답하세요.
차분하고 낮은 남성적인 음색과 절제된 로봇 같은 말투를 사용하되 발음은 명료하게 하세요. 영화 배우와 동일한 목소리라고 주장하지 마세요.
현재 현장 데이터는 실제 MES가 아닌 시연 데이터입니다. 수치를 말할 때 시연 기준임을 밝히고, 없는 측정값이나 원인을 지어내지 마세요.
카메라는 볼 수 없습니다. 설비를 제어하거나 DB를 변경할 권한은 없습니다.
연출을 열어달라는 명시적 요청은 open_scene 도구가 제공되면 사용하세요. 일반 질문이나 추천만으로 화면을 전환하지 마세요. 도구 없이 화면을 열었다고 주장하지 마세요.
machine은 PCB 불량 분석이 기본이며 subject는 pcb입니다. 사용자가 자동차/레이싱카를 명시적으로 요청한 경우에만 subject car로 호출하세요. PCB와 자동차는 자동 전환하지 않습니다.
화면 객체의 값을 바꿔달라는 명시적 요청은 set_scene_object_values 도구로만 처리하세요. 시연 값이 바뀔 뿐 설비는 제어되지 않습니다. 도구 없이 값을 바꿨다고 주장하지 마세요. 바꿀 수 있는 장면·객체·필드:
${hatcheryObjectCatalog(DEFAULT_FILM_SCENE_DATA)}
현장 수치는 아래 스냅샷만 근거로 사용하고 추정은 추정이라고 말하세요.
사용 가능한 연출: ${FILM_CHAPTERS.map(c => `${c.id}: ${c.title}`).join(', ')}.
시연 스냅샷: ${JSON.stringify({ zones: jarvisOverview().zones, energy: jarvisMainData.energy,
    process: jarvisMainData.process, quality: jarvisMainData.quality, inspection: jarvisMainData.inspection })}`;
}
export const ChatBody = z.object({ message: z.string().trim().min(1).max(1200),
  history: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().min(1).max(4000) })).max(8).default([]) });
// The demo has no login: paid endpoints are limited to local requests.
export function rejectExternalRequest(request: Request): Response | null {
  const url = new URL(request.url), origin = request.headers.get('origin');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || (origin && origin !== url.origin))
    return Response.json({ error: '로컬 HUD에서만 사용할 수 있습니다.' }, { status: 403 });
  return null;
}
export class OpenAiFailure extends Error {
  constructor(public status: number) {
    super(status === 429 ? 'OpenAI 사용 한도 또는 잔액을 확인해 주세요.'
      : status === 401 || status === 403 ? 'OpenAI 키 또는 모델 접근 권한을 확인해 주세요.'
      : 'OpenAI 연결에 실패했습니다. 잠시 후 다시 시도해 주세요.');
  }
}
export function apiFailure(error: unknown) {
  const known = error instanceof OpenAiFailure || error instanceof AiProviderFailure;
  return Response.json({ error: known ? error.message : 'AI 응답을 받지 못했습니다. 연결 상태를 확인해 주세요.' },
    { status: known && error.status === 429 ? 429 : 502 });
}
export async function openAiRequest(path: string, body: BodyInit, signal: AbortSignal, multipart = false, apiKey = resolveAiRuntime()?.apiKey ?? process.env.OPENAI_API_KEY) {
  const response = await fetch(`https://api.openai.com/v1/${path}`, { method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, ...(multipart ? {} : { 'Content-Type': 'application/json' }) },
    body, signal: AbortSignal.any([signal, AbortSignal.timeout(25000)]), cache: 'no-store' });
  if (!response.ok) throw new OpenAiFailure(response.status);
  return response;
}
export async function answerWithOpenAi(body: z.infer<typeof ChatBody>, signal: AbortSignal): Promise<JarvisReply> {
  const runtime = resolveAiRuntime();
  if (!runtime) throw new OpenAiFailure(503);
  if (runtime.provider !== 'openai') {
    // Other providers answer in plain text; the scene-value tool stays OpenAI-only for now.
    const reply = await chatWithProvider(runtime, jarvisInstructions(), [...body.history, { role: 'user', content: body.message }], signal);
    if (!reply) throw new AiProviderFailure(runtime.provider, 502);
    return { source: 'ai', reply };
  }
  const response = await openAiRequest('responses', JSON.stringify({ model: runtime.model, store: false,
    max_output_tokens: runtime.maxOutputTokens, temperature: runtime.temperature, instructions: jarvisInstructions(), tools: [SET_SCENE_OBJECT_VALUES_TOOL], tool_choice: 'auto',
    input: [...body.history, { role: 'user', content: body.message }] }), signal, false, runtime.apiKey);
  const data = await response.json() as { output?: { type: string; name?: string; arguments?: string; content?: { type: string; text?: string; refusal?: string }[] }[] };
  const reply = data.output?.filter(item => item.type === 'message').flatMap(item => item.content ?? [])
    .map(item => item.type === 'output_text' ? item.text ?? '' : item.type === 'refusal' ? item.refusal ?? '' : '').join('\n').trim();
  // The text path is single-round: the server turns the tool call into a contract patch and the browser applies it.
  const call = data.output?.find(item => item.type === 'function_call' && item.name === SET_SCENE_OBJECT_VALUES_TOOL.name);
  if (call) {
    let args: unknown;
    try { args = JSON.parse(call.arguments ?? '{}'); } catch { args = undefined; }
    const converted = toolCallToPatch(args, DEFAULT_FILM_SCENE_DATA);
    if (converted.ok) return { source: 'ai', reply: reply || describeHatcheryPatch(converted.patch), patch: converted.patch, chapter: converted.patch.scene };
    return { source: 'ai', reply: [reply, converted.reason].filter(Boolean).join(' ') };
  }
  if (!reply) throw new OpenAiFailure(502);
  return { source: 'ai', reply };
}
export function realtimeConfiguration(voice: string) {
  return { type: 'realtime', model: realtimeModel(), instructions: jarvisInstructions(), max_output_tokens: 800,
    audio: { input: { transcription: { model: 'gpt-4o-mini-transcribe', language: 'ko' },
      turn_detection: { type: 'semantic_vad', eagerness: 'medium', create_response: true, interrupt_response: true } }, output: { voice } },
    tools: [{ type: 'function', name: 'open_scene', description: '사용자가 명시적으로 요청한 HUD 연출을 엽니다. 설비 제어는 하지 않습니다.',
      parameters: { type: 'object', properties: { chapter: { type: 'string', enum: FILM_CHAPTERS.map(c => c.id) }, subject: { type: 'string', enum: ['pcb', 'car'], description: 'machine 전용. PCB 요청은 pcb, 명시적 자동차 요청만 car. 생략 시 pcb.' } }, required: ['chapter'], additionalProperties: false } },
      SET_SCENE_OBJECT_VALUES_TOOL], tool_choice: 'auto' };
}
