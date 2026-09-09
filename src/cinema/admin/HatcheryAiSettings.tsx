'use client';

import { useEffect, useState } from 'react';
import { AI_LIMITS, AI_PROVIDERS, AI_VOICE_MODES, DEFAULT_AI_CONFIG, aiProvider, type AiConfig, type AiProviderId, type AiVoiceMode, type MaskedAiConfig } from '../aiConfig';
import type { AiTestResult } from '@/server/cinema/aiProviders';
import type { CodexLoginStatus } from '@/server/cinema/codexAuth';
import { CINEMA_BASE_PATH, cinemaApi } from '../cinemaApi';
import styles from './hatcheryAdmin.module.css';

type Draft = AiConfig & { hasApiKey: boolean; keySource: MaskedAiConfig['keySource'] };
const emptyDraft = (): Draft => ({ ...DEFAULT_AI_CONFIG, hasApiKey: false, keySource: 'none' });

/** AI provider, model, key, generation settings, operator instructions and a live connection test. Server only. */
export function HatcheryAiSettings() {
  const [mode, setMode] = useState<'loading' | 'server' | 'static'>('loading');
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [saved, setSaved] = useState(false);
  const [codex, setCodex] = useState<CodexLoginStatus | null>(null);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [test, setTest] = useState<AiTestResult | 'running' | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await cinemaApi('admin/ai');
        if (!active) return;
        if (response.status === 404 || !(response.headers.get('content-type') ?? '').includes('json')) { setMode('static'); return; }
        const body = await response.json() as { ai: MaskedAiConfig; saved: boolean; codexLogin?: CodexLoginStatus; error?: string };
        if (!active) return;
        setDraft({ ...body.ai, apiKey: '' });
        setSaved(body.saved);
        setCodex(body.codexLogin ?? null);
        if (body.error) setNotice({ kind: 'error', text: body.error });
        setMode('server');
      } catch { if (active) setMode('static'); }
    };
    void load();
    return () => { active = false; };
  }, []);

  const provider = aiProvider(draft.provider);
  const update = (change: Partial<Draft>) => { setDraft(current => ({ ...current, ...change })); setTest(null); };
  const changeProvider = (id: AiProviderId) => {
    const next = aiProvider(id);
    // A new provider needs its own key and a model from its catalogue.
    update({ provider: id, model: next.models[0], apiKey: '', hasApiKey: false, keySource: 'none' });
  };
  const payload = (): AiConfig => ({ provider: draft.provider, model: draft.model, apiKey: draft.apiKey, temperature: draft.temperature,
    maxOutputTokens: draft.maxOutputTokens, instructions: draft.instructions, realtimeModel: draft.realtimeModel, voiceMode: draft.voiceMode });

  async function save() {
    setSaving(true); setNotice(null);
    try {
      const response = await cinemaApi('admin/ai', { method: 'PUT', body: JSON.stringify(payload()) });
      const body = await response.json() as { ai?: MaskedAiConfig; saved?: boolean; error?: string };
      if (!response.ok || !body.ai) { setNotice({ kind: 'error', text: body.error ?? '저장하지 못했습니다.' }); return; }
      setDraft({ ...body.ai, apiKey: '' }); setSaved(true);
      setNotice({ kind: 'ok', text: '저장했습니다. 다음 질문부터 새 설정으로 답합니다.' });
    } catch (error) { setNotice({ kind: 'error', text: error instanceof Error ? error.message : '저장하지 못했습니다.' }); }
    finally { setSaving(false); }
  }
  async function runTest() {
    setTest('running');
    try {
      const response = await cinemaApi('admin/ai/test', { method: 'POST', body: JSON.stringify(payload()) });
      const body = await response.json() as AiTestResult | { error: string };
      setTest('error' in body && !('ok' in body) ? { ok: false, error: body.error } : body as AiTestResult);
    } catch (error) { setTest({ ok: false, error: error instanceof Error ? error.message : '접속 테스트 실패' }); }
  }

  if (mode === 'loading') return <main className={styles.page}><p className={styles.muted}>설정을 읽는 중…</p></main>;
  if (mode === 'static') return <main className={styles.page}>
    <h1 className={styles.title}>HATCHERY AI 설정</h1>
    <p className={styles.notice} data-kind="error">이 배포에는 서버가 없어 AI 설정을 쓸 수 없습니다. <code>npm run dev</code> 또는 <code>npm run start</code>로 실행한 서버에서 여세요.</p>
  </main>;

  const keyPlaceholder = draft.keySource === 'config' ? '저장된 키 유지 (바꾸려면 입력)' : draft.keySource === 'env' ? '환경 변수 OPENAI_API_KEY 사용 중 (덮어쓰려면 입력)' : provider.keyHint;
  const customModel = !provider.models.includes(draft.model);
  const keyState = draft.keySource === 'codex' ? 'Codex 로그인' : draft.keySource === 'env' ? '환경 변수' : draft.keySource === 'config' ? '저장됨' : '없음';
  const codexExpiry = codex?.expiresAt ? new Date(codex.expiresAt).toLocaleString('ko-KR') : null;

  return <main className={styles.page} data-ai-settings="true">
    <header className={styles.header}>
      <div><h1 className={styles.title}>HATCHERY AI 설정</h1>
        <p className={styles.muted}>자유 대화 AI의 프로바이더·모델·키·생성 설정·프롬프트 지시어. 키는 서버 설정 파일에만 저장되고 화면으로 돌아오지 않습니다.
          {' '}상태: {saved ? <span className={styles.result} data-ok={draft.hasApiKey}>{draft.hasApiKey ? `${provider.label} · ${draft.model} · 인증 ${keyState}` : `${provider.label} · 인증 없음`}</span>
            : <span className={styles.result} data-ok={draft.keySource === 'env'}>{draft.keySource === 'env' ? '저장된 설정 없음 · 환경 변수 OpenAI 키 사용 중' : '저장된 설정 없음 · AI 미연결'}</span>}</p></div>
      <div className={styles.actions}>
        <a className={styles.button} href={`${CINEMA_BASE_PATH}/cinema`}>화면으로</a>
        <a className={styles.button} href={`${CINEMA_BASE_PATH}/cinema/admin`}>데이터 소스 관리</a>
        <button type="button" className={styles.button} data-primary onClick={() => void save()} disabled={saving}>{saving ? '저장 중…' : '저장'}</button>
      </div>
    </header>
    {notice && <p className={styles.notice} data-kind={notice.kind}>{notice.text}</p>}

    <section className={styles.section}>
      <h2>1. 프로바이더 · 모델</h2>
      <div className={styles.card}>
        <div className={styles.grid}>
          <label>프로바이더<select value={draft.provider} onChange={event => changeProvider(event.target.value as AiProviderId)}>
            {AI_PROVIDERS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <label>모델<select value={customModel ? '__custom' : draft.model} onChange={event => update({ model: event.target.value === '__custom' ? '' : event.target.value })}>
            {provider.models.map(model => <option key={model} value={model}>{model}</option>)}<option value="__custom">직접 입력…</option></select></label>
          {customModel && <label>모델 ID<input value={draft.model} placeholder={provider.models[0]} onChange={event => update({ model: event.target.value })} /></label>}
          {provider.realtime && <label>실시간 음성 모델 (OpenAI)<input value={draft.realtimeModel} onChange={event => update({ realtimeModel: event.target.value })} /></label>}
        </div>
        <p className={styles.muted}>{provider.realtime ? '실시간 음성 대화와 화면 값 변경 도구는 OpenAI API에서만 동작합니다.' : provider.auth === 'codex' ? 'ChatGPT Plus/Pro 구독으로 텍스트 대화를 합니다. 음성은 아래 "브라우저 음성 + 텍스트 모델" 방식을 쓰세요. Codex CLI 용도의 로그인을 재사용하는 방식이라 OpenAI가 형식을 바꾸면 멈출 수 있습니다.' : `${provider.label}은 텍스트 대화만 지원합니다. 실시간 음성은 OpenAI API 키가 따로 있을 때 동작합니다.`} 안내: <a href={provider.docs} target="_blank" rel="noreferrer">{provider.docs}</a></p>
      </div>
    </section>

    <section className={styles.section}>
      <h2>2. {provider.auth === 'codex' ? 'ChatGPT 로그인' : 'API 키'}</h2>
      <div className={styles.card}>
        {provider.auth === 'codex' ? <>
          <p className={styles.result} data-ok={codex?.ok ?? false} data-codex-login={codex?.ok ?? false}>{codex?.ok
            ? `Codex CLI 로그인 감지됨 · ~/.codex/auth.json${codexExpiry ? ` · 토큰 만료 ${codexExpiry} (자동 갱신)` : ''}`
            : codex?.reason ?? 'Codex CLI 로그인을 확인하는 중…'}</p>
          <p className={styles.muted}>API 키 대신 Codex CLI의 &quot;Sign in with ChatGPT&quot; 로그인을 재사용합니다. 로그인이 없거나 만료됐으면 터미널에서 <code>codex login</code>을 실행한 뒤 이 화면을 새로고침하세요.</p>
        </> : <>
          <div className={styles.grid}>
            <label>{provider.label} 키<input type="password" value={draft.apiKey} autoComplete="off" spellCheck={false} placeholder={keyPlaceholder}
              onChange={event => update({ apiKey: event.target.value })} /></label>
          </div>
          <p className={styles.muted}>비워 두고 저장하면 같은 프로바이더의 저장된 키를 유지합니다. 프로바이더를 바꾸면 새 키가 필요합니다.</p>
        </>}
      </div>
    </section>

    <section className={styles.section}>
      <h2>3. 음성 방식</h2>
      <div className={styles.card}>
        <div className={styles.grid}>
          <label>대화 방식<select value={draft.voiceMode} onChange={event => update({ voiceMode: event.target.value as AiVoiceMode })}>
            {AI_VOICE_MODES.map(mode => <option key={mode.id} value={mode.id}>{mode.label}</option>)}</select></label>
        </div>
        <p className={styles.muted}>{AI_VOICE_MODES.find(mode => mode.id === draft.voiceMode)?.hint}{draft.voiceMode === 'realtime' && !provider.realtime
          ? ` · ${provider.label}에는 Realtime이 없어 OpenAI API 키(저장 또는 환경 변수)가 없으면 브라우저 방식으로 동작합니다.` : ''}</p>
      </div>
    </section>

    <section className={styles.section}>
      <h2>4. 모델 설정</h2>
      <div className={styles.card}>
        <div className={styles.grid}>
          <label>temperature ({draft.temperature.toFixed(2)})<input type="range" min={AI_LIMITS.temperature.min} max={AI_LIMITS.temperature.max} step={0.05} value={draft.temperature}
            onChange={event => update({ temperature: Number(event.target.value) })} /></label>
          <label>최대 출력 토큰<input type="number" min={AI_LIMITS.maxOutputTokens.min} max={AI_LIMITS.maxOutputTokens.max} value={draft.maxOutputTokens}
            onChange={event => update({ maxOutputTokens: Number(event.target.value) })} /></label>
        </div>
        <p className={styles.muted}>낮은 temperature는 일관된 답, 높은 값은 다양한 답을 냅니다. Anthropic은 1을 넘는 값을 1로 맞추고, ChatGPT 구독 경로는 추론 모델이라 이 값을 보내지 않습니다.</p>
      </div>
    </section>

    <section className={styles.section}>
      <h2>5. 프롬프트 지시어</h2>
      <div className={styles.card}>
        <label className={styles.block}>운영자 추가 지시 (최대 {AI_LIMITS.instructions}자 · 기본 HATCHERY 지시문 뒤에 붙습니다)
          <textarea rows={8} value={draft.instructions} maxLength={AI_LIMITS.instructions} spellCheck={false}
            placeholder={'예) 답변은 세 문장 이내로. 설비명은 라인 번호와 함께 말할 것. 영어 약어는 처음 한 번 풀어 쓸 것.'}
            onChange={event => update({ instructions: event.target.value })} /></label>
        <p className={styles.muted}>기본 지시문은 HATCHERY의 역할·말투·시연 데이터 주의·연출/값 변경 도구 규칙을 담고 있으며 코드(<code>src/server/cinema/openai.ts</code>)에서 관리합니다. 여기 입력한 내용은 그 뒤에 &quot;운영자 추가 지시&quot;로 이어집니다.</p>
      </div>
    </section>

    <section className={styles.section}>
      <h2>6. 접속 테스트</h2>
      <div className={styles.card}>
        <div className={styles.actions}>
          <button type="button" className={styles.button} onClick={() => void runTest()} disabled={test === 'running'}>{test === 'running' ? '연결 중…' : '접속 테스트'}</button>
          <span className={styles.muted}>현재 화면의 설정(입력한 키가 없으면 저장된 키 또는 환경 변수)으로 짧은 질문을 보내 응답을 확인합니다. 저장하지 않아도 테스트할 수 있습니다.</span>
        </div>
        {test && test !== 'running' && <p className={styles.result} data-ok={test.ok}>{test.ok
          ? `연결 성공 · ${test.elapsedMs}ms · ${aiProvider(test.provider).label} ${test.model} · 응답: ${test.reply}`
          : `실패 · ${test.error}`}</p>}
      </div>
    </section>
  </main>;
}
