import { createElement } from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CUBE_CLOCK_AXES, cubeClockFaces, cubeStickerCell, cubeStickerCharacter, isoWeek } from '@/cinema/cubeClock';
import { CUBE_CUBIES, CUBE_IDENTITY, cubeApplyMove, cubeCubieStickers, cubeInvertSequence, cubeScramble } from '@/cinema/filmMenuCube';
import { FilmMenuCube } from '@/cinema/FilmMenuCubeView';

// Thursday 2026-09-10 10:42:17 local time.
const at = new Date(2026, 8, 10, 10, 42, 17);

describe('cube clock faces', () => {
  it('spreads time, date, year and weekday over nine stickers each', () => {
    const faces = cubeClockFaces(at);
    expect(CUBE_CLOCK_AXES).toEqual(['front', 'right', 'back', 'left']);
    expect(faces.front).toEqual(['1', '0', '시', '4', '2', '분', '1', '7', '초']);
    expect(faces.right).toEqual(['0', '9', '월', '1', '0', '일', '', '', '']);
    expect(faces.back).toEqual(['2', '0', '', '2', '6', '년', '', '', '']);
    expect(faces.left).toEqual(['T', 'H', 'U', '목', '요', '일', '3', '7', '주']);
    for (const axis of CUBE_CLOCK_AXES) expect(faces[axis]).toHaveLength(9);
    expect(cubeClockFaces(new Date(2026, 0, 4, 0, 0, 0)).left.slice(0, 3)).toEqual(['S', 'U', 'N']);
  });
  it('computes ISO week numbers across year boundaries', () => {
    expect(isoWeek(new Date(2026, 8, 10))).toBe(37);
    expect(isoWeek(new Date(2026, 0, 1))).toBe(1);
    expect(isoWeek(new Date(2027, 0, 1))).toBe(53);
    expect(isoWeek(new Date(2024, 11, 30))).toBe(1);
  });
  it('reads a solved cube row-major on every side face, with right/back/left mirrored in world axes', () => {
    expect(cubeStickerCell(CUBE_IDENTITY, { x: -1, y: -1, z: 1 }, 'front')).toEqual({ axis: 'front', row: 0, col: 0 });
    expect(cubeStickerCell(CUBE_IDENTITY, { x: 1, y: 1, z: 1 }, 'front')).toEqual({ axis: 'front', row: 2, col: 2 });
    expect(cubeStickerCell(CUBE_IDENTITY, { x: 1, y: -1, z: 1 }, 'right')).toEqual({ axis: 'right', row: 0, col: 0 });
    expect(cubeStickerCell(CUBE_IDENTITY, { x: 1, y: -1, z: -1 }, 'back')).toEqual({ axis: 'back', row: 0, col: 0 });
    expect(cubeStickerCell(CUBE_IDENTITY, { x: -1, y: -1, z: -1 }, 'left')).toEqual({ axis: 'left', row: 0, col: 0 });
    expect(cubeStickerCell(CUBE_IDENTITY, { x: 0, y: -1, z: 0 }, 'top')).toBeNull();
    const faces = cubeClockFaces(at);
    expect(cubeStickerCharacter(faces, CUBE_IDENTITY, { x: -1, y: -1, z: 1 }, 'front')).toBe('1');
    expect(cubeStickerCharacter(faces, CUBE_IDENTITY, { x: 1, y: 1, z: 1 }, 'front')).toBe('초');
    expect(cubeStickerCharacter(faces, CUBE_IDENTITY, { x: 0, y: 0, z: 0 } as never, 'top')).toBe('');
  });
  it('keeps every cell of every side face filled by exactly one sticker through a scramble and its solution', () => {
    const faces = cubeClockFaces(at);
    let orients = CUBE_CUBIES.map(() => CUBE_IDENTITY);
    const readFaces = () => {
      const seen: Record<string, string[]> = { front: Array(9).fill(undefined), right: Array(9).fill(undefined), back: Array(9).fill(undefined), left: Array(9).fill(undefined) };
      CUBE_CUBIES.forEach((home, index) => {
        for (const axis of cubeCubieStickers(home)) {
          const cell = cubeStickerCell(orients[index], home, axis);
          if (!cell) continue;
          expect(seen[cell.axis][cell.row * 3 + cell.col]).toBeUndefined();
          seen[cell.axis][cell.row * 3 + cell.col] = cubeStickerCharacter(faces, orients[index], home, axis);
        }
      });
      return seen;
    };
    // Characters belong to cells, so the faces read correctly in any state; what changes is which cubie carries them.
    const carried = () => CUBE_CUBIES.map((home, index) => cubeCubieStickers(home).map(axis => cubeStickerCharacter(faces, orients[index], home, axis)).join('|'));
    const solved = readFaces(), solvedCarried = carried();
    for (const axis of CUBE_CLOCK_AXES) expect(solved[axis]).toEqual(faces[axis]);
    const moves = cubeScramble();
    for (const move of moves) orients = cubeApplyMove(orients, move);
    for (const axis of CUBE_CLOCK_AXES) expect(readFaces()[axis]).toEqual(faces[axis]);
    expect(carried()).not.toEqual(solvedCarried);
    for (const move of cubeInvertSequence(moves)) orients = cubeApplyMove(orients, move);
    expect(carried()).toEqual(solvedCarried);
  });
  it('renders an empty character slot in every sticker and styles it as a monospace glyph', () => {
    const html = renderToStaticMarkup(createElement(FilmMenuCube));
    expect(html.match(/data-cube-clock="true"/g)).toHaveLength(54);
    expect(html).not.toMatch(/data-cube-clock="true"[^>]*>[^<]/);
    const css = readFileSync('src/cinema/filmMenuCube.module.css', 'utf8');
    expect(css).toContain('.clockChar { position:absolute; inset:0; display:grid; place-items:center; font:700 calc(var(--cubie-size) * .52)/1 var(--font-mono)');
    expect(css).toContain('.shell:hover .tile:has(.faceIcon) .clockChar,.shell:focus-within .tile:has(.faceIcon) .clockChar { opacity:0; }');
    const view = readFileSync('src/cinema/FilmMenuCubeView.tsx', 'utf8');
    expect(view).toContain('window.setInterval(() => applyClock(), 1000)');
    expect(view).toContain('window.clearInterval(clockTimer)');
  });
});
