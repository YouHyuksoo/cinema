'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useCameraWindow } from './useCameraWindow';
import { JarvisCamera } from './JarvisCamera';
import type { FilmCamera } from './useFilmCamera';
import styles from './jarvisCameraPopup.module.css';

export function JarvisCameraPopup({ camera, icon = false }: { camera: FilmCamera; icon?: boolean }) {
  const [open, setOpen] = useState(false);
  const placement = useCameraWindow();
  return <>
    <button type="button" className={styles.trigger} aria-haspopup="dialog" aria-label={camera.status === 'on' ? '영상 보기' : '영상 연결'} title="영상 연결" onClick={() => setOpen(true)}>
      {icon ? <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="5" width="13" height="14" rx="2" /><path d="m15 9 7-4v14l-7-4" /></svg> : camera.status === 'on' ? '영상 보기' : '영상 연결'}
    </button>
    {open && placement.bounds && createPortal(<CameraDialog camera={camera} placement={placement}
      onClose={() => { camera.stop(); setOpen(false); }} />, document.body)}
  </>;
}

function CameraDialog({ camera, onClose, placement }: { camera: FilmCamera; onClose(): void; placement: ReturnType<typeof useCameraWindow> }) {
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    return () => previous?.focus?.({ preventScroll: true });
  }, []);
  const connecting = camera.status === 'requesting';
  const active = camera.status === 'on';
  const pointer = { onPointerMove: placement.move, onPointerUp: placement.end, onPointerCancel: placement.end, onLostPointerCapture: placement.end };
  return <div ref={dialog} role="dialog" tabIndex={-1} className={styles.dialog} style={placement.bounds ?? undefined} aria-label="내 영상"
    onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); onClose(); } }}>
    <header tabIndex={0} aria-label="영상 창 이동" onPointerDown={event => placement.start(event, false)} {...pointer}
      onKeyDown={event => {
        if (event.target !== event.currentTarget || !event.key.startsWith('Arrow')) return;
        event.preventDefault(); placement.nudge(event.key === 'ArrowLeft' ? -20 : event.key === 'ArrowRight' ? 20 : 0,
          event.key === 'ArrowUp' ? -20 : event.key === 'ArrowDown' ? 20 : 0);
      }}><h2>내 영상 <small>드래그하여 이동</small></h2><button type="button" onClick={onClose} aria-label="영상 팝업 닫기">닫기</button></header>
    <div className={styles.video}><JarvisCamera camera={camera} /></div>
    <footer>
      <span role="status">{active ? '영상 연결됨' : connecting ? '카메라 연결 중' : '카메라 대기'}</span>
      <button type="button" onClick={active || connecting ? camera.stop : () => void camera.start()}>
        {active ? '영상 끄기' : connecting ? '연결 취소' : '카메라 연결'}
      </button>
    </footer>
    {camera.error && <p role="alert">{camera.error}</p>}
    <small>팝업을 닫으면 카메라 연결도 종료됩니다.</small>
    <button type="button" className={styles.resize} aria-label="영상 창 크기 조절" title="드래그 또는 방향키로 크기 조절"
      onPointerDown={event => placement.start(event, true)} {...pointer}
      onKeyDown={event => {
        if (!event.key.startsWith('Arrow')) return;
        event.preventDefault(); placement.nudge(event.key === 'ArrowLeft' ? -20 : event.key === 'ArrowRight' ? 20 : 0,
          event.key === 'ArrowUp' ? -20 : event.key === 'ArrowDown' ? 20 : 0, true);
      }}>◢</button>
  </div>;
}
