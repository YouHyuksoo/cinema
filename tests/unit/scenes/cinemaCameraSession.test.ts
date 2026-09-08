import { describe, expect, it, vi } from 'vitest';
import { createFilmCameraSession, type FilmCameraDependencies } from '@/cinema/filmCameraSession';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function cameraDevice(play: () => Promise<void> = () => Promise.resolve()) {
  const ended = new Set<EventListenerOrEventListenerObject>();
  const track = {
    readyState: 'live',
    stop: vi.fn(),
    addEventListener: vi.fn((_name: string, listener: EventListenerOrEventListenerObject) => ended.add(listener)),
    removeEventListener: vi.fn((_name: string, listener: EventListenerOrEventListenerObject) => ended.delete(listener)),
  };
  const stream = { getTracks: () => [track], getVideoTracks: () => [track] } as unknown as MediaStream;
  const video = {
    muted: false, playsInline: false, autoplay: false, srcObject: null as MediaStream | null,
    play: vi.fn(play), pause: vi.fn(),
  };
  return {
    track, stream, video,
    end() {
      track.readyState = 'ended';
      for (const listener of [...ended]) {
        if (typeof listener === 'function') listener(new Event('ended'));
        else listener.handleEvent(new Event('ended'));
      }
    },
    dependencies: {
      requestStream: vi.fn(async () => stream),
      createVideo: vi.fn(() => video as unknown as HTMLVideoElement),
    } satisfies FilmCameraDependencies,
  };
}

describe('explicit local camera session', () => {
  it('stays off until requested, asks for video only and publishes on only after playback starts', async () => {
    const playback = deferred<void>();
    const device = cameraDevice(() => playback.promise);
    const session = createFilmCameraSession(device.dependencies);
    const frame = session.frame;
    expect(device.dependencies.requestStream).not.toHaveBeenCalled();
    expect(session.getSnapshot()).toEqual({ status: 'off', error: null, mirror: true, zoom: 1.15, blur: 38 });
    const started = session.start();
    await Promise.resolve(); await Promise.resolve();
    expect(device.dependencies.requestStream).toHaveBeenCalledWith({
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false,
    });
    expect(device.video).toMatchObject({ muted: true, autoplay: true, playsInline: true, srcObject: device.stream });
    expect(session.frame.status).toBe('requesting');
    expect(session.frame.video).toBeNull();
    playback.resolve(); await started;
    expect(session.frame).toBe(frame);
    expect(session.frame.status).toBe('on');
    expect(session.frame.video).toBe(device.video);
    session.frame.face = { x: .2, y: .2, width: .3, height: .4 };
    session.frame.tracking = 'tracking';
    session.stop();
    expect(session.frame.video).toBeNull();
    expect(session.frame.face).toBeNull();
    expect(session.frame.tracking).toBe('off');
    expect(device.video.srcObject).toBeNull();
    expect(device.video.pause).toHaveBeenCalledOnce();
    expect(device.track.stop).toHaveBeenCalledOnce();
    expect(device.track.removeEventListener).toHaveBeenCalledOnce();
  });

  it('shares an in-flight request and does not open another stream while already on', async () => {
    const permission = deferred<MediaStream>();
    const device = cameraDevice();
    device.dependencies.requestStream.mockImplementation(() => permission.promise);
    const session = createFilmCameraSession(device.dependencies);
    const first = session.start();
    expect(session.start()).toBe(first);
    await Promise.resolve();
    expect(device.dependencies.requestStream).toHaveBeenCalledOnce();
    permission.resolve(device.stream); await first;
    await session.start();
    expect(device.dependencies.requestStream).toHaveBeenCalledOnce();
    session.stop();
  });

  it('stops a late permission grant without creating a video or reactivating the scene', async () => {
    const permission = deferred<MediaStream>();
    const device = cameraDevice();
    device.dependencies.requestStream.mockImplementation(() => permission.promise);
    const session = createFilmCameraSession(device.dependencies);
    const started = session.start(); await Promise.resolve();
    session.stop(); permission.resolve(device.stream); await started;
    expect(session.getSnapshot().status).toBe('off');
    expect(device.track.stop).toHaveBeenCalledOnce();
    expect(device.dependencies.createVideo).not.toHaveBeenCalled();
  });

  it('does not request permission when setup is immediately cancelled', async () => {
    const device = cameraDevice();
    const session = createFilmCameraSession(device.dependencies);
    const started = session.start(); session.stop(); await started;
    expect(device.dependencies.requestStream).not.toHaveBeenCalled();
    expect(session.getSnapshot().status).toBe('off');
  });

  it('cancels during pending playback and ignores its eventual rejection', async () => {
    const playback = deferred<void>();
    const device = cameraDevice(() => playback.promise);
    const session = createFilmCameraSession(device.dependencies);
    const started = session.start(); await Promise.resolve(); await Promise.resolve();
    session.stop(); playback.reject(new Error('play interrupted')); await started;
    expect(device.track.stop).toHaveBeenCalledOnce();
    expect(device.video.srcObject).toBeNull();
    expect(session.getSnapshot()).toMatchObject({ status: 'off', error: null });
  });

  it('keeps a newer live stream when a cancelled older permission request resolves', async () => {
    const permission = deferred<MediaStream>();
    const oldDevice = cameraDevice(), newDevice = cameraDevice();
    const requestStream = vi.fn().mockImplementationOnce(() => permission.promise).mockResolvedValueOnce(newDevice.stream);
    const session = createFilmCameraSession({ ...newDevice.dependencies, requestStream });
    const oldStart = session.start(); await Promise.resolve(); session.stop();
    await session.start();
    permission.resolve(oldDevice.stream); await oldStart;
    expect(oldDevice.track.stop).toHaveBeenCalledOnce();
    expect(newDevice.track.stop).not.toHaveBeenCalled();
    expect(session.frame).toMatchObject({ status: 'on', video: newDevice.video });
    session.stop();
  });

  it.each([
    ['NotAllowedError', '카메라 권한이 허용되지'],
    ['NotFoundError', '카메라를 찾지 못했'],
    ['NotReadableError', '다른 앱의 카메라 사용'],
    ['NotSupportedError', '카메라를 지원하지'],
  ])('reports %s in Korean and can retry successfully', async (name, message) => {
    const device = cameraDevice();
    device.dependencies.requestStream.mockRejectedValueOnce({ name });
    const session = createFilmCameraSession(device.dependencies);
    await session.start();
    expect(session.getSnapshot()).toMatchObject({ status: 'error', error: expect.stringContaining(message) });
    expect(session.frame.video).toBeNull();
    await session.start();
    expect(session.getSnapshot()).toMatchObject({ status: 'on', error: null });
    session.stop();
  });

  it('also recovers from a synchronous device API failure', async () => {
    const device = cameraDevice();
    device.dependencies.requestStream.mockImplementationOnce(() => { throw { name: 'NotAllowedError' }; });
    const session = createFilmCameraSession(device.dependencies);
    await session.start();
    expect(session.getSnapshot().status).toBe('error');
    await session.start();
    expect(session.getSnapshot().status).toBe('on');
    session.stop();
  });

  it('releases the stream if video playback fails', async () => {
    const device = cameraDevice(() => Promise.reject(new Error('decoder failed')));
    const session = createFilmCameraSession(device.dependencies);
    await session.start();
    expect(session.getSnapshot()).toMatchObject({ status: 'error', error: expect.stringContaining('영상을 재생하지 못했') });
    expect(device.track.stop).toHaveBeenCalledOnce();
    expect(device.video.srcObject).toBeNull();
  });

  it('reports external track termination and removes the stale video', async () => {
    const device = cameraDevice();
    const session = createFilmCameraSession(device.dependencies);
    await session.start(); device.end();
    expect(session.getSnapshot()).toMatchObject({ status: 'error', error: expect.stringContaining('카메라 연결이 종료') });
    expect(session.frame.video).toBeNull();
    expect(device.video.srcObject).toBeNull();
    expect(device.track.stop).toHaveBeenCalledOnce();
    session.stop();
    expect(device.track.stop).toHaveBeenCalledOnce();
  });

  it('handles repeat cleanup, preserves framing settings and can restart after StrictMode cleanup', async () => {
    const device = cameraDevice();
    const session = createFilmCameraSession(device.dependencies);
    const listener = vi.fn(), unsubscribe = session.subscribe(listener);
    const frame = session.frame;
    session.setMirror(false); session.setZoom(9);
    expect(session.getSnapshot()).toMatchObject({ mirror: false, zoom: 2 });
    session.setZoom(-3); expect(session.frame.zoom).toBe(1);
    session.setZoom(NaN); expect(session.frame.zoom).toBe(1);
    session.setZoom(1.35);
    session.stop(); session.stop();
    await session.start();
    expect(session.frame).toBe(frame);
    expect(session.frame).toMatchObject({ mirror: false, zoom: 1.35, status: 'on' });
    unsubscribe(); listener.mockClear(); session.stop(); session.stop();
    expect(listener).not.toHaveBeenCalled();
    expect(device.track.stop).toHaveBeenCalledOnce();
  });
});
