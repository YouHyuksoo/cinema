import type { FilmCamera } from './useFilmCamera';
import { RangeField } from './FilmFields';
import styles from './film.module.css';

export interface FilmCameraMode extends FilmCamera {
  preview: boolean;
  openPreview: () => void;
  closePreview: () => void;
  enable: () => void;
}

export function FilmCameraControls({ camera }: { camera: FilmCameraMode }) {
  const busy = camera.status === 'requesting';
  const on = camera.status === 'on';
  return (
    <fieldset className={styles.cameraSettings}>
      <legend>운영자 영상 설정</legend>
      <div className={styles.cameraActions}>
        <button type="button" className={styles.cameraButton}
          onClick={on || busy ? camera.stop : () => { camera.openPreview(); void camera.start(); }}>
          {on ? '영상 끄기' : busy ? '영상 요청 취소' : camera.status === 'error' ? '영상 다시 연결' : '내 영상 연결'}
        </button>
        <button type="button" onClick={camera.preview ? camera.closePreview : camera.openPreview}>
          {camera.preview ? '기존 연출로 돌아가기' : '메인 메뉴'}
        </button>
        <span className={styles.cameraState} role="status">
          {on ? '● 카메라 사용 중' : busy ? '카메라 연결 중 · 브라우저 권한 확인' : camera.status === 'error' ? '연결되지 않음' : '카메라 꺼짐'}
        </span>
      </div>
      {camera.preview && (
        <div className={styles.cameraActions}>
          <label className={styles.cameraMirror}>
            <input type="checkbox" checked={camera.mirror} onChange={event => camera.setMirror(event.target.checked)} />
            거울 모드
          </label>
          <RangeField label="얼굴 확대" ariaLabel="얼굴 확대" min={1} max={2} step={0.05} value={camera.zoom}
            display={`${camera.zoom.toFixed(2)}×`} onChange={camera.setZoom} />
          <RangeField label="얼굴 블러" ariaLabel="얼굴 블러" min={0} max={100} step={1} value={camera.blur}
            display={`${camera.blur}%`} onChange={camera.setBlur} />
        </div>
      )}
      {camera.error && <p className={styles.cameraError} role="alert">{camera.error}</p>}
      {on && <p className={styles.cameraNote} role="status">
        {camera.tracking === 'tracking' ? '얼굴 추적 중 · 자동으로 중앙에 맞추고 있어요.'
          : camera.tracking === 'error' ? camera.trackingError
            : camera.tracking === 'searching' ? '얼굴을 찾고 있어요. 카메라를 바라봐 주세요.' : '얼굴 추적 모델을 준비하고 있어요.'}
      </p>}
      <p className={styles.cameraNote}>영상은 메인 메뉴 우측 상단 고정 영역에 표시하며 녹화·전송하지 않습니다. 음성 대화는 메인 메뉴에서 시작합니다.</p>
      {camera.preview && <p className={styles.cameraNote}>얼굴을 영상 영역 안에 자동으로 맞춥니다.</p>}
    </fieldset>
  );
}
