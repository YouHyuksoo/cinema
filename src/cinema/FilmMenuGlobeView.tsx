import type { ComponentPropsWithoutRef, RefObject } from 'react';
import { FILM_CHAPTERS } from './filmProgram';
import { FilmChapterIcon } from './FilmChapterIcon';
import filmStyles from './film.module.css';
import styles from './filmMenuGlobe.module.css';

export function FilmMenuGlobe({ menuOpen, onExpand, layerRef, floatRef, faces, ballRef,
  controlRef, events, blockClick }: {
  menuOpen: boolean; onExpand?: () => void;
  layerRef: RefObject<HTMLDivElement | null>; floatRef: RefObject<HTMLDivElement | null>;
  faces: RefObject<(HTMLSpanElement | null)[]>;
  ballRef: RefObject<HTMLCanvasElement | null>;
  controlRef: RefObject<HTMLButtonElement | null>;
  events: Pick<ComponentPropsWithoutRef<'button'>, 'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerCancel' | 'onLostPointerCapture'>;
  blockClick: () => boolean;
}) {
  return <div className={styles.shell}>
    <div ref={layerRef} className={styles.layer} aria-hidden="true" data-globe-layer="true">
      <div ref={floatRef} className={styles.float}>
        <canvas ref={ballRef} className={styles.ball} data-globe-ball="true" />
        {FILM_CHAPTERS.map((chapter, index) => <span key={chapter.id}
          ref={node => { faces.current[index] = node; }} data-globe-face={chapter.id} className={styles.face}>
          <svg className={filmStyles.hexFrame} viewBox="0 0 64 72" fill="none" focusable="false">
            <path className={filmStyles.hexBack} d="M32 7 60 23v32L32 71 4 55V23Z" />
            <path className={filmStyles.hexFace} d="M32 1 60 17v32L32 65 4 49V17Z" />
            <path className={filmStyles.hexInset} d="m32 7 23 13v26L32 59 9 46V20Z" />
            <path className={filmStyles.hexAccent} d="m4 26 0-9L32 1l28 16v9M23 60l9 5 9-5" />
          </svg>
          <FilmChapterIcon id={chapter.id} className={filmStyles.chapterIcon} />
        </span>)}
      </div>
    </div>
    {onExpand && <button ref={controlRef} type="button" className={styles.expand}
      data-globe-control="true" {...events}
      aria-label="하단 메뉴 펼치기" aria-expanded={menuOpen} aria-controls="film-dock-panel"
      hidden={menuOpen} onClick={event => {
        event.stopPropagation();
        if (event.detail > 0 && blockClick()) { event.preventDefault(); return; }
        onExpand?.();
      }} />}
  </div>;
}
