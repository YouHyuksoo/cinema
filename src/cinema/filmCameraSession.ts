import type { FaceBox } from './faceTracking';

export type FilmCameraStatus = 'off' | 'requesting' | 'on' | 'error';
export type CameraTrackingStatus = 'off' | 'loading' | 'tracking' | 'searching' | 'error';

/** The renderer reads this same object each frame; the video never enters the DOM. */
export interface FilmCameraFrame {
  status: FilmCameraStatus;
  video: HTMLVideoElement | null;
  mirror: boolean;
  zoom: number;
  blur: number;
  face: FaceBox | null;
  tracking: CameraTrackingStatus;
}

export interface FilmCameraSnapshot {
  status: FilmCameraStatus;
  error: string | null;
  mirror: boolean;
  zoom: number;
  blur: number;
}

export interface FilmCameraDependencies {
  requestStream: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
  createVideo: () => HTMLVideoElement;
}

const browserDependencies: FilmCameraDependencies = {
  requestStream(constraints) {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return Promise.reject({ name: 'NotSupportedError' });
    }
    return navigator.mediaDevices.getUserMedia(constraints);
  },
  createVideo: () => document.createElement('video'),
};

function cameraError(error: unknown): string {
  const name = error && typeof error === 'object' && 'name' in error ? error.name : '';
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return '카메라 권한이 허용되지 않았어요. 브라우저의 사이트 권한에서 카메라를 허용한 뒤 다시 켜 주세요.';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return '연결된 카메라를 찾지 못했어요. 카메라 연결을 확인한 뒤 다시 켜 주세요.';
    case 'NotReadableError':
    case 'TrackStartError':
      return '카메라를 사용할 수 없어요. 다른 앱의 카메라 사용과 장치 연결을 확인해 주세요.';
    case 'NotSupportedError':
      return '이 환경에서는 카메라를 지원하지 않아요. localhost 또는 HTTPS 주소에서 지원되는 브라우저로 열어 주세요.';
    case 'CameraEndedError':
      return '카메라 연결이 종료됐어요. 장치 연결과 브라우저 권한을 확인한 뒤 다시 켜 주세요.';
    case 'CameraPlaybackError':
      return '카메라 영상을 재생하지 못했어요. 카메라를 다시 켜 주세요.';
    default:
      return '카메라를 시작하지 못했어요. 장치 연결과 브라우저 권한을 확인한 뒤 다시 켜 주세요.';
  }
}

function stopTracks(stream: MediaStream) {
  for (const track of stream.getTracks()) track.stop();
}

/** Owns one explicitly requested camera, including permission and playback cancellation. */
export function createFilmCameraSession(dependencies: FilmCameraDependencies = browserDependencies) {
  const frame: FilmCameraFrame = { status: 'off', video: null, mirror: true, zoom: 1.15, blur: 38, face: null, tracking: 'off' };
  let snapshot: FilmCameraSnapshot = { status: 'off', error: null, mirror: true, zoom: 1.15, blur: 38 };
  const listeners = new Set<() => void>();
  let generation = 0;
  let pending: Promise<void> | null = null;
  let active: { stream: MediaStream; video: HTMLVideoElement; ended: () => void } | null = null;

  function publish(change: Partial<FilmCameraSnapshot>) {
    snapshot = { ...snapshot, ...change };
    frame.status = snapshot.status;
    frame.mirror = snapshot.mirror;
    frame.zoom = snapshot.zoom;
    frame.blur = snapshot.blur;
    for (const listener of listeners) listener();
  }

  function release() {
    const previous = active;
    active = null;
    frame.video = null;
    frame.face = null;
    frame.tracking = 'off';
    if (!previous) return;
    for (const track of previous.stream.getTracks()) track.removeEventListener('ended', previous.ended);
    previous.video.pause();
    previous.video.srcObject = null;
    stopTracks(previous.stream);
  }

  function stop() {
    generation++;
    pending = null;
    release();
    publish({ status: 'off', error: null });
  }

  async function request(token: number) {
    if (token !== generation) return;
    let stream: MediaStream | null = null;
    try {
      stream = await dependencies.requestStream({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      if (token !== generation) { stopTracks(stream); return; }
      const tracks = stream.getVideoTracks();
      if (!tracks.length || tracks.some(track => track.readyState === 'ended')) throw { name: 'NotReadableError' };
      const video = dependencies.createVideo();
      const ended = () => {
        if (token !== generation) return;
        generation++;
        pending = null;
        release();
        publish({ status: 'error', error: cameraError({ name: 'CameraEndedError' }) });
      };
      active = { stream, video, ended };
      for (const track of stream.getTracks()) track.addEventListener('ended', ended);
      video.muted = true;
      video.playsInline = true;
      video.autoplay = true;
      video.srcObject = stream;
      try { await video.play(); }
      catch { throw { name: 'CameraPlaybackError' }; }
      if (token !== generation) return;
      frame.video = video;
      publish({ status: 'on', error: null });
    } catch (error) {
      if (token !== generation) return;
      if (active) release();
      else if (stream) stopTracks(stream);
      publish({ status: 'error', error: cameraError(error) });
    } finally {
      if (token === generation) pending = null;
    }
  }

  function start(): Promise<void> {
    if (pending) return pending;
    if (snapshot.status === 'on') return Promise.resolve();
    const token = ++generation;
    publish({ status: 'requesting', error: null });
    // Assign ownership before invoking a device API that may throw synchronously.
    pending = Promise.resolve().then(() => request(token));
    return pending;
  }

  return {
    frame,
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    start,
    stop,
    setMirror(mirror: boolean) { publish({ mirror }); },
    setBlur(blur: number) {
      if (Number.isFinite(blur)) publish({ blur: Math.max(0, Math.min(100, blur)) });
    },
    setZoom(zoom: number) {
      if (Number.isFinite(zoom)) publish({ zoom: Math.max(1, Math.min(2, zoom)) });
    },
  };
}
