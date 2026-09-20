'use client';

import { useEffect, useState } from 'react';
import { cinemaApi } from '../cinemaApi';
import { DEFAULT_TYPESAFE_CONFIG, TYPESAFE_MODES, TYPESAFE_MODELS, type MaskedTypeSafeConfig, type TypeSafeConfig } from '../typesafeConfig';
import styles from './hatcheryAdmin.module.css';

/** Independently saved command judge; changing chat providers must not replace the Jev key. */
export function TypesafeSettings() {
  const [draft, setDraft] = useState<TypeSafeConfig>(DEFAULT_TYPESAFE_CONFIG);
  const [stored, setStored] = useState<MaskedTypeSafeConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'save' | 'test' | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    const abort = new AbortController();
    void (async () => {
      try {
        const response = await cinemaApi('admin/typesafe', { signal: abort.signal });
        const body = await response.json();
        if (!response.ok || !body.settings) throw new Error(body.error || 'Jev 설정을 읽지 못했습니다.');
        if (!abort.signal.aborted) { setStored(body.settings); setDraft({ ...body.settings, apiKey: '' }); }
      } catch (error) {
        if (!abort.signal.aborted) setNotice({ ok: false, text: error instanceof Error ? error.message : 'Jev 설정을 읽지 못했습니다.' });
      } finally { if (!abort.signal.aborted) setLoading(false); }
    })();
    return () => abort.abort();
  }, []);
  const update = (change: Partial<TypeSafeConfig>) => { setDraft(value => ({ ...value, ...change })); setNotice(null); };
  async function submit(action: 'save' | 'test') {
    setBusy(action); setNotice(null);
    try {
      const response = await cinemaApi(action === 'save' ? 'admin/typesafe' : 'admin/typesafe/test', {
        method: action === 'save' ? 'PUT' : 'POST', body: JSON.stringify({ mode: draft.mode, model: draft.model, apiKey: draft.apiKey }),
      });
      const body = await response.json();
      if (!response.ok || (action === 'test' && !body.ok)) throw new Error(body.error || 'Jev 요청을 처리하지 못했습니다.');
      if (action === 'save') {
        if (!body.settings) throw new Error('Jev 저장 결과를 확인하지 못했습니다.');
        setStored(body.settings); setDraft({ ...body.settings, apiKey: '' });
        setNotice({ ok: true, text: 'Jev 설정을 저장했습니다. 다음 텍스트 요청부터 적용됩니다. 실시간 음성은 다시 연결해 주세요.' });
      } else setNotice({ ok: true, text: `Jev 연결 확인 · ${body.model} · ${body.elapsedMs}ms. 입력한 설정은 아직 저장하지 않았습니다.` });
    } catch (error) { setNotice({ ok: false, text: error instanceof Error ? error.message : 'Jev 요청에 실패했습니다.' }); }
    finally { setBusy(null); }
  }
  const customModel = !TYPESAFE_MODELS.some(model => model === draft.model);
  return <section className={styles.section} aria-labelledby="jev-settings-title" data-ai-section="typesafe">
    <h2 id="jev-settings-title">TypeSafe / Jev · 명령 판단</h2>
    <div className={styles.card}>
      <p className={styles.muted}>화면 이동·메뉴·재생 요청을 해석하는 AI입니다. 대화·분석 AI와 함께 사용하며 Jev 설정은 별도로 저장합니다.</p>
      {loading ? <p role="status">Jev 설정을 읽는 중…</p> : <>
        <p className={styles.result} data-ok={stored?.hasApiKey ?? false}>Jev 인증: {stored?.hasApiKey ? (stored.keySource === 'env' ? '환경 변수 키 사용 중' : '서버에 키 저장됨') : '키 없음'}
          {stored && ` · 현재 적용 모드: ${TYPESAFE_MODES.find(mode => mode.id === stored.mode)?.label}`}</p>
        <fieldset className={styles.jevFields} disabled={busy !== null || !stored}>
          <div className={styles.grid}>
            <label>Jev 적용 모드<select value={draft.mode} onChange={event => update({ mode: event.target.value as TypeSafeConfig['mode'] })}>
              {TYPESAFE_MODES.map(mode => <option key={mode.id} value={mode.id}>{mode.label}</option>)}</select></label>
            <label>Jev 모델<select value={customModel ? 'custom' : draft.model} onChange={event => update({ model: event.target.value === 'custom' ? 'jev-' : event.target.value })}>
              {TYPESAFE_MODELS.map(model => <option key={model} value={model}>{model}</option>)}<option value="custom">직접 입력</option></select></label>
            {customModel && <label>Jev 모델 ID<input value={draft.model} maxLength={114} spellCheck={false} onChange={event => update({ model: event.target.value })} /></label>}
            <label>Jev API 키<input type="password" autoComplete="new-password" spellCheck={false} maxLength={4096} value={draft.apiKey}
              placeholder={stored?.hasApiKey ? '비우면 기존 키 유지' : 'TypeSafe 콘솔에서 발급한 API 키'} onChange={event => update({ apiKey: event.target.value })} /></label>
          </div>
          <p className={styles.muted}>{TYPESAFE_MODES.find(mode => mode.id === draft.mode)?.hint}</p>
          <p className={styles.muted}>키는 서버에만 저장합니다. 처음에는 평가만 모드로 확인하세요. 연결 테스트는 Jev API를 한 번 호출하며 설정을 저장하지 않습니다.</p>
          <div className={styles.actions}>
            <button type="button" className={styles.button} onClick={() => void submit('test')}>{busy === 'test' ? 'Jev 연결 확인 중…' : 'Jev 연결 테스트'}</button>
            <button type="button" className={styles.button} data-primary onClick={() => void submit('save')}>{busy === 'save' ? 'Jev 저장 중…' : 'Jev 설정 저장'}</button>
            <a className={styles.button} href="https://console.typesafe.ai/home" target="_blank" rel="noreferrer">TypeSafe 콘솔</a>
          </div>
        </fieldset>
      </>}
      {notice && <p className={styles.result} data-ok={notice.ok} role="status">{notice.text}</p>}
    </div>
  </section>;
}
