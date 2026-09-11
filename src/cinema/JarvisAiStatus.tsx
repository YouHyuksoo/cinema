import styles from './jarvisAiStatus.module.css';

export interface JarvisAiConnection {
  configured: boolean | null;
  statusError: string;
  models: { text: string | null; realtime: string | null };
  connected: boolean;
  realtimeActive: boolean;
  error: string;
}

/** Configuration availability is not proof of a live OpenAI connection. */
export function JarvisAiStatus({ connection }: { connection: JarvisAiConnection }) {
  const { configured, statusError, connected, realtimeActive, error, models } = connection;
  const state = statusError ? 'unavailable' : configured === null ? 'checking' : !configured ? 'local'
    : error ? 'error' : connected ? 'connected' : realtimeActive ? 'connecting' : 'ready';
  const label = { unavailable: 'AI 상태 확인 실패', checking: 'AI 설정 확인 중', local: '로컬 모드 · AI 미설정',
    error: 'AI 오류', connected: 'AI 음성 연결됨', connecting: 'AI 음성 연결 중', ready: 'AI 연결 대기 · 설정됨' }[state];
  return <section className={styles.status} aria-label="AI 연결 상태와 모델" data-state={state}>
    <div role="status" title={statusError || error || (state === 'ready' ? '서버 설정이 확인되었습니다. 실제 음성 연결은 터빈의 AI 대화를 누른 뒤 시작됩니다.' : label)}>
      <i aria-hidden="true" />{label}
    </div>
    {configured === true ? <div className={styles.models} title="서버에 설정된 모델" tabIndex={0} role="group" aria-label="AI 모델명">
      <span>VOICE · {models.realtime ?? '확인되지 않음'}</span>
      <span>TEXT · {models.text ?? '확인되지 않음'}</span>
    </div> : <small>{state === 'local' ? 'AI 모델 미사용' : '모델 정보 확인되지 않음'}</small>}
  </section>;
}
