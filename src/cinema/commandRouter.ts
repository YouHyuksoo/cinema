import { cinemaApi } from './cinemaApi';
import { allowedTypeSafeCommand, minimalScreenState, type IntentInput } from './commandDecision';
import { resolveScreenCommands, type ScreenCommand, type ScreenExecutor } from './screenCommands';
import { resolveJarvisCommand } from './jarvisCommands';
import { classifyCinemaTurn, commandTextForCinemaTurn } from './agentTurn';

export type RoutedCommand = { source: 'local' | 'typesafe'; reply: string; ok: boolean; command?: ScreenCommand; proposal?: ScreenCommand } | { source: 'conversation'; reply?: never };
type Options = { execute?: ScreenExecutor; signal: AbortSignal; state?: Record<string, unknown>; skipLocal?: boolean;
  remote?: (input: IntentInput, signal: AbortSignal) => Promise<unknown> };
async function remoteDecision(input: IntentInput, signal: AbortSignal): Promise<unknown> {
  const response = await cinemaApi('intent', { method: 'POST', body: JSON.stringify(input), signal });
  const body = await response.json();
  if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : 'TypeSafe 판단 요청에 실패했습니다.');
  return body;
}

/** Local matching 이후에도 JEV 판단이 필요한, 명시적인 화면 조작 문장만 통과시킨다. */
export function shouldUseTypeSafe(message: string): boolean {
  const kind = classifyCinemaTurn(message);
  return kind === 'screen_action' || kind === 'screen_action_with_analysis';
}

export async function routeCommand(message: string, options: Options): Promise<RoutedCommand | null> {
  options.signal.throwIfAborted();
  let local = options.skipLocal ? null : resolveScreenCommands(message);
  if (!options.skipLocal && !local) {
    const scene = resolveJarvisCommand(message);
    if (scene?.chapter) local = [
      ...(scene.machineSubject ? [{ action: 'set' as const, key: 'machine', value: scene.machineSubject }] : []),
      { action: 'set', key: 'scene', value: scene.chapter },
    ];
  }
  if (local) {
    const replies: string[] = [];
    let ok = true;
    for (const command of local) {
      options.signal.throwIfAborted();
      const result = await options.execute?.(command);
      replies.push(result?.message ?? '화면 조작 기능이 연결되지 않았습니다.');
      if (!result?.ok) { ok = false; break; }
    }
    return { source: 'local', reply: replies.join('\n'), ok };
  }
  if (!shouldUseTypeSafe(message)) return { source: 'conversation' };
  const raw = await (options.remote ?? remoteDecision)({ message: commandTextForCinemaTurn(message), screenState: minimalScreenState(options.state) }, options.signal);
  options.signal.throwIfAborted();
  if (!raw || typeof raw !== 'object' || !('kind' in raw)) throw new Error('TypeSafe 판단 응답이 올바르지 않습니다.');
  if (raw.kind === 'disabled' || raw.kind === 'shadow') return null;
  if (raw.kind === 'conversation') return { source: 'conversation' };
  if (raw.kind === 'clarify' && 'message' in raw && typeof raw.message === 'string') {
    const proposal = 'proposal' in raw ? allowedTypeSafeCommand(raw.proposal) : null;
    return { source: 'typesafe', reply: raw.message, ok: false, ...(proposal ? { proposal } : {}) };
  }
  if (raw.kind !== 'command' || !('command' in raw)) throw new Error('TypeSafe 판단 응답이 올바르지 않습니다.');
  const command = allowedTypeSafeCommand(raw.command);
  if (!command || (command.key === 'pieStyle' && options.state?.scene !== 'pie')) return { source: 'typesafe', reply: '지원하지 않거나 현재 화면에서 실행할 수 없는 명령입니다.', ok: false };
  options.signal.throwIfAborted();
  const result = await options.execute?.(command);
  return { source: 'typesafe', reply: result?.message ?? '화면 조작 기능이 연결되지 않았습니다.', ok: result?.ok ?? false, command };
}
