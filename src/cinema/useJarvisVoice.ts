'use client';
import { useEffect, useRef, useState } from 'react';
import { useJarvisLocalVoice } from './useJarvisLocalVoice';
import { JarvisRealtimeSession } from './jarvisRealtimeSession';
import type { JarvisAudioFrame, JarvisPhase } from './jarvisAudio';
import type { FilmId } from './filmProgram';
import { DEFAULT_ROBOT_VOICE, type RobotVoiceSettings } from './robotVoice';
import type { HatcheryActions } from './hatcheryTargets';
import { DEFAULT_FILM_SCENE_DATA } from './filmSceneData';
import type { MachineSubject } from './machinePresentation';
import { cinemaApi, cinemaApiUrl } from './cinemaApi';
import type { AiProviderId, AiProviderOption, AiVoiceMode } from './aiConfig';
import { realtimeVoiceFor } from './jarvisVoiceGender';
import { describeScreenState, validateScreenCommand, type ScreenExecutor } from './screenCommands';

interface Message { id: string; role: 'user' | 'assistant'; content: string }
export function useJarvisVoice(onChapter: (id: FilmId, subject?: MachineSubject) => void, actions?: HatcheryActions) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  // Realtime voice only when the server has an OpenAI key and the AI settings ask for it; else browser speech + text model.
  const [realtime, setRealtime] = useState(false);
  const [providerLabel, setProviderLabel] = useState<string | null>(null);
  const [voiceMode, setVoiceModeState] = useState<AiVoiceMode | null>(null);
  const [realtimeAvailable, setRealtimeAvailable] = useState(false);
  const [switching, setSwitching] = useState(false);
  // What the operator picked on the AI settings screen or the main screen, and what can be picked now.
  const [provider, setProvider] = useState<AiProviderId | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [providers, setProviders] = useState<AiProviderOption[]>([]);
  const [statusError, setStatusError] = useState('');
  const [models, setModels] = useState<{ text: string | null; realtime: string | null }>({ text: null, realtime: null });
  const [connected, setConnected] = useState(false);
  const [robotVoice, setRobotVoice] = useState<RobotVoiceSettings>(DEFAULT_ROBOT_VOICE);
  const [realtimeView, setRealtimeView] = useState(false);
  const [active, setActive] = useState(false);
  const [phase, setPhase] = useState<JarvisPhase>('idle');
  const [messages, setMessages] = useState<Message[]>([]);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState('');
  const audioRef = useRef<JarvisAudioFrame>({ phase: 'idle', analyser: null });
  const session = useRef<JarvisRealtimeSession | null>(null);
  const chapter = useRef(onChapter);
  const actionsRef = useRef(actions);
  const screen: ScreenExecutor = async input => {
    const c = validateScreenCommand(input);
    if (!c) return { ok: false, message: '잘못된 화면 설정 명령입니다.' };
    const voiceState = { voiceGender: local.speechProfile.preferredGender.current, voiceMode, provider, model };
    const adminKeys = ['temperature', 'maxOutputTokens', 'realtimeModel', 'instructions', 'prompt'];
    if (adminKeys.includes(c.key)) {
      if (c.action === 'set' && switching) return { ok: false, message: '다른 AI 설정 변경이 진행 중입니다. 잠시 후 다시 요청해주세요.' };
      try {
        const response = await cinemaApi('admin/ai');
        if (!response.ok) return { ok: false, message: '서버 AI 설정을 조회하지 못했습니다.' };
        const current = (await response.json()).ai;
        if (c.action === 'get') return { ok: true, message: `${c.key}: ${current[c.key]}`, state: { [c.key]: current[c.key] } };
        const value = ['temperature', 'maxOutputTokens'].includes(c.key) ? Number(c.value) : c.value;
        const saved = await cinemaApi('admin/ai', { method: 'PUT', body: JSON.stringify({ ...current, apiKey: '', [c.key]: value }) });
        if (!saved.ok) return { ok: false, message: '서버 AI 설정 저장을 거부했습니다. 값과 범위를 확인해주세요.' };
        const persisted = (await saved.json()).ai;
        await readStatus();
        const ok = persisted?.[c.key] === value;
        return { ok, message: ok ? `${c.key} 서버 저장을 확인했습니다.${active || local.active ? ' 진행 중인 대화는 유지하며 다음 AI 요청 또는 재연결부터 적용됩니다.' : ''}` : '요청한 값의 저장을 확인하지 못했습니다.' };
      } catch { return { ok: false, message: '서버 AI 설정 연결에 실패했습니다.' }; }
    }
    if (c.action === 'get') {
      const base = await actionsRef.current?.screen?.(c);
      const state = { ...base?.state, ...voiceState };
      return { ok: true, message: describeScreenState(state, c.key), state };
    }
    if (c.key === 'voiceGender') { local.speechProfile.setGender(c.value as 'male' | 'female'); return { ok: true, message: `목소리를 ${c.value === 'male' ? '남성' : '여성'}으로 설정했습니다. 실시간 음성은 다음 연결부터 적용됩니다.` }; }
    if (['voiceMode', 'provider', 'model'].includes(c.key)) {
      if (switching) return { ok: false, message: '다른 AI 설정 변경이 진행 중입니다. 잠시 후 다시 요청해주세요.' };
      const patch = c.key === 'voiceMode' ? { voiceMode: c.value } : c.key === 'provider' ? { provider: c.value } : { model: c.value };
      try {
        const response = await cinemaApi('admin/ai', { method: 'PATCH', body: JSON.stringify(patch) });
        if (!response.ok) return { ok: false, message: 'AI 설정 변경에 실패했습니다. 제공자 설정과 모델을 확인해주세요.' };
        const saved = (await response.json()).ai;
        await readStatus();
        const ok = saved?.[c.key] === c.value;
        return { ok, message: ok ? `${c.key}: ${c.value} 서버 저장 완료.${active || local.active ? ' 현재 대화는 유지하며 다음 연결부터 적용됩니다.' : ''}` : '요청한 AI 설정값의 저장을 확인하지 못했습니다.' };
      } catch { return { ok: false, message: 'AI 설정 서버에 연결하지 못했습니다.' }; }
    }
    return await actionsRef.current?.screen?.(c) ?? { ok: false, message: '화면 설정 도구가 연결되지 않았습니다.' };
  };
  const screenRef = useRef<ScreenExecutor>(screen); screenRef.current = screen;
  const local = useJarvisLocalVoice(onChapter, { speakReplies: !realtime, actions: actions ? { ...actions, screen: input => screenRef.current(input) } : undefined });
  useEffect(() => { chapter.current = onChapter; }, [onChapter]);
  useEffect(() => { actionsRef.current = actions; }, [actions]);
  useEffect(() => { session.current?.setRobotVoice(robotVoice); }, [robotVoice]);
  const readStatus = (signal?: AbortSignal) => fetch(cinemaApiUrl('assistant'), { signal, cache: 'no-store' })
    .then(async response => { if (!response.ok) throw new Error(); return response.json(); })
    .then(data => {
      if (signal?.aborted) return;
      setConfigured(data.aiConfigured === true);
      setRealtime(data.useRealtime === true);
      setRealtimeAvailable(data.realtimeAvailable === true);
      setVoiceModeState(data.voiceMode === 'browser' ? 'browser' : 'realtime');
      setProviderLabel(typeof data.providerLabel === 'string' ? data.providerLabel : null);
      setProvider(typeof data.selectedProvider === 'string' ? data.selectedProvider as AiProviderId : null);
      setModel(typeof data.selectedModel === 'string' ? data.selectedModel : null);
      setProviders(Array.isArray(data.providers) ? data.providers as AiProviderOption[] : []);
      setModels({ text: typeof data.textModel === 'string' && data.textModel.trim() ? data.textModel : null,
        realtime: typeof data.realtimeModel === 'string' && data.realtimeModel.trim() ? data.realtimeModel : null });
    });
  useEffect(() => {
    const abort = new AbortController();
    void readStatus(abort.signal)
      .catch(() => { if (!abort.signal.aborted) setStatusError('AI 설정을 확인하지 못했습니다. 페이지를 새로고침해 주세요.'); });
    const hide = () => session.current?.stop();
    const visibility = () => { if (document.hidden) hide(); };
    window.addEventListener('pagehide', hide); document.addEventListener('visibilitychange', visibility);
    return () => { abort.abort(); hide(); window.removeEventListener('pagehide', hide); document.removeEventListener('visibilitychange', visibility); };
  }, []);
  async function start() {
    if (configured === null) return;
    if (!configured || !realtime) { setRealtimeView(false); await local.start(); return; }
    if (active) return;
    local.stop(); session.current?.stop(); setRealtimeView(true); setError(''); setActive(true); setMessages([]); setTranscript('');
    const current = new JarvisRealtimeSession({
      phase(value) { audioRef.current.phase = value; setPhase(value); },
      connection: setConnected,
      analyser(value) { audioRef.current.analyser = value; },
      error: setError, transcript: setTranscript, ended: () => setActive(false), chapter: (id, subject) => subject ? chapter.current(id, subject) : chapter.current(id),
      patch: input => actionsRef.current?.applySceneObjects(input) ?? { ok: false, reason: '이 화면에서는 값 변경을 처리할 수 없습니다.' },
      sceneData: () => actionsRef.current?.sceneData() ?? DEFAULT_FILM_SCENE_DATA,
      screen: input => screenRef.current(input),
      message(role, content, id) {
        setMessages(previous => {
          const next = previous.filter(item => item.id !== id);
          const index = previous.findIndex(item => item.id === id);
          if (index >= 0) next.splice(index, 0, { id, role, content }); else next.push({ id, role, content });
          return next.slice(-16);
        });
      },
    });
    session.current = current; current.setRobotVoice(robotVoice); await current.start(realtimeVoiceFor(local.speechProfile.gender));
  }
  function stop() { session.current?.stop(); local.stop(); }
  /** Persist a main-screen quick setting (voice mode, provider, model), then re-read what the server will actually do. */
  async function patchSettings(change: { voiceMode?: AiVoiceMode; provider?: AiProviderId; model?: string }, failure: string) {
    if (active || switching) return;
    setSwitching(true); setStatusError('');
    try {
      const response = await cinemaApi('admin/ai', { method: 'PATCH', body: JSON.stringify(change) });
      if (!response.ok) throw new Error((await response.json().catch(() => ({})) as { error?: string }).error ?? failure);
      await readStatus();
    } catch (error) { setStatusError(error instanceof Error ? error.message : failure); }
    finally { setSwitching(false); }
  }
  const setVoiceMode = (mode: AiVoiceMode) => patchSettings({ voiceMode: mode }, '음성 방식을 바꾸지 못했습니다.');
  const selectProvider = (id: AiProviderId, nextModel?: string) => patchSettings({ provider: id, ...(nextModel ? { model: nextModel } : {}) }, 'AI 프로바이더를 바꾸지 못했습니다.');
  async function ask(input: string) {
    if (active) session.current?.ask(input);
    else { setRealtimeView(false); await local.ask(input); }
  }
  const selected = realtimeView ? { phase, transcript, messages, error, source: 'OpenAI Realtime · AI 생성 음성',
    supported: typeof RTCPeerConnection !== 'undefined', active, audioRef } : local;
  return { ...selected, configured, realtime, realtimeAvailable, voiceMode, switching, setVoiceMode, providerLabel, statusError,
    provider, model, providers, selectProvider, voiceGender: local.speechProfile.gender, setVoiceGender: local.speechProfile.setGender,
    robotVoice, setRobotVoice, speechProfile: local.speechProfile,
    aiConnection: { configured, statusError, models, connected, realtimeActive: active, error: realtimeView ? error : local.error },
    start, stop, ask, stopReply: realtimeView ? () => session.current?.interrupt() : local.stopReply };
}
