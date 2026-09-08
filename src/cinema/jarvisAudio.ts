export type JarvisPhase = 'idle' | 'requesting' | 'listening' | 'thinking' | 'speaking' | 'error';
export const JARVIS_REALTIME_VOICES = ['cedar', 'marin', 'ash', 'echo'] as const;
export interface JarvisAudioFrame { phase: JarvisPhase; analyser: AnalyserNode | null }
export interface JarvisRecognition {
  lang: string; continuous: boolean; interimResults: boolean;
  onstart: (() => void) | null; onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  start(): void; abort(): void;
}
export function recognitionConstructor(): (new () => JarvisRecognition) | undefined {
  const browser = window as unknown as { SpeechRecognition?: new () => JarvisRecognition; webkitSpeechRecognition?: new () => JarvisRecognition };
  return browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
}
export const JARVIS_PHASE_LABELS: Record<JarvisPhase, string> = {
  idle: '대화 준비', requesting: '마이크 연결 중', listening: '듣고 있어요',
  thinking: '답변을 준비하고 있어요', speaking: 'HATCHERY가 답하고 있어요', error: '연결 상태를 확인해 주세요',
};
