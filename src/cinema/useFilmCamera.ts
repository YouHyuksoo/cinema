'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createFilmCameraSession, type CameraTrackingStatus } from './filmCameraSession';
import { startFilmFaceTracking } from './filmFaceTracking';

export function useFilmCamera() {
  const [session] = useState(createFilmCameraSession);
  const frameRef = useRef(session.frame);
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  const [tracking, setTracking] = useState<{ status: CameraTrackingStatus; error: string | null }>({ status: 'off', error: null });
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem('cinema.camera.preferences.v1') ?? 'null');
      if (typeof saved?.mirror === 'boolean') session.setMirror(saved.mirror);
      if (typeof saved?.zoom === 'number' && Number.isFinite(saved.zoom)) session.setZoom(saved.zoom);
      if (typeof saved?.blur === 'number' && Number.isFinite(saved.blur)) session.setBlur(saved.blur);
    } catch { /* Unavailable or invalid storage keeps the session defaults. */ }
  }, [session]);
  const savePreferences = () => {
    const { mirror, zoom, blur } = session.getSnapshot();
    try { window.localStorage.setItem('cinema.camera.preferences.v1', JSON.stringify({ mirror, zoom, blur })); } catch { /* Keep the live choice. */ }
  };

  useEffect(() => {
    const video = session.frame.video;
    if (snapshot.status !== 'on' || !video) return;
    const stopTracking = startFilmFaceTracking(video, next => {
      if (session.frame.video !== video || session.frame.status !== 'on') return;
      session.frame.face = next.face;
      session.frame.tracking = next.status;
      setTracking(previous => previous.status === next.status && previous.error === next.error
        ? previous : { status: next.status, error: next.error });
    });
    return () => {
      stopTracking();
      session.frame.face = null;
      session.frame.tracking = 'off';
    };
  }, [session, snapshot.status]);

  useEffect(() => {
    window.addEventListener('pagehide', session.stop);
    return () => {
      window.removeEventListener('pagehide', session.stop);
      session.stop();
    };
  }, [session]);

  return {
    ...snapshot,
    frameRef,
    start: session.start,
    stop: session.stop,
    setMirror(value: boolean) { session.setMirror(value); savePreferences(); },
    setZoom(value: number) { session.setZoom(value); savePreferences(); },
    setBlur(value: number) { session.setBlur(value); savePreferences(); },
    tracking: snapshot.status === 'on' ? tracking.status : 'off' as CameraTrackingStatus,
    trackingError: snapshot.status === 'on' ? tracking.error : null,
  };
}

export type FilmCamera = ReturnType<typeof useFilmCamera>;
