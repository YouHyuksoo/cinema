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
  const local = useJarvisLocalVoice(onChapter, { speakReplies: !realtime, actions });
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
