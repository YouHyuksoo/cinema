import { useRef, type CSSProperties } from 'react';
import { FilmChapterIcon } from './FilmChapterIcon';
import { FILM_CHAPTERS, type FilmId } from './filmProgram';
import styles from './film.module.css';
import ringStyles from './filmMenuRing.module.css';
import { ringIndex, ringPose } from './filmMenuRing';
import { useFilmMenuRing } from './useFilmMenuRing';

const SHORT_LABELS: Partial<Record<FilmId, string>> = {
  wave: '온습도', gears: '기어', scan: '설비 스캔', unfold: '지표', trace: '변화 추적',
  console: '정보창', bars: '막대', pie: '파이',
  machine: '투명 설비', network: '공정망', energy: '에너지', product: '내부 검사', spc: 'SPC',
};

/** Browsing the ring never starts a scene; activate the aligned tile to launch. */
export function FilmChapterMenu({ active, disabled, onSelect }: {
  active: FilmId | null; disabled: boolean; onSelect: (id: FilmId) => void;
}) {
  const { stage, turn, width, dragging, front, align, pointerActive, blockClick, events } = useFilmMenuRing(FILM_CHAPTERS.findIndex(chapter => chapter.id === active), FILM_CHAPTERS.length, disabled);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const selected = FILM_CHAPTERS[front];
  return (
    <nav className={ringStyles.menu} aria-label="연출 장면 선택" onKeyDown={event => {
      if (disabled || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation();
      const index = event.key === 'Home' ? 0 : event.key === 'End' ? FILM_CHAPTERS.length - 1
        : ringIndex(Math.round(turn) + (event.key === 'ArrowRight' ? 1 : -1), FILM_CHAPTERS.length);
      align(index); buttons.current[index]?.focus({ preventScroll: true });
    }}>
      <div ref={stage} className={ringStyles.stage} data-dragging={dragging} {...events}
        onClickCapture={event => { if (event.detail > 0 && blockClick()) { event.preventDefault(); event.stopPropagation(); } }}>
      <div className={ringStyles.orbit} aria-hidden="true" />
      {FILM_CHAPTERS.map((chapter, index) => {
        const pose = ringPose(index, turn, FILM_CHAPTERS.length, Math.max(40, Math.min(430, width / 2 - 36)));
        return <button key={chapter.id} ref={element => { buttons.current[index] = element; }}
          type="button" className={`${styles.chapterButton} ${ringStyles.tile}`} data-front={index === front}
          tabIndex={index === front ? 0 : -1} aria-describedby="film-ring-hint"
          style={{ '--ring-x': `${pose.x}px`, '--ring-y': `${pose.y}px`, '--ring-z': `${pose.z}px`,
            '--ring-yaw': `${pose.yaw}deg`, '--ring-scale': pose.scale, '--ring-opacity': pose.opacity } as CSSProperties}
          aria-label={`${String(index + 1).padStart(2, '0')} ${chapter.title}`}
          aria-current={active === chapter.id ? 'step' : undefined}
          title={`${chapter.title} · ${chapter.subtitle}`} disabled={disabled}
          onFocus={() => { if (!pointerActive()) align(index); }}
          onClick={() => { if (index === front) onSelect(chapter.id); else align(index); }}>
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
          <strong title={selected.title}>{String(front + 1).padStart(2, '0')} / {FILM_CHAPTERS.length} · {selected.title}</strong>
          <small>{selected.id === active ? '재생 중 · 클릭하면 다시 시작' : '정면 클릭 · Enter로 실행'}</small>
        </div>
        <button type="button" aria-label="다음 메뉴로 회전" disabled={disabled} onClick={() => align(ringIndex(turn + 1, FILM_CHAPTERS.length))}>›</button>
      </div>
      <p id="film-ring-hint" className={ringStyles.hint}>좌우로 밀어 회전 · 방향키로 선택 · 정면 클릭 또는 Enter로 실행</p>
    </nav>
  );
}
