import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFaceTrackingFilter, type FaceBox } from '@/cinema/faceTracking';
import { startFilmFaceTracking, type FilmFaceTrackingDependencies, type FilmFaceTrackingState } from '@/cinema/filmFaceTracking';

const subject: FaceBox = { x: .125, y: .25, width: .25, height: .375 };

describe('local face framing filter', () => {
  it('chooses the largest initial face and keeps the same nearby subject when another appears', () => {
    const filter = createFaceTrackingFilter();
    const small = { x: .72, y: .24, width: .1, height: .15 };
    expect(filter.update([small, subject], 0).face).toEqual(subject);
    const newcomer = { x: .65, y: .2, width: .3, height: .5 };
    const moving = { ...subject, x: .17 };
    const reading = filter.update([newcomer, moving], 100);
    expect(reading.status).toBe('tracking');
    expect(reading.face!.x).toBeGreaterThan(subject.x);
    expect(reading.face!.x).toBeLessThan(moving.x);
    expect(reading.face!.width).toBeCloseTo(subject.width);
  });

  it('holds short detection gaps, then releases a lost face without jumping immediately to a stranger', () => {
    const filter = createFaceTrackingFilter();
    filter.update([subject], 0);
    expect(filter.update([], 600)).toMatchObject({ status: 'tracking', face: subject });
    const stranger = { ...subject, x: .75 };
    expect(filter.update([stranger], 800).face).toEqual(subject);
    expect(filter.update([], 1000)).toEqual({ status: 'searching', face: null });
    expect(filter.update([stranger], 1100).face).toEqual(stranger);
  });

  it('rejects broken detections and clips edge detections to the source video', () => {
    const filter = createFaceTrackingFilter();
    expect(filter.update([
      { ...subject, x: NaN }, { ...subject, width: -1 }, { ...subject, x: 2 },
    ], 0)).toEqual({ status: 'searching', face: null });
    expect(filter.update([{ x: -.1, y: .8, width: .3, height: .4 }], 100).face)
      .toMatchObject({ x: 0, y: .8 });
    const box = filter.update([], 200).face!;
    expect(box.x + box.width).toBeCloseTo(.2);
    expect(box.y + box.height).toBeCloseTo(1);
  });

  it('does not move backward or produce invalid framing on a repeated or invalid timestamp', () => {
    const filter = createFaceTrackingFilter();
    expect(filter.update([subject], NaN).face).toEqual(subject);
    expect(filter.update([{ ...subject, x: .3 }], -1).face).toEqual(subject);
  });
});

function trackingDevice() {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  const worker = {
    onmessage: null as ((event: MessageEvent) => void) | null,
    onerror: null as ((event: ErrorEvent) => void) | null,
    onmessageerror: null as (() => void) | null,
    postMessage: vi.fn(),
    terminate: vi.fn(),
  };
  const video = { readyState: 4, videoWidth: 1280, videoHeight: 720, currentTime: 1 };
  const bitmap = { close: vi.fn() } as unknown as ImageBitmap;
  const states: FilmFaceTrackingState[] = [];
  const dependencies = {
    createWorker: vi.fn(() => worker as unknown as Worker),
    capture: vi.fn(async () => bitmap),
    now: () => Date.now(),
    setTimer: (callback: () => void, milliseconds: number) => setTimeout(callback, milliseconds),
    clearTimer: (timer: ReturnType<typeof setTimeout>) => clearTimeout(timer),
  } satisfies FilmFaceTrackingDependencies;
  return {
    worker, video, bitmap, dependencies, states,
    start: () => startFilmFaceTracking(video as HTMLVideoElement, state => states.push(state), dependencies),
    reply: (data: unknown) => worker.onmessage?.({ data } as MessageEvent),
  };
}

afterEach(() => { vi.useRealTimers(); });

describe('face tracking worker lifecycle', () => {
  it('waits for the model, downsizes frames and transfers only one frame at a time', async () => {
    const device = trackingDevice();
    const stop = device.start();
    expect(device.states).toEqual([{ status: 'loading', face: null, error: null }]);
    expect(device.worker.postMessage).toHaveBeenCalledWith({ type: 'init' });
    expect(device.dependencies.capture).not.toHaveBeenCalled();
    device.reply({ type: 'ready' });
    await Promise.resolve();
    expect(device.dependencies.capture).toHaveBeenCalledWith(device.video, 480, 270);
    expect(device.worker.postMessage).toHaveBeenLastCalledWith(
      { type: 'frame', bitmap: device.bitmap, timestamp: 0 }, [device.bitmap],
    );
    device.video.currentTime = 2;
    await vi.advanceTimersByTimeAsync(400);
    expect(device.dependencies.capture).toHaveBeenCalledOnce();
    device.reply({ type: 'result', boxes: [subject], timestamp: 0 });
    expect(device.states.at(-1)).toEqual({ status: 'tracking', face: subject, error: null });
    await vi.advanceTimersByTimeAsync(100);
    expect(device.dependencies.capture).toHaveBeenCalledTimes(2);
    stop();
    expect(device.worker.terminate).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not repeatedly analyze a frozen video or capture more often than ten times per second', async () => {
    const device = trackingDevice();
    const stop = device.start();
    device.reply({ type: 'ready' }); await Promise.resolve();
    device.reply({ type: 'result', boxes: [], timestamp: 0 });
    await vi.advanceTimersByTimeAsync(300);
    expect(device.dependencies.capture).toHaveBeenCalledOnce();
    device.video.currentTime = 2;
    await vi.advanceTimersByTimeAsync(99);
    expect(device.dependencies.capture).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1);
    expect(device.dependencies.capture).toHaveBeenCalledTimes(2);
    stop();
  });

  it.each(['frozen time', 'unavailable frame'])('clears a stale lock once for %s and recovers on a fresh frame', async reason => {
    const device = trackingDevice();
    const stop = device.start();
    device.reply({ type: 'ready' }); await Promise.resolve();
    device.reply({ type: 'result', boxes: [subject], timestamp: 0 });
    expect(device.states.at(-1)?.status).toBe('tracking');
    if (reason === 'unavailable frame') {
      device.video.readyState = 1;
      device.video.currentTime = 2;
    }
    await vi.advanceTimersByTimeAsync(1400);
    expect(device.states.at(-1)?.status).toBe('tracking');
    await vi.advanceTimersByTimeAsync(100);
    expect(device.states.at(-1)).toEqual({ status: 'searching', face: null, error: null });
    const count = device.states.length;
    await vi.advanceTimersByTimeAsync(1500);
    expect(device.states).toHaveLength(count);
    expect(device.dependencies.capture).toHaveBeenCalledOnce();
    device.video.readyState = 4;
    device.video.currentTime = 3;
    await vi.advanceTimersByTimeAsync(100);
    expect(device.dependencies.capture).toHaveBeenCalledTimes(2);
    const moved = { ...subject, x: .5 };
    device.reply({ type: 'result', boxes: [moved], timestamp: 3100 });
    expect(device.states.at(-1)).toEqual({ status: 'tracking', face: moved, error: null });
    expect(device.worker.terminate).not.toHaveBeenCalled();
    stop();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not reinstate a stale face when an old inference result arrives late', async () => {
    const device = trackingDevice();
    const stop = device.start();
    device.reply({ type: 'ready' }); await Promise.resolve();
    await vi.advanceTimersByTimeAsync(1600);
    device.reply({ type: 'result', boxes: [subject], timestamp: 0 });
    expect(device.states.at(-1)).toEqual({ status: 'searching', face: null, error: null });
    expect(device.dependencies.capture).toHaveBeenCalledOnce();
    stop();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('closes an asynchronous bitmap that finishes after camera tracking is stopped', async () => {
    const device = trackingDevice();
    let finish!: (bitmap: ImageBitmap) => void;
    device.dependencies.capture.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const stop = device.start();
    device.reply({ type: 'ready' });
    stop();
    finish(device.bitmap); await Promise.resolve();
    expect(device.bitmap.close).toHaveBeenCalledOnce();
    expect(device.worker.postMessage).toHaveBeenCalledTimes(1);
    expect(device.states.at(-1)?.status).toBe('searching');
    stop();
    expect(device.worker.terminate).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('surfaces model loading failures and fully tears down the worker', () => {
    const device = trackingDevice();
    device.start();
    device.reply({ type: 'error', stage: 'load' });
    expect(device.states.at(-1)).toMatchObject({ status: 'error', face: null });
    expect(device.states.at(-1)?.error).toContain('모델');
    expect(device.worker.terminate).toHaveBeenCalledOnce();
    expect(device.worker.onmessage).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('fails a stalled model or stalled frame instead of pretending to track', async () => {
    const loading = trackingDevice();
    loading.start();
    await vi.advanceTimersByTimeAsync(20000);
    expect(loading.states.at(-1)?.status).toBe('error');
    expect(loading.worker.terminate).toHaveBeenCalledOnce();
    const frame = trackingDevice();
    frame.start(); frame.reply({ type: 'ready' });
    await vi.advanceTimersByTimeAsync(5000);
    expect(frame.states.at(-1)?.status).toBe('error');
    expect(frame.worker.terminate).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('closes the bitmap when transfer fails and reports capture failures without leaking timers', async () => {
    const device = trackingDevice();
    device.start();
    device.worker.postMessage.mockImplementation(() => { throw new Error('Transfer failed'); });
    device.reply({ type: 'ready' }); await Promise.resolve();
    expect(device.bitmap.close).toHaveBeenCalledOnce();
    expect(device.states.at(-1)?.status).toBe('error');
    expect(vi.getTimerCount()).toBe(0);
  });
});
