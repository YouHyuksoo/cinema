import { z } from 'zod';
import type { IntentInput } from '@/cinema/commandDecision';
import { resolveTypeSafeRuntime } from './typesafeRuntime';

const probability = z.number().finite().min(0).max(1);
const choice = z.object({ type: z.literal('choice'), choice: z.string(), confidence: probability,
  probabilities: z.record(z.string(), probability) });
const responseSchema = z.object({ model: z.string().optional(), answers: z.object({
  intent: choice, command: choice, explicit: z.object({ type: z.literal('noul'), noul: probability }),
}), usage: z.object({ input_tokens: z.number().nonnegative(), output_tokens: z.number().nonnegative() }).optional() });
export function typesafeStatus() {
  const { mode, apiKey, model } = resolveTypeSafeRuntime();
  return { mode, configured: Boolean(apiKey), model };
}
export async function requestTypeSafe(input: unknown, questions: Record<string, unknown>, signal: AbortSignal, runtime = resolveTypeSafeRuntime()) {
  if (!runtime.apiKey) throw new Error('TypeSafe API 키가 설정되지 않았습니다.');
  signal.throwIfAborted();
  let response: Response;
  try {
    response = await fetch('https://api.typesafe.ai/v1/systemone', {
      method: 'POST', cache: 'no-store', signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]),
      headers: { Authorization: `Bearer ${runtime.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: runtime.model, state: input, questions }),
    });
  } catch (error) {
    signal.throwIfAborted();
    const cause = error instanceof Error ? (error.cause as { code?: unknown } | undefined)?.code : undefined;
    const code = typeof cause === 'string' && /^[A-Z_]{1,60}$/.test(cause) ? ` (${cause})` : '';
    if (error instanceof Error && error.name === 'TimeoutError') throw new Error('TypeSafe 응답 대기 시간이 20초를 초과했습니다.');
    throw new Error(`TypeSafe 네트워크 연결에 실패했습니다${code}.`);
  }
  if (!response.ok) throw new Error(`TypeSafe 요청 실패 (HTTP ${response.status}). 키·사용 한도·연결 상태를 확인해 주세요.`);
  return response.json().catch(() => { throw new Error('TypeSafe 응답 형식이 올바르지 않습니다.'); });
}
export async function askTypeSafe(input: IntentInput, questions: Record<string, unknown>, signal: AbortSignal) {
  const parsed = responseSchema.safeParse(await requestTypeSafe(input, questions, signal));
  if (!parsed.success) throw new Error('TypeSafe 응답 형식이 올바르지 않습니다.');
  return parsed.data;
}
