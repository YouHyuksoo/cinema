import { FILM_CHAPTERS, type FilmId } from './filmProgram';
import type { JarvisPhase } from './jarvisAudio';
import { createRobotVoice, DEFAULT_ROBOT_VOICE, type RobotVoiceSettings } from './robotVoice';
import { JARVIS_STARTUP_MESSAGE, playJarvisStartupSound } from './jarvisStartupSound';

export interface RealtimeCallbacks {
  phase(value: JarvisPhase): void;
  message(role: 'user' | 'assistant', content: string, id: string): void;
  transcript(value: string): void;
  analyser(value: AnalyserNode | null): void;
  error(message: string): void;
  chapter(id: FilmId): void;
  ended(): void;
}
interface RealtimeEvent {
  type: string; item_id?: string; transcript?: string; text?: string; delta?: string;
  response_id?: string; error?: { code?: string };
  response?: { id?: string; status?: string; output?: { type: string; name?: string; call_id?: string; arguments?: string }[] };
}

/** Owns one explicit WebRTC conversation. Never captures the camera. */
export class JarvisRealtimeSession {
  private closed = true;
  private peer: RTCPeerConnection | null = null;
  private channel: RTCDataChannel | null = null;
  private microphone: MediaStream | null = null;
  private context: AudioContext | null = null;
  private startupSound: ReturnType<typeof playJarvisStartupSound> | null = null;
  private startupSent = false;
  private startupPending = false;
  private startupTimer?: ReturnType<typeof setTimeout>;
  private audio: HTMLAudioElement | null = null;
  private inputMeter: AnalyserNode | null = null;
  private outputMeter: AnalyserNode | null = null;
  private robotVoice: ReturnType<typeof createRobotVoice> | null = null;
  private robotSettings: RobotVoiceSettings = DEFAULT_ROBOT_VOICE;
  private abort: AbortController | null = null;
  private connectTimer?: ReturnType<typeof setTimeout>;
  private sessionTimer?: ReturnType<typeof setTimeout>;
  private disconnectTimer?: ReturnType<typeof setTimeout>;
  private responding = false;
  private playing = false;
  private pendingChapter?: FilmId;
  private chapterReplyId = '';
  private ignoredResponses = new Set<string>();
  private responseId = '';
  private partial = new Map<string, string>();
  constructor(private callbacks: RealtimeCallbacks) {}

  async start(voice: string) {
    if (!this.closed) return;
    this.closed = false; this.abort = new AbortController();
    this.callbacks.phase('requesting');
    this.connectTimer = setTimeout(() => this.fail('음성 연결 시간이 초과되었습니다. 다시 시작해 주세요.'), 30000);
    try {
      // Unlock audio directly from the start click, before the permission/SDP awaits.
      this.context = new AudioContext();
      this.startupSound = playJarvisStartupSound(this.context);
      await this.context.resume(); if (this.closed) return;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
      if (this.closed) { stream.getTracks().forEach(track => track.stop()); return; }
      this.microphone = stream;
      stream.getTracks().forEach(track => track.addEventListener('ended', () => { if (!this.closed) this.fail('마이크 연결이 종료되었습니다.'); }));
      this.inputMeter = this.context.createAnalyser(); this.inputMeter.fftSize = 1024;
      this.context.createMediaStreamSource(stream).connect(this.inputMeter);
      await this.context.resume(); if (this.closed) return;
      const peer = new RTCPeerConnection(); this.peer = peer;
      // Keep the WebRTC media element alive but mute its raw output to avoid doubling.
      const audio = new Audio(); audio.autoplay = true; audio.muted = true; this.audio = audio;
      peer.ontrack = event => {
        if (this.closed) return;
        const remote = event.streams[0] ?? new MediaStream([event.track]);
        audio.srcObject = remote;
        if (this.context) {
          try {
            this.robotVoice?.dispose();
            this.robotVoice = createRobotVoice(this.context, this.context.createMediaStreamSource(remote), this.robotSettings);
            this.outputMeter = this.robotVoice.analyser;
          } catch { this.fail('음성 효과를 준비하지 못했습니다. 대화를 다시 시작해 주세요.'); return; }
        }
        void audio.play().catch(() => { if (!this.closed) this.callbacks.error('브라우저에서 소리 재생이 차단됐습니다. 사이트의 소리 권한을 허용하고 대화를 다시 시작해 주세요.'); });
      };
      peer.onconnectionstatechange = () => {
        if (this.closed) return;
        clearTimeout(this.disconnectTimer);
        if (peer.connectionState === 'failed') this.fail('OpenAI 음성 연결이 끊어졌습니다. 다시 시작해 주세요.');
        if (peer.connectionState === 'disconnected') this.disconnectTimer = setTimeout(() => this.fail('음성 네트워크 연결이 끊어졌습니다.'), 8000);
      };
      stream.getAudioTracks().forEach(track => { track.enabled = false; peer.addTrack(track, stream); });
      const channel = peer.createDataChannel('oai-events'); this.channel = channel;
      channel.onopen = async () => {
        if (this.closed || this.startupSent) return;
        this.startupSent = true;
        await this.startupSound?.finished;
        if (this.closed) return;
        clearTimeout(this.connectTimer); this.toPhase('thinking');
        this.startupPending = true;
        this.startupTimer = setTimeout(() => this.fail('시작 음성 안내가 지연되었습니다. 대화를 다시 시작해 주세요.'), 20000);
        this.responding = true;
        this.send({ type: 'response.create', response: {
          instructions: `Speak exactly this English startup announcement and nothing else: "${JARVIS_STARTUP_MESSAGE}". Use a calm, low, precise machine-assistant delivery. Do not translate it or call tools.`,
          tool_choice: 'none',
        } });
        this.sessionTimer = setTimeout(() => this.fail('10분 대화가 종료되었습니다. 계속하려면 대화 시작을 눌러 주세요.'), 600000);
      };
      channel.onmessage = event => {
        if (this.closed) return;
        try { this.handle(JSON.parse(event.data) as RealtimeEvent); }
        catch { this.fail('음성 응답을 처리하지 못했습니다. 다시 시작해 주세요.'); }
      };
      channel.onclose = () => { if (!this.closed) this.fail('OpenAI 대화 연결이 종료되었습니다.'); };
      const offer = await peer.createOffer(); if (this.closed) return;
      await peer.setLocalDescription(offer); if (this.closed) return;
      const response = await fetch(`/api/cinema/realtime?voice=${encodeURIComponent(voice)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/sdp' }, body: offer.sdp, signal: this.abort!.signal,
      });
      if (this.closed) return;
      if (!response.ok) {
        const data = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error || 'OpenAI 음성을 연결하지 못했습니다.');
      }
      const sdp = await response.text(); if (this.closed) return;
      await peer.setRemoteDescription({ type: 'answer', sdp });
    } catch (error) {
      if (!this.closed) this.fail(error instanceof Error && error.name === 'NotAllowedError'
        ? '마이크 권한을 허용해 주세요.' : error instanceof Error ? error.message : '음성 연결에 실패했습니다.');
    }
  }
  setRobotVoice(settings: RobotVoiceSettings) {
    this.robotSettings = { ...settings };
    this.robotVoice?.update(this.robotSettings);
  }
  private send(event: object) {
    if (this.closed || this.channel?.readyState !== 'open') return false;
    this.channel.send(JSON.stringify(event)); return true;
  }
  private toPhase(phase: JarvisPhase) {
    this.callbacks.analyser(phase === 'speaking' ? this.outputMeter : this.inputMeter);
    this.callbacks.phase(phase);
  }
  private finishStartup() {
    if (!this.startupPending) return;
    this.startupPending = false; clearTimeout(this.startupTimer);
    this.microphone?.getAudioTracks().forEach(track => { track.enabled = true; });
  }
  private handle(event: RealtimeEvent) {
    if (event.response_id && this.ignoredResponses.has(event.response_id)) return;
    switch (event.type) {
      case 'input_audio_buffer.speech_started':
        this.pendingChapter = undefined; this.toPhase('listening'); break;
      case 'input_audio_buffer.speech_stopped': this.toPhase('thinking'); break;
      case 'conversation.item.input_audio_transcription.completed':
        if (event.transcript?.trim()) { this.callbacks.transcript(event.transcript); this.callbacks.message('user', event.transcript, event.item_id ?? 'input'); }
        break;
      case 'conversation.item.input_audio_transcription.failed':
        this.callbacks.error('음성 자막을 생성하지 못했습니다.'); break;
      case 'response.created':
        this.responseId = event.response?.id ?? '';
        if (this.pendingChapter && !this.chapterReplyId) this.chapterReplyId = this.responseId;
        this.responding = true; this.toPhase('thinking'); break;
      case 'output_audio_buffer.started': this.playing = true; this.toPhase('speaking'); break;
      case 'output_audio_buffer.stopped':
        this.finishStartup();
        this.playing = false;
        if (this.pendingChapter && this.chapterReplyId && (event.response_id ?? this.responseId) === this.chapterReplyId) {
          const chapter = this.pendingChapter; this.stop(); this.callbacks.chapter(chapter);
        }
        else this.toPhase('listening');
        break;
      case 'output_audio_buffer.cleared': this.finishStartup(); this.playing = false; this.pendingChapter = undefined; this.toPhase('listening'); break;
      case 'response.output_audio_transcript.delta':
      case 'response.output_text.delta': {
        const id = event.item_id ?? this.responseId;
        const text = (this.partial.get(id) ?? '') + (event.delta ?? '');
        this.partial.set(id, text); this.callbacks.message('assistant', text, id); break;
      }
      case 'response.output_audio_transcript.done':
      case 'response.output_text.done': {
        const id = event.item_id ?? this.responseId;
        this.callbacks.message('assistant', event.transcript ?? event.text ?? this.partial.get(id) ?? '', id); this.partial.delete(id); break;
      }
      case 'response.done': {
        this.responding = false;
        if (event.response?.status === 'failed') { this.finishStartup(); this.pendingChapter = undefined; this.callbacks.error('OpenAI 음성 응답에 실패했습니다. 사용 한도와 연결 상태를 확인해 주세요.'); this.toPhase('listening'); break; }
        if (event.response?.status !== 'completed') { this.pendingChapter = undefined; break; }
        const calls = event.response.output?.filter(item => item.type === 'function_call') ?? [];
        for (const call of calls) {
          let chapter: unknown;
          try { chapter = JSON.parse(call.arguments ?? '{}').chapter; } catch { chapter = undefined; }
          const scene = call.name === 'open_scene' ? FILM_CHAPTERS.find(c => c.id === chapter) : undefined;
          if (scene) { this.pendingChapter = scene.id; this.chapterReplyId = ''; }
          this.send({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: call.call_id,
            output: JSON.stringify(scene ? { ok: true, title: scene.title, instruction: '한 문장으로 안내하세요. 음성 안내가 끝나면 화면을 전환합니다.' } : { ok: false, error: '허용되지 않은 연출입니다.' }) } });
        }
        if (calls.length) this.send({ type: 'response.create' });
        else if (!this.playing && !this.startupPending) this.toPhase('listening');
        break;
      }
      case 'error':
        if (event.error?.code === 'response_cancel_not_active') break;
        this.finishStartup();
        this.callbacks.error('OpenAI 음성 요청을 처리하지 못했습니다. 응답 중지 후 다시 말해 주세요.');
        this.responding = false; this.toPhase('listening'); break;
    }
  }
  ask(input: string) {
    const text = input.trim(); if (!text || text.length > 1200) return;
    if (this.channel?.readyState !== 'open' || this.closed) { this.callbacks.error('음성 연결이 준비될 때까지 기다려 주세요.'); return; }
    this.interrupt();
    this.send({ type: 'conversation.item.create', item: { type: 'message', role: 'user', content: [{ type: 'input_text', text }] } });
    this.callbacks.transcript(text); this.callbacks.message('user', text, `typed-${Date.now()}`);
    this.send({ type: 'response.create' }); this.toPhase('thinking');
  }
  interrupt() {
    if (this.closed) return;
    this.finishStartup();
    if (this.responding) this.send({ type: 'response.cancel' });
    if (this.responseId) this.ignoredResponses.add(this.responseId);
    this.send({ type: 'output_audio_buffer.clear' });
    this.pendingChapter = undefined; this.responding = false; this.playing = false; this.toPhase('listening');
  }
  private fail(message: string) { this.stop(); this.callbacks.error(message); this.callbacks.phase('error'); }
  stop() {
    if (this.closed) return;
    this.closed = true; this.abort?.abort(); this.abort = null;
    clearTimeout(this.connectTimer); clearTimeout(this.sessionTimer); clearTimeout(this.disconnectTimer);
    clearTimeout(this.startupTimer); this.startupPending = false; this.startupSent = false;
    this.startupSound?.stop(); this.startupSound = null;
    if (this.channel) { this.channel.onclose = null; this.channel.onmessage = null; this.channel.onopen = null; this.channel.close(); this.channel = null; }
    if (this.peer) { this.peer.ontrack = null; this.peer.onconnectionstatechange = null; this.peer.close(); this.peer = null; }
    this.microphone?.getTracks().forEach(track => track.stop()); this.microphone = null;
    if (this.audio) { this.audio.pause(); this.audio.srcObject = null; this.audio = null; }
    this.robotVoice?.dispose(); this.robotVoice = null; this.outputMeter = null;
    if (this.context) void this.context.close().catch(() => {});
    this.context = null; this.pendingChapter = undefined;
    this.callbacks.analyser(null); this.callbacks.phase('idle'); this.callbacks.ended();
  }
}
