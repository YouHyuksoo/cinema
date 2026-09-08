import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { JarvisRecognition } from '@/cinema/jarvisAudio';
import { DEFAULT_FILM_SCENE_DATA } from '@/cinema/filmSceneData';
vi.mock('@/cinema/jarvisStartupSound', () => ({ JARVIS_STARTUP_MESSAGE: 'HATCHERY initializing.', playJarvisStartupSound: () => ({ stop: vi.fn(), finished: Promise.resolve() }) }));

const hooks = vi.hoisted(() => ({ effects: [] as (() => void | (() => void))[] }));
vi.mock('react', () => ({
  useRef: <T>(value: T) => ({ current: value }),
  useState: <T>(value: T) => [value, vi.fn()],
  useEffect: (effect: () => void | (() => void)) => { hooks.effects.push(effect); },
}));
import { useJarvisLocalVoice as useJarvisVoice } from '@/cinema/useJarvisLocalVoice';

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
    expect(speak.mock.calls[0][0].pitch).toBe(.72);
    expect(speak.mock.calls[0][0].rate).toBe(.94);
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
  it('opens a validated scene after its reply and releases the conversation session', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ reply: 'SPC를 엽니다', source: 'local', chapter: 'spc' }));
    const open = vi.fn(), voice = useJarvisVoice(open);
    await voice.start(); await voice.ask('SPC 분석 보여줘');
    expect(open).not.toHaveBeenCalled();
    speak.mock.calls[0][0].onend?.();
    expect(open).toHaveBeenCalledExactlyOnceWith('spc');
    expect(stopTrack).toHaveBeenCalledOnce();
  });
});

describe('HATCHERY value commands in the local voice hook', () => {
  const actions = () => ({ sceneData: () => DEFAULT_FILM_SCENE_DATA,
    applySceneObjects: vi.fn((_input: unknown) => ({ ok: true as const, scene: 'bars' as const, applied: 1, ignored: [] as string[] })) });
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
