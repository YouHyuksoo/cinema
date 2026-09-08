import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JarvisRealtimeSession } from '@/cinema/jarvisRealtimeSession';
import { DEFAULT_FILM_SCENE_DATA } from '@/cinema/filmSceneData';
import type { SceneDataResult } from '@/cinema/sceneDataDocument';
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
  vi.stubGlobal('AudioContext', class { resume = async () => {}; close = async () => {}; createAnalyser = () => ({ fftSize: 0 }); createMediaStreamSource = () => ({ connect() {} }); });
  vi.stubGlobal('fetch', vi.fn(async () => new Response('v=0\r\nanswer')));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
describe('Realtime lifecycle', () => {
  it('reports a live connection only after the channel opens and clears it on stop', async () => {
    const cb = callbacks(), session = new JarvisRealtimeSession(cb);
    await session.start('cedar');
    expect(cb.connection).not.toHaveBeenCalledWith(true);
    channel.onopen?.(); await Promise.resolve();
    expect(cb.connection).toHaveBeenLastCalledWith(true);
    session.stop();
    expect(cb.connection).toHaveBeenLastCalledWith(false);
  });
  it('clears connection status during a network interruption and restores it on reconnect', async () => {
    const cb = callbacks(), session = new JarvisRealtimeSession(cb);
    await session.start('cedar'); channel.onopen?.(); await Promise.resolve();
    peer.connectionState = 'disconnected';
    (peer.onconnectionstatechange as (() => void) | null)?.();
    expect(cb.connection).toHaveBeenLastCalledWith(false);
    peer.connectionState = 'connected';
    (peer.onconnectionstatechange as (() => void) | null)?.();
    expect(cb.connection).toHaveBeenLastCalledWith(true);
    session.stop();
  });
  it('waits for the startup sound, announces once, and opens the microphone only after playback', async () => {
    let finish!: () => void;
    startup.finished = new Promise(resolve => { finish = resolve; });
    const session = new JarvisRealtimeSession(callbacks()); await session.start('cedar');
    channel.onopen?.(); channel.onopen?.();
    expect(channel.send).not.toHaveBeenCalled(); expect(audioTrack.enabled).toBe(false);
    finish(); await Promise.resolve();
    const events = channel.send.mock.calls.map(([value]) => JSON.parse(value));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'response.create', response: { tool_choice: 'none', instructions: expect.stringContaining('HATCHERY initializing.') } });
    channel.onmessage?.({ data: JSON.stringify({ type: 'response.done', response: { status: 'completed' } }) });
    expect(audioTrack.enabled).toBe(false);
    channel.onmessage?.({ data: JSON.stringify({ type: 'output_audio_buffer.stopped' }) });
    expect(audioTrack.enabled).toBe(true); session.stop();
  });
  it('cancels startup audio and does not send a late greeting after stop', async () => {
    let finish!: () => void;
    startup.finished = new Promise(resolve => { finish = resolve; });
    const session = new JarvisRealtimeSession(callbacks()); await session.start('cedar');
    channel.onopen?.(); session.stop(); finish(); await Promise.resolve();
    expect(startup.stop).toHaveBeenCalledOnce(); expect(channel.send).not.toHaveBeenCalled();
  });
  it('does not access media until start and releases media, peer and channel on stop', async () => {
    const session = new JarvisRealtimeSession(callbacks());
    expect(media).not.toHaveBeenCalled();
    await session.start('cedar'); session.stop(); session.stop();
    expect(stopTrack).toHaveBeenCalledOnce(); expect(peer.close).toHaveBeenCalledOnce(); expect(channel.close).toHaveBeenCalledOnce();
  });
  it('stops media granted after the session was cancelled without contacting OpenAI', async () => {
    let grant!: (s: typeof stream) => void;
    media.mockImplementationOnce(() => new Promise(resolve => { grant = resolve; }));
    const session = new JarvisRealtimeSession(callbacks());
    const pending = session.start('cedar'); await Promise.resolve(); session.stop(); grant(stream); await pending;
    expect(stopTrack).toHaveBeenCalledOnce(); expect(fetch).not.toHaveBeenCalled();
  });
  it('waits for audible output to finish before navigating', async () => {
    const cb = callbacks(), session = new JarvisRealtimeSession(cb); await session.start('cedar');
    const event = (data: unknown) => channel.onmessage?.({ data: JSON.stringify(data) });
    event({ type: 'response.done', response: { status: 'completed', output: [{ type: 'function_call', name: 'open_scene', call_id: 'c1', arguments: '{"chapter":"spc"}' }] } });
    expect(cb.chapter).not.toHaveBeenCalled();
    event({ type: 'response.created', response: { id: 'ack' } });
    event({ type: 'output_audio_buffer.started', response_id: 'ack' });
    event({ type: 'output_audio_buffer.stopped' });
    expect(cb.chapter).toHaveBeenCalledWith('spc');
    expect(stopTrack).toHaveBeenCalledOnce();
  });
  it('does not navigate when a pre-tool spoken preamble ends before the tool acknowledgement', async () => {
    const cb = callbacks(), session = new JarvisRealtimeSession(cb); await session.start('cedar');
    const event = (data: unknown) => channel.onmessage?.({ data: JSON.stringify(data) });
    event({ type: 'output_audio_buffer.started', response_id: 'preamble' });
    event({ type: 'response.done', response: { status: 'completed', output: [{ type: 'function_call', name: 'open_scene', call_id: 'c1', arguments: '{"chapter":"spc"}' }] } });
    event({ type: 'output_audio_buffer.stopped', response_id: 'preamble' });
    expect(cb.chapter).not.toHaveBeenCalled(); session.stop();
  });
  it.each([undefined, 'pcb', 'car', 'invalid'])('validates the machine subject %s and carries it after acknowledgement', async subject => {
    const cb = callbacks(), session = new JarvisRealtimeSession(cb); await session.start('cedar');
    const event = (data: unknown) => channel.onmessage?.({ data: JSON.stringify(data) });
    event({ type: 'response.done', response: { status: 'completed', output: [{ type: 'function_call', name: 'open_scene', call_id: 'm1', arguments: JSON.stringify({ chapter: 'machine', subject }) }] } });
    expect(cb.chapter).not.toHaveBeenCalled();
    event({ type: 'response.created', response: { id: 'ack-machine' } });
    event({ type: 'output_audio_buffer.stopped', response_id: 'ack-machine' });
    if (subject === 'invalid') expect(cb.chapter).not.toHaveBeenCalled();
    else expect(cb.chapter).toHaveBeenCalledExactlyOnceWith('machine', subject ?? 'pcb');
    session.stop();
  });
  it('manual interruption cancels the response and clears buffered sound', async () => {
    const session = new JarvisRealtimeSession(callbacks()); await session.start('cedar');
    channel.onmessage?.({ data: JSON.stringify({ type: 'response.created', response: { id: 'r1' } }) });
    session.interrupt();
    const events = channel.send.mock.calls.map(([value]) => JSON.parse(value));
    expect(events).toContainEqual({ type: 'response.cancel' });
    expect(events).toContainEqual({ type: 'output_audio_buffer.clear' });
    session.stop();
  });
});

describe('Realtime value commands', () => {
  const sent = () => channel.send.mock.calls.map(call => JSON.parse(call[0] as string) as { type: string; item?: { output: string } });
  const valueCall = (args: unknown) => ({ type: 'response.done', response: { status: 'completed',
    output: [{ type: 'function_call', name: 'set_scene_object_values', call_id: 'v1', arguments: JSON.stringify(args) }] } });
  it('applies set_scene_object_values at once and keeps the conversation open', async () => {
    const patch = vi.fn<(input: unknown) => SceneDataResult>(() => ({ ok: true, scene: 'bars', applied: 1, ignored: [] }));
    const cb = { ...callbacks(), patch, sceneData: () => DEFAULT_FILM_SCENE_DATA };
    const session = new JarvisRealtimeSession(cb); await session.start('cedar');
    channel.onmessage?.({ data: JSON.stringify(valueCall({ scene: 'bars', objects: [{ id: 'LINE 02', field: 'value', value: 470 }] })) });
    expect(patch).toHaveBeenCalledOnce();
    expect(patch.mock.calls[0][0]).toMatchObject({ scene: 'bars', source: 'hatchery', objects: [{ id: 'LINE-02', value: 470 }] });
    const outputs = sent().filter(message => message.type === 'conversation.item.create');
    expect(JSON.parse(outputs.at(-1)!.item!.output)).toMatchObject({ ok: true, applied: 1 });
    expect(sent().some(message => message.type === 'response.create')).toBe(true);
    expect(cb.chapter).not.toHaveBeenCalled();
    expect(stopTrack).not.toHaveBeenCalled();
  });
  it('hands invalid arguments back to the model without touching the store', async () => {
    const patch = vi.fn<(input: unknown) => SceneDataResult>(() => ({ ok: true, scene: 'bars', applied: 1, ignored: [] }));
    const cb = { ...callbacks(), patch, sceneData: () => DEFAULT_FILM_SCENE_DATA };
    const session = new JarvisRealtimeSession(cb); await session.start('cedar');
    channel.onmessage?.({ data: JSON.stringify(valueCall({ scene: 'energy', objects: [{ id: 'power', field: 'value', value: 1 }] })) });
    expect(patch).not.toHaveBeenCalled();
    const outputs = sent().filter(message => message.type === 'conversation.item.create');
    expect(JSON.parse(outputs.at(-1)!.item!.output)).toMatchObject({ ok: false, error: expect.stringContaining('energy') });
  });
});
