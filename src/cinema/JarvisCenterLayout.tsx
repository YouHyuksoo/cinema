'use client';
import { useSyncExternalStore, type ReactNode } from 'react';
import { JarvisCamera } from './JarvisCamera';
import { JarvisCenterBackdrop } from './JarvisCenterBackdrop';
import { CENTER_BACKGROUNDS, centerBackgroundPreference, type CenterBackground } from './jarvisCenterBackground';
import type { FilmCamera } from './useFilmCamera';
import styles from './jarvis.module.css';
import layout from './jarvisCenterLayout.module.css';

interface CenterLayoutProps {
  camera: FilmCamera; ignition: ReactNode; heading: ReactNode; visual: ReactNode; children?: ReactNode; form: ReactNode; aiStatus: ReactNode;
}

export function JarvisCenterLayout(props: CenterLayoutProps) {
  const background = useSyncExternalStore(centerBackgroundPreference.subscribe, centerBackgroundPreference.getSnapshot, centerBackgroundPreference.getServerSnapshot);
  return <JarvisCenterLayoutView {...props} background={background} onBackgroundChange={centerBackgroundPreference.set} />;
}

/** Stable children stay mounted when switching backgrounds, including live camera and reactor playback. */
export function JarvisCenterLayoutView({ camera, ignition, heading, visual, children, form, aiStatus, background, onBackgroundChange }:
  CenterLayoutProps & { background: CenterBackground; onBackgroundChange(value: string): void }) {
  const hud = background === 'neon-hud';
  return <div className={`${styles.center} ${hud ? layout.hud : ''}`} role="region" aria-label="중앙 음성 대화" data-background={background}>
    <div className={layout.stageShell}>
      <div className={layout.scene}>
      <div className={layout.sceneSurface} data-hud-surface={hud ? '800x400' : undefined}>
      <div className={layout.backgroundPicker} role="region" aria-label={hud ? '중앙 우측 하단 배경 선택' : '중앙 상단 배경 선택'} data-slot={hud ? 'options' : undefined}>
        <span aria-hidden="true">{hud ? 'OPTIONS / DISPLAY' : 'CENTER / VISUAL SYSTEM'}</span>
        <label>중앙 배경 <select value={background} onChange={event => onBackgroundChange(event.target.value)}>
          {CENTER_BACKGROUNDS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select></label>
      </div>
        {hud ? <JarvisCenterBackdrop /> : null}
        <div className={layout.toolbar}>
      <div className={layout.aiPanel} role="region" aria-label={hud ? '중앙 좌측 상단 AI 연결정보' : '중앙 상단 AI 연결정보'}>
        {hud && <div className={layout.panelLabel}>MODEL / CONNECTION</div>}{aiStatus}
      </div>
      <div className={layout.startPanel} role="region" aria-label={hud ? '중앙 좌측 하단 음성 제어' : '중앙 좌측 상단 음성 제어'}>
        {ignition}
      </div>
      <section className={layout.cameraDock} aria-label="중앙 우측 상단 카메라">
        <div className={layout.cameraTitle}>OPERATOR / VISUAL LINK <i data-on={camera.status === 'on'} /></div>
        <div className={layout.cameraImage}>
          <JarvisCamera camera={camera} />
          <span>{camera.status === 'on' ? 'VIDEO CONNECTED' : camera.status === 'requesting' ? 'CONNECTING' : 'VISUAL STANDBY'}</span>
          <button type="button" className={layout.cameraToggle}
            onClick={camera.status === 'on' || camera.status === 'requesting' ? camera.stop : () => void camera.start()}>
            {camera.status === 'on' ? '영상 끄기' : camera.status === 'requesting' ? '영상 연결 취소' : '내 영상 연결'}
          </button>
        </div>
      </section>
        </div>
        <div className={layout.visual}>{visual}</div>
      </div>
      </div>
      <div className={layout.centerHeading} role="status" aria-label="중앙 상태 메시지">{heading}</div>
    </div>
    {children}
    <div className={layout.bottomRow}>
      {form}
    </div>
  </div>;
}
