'use client';

import type { AiProviderId, AiProviderOption } from './aiConfig';
import { CINEMA_BASE_PATH } from './cinemaApi';
import styles from './jarvisVoiceMode.module.css';

/**
 * Quick switch for which AI answers HATCHERY, mirroring the first section of the AI settings screen.
 * Only providers with credentials on the server are selectable; the others point at the settings screen.
 */
export function JarvisAiProviderSelect({ providers, provider, model, busy, onChange }: {
  providers: AiProviderOption[]; provider: AiProviderId | null; model: string | null; busy: boolean;
  onChange: (provider: AiProviderId, model?: string) => void;
}) {
  const current = providers.find(option => option.id === provider);
  const settingsHref = `${CINEMA_BASE_PATH}/cinema/ai`;
  if (!current || !provider) return <p className={styles.hint}>AI 설정을 확인하는 중입니다. 서버에서만 바꿀 수 있습니다. <a className={styles.link} href={settingsHref}>AI 설정 열기 ↗</a></p>;
  const models = model && !current.models.includes(model) ? [model, ...current.models] : current.models;
  return <div data-ai-provider-select>
    <div className={styles.row} role="group" aria-label="AI 프로바이더">
      <span className={styles.label}>프로바이더</span>
      {providers.map(option => <button key={option.id} type="button" className={styles.option} aria-pressed={option.id === provider}
        disabled={busy || (!option.ready && option.id !== provider)} data-provider={option.id} data-ready={option.ready}
        title={option.ready ? option.label : `${option.label}: ${option.id === 'chatgpt' ? 'Codex CLI 로그인이 없습니다' : 'API 키가 없습니다'}. AI 설정에서 저장하세요.`}
        onClick={() => { if (option.id !== provider) onChange(option.id); }}>{option.label}</button>)}
    </div>
    <label className={styles.row}>
      <span className={styles.label}>모델</span>
      <select className={styles.select} value={model ?? ''} disabled={busy} aria-label="AI 모델"
        onChange={event => onChange(provider, event.target.value)}>
        {models.map(id => <option key={id} value={id}>{id}</option>)}
      </select>
    </label>
    <p className={styles.hint}>{current.ready ? '선택은 바로 저장되고 다음 질문부터 적용됩니다.' : `${current.label}은 인증이 없어 답하지 못합니다.`} 키·프롬프트·세부 설정은 <a className={styles.link} href={settingsHref}>AI 설정 ↗</a></p>
  </div>;
}
