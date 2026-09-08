import type { ReactNode } from 'react';
import { JarvisCamera } from './JarvisCamera';
import { JarvisMetricCards } from './JarvisMetricCards';
import { JarvisIdentity } from './JarvisIdentity';
import type { FilmCamera } from './useFilmCamera';
import header from './jarvisHeader.module.css';

export function JarvisMainHeader({ camera, ignition }: { camera: FilmCamera; ignition: ReactNode }) {
  return <header className={header.header}>
    <div className={header.overview}>
      <div className={header.identityControl} role="region" aria-label="HATCHERY 음성 제어">
        {ignition}
        <div className={header.brandMark} role="region" aria-label="START 아래 HATCHERY 로고">
          <JarvisIdentity compact />
        </div>
      </div>
      <JarvisMetricCards />
    </div>
    <section className={header.cameraDock} aria-label="우측 상단 고정 카메라">
      <div className={header.cameraTitle}>OPERATOR / VISUAL LINK <i data-on={camera.status === 'on'} /></div>
      <div className={header.cameraImage}><JarvisCamera camera={camera} />
        <span>{camera.status === 'on' ? 'VIDEO CONNECTED' : camera.status === 'requesting' ? 'CONNECTING' : 'VISUAL STANDBY'}</span>
        <button type="button" className={header.cameraToggle}
          onClick={camera.status === 'on' || camera.status === 'requesting' ? camera.stop : () => void camera.start()}>
          {camera.status === 'on' ? '영상 끄기' : camera.status === 'requesting' ? '영상 연결 취소' : '내 영상 연결'}
        </button>
      </div>
    </section>
  </header>;
}
