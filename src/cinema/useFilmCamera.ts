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
    setMirror: session.setMirror,
    setZoom: session.setZoom,
    setBlur: session.setBlur,
    tracking: snapshot.status === 'on' ? tracking.status : 'off' as CameraTrackingStatus,
    trackingError: snapshot.status === 'on' ? tracking.error : null,
  };
}

export type FilmCamera = ReturnType<typeof useFilmCamera>;
