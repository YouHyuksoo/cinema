import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JarvisRealtimeSession } from '@/cinema/jarvisRealtimeSession';
import { FILM_CHAPTERS } from '@/cinema/filmProgram';
import { resolveJarvisCommand } from '@/cinema/jarvisCommands';
const startup = vi.hoisted(() => ({ stop: vi.fn(), finished: Promise.resolve() }));
vi.mock('@/cinema/jarvisStartupSound', () => ({ JARVIS_STARTUP_MESSAGE: 'HATCHERY initializing.', playJarvisStartupSound: () => startup }));
const stopTrack = vi.fn();
const audioTrack = { stop: stopTrack, enabled: true, addEventListener: vi.fn() };
const stream = { getTracks: () => [audioTrack], getAudioTracks: () => [audioTrack] };
const media = vi.fn(async () => stream);
const channel = { readyState: 'open', send: vi.fn(), close: vi.fn(), onopen: null as null | (() => void), onmessage: null as null | ((e: { data: string }) => void), onclose: null };
const peer = { addTrack: vi.fn(), createDataChannel: () => channel, createOffer: async () => ({ sdp: 'v=0\r\nm=audio' }),
  setLocalDescription: vi.fn(), setRemoteDescription: vi.fn(), close: vi.fn(), ontrack: null, onconnectionstatechange: null, connectionState: 'new' };
const callbacks = () => ({ phase: vi.fn(), message: vi.fn(), transcript: vi.fn(), analyser: vi.fn(), error: vi.fn(), chapter: vi.fn(), ended: vi.fn(), connection: vi.fn() });
beforeEach(() => {
  vi.clearAllMocks(); vi.useFakeTimers(); media.mockResolvedValue(stream);
  startup.finished = Promise.resolve(); audioTrack.enabled = true;
  peer.connectionState = 'new';
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: media } });
  vi.stubGlobal('RTCPeerConnection', class { constructor() { return peer; } });
  vi.stubGlobal('Audio', class { autoplay = true; srcObject = null; pause() {} play() { return Promise.resolve(); } });
  vi.stubGlobal('AudioContext', class { destination = {}; resume = async () => {}; close = async () => {};
    createAnalyser = () => ({ fftSize: 0, connect() {}, disconnect() {} });
    createMediaStreamSource = () => ({ connect() {}, disconnect() {} }); });
  vi.stubGlobal('fetch', vi.fn(async () => new Response('v=0\r\nanswer')));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
const emit = async (event: unknown) => {
  channel.onmessage?.({ data: JSON.stringify(event) });
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
const call = (name: string, args: unknown, id = 'call-1', responseId = 'response-1') => ({
  type: 'response.done', response: { id: responseId, status: 'completed', output: [
    { type: 'function_call', name, call_id: id, arguments: JSON.stringify(args) },
  ] },
});
const sent = () => channel.send.mock.calls.map(([value]) => JSON.parse(value));
const output = () => sent().filter(e => e.item?.type === 'function_call_output');

describe('Realtime TypeSafe routing', () => {
  const enable = () => vi.stubGlobal('fetch', vi.fn(async () => new Response('v=0\r\nanswer', { headers: { 'X-Cinema-Command-Router': 'typesafe' } })));
  it('uses the exact transcript once for concurrent tool calls, without direct transcript execution', async () => {
    enable();
    const command = vi.fn(async () => ({ ok: true, message: '이동 완료' })), screen = vi.fn();
    const session = new JarvisRealtimeSession({ ...callbacks(), screen, command }); await session.start('cedar');
    await emit({ type: 'input_audio_buffer.speech_started', item_id: 'u1' });
    await emit({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'u1', transcript: '온습도 화면으로 전환해' });
    expect(screen).not.toHaveBeenCalled();
    expect(command).toHaveBeenCalledExactlyOnceWith('온습도 화면으로 전환해', expect.any(AbortSignal));
    await emit(call('route_command', { transcript: 'altered' }));
    await emit(call('route_command', {}, 'call-2', 'response-2'));
    expect(command).toHaveBeenCalledExactlyOnceWith('온습도 화면으로 전환해', expect.any(AbortSignal));
    expect(output()).toHaveLength(2); session.stop();
  });
  it('aborts old work on interruption and does not acknowledge its result', async () => {
    enable(); let finish!: (value: { ok: boolean; message: string }) => void;
    const command = vi.fn((_text: string, _signal: AbortSignal) => new Promise<{ ok: boolean; message: string }>(resolve => { finish = resolve; }));
    const session = new JarvisRealtimeSession({ ...callbacks(), command }); await session.start('cedar');
    await emit({ type: 'input_audio_buffer.speech_started', item_id: 'u1' });
    await emit({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'u1', transcript: '온습도 띄워' });
    await emit(call('route_command', {}));
    await emit({ type: 'input_audio_buffer.speech_started', item_id: 'u2' });
    expect(command.mock.calls[0][1].aborted).toBe(true);
    finish({ ok: true, message: '이전 결과' }); await emit({ type: 'noop' });
    expect(output()).toHaveLength(0); session.stop();
  });
  it('rejects direct tool calls and ignores a stale transcript in TypeSafe mode', async () => {
    enable(); const screen = vi.fn(), command = vi.fn();
    const session = new JarvisRealtimeSession({ ...callbacks(), screen, command }); await session.start('cedar');
    await emit({ type: 'input_audio_buffer.speech_started', item_id: 'u2' });
    await emit({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'u1', transcript: '메뉴 열어줘' });
    await emit(call('control_screen', { action: 'set', key: 'menu', value: 'true' }));
    expect(screen).not.toHaveBeenCalled(); expect(command).not.toHaveBeenCalled();
    expect(JSON.parse(output()[0].item.output).ok).toBe(false); session.stop();
  });
});

describe('Realtime direct control and analysis routing', () => {
  it('recognizes every current scene title as a navigation request', () => {
    for (const chapter of FILM_CHAPTERS) {
      expect(resolveJarvisCommand(`${chapter.title} 화면으로 전환해`)?.chapter, chapter.title).toBe(chapter.id);
    }
  });
  it('executes a direct navigation once, returns its result and keeps media connected', async () => {
    const screen = vi.fn(async () => ({ ok: true, message: 'OEE 이동 완료' }));
    const analyze = vi.fn();
    const session = new JarvisRealtimeSession({ ...callbacks(), screen, analyze });
    await session.start('cedar');
    const event = call('control_screen', { action: 'set', key: 'scene', value: 'oee' });
    await emit(event); await emit(event);
    expect(screen).toHaveBeenCalledExactlyOnceWith({ action: 'set', key: 'scene', value: 'oee' });
    expect(analyze).not.toHaveBeenCalled();
    expect(output()).toHaveLength(1);
    expect(JSON.parse(output()[0].item.output).ok).toBe(true);
    expect(sent().at(-1).response.tool_choice).toBe('none');
    expect(stopTrack).not.toHaveBeenCalled(); session.stop();
  });
  it('executes a transcribed scene command deterministically and deduplicates the model tool call', async () => {
    const screen = vi.fn(async () => ({ ok: true, message: '온습도 이동 완료' })), analyze = vi.fn();
    const session = new JarvisRealtimeSession({ ...callbacks(), screen, analyze });
    await session.start('cedar');
    await emit({ type: 'conversation.item.input_audio_transcription.completed', transcript: '온습도 화면으로 전환해' });
    expect(screen).toHaveBeenCalledExactlyOnceWith({ action: 'set', key: 'scene', value: 'wave' });
    await emit(call('control_screen', { action: 'set', key: 'scene', value: 'oee' }));
    expect(screen).toHaveBeenCalledOnce();
    expect(JSON.parse(output()[0].item.output)).toMatchObject({ ok: true });
    expect(analyze).not.toHaveBeenCalled(); session.stop();
  });
  it('waits for transcription and delegates the exact utterance, ignoring rewritten tool text', async () => {
    const analyze = vi.fn(async () => '분석 결과');
    const session = new JarvisRealtimeSession({ ...callbacks(), analyze }); await session.start('cedar');
    await emit({ type: 'input_audio_buffer.speech_started', item_id: 'u1' });
    await emit(call('delegate_analysis', { transcript: 'rewritten' }));
    expect(analyze).not.toHaveBeenCalled();
    await emit({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'u1', transcript: '  OEE가 왜 낮아?  ' });
    expect(analyze).toHaveBeenCalledExactlyOnceWith('  OEE가 왜 낮아?  ');
    expect(JSON.parse(output()[0].item.output)).toEqual({ reply: '분석 결과' }); session.stop();
  });
  it('returns a failed execution and prevents automatic repeat actions', async () => {
    const screen = vi.fn(async () => ({ ok: false, message: '실행 거절' }));
    const session = new JarvisRealtimeSession({ ...callbacks(), screen }); await session.start('cedar');
    await emit(call('control_screen', { action: 'set', key: 'scene', value: 'oee' }));
    expect(JSON.parse(output()[0].item.output)).toEqual({ ok: false, message: '실행 거절' });
    expect(sent().at(-1).response.tool_choice).toBe('none'); session.stop();
  });
  it('allows a follow-up tool after querying the current setting', async () => {
    const screen = vi.fn(async () => ({ ok: true, message: '현재 속도 1', value: 1 }));
    const session = new JarvisRealtimeSession({ ...callbacks(), screen }); await session.start('cedar');
    await emit(call('control_screen', { action: 'get', key: 'speed' }));
    expect(screen).toHaveBeenCalledOnce();
    expect(sent().at(-1).response.tool_choice).toBe('auto'); session.stop();
  });
  it('rejects malformed or unsupported commands without executing', async () => {
    const screen = vi.fn();
    const session = new JarvisRealtimeSession({ ...callbacks(), screen }); await session.start('cedar');
    await emit(call('control_screen', { action: 'set', key: 'prompt', value: 'change' }));
    expect(screen).not.toHaveBeenCalled(); expect(JSON.parse(output()[0].item.output).ok).toBe(false); session.stop();
  });
  it('ends the realtime session after the spoken tool acknowledgement finishes', async () => {
    const shutdown = vi.fn(), cb = { ...callbacks(), shutdown };
    const session = new JarvisRealtimeSession(cb); await session.start('cedar');
    await emit(call('end_voice_session', {}));
    expect(JSON.parse(output()[0].item.output)).toMatchObject({ ok: true });
    expect(stopTrack).not.toHaveBeenCalled();
    await emit({ type: 'response.created', response: { id: 'end-ack' } });
    await emit({ type: 'output_audio_buffer.started', response_id: 'end-ack' });
    await emit({ type: 'output_audio_buffer.stopped', response_id: 'end-ack' });
    expect(stopTrack).toHaveBeenCalledOnce();
    expect(shutdown).toHaveBeenCalledOnce();
    expect(cb.ended).toHaveBeenCalledOnce();
  });
  it('ignores a completed response cancelled by a new utterance', async () => {
    const screen = vi.fn();
    const session = new JarvisRealtimeSession({ ...callbacks(), screen }); await session.start('cedar');
    await emit({ type: 'response.created', response: { id: 'response-1' } });
    await emit({ type: 'input_audio_buffer.speech_started', item_id: 'u2' });
    await emit(call('control_screen', { action: 'set', key: 'scene', value: 'oee' }));
    expect(screen).not.toHaveBeenCalled(); session.stop();
  });
  it('does not publish an analysis result after the user interrupts', async () => {
    let finish!: (reply: string) => void;
    const analyze = vi.fn(() => new Promise<string>(resolve => { finish = resolve; }));
    const session = new JarvisRealtimeSession({ ...callbacks(), analyze }); await session.start('cedar');
    await emit({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'u1', transcript: '원인 분석해' });
    await emit(call('delegate_analysis', {}));
    await emit({ type: 'input_audio_buffer.speech_started', item_id: 'u2' });
    finish('이전 분석'); await emit({ type: 'noop' });
    expect(output()).toHaveLength(0); session.stop();
  });
});
