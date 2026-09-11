'use client';
import { useSyncExternalStore } from 'react';
import { CENTER_BACKGROUNDS, centerBackgroundPreference } from './jarvisCenterBackground';
import { CenterTemplateBackdrop } from './CenterTemplateBackdrop';
import styles from './filmCenterControls.module.css';

export function FilmCenterControls() {
  const background = useSyncExternalStore(centerBackgroundPreference.subscribe, centerBackgroundPreference.getSnapshot, centerBackgroundPreference.getServerSnapshot);
  return <fieldset className={styles.fieldset}>
    <legend>중앙 배경</legend>
    <div className={styles.grid}>
      {CENTER_BACKGROUNDS.map(option => <button key={option.id} type="button" className={styles.card}
        aria-label={`중앙 배경 ${option.label}`} aria-pressed={background === option.id}
        onClick={() => centerBackgroundPreference.set(option.id)}>
        <span className={styles.preview} data-preview={option.id} aria-hidden="true">
          <CenterTemplateBackdrop background={option.id} />
        </span>
        <span className={styles.caption}><span>{option.label}</span><span className={styles.selected}>{background === option.id ? '✓ 선택됨' : '선택'}</span></span>
      </button>)}
    </div>
  </fieldset>;
}
