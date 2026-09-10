import { useEffect, useImperativeHandle, useRef, type CSSProperties, type Ref } from 'react';
import { FilmChapterIcon } from './FilmChapterIcon';
import { FILM_CHAPTERS, type FilmId } from './filmProgram';
import styles from './film.module.css';
import ringStyles from './filmMenuRing.module.css';
import { orbitPose, ringIndex, ringPose, type MenuLayout } from './filmMenuRing';
import { useFilmMenuRing } from './useFilmMenuRing';
import { FilmMenuGlobe } from './FilmMenuGlobeView';
import { useFilmMenuGlobe } from './useFilmMenuGlobe';
import { pad2 } from './filmMath';

const SHORT_LABELS: Partial<Record<FilmId, string>> = {
  wave: '온습도', gears: '기어', scan: '설비 스캔', unfold: '지표', trace: '변화 추적',
  console: '정보창', bars: '막대', pie: '파이',
  machine: 'PCB 검사', network: '공정망', energy: '에너지', product: '내부 검사', spc: 'SPC', cctv: 'CCTV',
};

/** Browsing the ring never starts a scene; activate the aligned tile to launch. */
export function FilmChapterMenu({ active, disabled, onSelect, menuOpen = true, onExpand, onCollapse, globeButtonRef, onOpened, layout = 'dock' }: {
  active: FilmId | null; disabled: boolean; onSelect: (id: FilmId) => void;
  menuOpen?: boolean; onExpand?: () => void; onCollapse?: () => void; globeButtonRef?: Ref<HTMLButtonElement>;
  onOpened?: () => void;
  /** `dock`: tiles unfold into the bottom ring; `orbit`: tiles circle the globe where it floats. */
  layout?: MenuLayout;
}) {
  const { stage, turn, width, dragging, front, align, pointerActive, blockClick, events } = useFilmMenuRing(FILM_CHAPTERS.findIndex(chapter => chapter.id === active), FILM_CHAPTERS.length, disabled || !menuOpen);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const globe = useFilmMenuGlobe(menuOpen, turn, FILM_CHAPTERS.length, stage, buttons, layout);
  useImperativeHandle(globeButtonRef, () => globe.control.current as HTMLButtonElement);
  const ringBlocked = !menuOpen || globe.phase !== 'open';
  const pendingOpen = useRef(!menuOpen);
  useEffect(() => {
    if (!menuOpen) pendingOpen.current = true;
    else if (globe.phase === 'open' && pendingOpen.current) {
      pendingOpen.current = false; onOpened?.();
    }
  }, [menuOpen, globe.phase, onOpened]);
  const selected = FILM_CHAPTERS[front];
  return (
    <nav className={ringStyles.menu} data-menu-open={menuOpen} data-menu-phase={globe.phase} data-menu-layout={layout} aria-label="연출 장면 선택" onKeyDown={event => {
      if (disabled || ringBlocked || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation();
      const index = event.key === 'Home' ? 0 : event.key === 'End' ? FILM_CHAPTERS.length - 1
        : ringIndex(Math.round(turn) + (event.key === 'ArrowRight' ? 1 : -1), FILM_CHAPTERS.length);
      align(index); buttons.current[index]?.focus({ preventScroll: true });
    }}>
      <div data-ring-controls="true" className={ringStyles.ringControls} inert={ringBlocked} aria-hidden={ringBlocked}>
      <div ref={stage} className={ringStyles.stage} data-dragging={dragging} {...events}
        onClickCapture={event => { if (ringBlocked || (event.detail > 0 && blockClick())) { event.preventDefault(); event.stopPropagation(); } }}>
      <div className={ringStyles.orbit} aria-hidden="true" />
      {FILM_CHAPTERS.map((chapter, index) => {
        const pose = layout === 'orbit' ? orbitPose(index, turn, FILM_CHAPTERS.length, 1) : ringPose(index, turn, FILM_CHAPTERS.length, Math.max(40, Math.min(430, width / 2 - 36)));
        const placement = layout === 'orbit'
          ? { '--orbit-angle': `${(pose as ReturnType<typeof orbitPose>).angle}rad`, '--ring-scale': pose.scale, '--ring-opacity': pose.opacity }
          : { '--ring-x': `${pose.x}px`, '--ring-y': `${pose.y}px`, '--ring-z': `${pose.z}px`, '--ring-yaw': `${pose.yaw}deg`, '--ring-scale': pose.scale, '--ring-opacity': pose.opacity };
        return <button key={chapter.id} ref={element => { buttons.current[index] = element; }}
          type="button" className={`${styles.chapterButton} ${ringStyles.tile}`} data-front={index === front}
          tabIndex={index === front ? 0 : -1} aria-describedby="film-ring-hint"
          style={placement as CSSProperties}
          aria-label={`${pad2(index + 1)} ${chapter.title}`}
          aria-current={active === chapter.id ? 'step' : undefined}
          title={`${chapter.title} · ${chapter.subtitle}`} disabled={disabled}
          onFocus={() => { if (!ringBlocked && !pointerActive()) align(index); }}
          onClick={() => { if (ringBlocked) return; if (index === front) onSelect(chapter.id); else align(index); }}>
          <span className={styles.hexTile} aria-hidden="true">
            <svg className={styles.hexFrame} viewBox="0 0 64 72" fill="none" focusable="false">
              <path className={styles.hexBack} d="M32 7 60 23v32L32 71 4 55V23Z" />
              <path className={styles.hexFace} d="M32 1 60 17v32L32 65 4 49V17Z" />
              <path className={styles.hexInset} d="m32 7 23 13v26L32 59 9 46V20Z" />
              <path className={styles.hexAccent} d="m4 26 0-9L32 1l28 16v9M23 60l9 5 9-5" />
            </svg>
            <FilmChapterIcon id={chapter.id} className={styles.chapterIcon} />
          </span>
          <span className={styles.chapterLabel}>{SHORT_LABELS[chapter.id] ?? chapter.title}</span>
        </button>;
      })}
      </div>
      <div className={ringStyles.controls}>
        <button type="button" aria-label="이전 메뉴로 회전" disabled={disabled} onClick={() => align(ringIndex(turn - 1, FILM_CHAPTERS.length))}>‹</button>
        <div className={ringStyles.readout} aria-live={dragging ? 'off' : 'polite'} aria-atomic="true">
          <strong title={selected.title}>{pad2(front + 1)} / {FILM_CHAPTERS.length} · {selected.title}</strong>
          <small>{selected.id === active ? '재생 중 · 클릭하면 다시 시작' : '정면 클릭 · Enter로 실행'}</small>
        </div>
        <button type="button" aria-label="다음 메뉴로 회전" disabled={disabled} onClick={() => align(ringIndex(turn + 1, FILM_CHAPTERS.length))}>›</button>
      </div>
      <p id="film-ring-hint" className={ringStyles.hint}>좌우로 밀어 회전 · 방향키로 선택 · 정면 클릭 또는 Enter로 실행</p>
      </div>
      <FilmMenuGlobe menuOpen={menuOpen} onExpand={onExpand} onCollapse={onCollapse} layout={layout}
        layerRef={globe.layer} floatRef={globe.float} controlRef={globe.control}
        faces={globe.faces} ballRef={globe.ball} events={globe.events} blockClick={globe.blockClick} />
    </nav>
  );
}
