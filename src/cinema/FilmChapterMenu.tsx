import type { CSSProperties } from 'react';
import { FilmChapterIcon } from './FilmChapterIcon';
import { FILM_CHAPTERS, type FilmId } from './filmProgram';
import styles from './film.module.css';

const SHORT_LABELS: Partial<Record<FilmId, string>> = {
  wave: '온습도', gears: '기어', scan: '설비 스캔', unfold: '지표', trace: '변화 추적',
  console: '정보창', bars: '막대', pie: '파이',
  machine: '투명 설비', network: '공정망', energy: '에너지', product: '내부 검사', spc: 'SPC',
};

/** A persistent scene menu; each glyph represents the film it opens. */
export function FilmChapterMenu({ active, disabled, onSelect }: {
  active: FilmId | null; disabled: boolean; onSelect: (id: FilmId) => void;
}) {
  return (
    <nav className={styles.chapterMenu} aria-label="연출 장면 선택"
      style={{ '--film-chapter-count': FILM_CHAPTERS.length } as CSSProperties}>
      {FILM_CHAPTERS.map((chapter, index) => (
        <button key={chapter.id} type="button" className={styles.chapterButton}
          aria-label={`${String(index + 1).padStart(2, '0')} ${chapter.title}`}
          aria-current={active === chapter.id ? 'step' : undefined}
          title={`${chapter.title} · ${chapter.subtitle}`} disabled={disabled} onClick={() => onSelect(chapter.id)}>
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
        </button>
      ))}
    </nav>
  );
}
