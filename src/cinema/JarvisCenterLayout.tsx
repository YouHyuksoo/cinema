import type { ReactNode } from 'react';
import { JarvisCamera } from './JarvisCamera';
import { JarvisIdentity } from './JarvisIdentity';
import type { FilmCamera } from './useFilmCamera';
import styles from './jarvis.module.css';
import layout from './jarvisCenterLayout.module.css';

/** Central controls stay outside the scrolling information streams. */
export function JarvisCenterLayout({ camera, ignition, heading, children, form, aiStatus }: {
  camera: FilmCamera; ignition: ReactNode; heading: ReactNode; children: ReactNode; form: ReactNode; aiStatus: ReactNode;
}) {
  return <div className={styles.center} role="region" aria-label="중앙 음성 대화">
    <div className={layout.toolbar}>
      <div className={layout.startPanel} role="region" aria-label="중앙 좌측 상단 음성 제어">
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
    <div className={layout.centerHeading} role="status" aria-label="중앙 상태 메시지">{heading}</div>
    {children}
    <div className={layout.bottomRow}>
      <div className={layout.brandMark} role="region" aria-label="중앙 좌측 하단 HATCHERY 로고">
        <JarvisIdentity compact />
      </div>
      {form}
      {aiStatus}
    </div>
  </div>;
}
