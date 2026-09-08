'use client';

import { type PlaybackMode } from './filmProgram';
import type { FilmPlayback } from './useFilmPlayback';
import { FilmTextureControls } from './FilmTextureControls';
import { FilmChartControls } from './FilmChartControls';
import { FilmThemeControls } from './FilmThemeControls';
import { FilmCameraControls, type FilmCameraMode } from './FilmCameraControls';
import styles from './film.module.css';

const PLAYBACK_RATES = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];

export function FilmControls({ player, camera }: { player: FilmPlayback; camera: FilmCameraMode }) {
  const { chapter, localTime } = player.position;
  return (
    <div className={styles.footer}>
      <FilmCameraControls camera={camera} />
      {!camera.preview && <><div className={styles.chapterDetail}>
        <span>{chapter.subtitle}</span>
        <span className={styles.time}>{localTime.toFixed(1)} / {chapter.duration}초</span>
      </div>
      <input className={styles.seek} type="range" min={0} max={chapter.duration} step={0.1} value={localTime}
        aria-label="현재 장면 재생 위치" aria-valuetext={`${chapter.title} ${localTime.toFixed(1)}초 / ${chapter.duration}초`}
        disabled={!player.ready} onChange={(event) => player.seek(Number(event.target.value))} /></>}
      <FilmThemeControls theme={player.theme} disabled={!player.ready} onChange={player.changeTheme} />
      <FilmTextureControls texture={player.texture} disabled={!player.ready}
        onStyleChange={player.changeTextureStyle} onIntensityChange={player.changeTextureIntensity} />
      {!camera.preview && (chapter.id === 'bars' || chapter.id === 'pie') && (
        <FilmChartControls kind={chapter.id} presentation={player.charts[chapter.id]} disabled={!player.ready}
          onChange={player.changeChartPresentation} />
      )}
      <div className={styles.controlRow}>
        <span className={styles.simulation}>연출 비교 · 시뮬레이션 데이터</span>
        <div className={styles.controls}>
          {!camera.preview && <label className={styles.speedControl}>
            <span>재생 방식</span>
            <select value={player.mode} onChange={(event) => player.changeMode(event.target.value as PlaybackMode)}>
              <option value="sequence">전체 연속</option>
              <option value="chapter">현재 장면 반복</option>
            </select>
          </label>}
          <label className={styles.speedControl}>
            <span>재생 속도</span>
            <select value={player.speed} onChange={(event) => player.changeSpeed(Number(event.target.value))}>
              {PLAYBACK_RATES.map((rate) => <option key={rate} value={rate}>{rate}×{rate === 1 ? ' (기본)' : ''}</option>)}
            </select>
          </label>
          <button disabled={!player.ready} onClick={player.togglePlay}>{player.playing ? '일시정지' : '재생'}</button>
          {!camera.preview && <button disabled={!player.ready} onClick={player.restart}>처음부터</button>}
        </div>
      </div>
    </div>
  );
}
