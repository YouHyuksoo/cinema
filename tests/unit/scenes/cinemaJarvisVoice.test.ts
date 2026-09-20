import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { JarvisRecognition } from '@/cinema/jarvisAudio';
import { DEFAULT_FILM_SCENE_DATA } from '@/cinema/filmSceneData';
import type { SceneDataResult } from '@/cinema/sceneDataDocument';
// This suite exercises voice ownership; the remote intent contract is covered in cinemaTypesafe/IntentRoute.
vi.mock('@/cinema/commandRouter', () => ({ routeCommand: vi.fn(async () => null) }));
vi.mock('@/cinema/jarvisStartupSound', () => ({ JARVIS_STARTUP_MESSAGE: 'HATCHERY initializing.', playJarvisStartupSound: () => ({ stop: vi.fn(), finished: Promise.resolve() }) }));

const hooks = vi.hoisted(() => ({ effects: [] as (() => void | (() => void))[] }));
vi.mock('react', () => ({
  useRef: <T>(value: T) => ({ current: value }),
  useState: <T>(value: T) => [value, vi.fn()],
  useEffect: (effect: () => void | (() => void)) => { hooks.effects.push(effect); },
}));
import { useJarvisLocalVoice as useJarvisVoice } from '@/cinema/useJarvisLocalVoice';
import { routeCommand } from '@/cinema/commandRouter';

class Recognition implements JarvisRecognition {
  static instances: Recognition[] = [];
  lang = ''; continuous = false; interimResults = false;
  onstart: JarvisRecognition['onstart'] = null;
  onend: JarvisRecognition['onend'] = null;
  onerror: JarvisRecognition['onerror'] = null;
  onresult: JarvisRecognition['onresult'] = null;
  start = vi.fn(() => this.onstart?.());
  abort = vi.fn();
  constructor() { Recognition.instances.push(this); }
}
class Utterance {
  lang = ''; rate = 1; pitch = 1; volume = 1; voice: SpeechSynthesisVoice | null = null;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public text: string) {}
}
const stopTrack = vi.fn();
const stream = { getTracks: () => [{ stop: stopTrack, addEventListener: vi.fn() }] };
const closeContext = vi.fn(async () => {});
const requestMedia = vi.fn(async () => stream);
const speak = vi.fn((u: Utterance) => u.onstart?.());
const cancel = vi.fn();
beforeEach(() => {
  hooks.effects = []; Recognition.instances = [];
  vi.clearAllMocks(); vi.useFakeTimers();
  speak.mockImplementation(u => { u.onstart?.(); if (u.text === 'HATCHERY initializing.') { u.onend?.(); speak.mockClear(); } });
  requestMedia.mockResolvedValue(stream);
  vi.stubGlobal('window', { SpeechRecognition: Recognition, speechSynthesis: { speak, cancel, getVoices: () => [], addEventListener: vi.fn(), removeEventListener: vi.fn() }, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  vi.stubGlobal('document', { hidden: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: requestMedia } });
  vi.stubGlobal('AudioContext', class {
    close = closeContext; resume = async () => {};
    createAnalyser = () => ({ fftSize: 0 });
    createMediaStreamSource = () => ({ connect: vi.fn() });
  });
  vi.stubGlobal('SpeechSynthesisUtterance', Utterance);
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ source: 'local', reply: '테스트 답변' })));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('Jarvis explicit voice session ownership', () => {
  it('uses the TypeSafe result without invoking the conversation provider', async () => {
    vi.mocked(routeCommand).mockResolvedValueOnce({ source: 'typesafe', reply: '화면 이동 완료', ok: true });
    const voice = useJarvisVoice(vi.fn(), { speakReplies: false });
    expect(await voice.ask('온도 습도 보는 곳 띄워')).toBe('화면 이동 완료');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('remembers a clarification proposal and executes it when the operator confirms', async () => {
    vi.mocked(routeCommand).mockResolvedValueOnce({ source: 'typesafe', reply: '현재 열린 터빈 메뉴를 닫을까요?', ok: false,
      proposal: { action: 'set', key: 'turbineMenu', value: 'false' } });
    const screen = vi.fn(async () => ({ ok: true, message: '터빈 메뉴를 닫았습니다.' }));
    const voice = useJarvisVoice(vi.fn(), { speakReplies: false, actions: {
      screen, sceneData: () => DEFAULT_FILM_SCENE_DATA, applySceneObjects: vi.fn(),
    } });
    expect(await voice.ask('그 메뉴 닫아')).toBe('현재 열린 터빈 메뉴를 닫을까요?');
    expect(await voice.ask('응')).toBe('터빈 메뉴를 닫았습니다.');
    expect(routeCommand).toHaveBeenCalledOnce();
    expect(screen).toHaveBeenLastCalledWith({ action: 'set', key: 'turbineMenu', value: 'false' });
  });
  it('clears a clarification proposal when the operator declines', async () => {
    vi.mocked(routeCommand).mockResolvedValueOnce({ source: 'typesafe', reply: '현재 열린 터빈 메뉴를 닫을까요?', ok: false,
      proposal: { action: 'set', key: 'turbineMenu', value: 'false' } });
    const screen = vi.fn(async () => ({ ok: true, message: '터빈 메뉴를 닫았습니다.' }));
    const voice = useJarvisVoice(vi.fn(), { speakReplies: false, actions: {
      screen, sceneData: () => DEFAULT_FILM_SCENE_DATA, applySceneObjects: vi.fn(),
    } });
    await voice.ask('그 메뉴 닫아');
    expect(await voice.ask('아니')).toBe('알겠습니다. 실행하지 않았습니다.');
    expect(screen).not.toHaveBeenCalledWith({ action: 'set', key: 'turbineMenu', value: 'false' });
  });
  it('does not switch providers when command classification fails', async () => {
    vi.mocked(routeCommand).mockRejectedValueOnce(new Error('TypeSafe 요청 실패'));
    const voice = useJarvisVoice(vi.fn(), { speakReplies: false });
    await voice.ask('온도 습도 보는 곳 띄워');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('does not apply model actions after TypeSafe classifies a conversation', async () => {
    vi.mocked(routeCommand).mockResolvedValueOnce({ source: 'conversation' });
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ source: 'ai', reply: '설명입니다.', chapter: 'wave',
      screenCommands: [{ action: 'set', key: 'scene', value: 'wave' }] }));
    const open = vi.fn(), voice = useJarvisVoice(open, { speakReplies: false });
    expect(await voice.ask('온습도 화면 설명해 줘')).toBe('설명입니다.');
    expect(JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string).readOnly).toBe(true);
    expect(open).not.toHaveBeenCalled();
  });
  it('continues with one grounded explanation after Jev executes the action part of a combined request', async () => {
    vi.mocked(routeCommand).mockResolvedValueOnce({ source: 'typesafe', reply: 'SPC 분석 화면을 엽니다.', ok: true });
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ source: 'ai', reply: '현재 공정능력은 안정 범위입니다.' }));
    const voice = useJarvisVoice(vi.fn(), { speakReplies: false });
    expect(await voice.ask('품질 관리 페이지로 넘겨 주고 현재 상태도 설명해 줘'))
      .toBe('SPC 분석 화면을 엽니다.\n현재 공정능력은 안정 범위입니다.');
    expect(routeCommand).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledOnce();
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
    expect(body.readOnly).toBe(true);
    expect(body.actionResult).toBe('SPC 분석 화면을 엽니다.');
  });
  it('speaks the English startup line before recognition and cancels it on stop', async () => {
    speak.mockImplementationOnce(u => u.onstart?.());
    const voice = useJarvisVoice(vi.fn()); await voice.start();
    const greeting = speak.mock.calls[0][0];
    expect(greeting.text).toBe('HATCHERY initializing.'); expect(greeting.lang).toBe('en-US');
    expect(Recognition.instances).toHaveLength(0);
    voice.stop(); greeting.onend?.();
    expect(Recognition.instances).toHaveLength(0); expect(cancel).toHaveBeenCalled();
  });
  it('does not access devices on mount, then stops microphone and recognizer on exit', async () => {
    const voice = useJarvisVoice(vi.fn());
    const cleanups = hooks.effects.map(effect => effect());
    expect(requestMedia).not.toHaveBeenCalled();
    await voice.start();
    expect(requestMedia).toHaveBeenCalledOnce();
    expect(voice.audioRef.current.phase).toBe('listening');
    expect(voice.audioRef.current.analyser).not.toBeNull();
    cleanups.forEach(cleanup => cleanup?.());
    expect(stopTrack).toHaveBeenCalledOnce(); expect(closeContext).toHaveBeenCalledOnce();
    expect(Recognition.instances[0].abort).toHaveBeenCalledOnce();
    expect(voice.audioRef.current.analyser).toBeNull();
  });
  it('releases a stream that arrives after permission was cancelled', async () => {
    let grant!: (value: typeof stream) => void;
    requestMedia.mockImplementationOnce(() => new Promise(resolve => { grant = resolve; }));
    const voice = useJarvisVoice(vi.fn());
    const pending = voice.start(); await Promise.resolve(); voice.stop(); grant(stream); await pending;
    expect(stopTrack).toHaveBeenCalledOnce(); expect(Recognition.instances).toHaveLength(0);
    expect(voice.audioRef.current.phase).toBe('idle');
  });
  it('suspends recognition while answering and resumes only when speech ends', async () => {
    const voice = useJarvisVoice(vi.fn()); await voice.start();
    await voice.ask('현장 요약');
    expect(Recognition.instances[0].abort).toHaveBeenCalledOnce();
    expect(voice.audioRef.current.phase).toBe('speaking');
    expect(speak.mock.calls[0][0].pitch).toBe(1);
    expect(speak.mock.calls[0][0].rate).toBe(1);
    expect(Recognition.instances).toHaveLength(1);
    speak.mock.calls[0][0].onend?.();
    expect(Recognition.instances).toHaveLength(2);
    expect(voice.audioRef.current.phase).toBe('listening');
    voice.stop();
  });
  it('ignores late output after stopping and prevents duplicate pending submissions', async () => {
    let reply!: (value: Response) => void;
    vi.mocked(fetch).mockImplementationOnce(() => new Promise(resolve => { reply = resolve; }));
    const voice = useJarvisVoice(vi.fn());
    const pending = voice.ask('현장 요약');
    await voice.ask('중복 질문');
    for (let i = 0; i < 6; i++) await Promise.resolve();
    expect(fetch).toHaveBeenCalledOnce();
    voice.stop();
    reply(Response.json({ reply: '늦은 응답', source: 'local' })); await pending;
    expect(speak).not.toHaveBeenCalled();
    expect(voice.audioRef.current.phase).toBe('idle');
  });
  it('stops the actual stream after recognition failure and never retries a rejected service', async () => {
    const voice = useJarvisVoice(vi.fn()); await voice.start();
    Recognition.instances[0].onerror?.({ error: 'network' });
    await vi.advanceTimersByTimeAsync(3000);
    expect(stopTrack).toHaveBeenCalledOnce();
    expect(Recognition.instances).toHaveLength(1);
    expect(voice.audioRef.current.phase).toBe('error');
    expect(voice.audioRef.current.analyser).toBeNull();
  });
  it('does not request a microphone when speech recognition is unsupported', async () => {
    vi.stubGlobal('window', { speechSynthesis: { cancel }, addEventListener: vi.fn(), removeEventListener: vi.fn() });
    const voice = useJarvisVoice(vi.fn()); await voice.start();
    expect(requestMedia).not.toHaveBeenCalled();
    expect(voice.audioRef.current.phase).toBe('error');
  });
  it('opens a validated scene after its reply and keeps listening in the same session', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ reply: 'SPC를 엽니다', source: 'local', chapter: 'spc' }));
    const open = vi.fn(), voice = useJarvisVoice(open);
    await voice.start(); await voice.ask('SPC 분석 보여줘');
    expect(open).not.toHaveBeenCalled();
    speak.mock.calls[0][0].onend?.();
    expect(open).toHaveBeenCalledExactlyOnceWith('spc');
    expect(stopTrack).not.toHaveBeenCalled();
    expect(Recognition.instances).toHaveLength(2);
    expect(voice.audioRef.current.phase).toBe('listening');
    voice.stop(); expect(stopTrack).toHaveBeenCalledOnce();
  });
  it('forwards an explicit car subject from text replies without starting a microphone', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ reply: '자동차 분석을 엽니다', source: 'local', chapter: 'machine', machineSubject: 'car' }));
    const open = vi.fn(), voice = useJarvisVoice(open, { speakReplies: false });
    await voice.ask('자동차 보여줘');
    expect(open).toHaveBeenCalledExactlyOnceWith('machine', 'car');
    expect(requestMedia).not.toHaveBeenCalled();
  });
});

describe('HATCHERY value commands in the local voice hook', () => {
  const actions = () => ({ sceneData: () => DEFAULT_FILM_SCENE_DATA,
    applySceneObjects: vi.fn<(input: unknown) => SceneDataResult>(() => ({ ok: true, scene: 'bars', applied: 1, ignored: [] })) });
  it('applies a deterministic value command locally, speaks the result and then opens the scene', async () => {
    const open = vi.fn(), acts = actions(), voice = useJarvisVoice(open, { actions: acts });
    await voice.start(); await voice.ask('라인 2 470으로');
    expect(fetch).not.toHaveBeenCalled();
    expect(acts.applySceneObjects).toHaveBeenCalledOnce();
    const patch = vi.mocked(acts.applySceneObjects).mock.calls[0][0] as { scene: string; source: string; objects: unknown[] };
    expect(patch).toMatchObject({ scene: 'bars', source: 'hatchery', objects: [{ id: 'LINE-02', value: 470 }] });
    expect(speak.mock.calls[0][0].text).toContain('470');
    expect(open).not.toHaveBeenCalled();
    speak.mock.calls[0][0].onend?.();
    expect(open).toHaveBeenCalledExactlyOnceWith('bars');
  });
  it('reports a rejected patch without navigating', async () => {
    const open = vi.fn(), acts = actions();
    vi.mocked(acts.applySceneObjects).mockReturnValueOnce({ ok: false, scene: 'bars', reason: '일치하는 객체가 없습니다: LINE-02' } as never);
    const voice = useJarvisVoice(open, { actions: acts });
    await voice.start(); await voice.ask('라인 2 470으로');
    expect(speak.mock.calls[0][0].text).toContain('일치하는 객체가 없습니다');
    speak.mock.calls[0][0].onend?.();
    expect(open).not.toHaveBeenCalled();
  });
  it('applies a patch returned by the assistant API', async () => {
    const patch = { scene: 'wave', source: 'hatchery', at: '2026-09-08T09:00:00+09:00', objects: [{ id: 'ZONE 03', temperature: 31.5 }] };
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ reply: '3구역 온도를 갱신합니다.', source: 'ai', patch, chapter: 'wave' }));
    const open = vi.fn(), acts = actions(), voice = useJarvisVoice(open, { actions: acts });
    await voice.start(); await voice.ask('세 번째 구역을 좀 더 덥게 해줘');
    expect(acts.applySceneObjects).toHaveBeenCalledWith(patch);
    speak.mock.calls[0][0].onend?.();
    expect(open).toHaveBeenCalledExactlyOnceWith('wave');
  });
});
