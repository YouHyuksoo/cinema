'use client';

import { useEffect, useRef, useState } from 'react';
import { recognitionConstructor, type JarvisAudioFrame, type JarvisPhase, type JarvisRecognition } from './jarvisAudio';
import type { FilmId } from './filmProgram';
import type { JarvisReply } from './jarvisCommands';
import { configureJarvisSpeech } from './jarvisSpeechProfile';
import { useJarvisSpeechProfile } from './useJarvisSpeechProfile';
import { JARVIS_STARTUP_MESSAGE, playJarvisStartupSound } from './jarvisStartupSound';
import { describeSceneDataResult, resolveHatcheryValueCommand, type HatcheryActions } from './hatcheryTargets';
import { isSceneId, parseSceneObjectPatch } from './sceneDataDocument';
import { isMachineSubject, type MachineSubject } from './machinePresentation';
import { cinemaApi } from './cinemaApi';
import { resolveScreenCommands } from './screenCommands';

interface Message { role: 'user' | 'assistant'; content: string }
export function useJarvisLocalVoice(onChapter: (id: FilmId, subject?: MachineSubject) => void, options: { speakReplies?: boolean; actions?: HatcheryActions } = {}) {
  const speechProfile = useJarvisSpeechProfile();
  const audioRef = useRef<JarvisAudioFrame>({ phase: 'idle', analyser: null });
  const [phase, setPhase] = useState<JarvisPhase>('idle');
  const [transcript, setTranscript] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState('');
  const [source, setSource] = useState('');
  const [supported, setSupported] = useState<boolean | null>(null);
  const [active, setActive] = useState(false);
  const history = useRef<Message[]>([]);
  const state = useRef({ enabled: false, busy: false, generation: 0, stream: null as MediaStream | null,
    startupSound: null as ReturnType<typeof playJarvisStartupSound> | null,
    context: null as AudioContext | null, recognition: null as JarvisRecognition | null,
    abort: null as AbortController | null, timer: undefined as ReturnType<typeof setTimeout> | undefined,
    speechTimer: undefined as ReturnType<typeof setTimeout> | undefined });
  const chapterRef = useRef(onChapter);
  useEffect(() => { chapterRef.current = onChapter; }, [onChapter]);
  const actionsRef = useRef(options.actions);
  useEffect(() => { actionsRef.current = options.actions; }, [options.actions]);
  /** Deterministic value commands never leave the browser; assistant replies carrying a patch are applied here too. */
  function resolveReply(message: string): JarvisReply | null {
    const actions = actionsRef.current;
    if (!actions) return null;
    const command = resolveHatcheryValueCommand(message, actions.sceneData());
    if (!command) return null;
    if (command.kind === 'clarify') return { reply: command.reply, source: 'local' };
    const result = actions.applySceneObjects(command.patch);
    return { reply: describeSceneDataResult(command, result), source: 'local', chapter: result.ok ? command.chapter : undefined };
  }
  function applyReplyPatch(data: JarvisReply): JarvisReply {
    const actions = actionsRef.current;
    if (!data.patch || !actions) return data;
    const parsed = parseSceneObjectPatch(data.patch);
    const result = parsed.ok ? actions.applySceneObjects(parsed.patch) : { ok: false as const, reason: parsed.reason };
    if (result.ok) return data;
    return { ...data, reply: `${data.reply} 값은 바꾸지 못했습니다. ${result.reason}`, chapter: undefined };
  }
  const phaseTo = (value: JarvisPhase) => { audioRef.current.phase = value; setPhase(value); };
  function stopRecognition() {
    const current = state.current;
    if (current.timer) clearTimeout(current.timer);
    current.timer = undefined;
    const rec = current.recognition; current.recognition = null;
    if (rec) { rec.onend = null; rec.onresult = null; rec.onerror = null; rec.onstart = null; try { rec.abort(); } catch {} }
  }
  function release() {
    const current = state.current;
    current.generation++; current.enabled = false; current.busy = false;
    stopRecognition(); current.abort?.abort(); current.abort = null;
    if (current.speechTimer) clearTimeout(current.speechTimer);
    current.speechTimer = undefined;
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    current.startupSound?.stop(); current.startupSound = null;
    const stream = current.stream; current.stream = null;
    stream?.getTracks().forEach(track => track.stop());
    if (current.context) void current.context.close().catch(() => {});
    current.context = null; audioRef.current.analyser = null; audioRef.current.phase = 'idle';
  }
  function stop() { release(); setActive(false); setTranscript(''); phaseTo('idle'); }
  function failure(message: string) {
    release(); setActive(false); setError(message); phaseTo('error');
  }
  function listen() {
    const current = state.current, Ctor = recognitionConstructor();
    if (!current.enabled || current.busy || !Ctor) return;
    stopRecognition();
    const token = current.generation;
    const rec = new Ctor(); current.recognition = rec;
    rec.lang = 'ko-KR'; rec.continuous = false; rec.interimResults = true;
    rec.onstart = () => { if (token === current.generation) phaseTo('listening'); };
    rec.onresult = event => {
      if (token !== current.generation || current.busy) return;
      let final = '', interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) final += result[0].transcript; else interim += result[0].transcript;
      }
      setTranscript((final || interim).trim());
      if (final.trim()) void ask(final.trim());
    };
    rec.onerror = event => {
      if (token !== current.generation || event.error === 'aborted' || event.error === 'no-speech') return;
      failure(event.error === 'not-allowed' || event.error === 'service-not-allowed'
        ? '음성 인식 권한 또는 브라우저 인식 서비스가 허용되지 않았습니다. 사이트 권한을 확인하거나 아래 입력창을 사용해 주세요.'
        : `브라우저 음성 인식에 연결하지 못했습니다 (${event.error}). 아래 입력창으로 질문할 수 있습니다.`);
    };
    rec.onend = () => {
      if (token === current.generation && current.enabled && !current.busy)
        current.timer = setTimeout(listen, 650);
    };
    try { rec.start(); } catch { failure('음성 인식을 시작하지 못했습니다. 다시 시도해 주세요.'); }
  }
  async function start() {
    const current = state.current;
    if (current.enabled) return;
    setError('');
    const Ctor = recognitionConstructor(); setSupported(Boolean(Ctor));
    if (!Ctor) { failure('이 브라우저에서는 음성 인식을 지원하지 않습니다. 아래 입력창으로 HATCHERY와 대화할 수 있습니다.'); return; }
    if (!navigator.mediaDevices?.getUserMedia) { failure('마이크를 사용할 수 없는 환경입니다.'); return; }
    release();
    const token = current.generation;
    current.enabled = true; setActive(true); phaseTo('requesting');
    try {
      const context = new AudioContext(); current.context = context;
      current.startupSound = playJarvisStartupSound(context);
      await context.resume();
      if (token !== current.generation) return;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
      if (token !== current.generation) { stream.getTracks().forEach(track => track.stop()); return; }
      current.stream = stream;
      stream.getTracks().forEach(track => track.addEventListener('ended', () => {
        if (current.stream === stream) failure('마이크 연결이 종료되었습니다.');
      }));
      const analyser = context.createAnalyser(); analyser.fftSize = 1024;
      context.createMediaStreamSource(stream).connect(analyser);
      await context.resume();
      if (token !== current.generation) return;
      audioRef.current.analyser = analyser;
      await current.startupSound?.finished;
      if (token !== current.generation) return;
      if ('speechSynthesis' in window) {
        current.busy = true;
        const utterance = new SpeechSynthesisUtterance(JARVIS_STARTUP_MESSAGE);
        utterance.lang = 'en-US'; utterance.pitch = .72; utterance.rate = .9;
        const english = window.speechSynthesis.getVoices().filter(voice => /^en[-_]/i.test(voice.lang));
        utterance.voice = english.find(voice => /David|Mark|Guy|Daniel|\bmale\b/i.test(voice.name)) ?? english[0] ?? null;
        const finish = () => {
          if (token !== current.generation) return;
          clearTimeout(current.speechTimer); current.speechTimer = undefined;
          current.busy = false; listen();
        };
        utterance.onstart = () => {
          if (token !== current.generation) return;
          phaseTo('speaking'); setMessages([{ role: 'assistant', content: JARVIS_STARTUP_MESSAGE }]);
        };
        utterance.onend = finish;
        utterance.onerror = () => { if (token === current.generation) setError('시작 음성 안내를 재생하지 못했습니다.'); finish(); };
        current.speechTimer = setTimeout(() => {
          if (token !== current.generation) return;
          window.speechSynthesis.cancel(); setError('시작 음성 안내가 지연되어 듣기를 시작합니다.'); finish();
        }, 10000);
        window.speechSynthesis.speak(utterance);
      } else listen();
    } catch {
      if (token === current.generation) failure('마이크를 연결하지 못했습니다. 브라우저 권한과 장치 연결을 확인해 주세요.');
    }
  }
  async function ask(input: string) {
    const message = input.trim(), current = state.current;
    if (!message || message.length > 1200 || current.busy) return;
    current.busy = true; stopRecognition(); setError(''); setTranscript(message); phaseTo('thinking');
    const token = current.generation, abort = new AbortController(); current.abort = abort;
    const previous = history.current.slice(-6).map(item => ({ ...item, content: item.content.slice(0, 4000) }));
    history.current = [...previous, { role: 'user', content: message }]; setMessages(history.current);
    const timeout = setTimeout(() => abort.abort(), 30000);
    let finished = false;
    let machineSubject: MachineSubject | undefined;
    const finish = (chapter?: FilmId) => {
      if (finished || token !== current.generation) return;
      finished = true;
      if (current.speechTimer) clearTimeout(current.speechTimer);
      current.speechTimer = undefined; current.busy = false;
      if (chapter) { stop(); if (machineSubject) chapterRef.current(chapter, machineSubject); else chapterRef.current(chapter); }
      else if (current.enabled) listen(); else phaseTo('idle');
    };
    try {
      const direct = resolveScreenCommands(message);
      let data: JarvisReply | null = null;
      if (direct) {
        const replies: string[] = [];
        for (const command of direct) {
          const result = await actionsRef.current?.screen?.(command);
          replies.push(result?.message ?? '화면 설정 도구가 연결되지 않았습니다.');
          if (!result?.ok) break;
        }
        data = { source: 'local', reply: replies.join('\n') };
      } else data = resolveReply(message);
      if (!data) {
        const screenState = await actionsRef.current?.screen?.({ action: 'get', key: 'all' });
        const response = await cinemaApi('assistant', { method: 'POST', body: JSON.stringify({ message, history: previous,
          screenState: screenState?.state ? JSON.stringify(screenState.state) : undefined }), signal: abort.signal });
        const answer = await response.json() as JarvisReply & { error?: string };
        if (token !== current.generation) return;
        if (!response.ok || !answer.reply) throw new Error(answer.error || '응답을 받지 못했습니다.');
        data = applyReplyPatch(answer);
        if (answer.screenCommands?.length) {
          const replies: string[] = [];
          for (const command of answer.screenCommands) {
            const result = await actionsRef.current?.screen?.(command);
            replies.push(result?.message ?? '화면 설정 도구가 연결되지 않았습니다.');
            if (!result?.ok) break;
          }
          data = { source: 'ai', reply: replies.join('\n') };
        }
      }
      history.current = [...history.current, { role: 'assistant' as const, content: data.reply }].slice(-8);
      setMessages(history.current); setSource(data.source === 'local' ? '현장 명령 응답 · 시연 데이터' : data.source === 'ai' ? 'AI 생성 답변 · 텍스트 모델' : 'AI 연결 안내');
      const chapter = isSceneId(data.chapter) ? data.chapter : undefined;
      machineSubject = chapter === 'machine' && isMachineSubject(data.machineSubject) ? data.machineSubject : undefined;
      if (options.speakReplies === false) { finish(chapter); }
      else if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(data.reply);
        configureJarvisSpeech(utterance, window.speechSynthesis.getVoices(), speechProfile.preferredGender.current);
        utterance.onstart = () => { if (token === current.generation) phaseTo('speaking'); };
        utterance.onend = () => finish(chapter);
        utterance.onerror = () => { if (token === current.generation) setError('음성 출력을 사용할 수 없어 답변을 글로 표시했습니다.'); finish(chapter); };
        current.speechTimer = setTimeout(() => {
          if (token !== current.generation) return;
          window.speechSynthesis.cancel(); setError('음성 출력이 지연되어 글로 표시했습니다.'); finish(chapter);
        }, 45000);
        window.speechSynthesis.speak(utterance);
      } else { setError('음성 출력을 지원하지 않아 답변을 글로 표시했습니다.'); finish(chapter); }
    } catch (err) {
      if (token === current.generation) {
        setError(err instanceof Error && err.name !== 'AbortError' ? err.message : '응답 시간이 초과되었습니다.'); finish();
      }
    } finally { clearTimeout(timeout); if (token === current.generation) current.abort = null; }
  }
  useEffect(() => {
    const frame = requestAnimationFrame(() => setSupported(Boolean(recognitionConstructor())));
    const hide = () => { release(); setActive(false); setPhase('idle'); };
    const visibility = () => { if (document.hidden) hide(); };
    window.addEventListener('pagehide', hide); document.addEventListener('visibilitychange', visibility);
    return () => { cancelAnimationFrame(frame); release(); window.removeEventListener('pagehide', hide); document.removeEventListener('visibilitychange', visibility); };
    // Session ownership is stable for this mounted main screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { phase, transcript, messages, error, source, supported, active, audioRef, speechProfile, start, stop, ask,
    stopReply() {
      const current = state.current;
      if (current.speechTimer) clearTimeout(current.speechTimer);
      current.generation++; current.abort?.abort(); stopRecognition();
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      current.busy = false;
      if (current.enabled) listen(); else phaseTo('idle');
    } };
}
