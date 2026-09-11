'use client';

import { type PlaybackMode } from './filmProgram';
import type { FilmPlayback } from './useFilmPlayback';
import { FilmTextureControls } from './FilmTextureControls';
import { FilmChartControls } from './FilmChartControls';
import { FilmThemeControls } from './FilmThemeControls';
import { FilmCameraControls, type FilmCameraMode } from './FilmCameraControls';
import { FilmMachineControls } from './FilmMachineControls';
import { MACHINE_PRESENTATIONS } from './machinePresentation';
import { SelectField } from './FilmFields';
import { FilmCenterControls } from './FilmCenterControls';
import { MENU_LAYOUTS } from './filmMenuRing';
import styles from './film.module.css';

const PLAYBACK_RATES = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4].map(rate => ({ value: String(rate), label: `${rate}×${rate === 1 ? ' (기본)' : ''}` }));
const PLAYBACK_MODES = [
  { value: 'sequence', label: '전체 연속' },
  { value: 'chapter', label: '현재 장면 반복' },
] as const satisfies readonly { value: PlaybackMode; label: string }[];

export function FilmControls({ player, camera }: { player: FilmPlayback; camera: FilmCameraMode }) {
  const { chapter, localTime } = player.position;
  const title = chapter.id === 'machine' ? MACHINE_PRESENTATIONS[player.machineSubject].title : chapter.title;
  return (
    <div className={styles.footer}>
      <FilmCameraControls camera={camera} />
      {!camera.preview && <><div className={styles.chapterDetail}>
        <span>{title}</span>
        <span className={styles.time}>{localTime.toFixed(1)} / {chapter.duration}초</span>
      </div>
      <input className={styles.seek} type="range" min={0} max={chapter.duration} step={0.1} value={localTime}
        aria-label="현재 장면 재생 위치" aria-valuetext={`${title} ${localTime.toFixed(1)}초 / ${chapter.duration}초`}
        disabled={!player.ready} onChange={(event) => player.seek(Number(event.target.value))} /></>}
      <FilmThemeControls theme={player.theme} disabled={!player.ready} onChange={player.changeTheme} />
      <FilmCenterControls />
      <div className={styles.textureRow}>
        <SelectField label="메뉴 펼침 방식" value={player.menuLayout ?? 'dock'} options={MENU_LAYOUTS} disabled={!player.ready} onChange={player.changeMenuLayout} />
        <span className={styles.textureDescription}>{(player.menuLayout ?? 'dock') === 'orbit' ? '구체가 화면 안쪽으로 나와 둘레에 장면 링을 펼칩니다' : '구체가 하단 3D 링으로 펼쳐집니다'}</span>
      </div>
      <FilmTextureControls texture={player.texture} disabled={!player.ready}
        onStyleChange={player.changeTextureStyle} onIntensityChange={player.changeTextureIntensity} />
      {!camera.preview && chapter.id === 'machine' && <FilmMachineControls subject={player.machineSubject}
        disabled={!player.ready} onChange={player.changeMachineSubject} />}
      {!camera.preview && (chapter.id === 'bars' || chapter.id === 'pie') && (
        <FilmChartControls kind={chapter.id} presentation={player.charts[chapter.id]} disabled={!player.ready}
          onChange={player.changeChartPresentation} />
      )}
      <div className={styles.controlRow}>
        <span className={styles.simulation}>연출 비교 · 시뮬레이션 데이터</span>
        <div className={styles.controls}>
          {!camera.preview && <SelectField label="재생 방식" value={player.mode} options={PLAYBACK_MODES} onChange={player.changeMode} />}
          <SelectField label="재생 속도" value={String(player.speed)} options={PLAYBACK_RATES} onChange={value => player.changeSpeed(Number(value))} />
          <button disabled={!player.ready} onClick={player.togglePlay}>{player.playing ? '일시정지' : '재생'}</button>
          {!camera.preview && <button disabled={!player.ready} onClick={player.restart}>처음부터</button>}
        </div>
      </div>
    </div>
  );
}
