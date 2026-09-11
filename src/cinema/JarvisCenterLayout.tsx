'use client';
import { useSyncExternalStore, type ReactNode } from 'react';
import { CenterTemplateBackdrop } from './CenterTemplateBackdrop';
import { centerBackgroundPreference, type CenterBackground } from './jarvisCenterBackground';
import type { FilmCamera } from './useFilmCamera';
import styles from './jarvis.module.css';
import layout from './jarvisCenterLayout.module.css';

interface CenterLayoutProps {
  camera: FilmCamera; heading: ReactNode; visual: ReactNode; children?: ReactNode; form: ReactNode;
}

export function JarvisCenterLayout(props: CenterLayoutProps) {
  const background = useSyncExternalStore(centerBackgroundPreference.subscribe, centerBackgroundPreference.getSnapshot, centerBackgroundPreference.getServerSnapshot);
  return <JarvisCenterLayoutView {...props} background={background} onBackgroundChange={centerBackgroundPreference.set} />;
}

/** Stable children stay mounted when switching backgrounds, including live camera and reactor playback. */
export function JarvisCenterLayoutView({ camera, heading, visual, children, form, background }:
  CenterLayoutProps & { background: CenterBackground; onBackgroundChange(value: string): void }) {
  const hud = background !== 'classic';
  return <div className={`${styles.center} ${hud ? layout.hud : ''}`} role="region" aria-label="중앙 음성 대화" data-background={background}>
    <div className={layout.stageShell}>
      <div className={layout.scene}>
      <div className={layout.sceneSurface} data-hud-surface={hud ? '800x400' : undefined}>
        <CenterTemplateBackdrop background={background} />
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
