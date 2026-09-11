'use client';
import { useEffect, useRef } from 'react';
import { FilmControls } from './FilmControls';
import type { FilmPlayback } from './useFilmPlayback';
import type { FilmCameraMode } from './FilmCameraControls';
import styles from './filmSettingsDialog.module.css';

export function FilmSettingsDialog({ player, camera, onClose }: {
  player: FilmPlayback; camera: FilmCameraMode; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="film-settings-title"
    onCancel={onClose}>
    <header className={styles.header}>
      <h2 id="film-settings-title">연출 설정</h2>
      <button type="button" onClick={onClose} aria-label="연출 설정 닫기">닫기</button>
    </header>
    <div className={styles.content}><FilmControls player={player} camera={camera} /></div>
  </dialog>;
}
