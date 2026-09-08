import { createFaceTrackingFilter, type FaceBox } from './faceTracking';

export interface FilmFaceTrackingState {
  status: 'loading' | 'tracking' | 'searching' | 'error';
  face: FaceBox | null;
  error: string | null;
}

export interface FilmFaceTrackingDependencies {
  createWorker: () => Worker;
  capture: (video: HTMLVideoElement, width: number, height: number) => Promise<ImageBitmap>;
  now: () => number;
  setTimer: (callback: () => void, milliseconds: number) => ReturnType<typeof setTimeout>;
  clearTimer: (timer: ReturnType<typeof setTimeout>) => void;
}

const browserDependencies: FilmFaceTrackingDependencies = {
  createWorker: () => new Worker(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/cinema/face-tracker.worker.js`),
  capture: (video, width, height) => createImageBitmap(video, {
    resizeWidth: width, resizeHeight: height, resizeQuality: 'low',
  }),
  now: () => performance.now(),
  setTimer: (callback, milliseconds) => setTimeout(callback, milliseconds),
  clearTimer: timer => clearTimeout(timer),
};

type WorkerReply = { type: 'ready' } | { type: 'error'; stage?: string }
  | { type: 'result'; boxes: FaceBox[]; timestamp: number };

const STALE_FRAME_MS = 1500;

/** Reads only the supplied video. Camera ownership remains in the camera session. */
export function startFilmFaceTracking(
  video: HTMLVideoElement,
  onUpdate: (state: FilmFaceTrackingState) => void,
  dependencies: FilmFaceTrackingDependencies = browserDependencies,
): () => void {
  let stopped = false;
  let ready = false;
  let busy = false;
  let lastVideoTime = -1;
  let lastFreshFrameTime = 0;
  let stale = false;
  let worker: Worker | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let watchdog: ReturnType<typeof setTimeout> | null = null;
  let filter = createFaceTrackingFilter();

  function stop() {
    if (stopped) return;
    stopped = true;
    if (timer !== null) dependencies.clearTimer(timer);
    if (watchdog !== null) dependencies.clearTimer(watchdog);
    if (worker) {
      worker.onmessage = null;
      worker.onerror = null;
      worker.onmessageerror = null;
      worker.terminate();
      worker = null;
    }
  }

  function fail(message: string) {
    if (stopped) return;
    stop();
    onUpdate({ status: 'error', face: null, error: message });
  }

  function watch(milliseconds: number, message: string) {
    if (watchdog !== null) dependencies.clearTimer(watchdog);
    watchdog = dependencies.setTimer(() => fail(message), milliseconds);
  }

  function releaseStaleFace() {
    if (stale) return;
    stale = true;
    filter = createFaceTrackingFilter();
    onUpdate({ status: 'searching', face: null, error: null });
  }

  async function captureFrame() {
    if (stopped || !ready || busy || video.readyState < 2 || !video.videoWidth || !video.videoHeight
      || lastVideoTime === video.currentTime) return;
    busy = true;
    lastVideoTime = video.currentTime;
    const width = Math.min(480, video.videoWidth);
    const height = Math.max(1, Math.round(video.videoHeight * width / video.videoWidth));
    const timestamp = dependencies.now();
    lastFreshFrameTime = timestamp;
    stale = false;
    watch(5000, '얼굴 분석 응답이 지연됐어요. 카메라를 껐다 켜서 다시 시도해 주세요.');
    let bitmap: ImageBitmap | null = null;
    try {
      bitmap = await dependencies.capture(video, width, height);
      if (stopped || !worker) { bitmap.close(); return; }
      worker.postMessage({ type: 'frame', bitmap, timestamp }, [bitmap]);
      // The worker owns the transferred bitmap and closes it after inference.
      bitmap = null;
    } catch {
      bitmap?.close();
      fail('카메라 프레임을 분석하지 못했어요. 카메라를 껐다 켜서 다시 시도해 주세요.');
    }
  }

  function tick() {
    if (stopped) return;
    // A frozen camera provides no detector result to expire the previous lock.
    if (ready && dependencies.now() - lastFreshFrameTime >= STALE_FRAME_MS) releaseStaleFace();
    void captureFrame();
    if (!stopped) timer = dependencies.setTimer(tick, 100);
  }

  onUpdate({ status: 'loading', face: null, error: null });
  try {
    worker = dependencies.createWorker();
    worker.onmessage = (event: MessageEvent<WorkerReply>) => {
      if (stopped) return;
      const reply = event.data;
      if (reply.type === 'error') {
        fail(reply.stage === 'load'
          ? '얼굴 인식 모델을 불러오지 못했어요. 카메라를 껐다 켜서 다시 시도해 주세요.'
          : '얼굴 분석을 계속할 수 없어요. 카메라를 껐다 켜서 다시 시도해 주세요.');
        return;
      }
      if (watchdog !== null) dependencies.clearTimer(watchdog);
      watchdog = null;
      if (reply.type === 'ready') {
        ready = true;
        lastFreshFrameTime = dependencies.now();
        onUpdate({ status: 'searching', face: null, error: null });
        tick();
      } else {
        busy = false;
        if (dependencies.now() - reply.timestamp >= STALE_FRAME_MS) {
          releaseStaleFace();
          return;
        }
        onUpdate({ ...filter.update(reply.boxes, reply.timestamp), error: null });
      }
    };
    worker.onerror = event => {
      event.preventDefault();
      fail('이 브라우저에서 얼굴 분석을 시작하지 못했어요. 카메라를 껐다 켜서 다시 시도해 주세요.');
    };
    worker.onmessageerror = () => fail('얼굴 분석 결과를 읽지 못했어요. 카메라를 껐다 켜서 다시 시도해 주세요.');
    watch(20000, '얼굴 인식 모델 로딩 시간이 초과됐어요. 카메라를 껐다 켜서 다시 시도해 주세요.');
    worker.postMessage({ type: 'init' });
  } catch {
    fail('이 브라우저에서는 얼굴 자동 추적을 사용할 수 없어요.');
  }
  return stop;
}
