'use client';
import { useRef } from 'react';
import type { FilmPlayback } from './useFilmPlayback';
import type { FilmCamera } from './useFilmCamera';
import { centerBackgroundPreference, type CenterBackground } from './jarvisCenterBackground';
import { menuLayoutPreference } from './filmMenuPreference';
import { SCREEN_SETTINGS, describeScreenState, validateScreenCommand, type ScreenExecutor } from './screenCommands';
import type { FilmThemeId } from './filmThemes';
import type { FilmTextureStyle } from './filmTexture';
import type { FilmId } from './filmProgram';

export function useScreenCommands(context: {
  player: FilmPlayback; camera: FilmCamera; menuOpen: boolean; settingsOpen: boolean; preview: boolean;
  menu(value: boolean): void; settings(value: boolean): void; home(value: boolean): void;
}) {
  const latest = useRef(context); latest.current = context;
  const snapshot = () => {
    const { player: p, camera: c, menuOpen, settingsOpen, preview } = latest.current;
    return { menu: menuOpen, menuLayout: menuLayoutPreference.getSnapshot(), settings: settingsOpen, home: preview,
      scene: p.position.chapter.id, theme: p.theme, background: centerBackgroundPreference.getSnapshot(), texture: p.texture.style,
      intensity: p.texture.intensity * 100, speed: p.speed, playing: p.playing, mode: p.mode, seek: p.position.localTime,
      machine: p.machineSubject, barsDimension: p.charts.bars.dimension, barsDepth: p.charts.bars.depthScale * 100,
      pieDimension: p.charts.pie.dimension, pieDepth: p.charts.pie.depthScale * 100,
      camera: c.status === 'on', cameraPopup: Boolean(document.querySelector('[role="dialog"][aria-label="내 영상"]')), mirror: c.mirror, zoom: c.zoom, blur: c.blur };
  };
  const execute: ScreenExecutor = async input => {
    const command = validateScreenCommand(input);
    if (!command) return { ok: false, message: '지원하지 않는 설정이나 범위 밖의 값입니다.' };
    const { key, value } = command;
    if (command.action === 'get') return { ok: true, message: describeScreenState(snapshot(), key), state: snapshot() };
    const { player: p, camera: c, menu, settings, home } = latest.current;
    if (!p.ready) return { ok: false, message: '화면을 준비 중입니다. 잠시 후 다시 요청해주세요.' };
    const n = Number(value), on = value === 'true';
    try { switch (key) {
      case 'menu': menu(on); break;
      case 'menuLayout': p.changeMenuLayout(value as 'dock' | 'orbit'); break;
      case 'settings': settings(on); break;
      case 'home': home(on); break;
      case 'scene': home(false); p.selectChapter(value as FilmId); break;
      case 'theme': p.changeTheme(value as FilmThemeId); break;
      case 'background': centerBackgroundPreference.set(value as CenterBackground); break;
      case 'texture': p.changeTextureStyle(value as FilmTextureStyle); break;
      case 'intensity': p.changeTextureIntensity(n / 100); break;
      case 'speed': p.changeSpeed(n); break;
      case 'playing': if (on) p.play(); else p.pause(); break;
      case 'mode': p.changeMode(value as 'chapter' | 'sequence'); break;
      case 'seek': if (n > p.position.chapter.duration) return { ok: false, message: `현재 장면은 ${p.position.chapter.duration}초까지입니다.` }; p.seek(n); break;
      case 'machine': p.changeMachineSubject(value as 'pcb' | 'car'); break;
      case 'barsDimension': case 'pieDimension': p.changeChartPresentation(key === 'barsDimension' ? 'bars' : 'pie', { dimension: value as '2d' | '3d' }); break;
      case 'barsDepth': case 'pieDepth': p.changeChartPresentation(key === 'barsDepth' ? 'bars' : 'pie', { depthScale: n / 100 }); break;
      case 'camera': if (on) { window.dispatchEvent(new CustomEvent('cinema-camera-popup', { detail: true })); await c.start(); } else c.stop(); break;
      case 'cameraPopup': window.dispatchEvent(new CustomEvent('cinema-camera-popup', { detail: on })); break;
      case 'mirror': c.setMirror(on); break;
      case 'zoom': c.setZoom(n); break;
      case 'blur': c.setBlur(n); break;
      default: return { ok: false, message: '이 설정은 현재 화면에 연결되지 않았습니다.' };
    } } catch { return { ok: false, message: '설정 실행에 실패했습니다. 현재 상태를 확인해주세요.', state: snapshot() }; }
    // React commits and external stores settle before checking the actual value.
    await new Promise(resolve => window.setTimeout(resolve, 220));
    const state = snapshot();
    const actual = state[key as keyof typeof state];
    const matches = typeof actual === 'number' ? Math.abs(actual - n) < (key === 'seek' ? 1.5 : .01) : String(actual) === value;
    const setting = SCREEN_SETTINGS.find(s => s.key === key);
    const label = setting?.label ?? key;
    const display = setting?.options?.find(o => o.value === String(actual))?.label ?? actual;
    return { ok: matches, message: matches ? `${label}: ${display} 적용을 확인했습니다.` : `${label} 변경을 확인하지 못했습니다. 현재 값: ${display}`, state };
  };
  return execute;
}
