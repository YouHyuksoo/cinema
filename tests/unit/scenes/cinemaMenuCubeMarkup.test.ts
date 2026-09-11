import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FilmDock } from '@/cinema/FilmDock';
import { FILM_CHAPTERS } from '@/cinema/filmProgram';
import { CUBE_FACES, CUBE_STICKERS_PER_FACE } from '@/cinema/filmMenuCube';
import type { FilmPlayback } from '@/cinema/useFilmPlayback';
import type { FilmCameraMode } from '@/cinema/FilmCameraControls';

function renderDock(menuOpen: boolean) {
  const player = { position: { chapter: FILM_CHAPTERS[0], localTime: 0 }, ready: true,
    playing: true, factory: { manual: false } } as FilmPlayback;
  const camera = { preview: true } as FilmCameraMode;
  return renderToStaticMarkup(createElement(FilmDock, { player, camera, menuOpen, onMenuOpenChange() {} }));
}

describe('management cube markup', () => {
  it('keeps overlay chrome pink and the cube faces in Rubik sticker colors', () => {
    const css = readFileSync(new URL('../../../src/cinema/filmMenuCube.module.css', import.meta.url), 'utf8');
    expect(css).toContain('--film-accent:#ff79c6');
    expect(css).toContain('--film-accent-soft:#ffc2e5');
    expect(css).toContain('--film-panel:#282a36');
    expect(css).toContain('--film-muted:#d7b5d8');
    expect(css).toContain('--cube-plastic:#111');
    for (const face of CUBE_FACES) {
      expect(css).toContain(`--cube-sticker:${face.sticker}`);
    }
  });

  it('renders a 3x3 sticker Rubik cube with six faces and a single management control', () => {
    const html = renderDock(false);
    for (const face of CUBE_FACES) {
      expect(html.match(new RegExp(`data-cube-face="${face.id}"`, 'g'))).toHaveLength(9);
      expect(html).toContain(face.label);
    }
    expect(html.match(/data-cube-cubie="/g)).toHaveLength(26);
    expect(html.match(/data-cube-sticker="/g)).toHaveLength(CUBE_FACES.length * CUBE_STICKERS_PER_FACE);
    expect(html.match(/aria-label="메뉴 관리"/g)).toHaveLength(1);
    expect(html).not.toContain('드래그로 이동');
    for (const face of CUBE_FACES) {
      expect(html.match(new RegExp(`data-cube-icon="${face.id}"`, 'g'))).toHaveLength(1);
    }
    expect(html).toContain('data-cube-control="true"');
    expect(html).toContain('data-cube-layer="true"');
  });

  it('renders a closed six-item menu the cube control expands', () => {
    const html = renderDock(false);
    expect(html).toMatch(/<button[^>]*aria-label="메뉴 관리"[^>]*aria-haspopup="menu"[^>]*aria-expanded="false"/);
    expect(html).toMatch(/role="menu"[^>]*aria-label="관리 메뉴"[^>]*data-open="false"/);
    expect(html.match(/role="menuitem"/g)).toHaveLength(7);
    expect(html).toContain('data-cube-menu="fold"');
    for (const face of CUBE_FACES) expect(html).toContain(`data-cube-menu="${face.id}"`);
  });

  it('stays available while the scene ring is open or collapsed', () => {
    for (const menuOpen of [false, true]) {
      const html = renderDock(menuOpen);
      expect(html).toContain('aria-label="메뉴 관리"');
      expect(html).toContain('data-cube-control="true"');
      expect(html.match(/<button[^>]*aria-label="메뉴 관리"[^>]*>/)?.[0] ?? '').not.toContain('hidden=');
    }
  });

  it('keeps the cube overlay from stealing the rest of the viewport', () => {
    const css = readFileSync(new URL('../../../src/cinema/filmMenuCube.module.css', import.meta.url), 'utf8')
      .replace(/\s+/g, ' ');
    expect(css).toMatch(/\.layer\s*{[^}]*position:fixed[^}]*pointer-events:none/);
    expect(css).toMatch(/\.control\s*{[^}]*position:fixed[^}]*touch-action:none/);
    expect(css).toMatch(/\.control\s*{[^}]*pointer-events:auto/);
    expect(css).toMatch(/\.hit,.float\s*{[^}]*animation:cubeFloat 4\.8s ease-in-out infinite/);
    expect(css).toContain('@keyframes cubeFloat');
    expect(css).toContain('translateY(-4px)');
    expect(css).toMatch(/\.cube\s*{[^}]*transform-style:preserve-3d/);
    expect(css).toMatch(/\.cubie\s*{[^}]*transform-style:preserve-3d/);
    expect(css).toMatch(/\.tile\s*{[^}]*border-radius/);
    expect(css).toMatch(/\.faceIcon\s*{[^}]*opacity:0/);
    expect(css).toMatch(/\.shell:hover\s+\.faceIcon[^}]*opacity:1/);
  });
});
