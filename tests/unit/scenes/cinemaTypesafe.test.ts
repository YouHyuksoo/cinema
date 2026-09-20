import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { decideCommand } from '@/server/cinema/commandDecision';
import { askTypeSafe } from '@/server/cinema/typesafeClient';
import { TYPESAFE_COMMANDS } from '@/cinema/commandDecision';
import { routeCommand } from '@/cinema/commandRouter';
import { shouldUseTypeSafe } from '@/cinema/commandRouter';
import cases from '../../fixtures/typesafe-korean.json';

const answer = (command = 'scene:wave', confidence = 0.99, intent = 'command', explicit = 0.99) => ({
  model: 'test', answers: {
    intent: { type: 'choice', choice: intent, confidence: 0.99, probabilities: { [intent]: 1 } },
    command: { type: 'choice', choice: command, confidence, probabilities: { [command]: 1 } },
    explicit: { type: 'noul', noul: explicit },
  }, usage: { input_tokens: 100, output_tokens: 0 },
});
beforeEach(() => vi.stubEnv('HATCHERY_CONFIG_PATH', join(tmpdir(), `cinema-typesafe-unit-${crypto.randomUUID()}.json`)));
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
function enabled(payload: unknown = answer()) {
  vi.stubEnv('TYPESAFE_MODE', 'on'); vi.stubEnv('TYPESAFE_API_KEY', 'test-key');
  const fetcher = vi.fn(async (_url: string, _init: RequestInit) => Response.json(payload)); vi.stubGlobal('fetch', fetcher); return fetcher;
}
describe('TypeSafe command decisions', () => {
  it('distinguishes network connection failure from response timeout without exposing upstream details', async () => {
    enabled();
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('private upstream details', { cause: { code: 'UND_ERR_CONNECT_TIMEOUT' } }); }));
    await expect(askTypeSafe({ message: '온습도' }, {}, new AbortController().signal)).rejects.toThrow('TypeSafe 네트워크 연결에 실패했습니다 (UND_ERR_CONNECT_TIMEOUT).');
    vi.stubGlobal('fetch', vi.fn(async () => { throw new DOMException('private upstream details', 'TimeoutError'); }));
    await expect(askTypeSafe({ message: '온습도' }, {}, new AbortController().signal)).rejects.toThrow('TypeSafe 응답 대기 시간이 20초를 초과했습니다.');
  });
  it('allows a valid response that takes longer than five seconds', async () => {
    vi.useFakeTimers();
    try {
      enabled();
      let requestSignal: AbortSignal | undefined;
      vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
        requestSignal = init.signal as AbortSignal;
        return new Promise<Response>((resolve, reject) => {
          requestSignal!.addEventListener('abort', () => reject(requestSignal!.reason));
          setTimeout(() => resolve(Response.json(answer())), 10000);
        });
      }));
      const timeoutSpy = vi.spyOn(AbortSignal, 'timeout').mockImplementation(ms => {
        const controller = new AbortController(); setTimeout(() => controller.abort(), ms); return controller.signal;
      });
      const pending = askTypeSafe({ message: '온습도' }, {}, new AbortController().signal);
      const assertion = expect(pending).resolves.toMatchObject({ model: 'test' });
      await vi.advanceTimersByTimeAsync(6000);
      expect(requestSignal?.aborted).toBe(false);
      await vi.advanceTimersByTimeAsync(4000);
      await assertion; timeoutSpy.mockRestore();
    } finally { vi.restoreAllMocks(); vi.useRealTimers(); }
  });
  it('uses only the shared finite catalog, excluding credentials and free text', () => {
    expect(TYPESAFE_COMMANDS['scene:wave'].command).toEqual({ action: 'set', key: 'scene', value: 'wave' });
    expect(Object.values(TYPESAFE_COMMANDS).some(x => ['prompt', 'provider', 'model', 'camera'].includes(x.command.key))).toBe(false);
  });
  it('returns a validated command and sends only minimal state to the official endpoint', async () => {
    const fetcher = enabled();
    const result = await decideCommand({ message: '온도랑 습도 보는 곳 띄워', screenState: {
      scene: 'spc', playing: false, menu: true, turbineMenu: false, cubeMenu: true, pieStyle: 'line', secret: 'never-send',
    } as never }, new AbortController().signal);
    expect(result.kind).toBe('command');
    expect(result).toMatchObject({ command: { action: 'set', key: 'scene', value: 'wave' } });
    expect(fetcher.mock.calls[0][0]).toBe('https://api.typesafe.ai/v1/systemone');
    expect(JSON.parse(fetcher.mock.calls[0][1].body as string).state).toEqual({ message: '온도랑 습도 보는 곳 띄워', screenState: {
      scene: 'spc', playing: false, menu: true, turbineMenu: false, cubeMenu: true, pieStyle: 'line',
    } });
  });
  it('describes Korean menu, pause and summary meanings to Jev', async () => {
    const fetcher = enabled();
    await decideCommand({ message: '작업 메뉴를 열어' }, new AbortController().signal);
    const questions = JSON.parse(fetcher.mock.calls[0][1].body as string).questions;
    expect(questions.command.criteria['menu:true']).toContain('작업 메뉴를 열거나 펼치기');
    expect(questions.command.criteria['menu:false']).toContain('작업 메뉴를 닫거나 접기');
    expect(questions.command.criteria['menu:true']).toContain('터빈이나 큐브라는 말이 없을 때');
    expect(questions.command.criteria['turbineMenu:true']).toContain('터빈을 명시');
    expect(questions.command.criteria['cubeMenu:true']).toContain('큐브를 명시');
    expect(questions.command.criteria['playing:false']).toBeUndefined();
    expect(questions.command.criteria['scene:spc']).toBeUndefined();
    expect(questions.intent.criteria.conversation).toContain('요약');

    await decideCommand({ message: '화면을 잠깐 멈춰' }, new AbortController().signal);
    const playbackQuestions = JSON.parse(fetcher.mock.calls[1][1].body as string).questions;
    expect(playbackQuestions.command.criteria['playing:false']).toContain('화면을 잠깐 멈추거나 일시정지');
    expect(playbackQuestions.command.criteria['menu:true']).toBeUndefined();

    await decideCommand({ message: 'SPC 분석 화면을 열어' }, new AbortController().signal);
    const sceneQuestions = JSON.parse(fetcher.mock.calls[2][1].body as string).questions;
    expect(sceneQuestions.command.criteria['scene:spc']).toContain('관리도와 공정능력');
    expect(sceneQuestions.command.criteria['scene:pie']).toContain('통합 차트');
    expect(sceneQuestions.command.criteria['scene:energy']).toContain('에너지 파동');
    expect(sceneQuestions.command.criteria['menu:true']).toBeUndefined();
  });
  it('accepts calibrated Jev scores while rejecting a weak command selection', async () => {
    enabled(answer('menu:true', 0.98, 'command', 0.75));
    const accepted = await decideCommand({ message: '작업 메뉴를 열어' }, new AbortController().signal);
    expect(accepted).toMatchObject({ kind: 'command', command: { key: 'menu', value: 'true' } });
    enabled(answer('menu:true', 0.84, 'command', 0.75));
    expect((await decideCommand({ message: '작업 메뉴를 열어' }, new AbortController().signal)).kind).toBe('clarify');
  });
  it.each([answer('scene:wave', 0.5), answer('scene:wave', 0.99, 'command', 0.4), answer('none'), answer('scene:unknown')])('does not execute ambiguous or unknown decisions', async payload => {
    enabled(payload); expect((await decideCommand({ message: '그거 띄워' }, new AbortController().signal)).kind).toBe('clarify');
  });
  it('asks a context-specific question instead of a generic failure for an ambiguous follow-up', async () => {
    enabled(answer('none'));
    const menu = await decideCommand({ message: '그 메뉴 닫아', screenState: { turbineMenu: true, menu: false, cubeMenu: false } }, new AbortController().signal);
    expect(menu).toMatchObject({ kind: 'clarify', proposal: { action: 'set', key: 'turbineMenu', value: 'false' } });
    expect(menu.kind === 'clarify' && menu.message).toContain('터빈 메뉴');

    enabled(answer('none'));
    const scene = await decideCommand({ message: '다른 화면으로 가' }, new AbortController().signal);
    expect(scene.kind === 'clarify' && scene.message).toContain('온습도');
  });
  it('does not apply chart style to a different scene', async () => {
    enabled(answer('pieStyle:line'));
    expect((await decideCommand({ message: '선 그래프로 바꿔', screenState: { scene: 'wave' } }, new AbortController().signal)).kind).toBe('clarify');
  });
  it('routes analysis without a screen command', async () => {
    enabled(answer('scene:wave', 0.99, 'conversation'));
    expect((await decideCommand({ message: '습도가 왜 높아?' }, new AbortController().signal)).kind).toBe('conversation');
  });
  it('defaults to disabled without making an external call', async () => {
    const fetcher = enabled(); vi.stubEnv('TYPESAFE_MODE', 'off');
    expect((await decideCommand({ message: '온습도' }, new AbortController().signal)).kind).toBe('disabled'); expect(fetcher).not.toHaveBeenCalled();
  });
  it('fails explicitly for a missing key, HTTP failure and malformed payload', async () => {
    enabled(); vi.stubEnv('TYPESAFE_API_KEY', '');
    await expect(decideCommand({ message: '온습도' }, new AbortController().signal)).rejects.toThrow('키');
    enabled(); vi.stubGlobal('fetch', vi.fn(async () => new Response('secret upstream error', { status: 429 })));
    await expect(decideCommand({ message: '온습도' }, new AbortController().signal)).rejects.toThrow('429');
    enabled({ answers: {} });
    await expect(decideCommand({ message: '온습도' }, new AbortController().signal)).rejects.toThrow('응답');
  });
  it('shadow decisions never authorize execution', async () => {
    enabled(); vi.stubEnv('TYPESAFE_MODE', 'shadow');
    expect(await decideCommand({ message: '온습도' }, new AbortController().signal)).toMatchObject({
      kind: 'shadow', candidate: { kind: 'command' }, metrics: {
        intent: { choice: 'command', confidence: 0.99 }, command: { choice: 'scene:wave', confidence: 0.99 }, explicit: 0.99,
      },
    });
  });
});
describe('shared command router', () => {
  it('keeps every supported Korean fixture command behind the Jev action gate', () => {
    for (const item of cases.filter(item => item.expected.includes(':'))) {
      expect(shouldUseTypeSafe(item.message), item.id).toBe(true);
    }
  });
  it('keeps every fixture conversation out of the Jev action gate', () => {
    for (const item of cases.filter(item => item.expected === 'conversation')) {
      expect(shouldUseTypeSafe(item.message), item.id).toBe(false);
    }
  });
  it('sends ambiguous supported-screen requests to Jev for clarification', () => {
    for (const item of cases.filter(item => item.expected === 'clarify'
      && (Number(item.id.slice(3)) <= 93 || Number(item.id.slice(3)) >= 99))) {
      expect(shouldUseTypeSafe(item.message), item.id).toBe(true);
    }
  });
  it.each([
    '이전 품질 결과를 요약해 줘',
    '습도가 왜 높은지 설명해 줘',
    '화면을 바꾸면 어떻게 돼?',
    '안녕하세요',
  ])('sends obvious conversation directly to the assistant without Jev: %s', async message => {
    const remote = vi.fn();
    const result = await routeCommand(message, { remote, signal: new AbortController().signal, skipLocal: true });
    expect(result).toEqual({ source: 'conversation' });
    expect(remote).not.toHaveBeenCalled();
  });
  it('still sends an explicit screen action to Jev after local matching misses', async () => {
    const remote = vi.fn(async () => ({ kind: 'clarify' as const, message: '어느 화면인가요?' }));
    const result = await routeCommand('품질 관리 페이지로 넘겨 줘', { remote, signal: new AbortController().signal, skipLocal: true });
    expect(remote).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ source: 'typesafe' });
  });
  it('uses Jev once for the action part of a combined action and analysis request', async () => {
    const remote = vi.fn(async () => ({ kind: 'command' as const, command: { action: 'set' as const, key: 'scene', value: 'spc' } }));
    const execute = vi.fn(async () => ({ ok: true, message: 'SPC 분석 화면을 엽니다.' }));
    const result = await routeCommand('SPC 분석 화면을 열고 현재 품질 상태도 설명해 줘', {
      execute, remote, signal: new AbortController().signal, skipLocal: true,
    });
    expect(remote).toHaveBeenCalledOnce();
    expect(remote).toHaveBeenCalledWith(expect.objectContaining({ message: 'SPC 분석 화면을 열어' }), expect.any(AbortSignal));
    expect(execute).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ source: 'typesafe', reply: 'SPC 분석 화면을 엽니다.' });
  });
  it('passes only relevant current UI context for a follow-up reference', async () => {
    const remote = vi.fn(async () => ({ kind: 'clarify' as const, message: '현재 열린 터빈 메뉴를 닫을까요?',
      proposal: { action: 'set' as const, key: 'turbineMenu', value: 'false' } }));
    const result = await routeCommand('그 메뉴 닫아', { remote, signal: new AbortController().signal, skipLocal: true,
      state: { scene: 'pie', menu: false, turbineMenu: true, cubeMenu: false, pieStyle: 'bar', apiKey: 'never-send' } });
    expect(remote).toHaveBeenCalledWith({ message: '그 메뉴 닫아', screenState: {
      scene: 'pie', menu: false, turbineMenu: true, cubeMenu: false, pieStyle: 'bar',
    } }, expect.any(AbortSignal));
    expect(result).toMatchObject({ proposal: { key: 'turbineMenu', value: 'false' } });
  });
  it('keeps recognized local commands offline', async () => {
    const remote = vi.fn(); const execute = vi.fn(async () => ({ ok: true, message: '완료' }));
    const result = await routeCommand('메뉴 접어줘', { execute, remote, signal: new AbortController().signal });
    expect(remote).not.toHaveBeenCalled(); expect(execute).toHaveBeenCalledOnce(); expect(result?.source).toBe('local');
  });
  it('executes a TypeSafe decision once and returns the actual failure', async () => {
    const execute = vi.fn(async () => ({ ok: false, message: '화면 연결 실패' }));
    const remote = vi.fn(async () => ({ kind: 'command' as const, command: { action: 'set' as const, key: 'scene', value: 'wave' } }));
    const result = await routeCommand('온도와 습도 보는 곳 띄워', { execute, remote, signal: new AbortController().signal });
    expect(execute).toHaveBeenCalledOnce(); expect(result).toMatchObject({ reply: '화면 연결 실패' });
  });
  it('discards a remote decision after cancellation', async () => {
    const controller = new AbortController(); const execute = vi.fn();
    const remote = vi.fn(async () => { controller.abort(); return { kind: 'command' as const, command: { action: 'set' as const, key: 'scene', value: 'wave' } }; });
    await expect(routeCommand('온도와 습도 보는 곳 띄워', { execute, remote, signal: controller.signal })).rejects.toThrow();
    expect(execute).not.toHaveBeenCalled();
  });
  it('never executes a remote invalid command or low confidence reply', async () => {
    const execute = vi.fn();
    for (const decision of [{ kind: 'command', command: { action: 'set', key: 'prompt', value: 'injected' } }, { kind: 'clarify', message: '어느 화면인가요?' }]) {
      const remote = vi.fn(async () => decision);
      expect(await routeCommand('그걸 띄워', { execute, remote, signal: new AbortController().signal })).toBeTruthy();
    }
    expect(execute).not.toHaveBeenCalled();
  });
});
