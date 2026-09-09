import { describe, expect, it } from 'vitest';
import {
  CUBE_CUBIES,
  CUBE_FACES,
  CUBE_IDENTITY,
  CUBE_TWIST_DELAY_MS,
  clampCubeCenter,
  cubeApply,
  cubeApplyMove,
  cubeCubieStickers,
  cubeFaceTransform,
  cubeInvertSequence,
  cubeMomentumStep,
  cubeRestingCenter,
  cubeScramble,
  cubeSize,
  isCubeDrag,
} from '@/cinema/filmMenuCube';

describe('floating management cube geometry', () => {
  it.each([
    { width: 1200, height: 805, expected: { x: 106, y: 703 } },
    { width: 390, height: 845, expected: { x: 106, y: 753 } },
    { width: 843, height: 390, expected: { x: 106, y: 306 } },
  ])('docks at bottom left with caption clearance in $width x $height', ({ width, height, expected }) => {
    expect(cubeRestingCenter({ width, height }, cubeSize(width, height))).toEqual(expected);
  });

  it('preserves a dragged center and otherwise uses the current left corner', () => {
    const viewport = { width: 1200, height: 805 }, dragged = { x: 400, y: 300 };
    expect(cubeRestingCenter(viewport, 108, dragged)).toEqual(dragged);
    expect(cubeRestingCenter(viewport, 108, null)).toEqual({ x: 106, y: 703 });
    expect(cubeRestingCenter({ width: 1440, height: 900 }, 108, null)).toEqual({ x: 106, y: 798 });
  });

  it('uses the requested desktop, mobile, and short-screen sizes', () => {
    expect(cubeSize(1440, 900)).toBe(108);
    expect(cubeSize(680, 900)).toBe(88);
    expect(cubeSize(1440, 500)).toBe(72);
    expect(cubeSize(680, 500)).toBe(72);
  });

  it('shrinks only as needed to keep the cube, float, and caption on screen', () => {
    expect(cubeSize(100, 160)).toBe(68);
    expect(cubeSize(30, 30)).toBe(0);
  });

  it('clamps remembered centers with edge, float, and caption clearance', () => {
    expect(clampCubeCenter({ x: -20, y: 900 }, { width: 400, height: 700 }, 108))
      .toEqual({ x: 106, y: 598 });
    expect(clampCubeCenter({ x: 200, y: 455 }, { width: 400, height: 700 }, 108))
      .toEqual({ x: 200, y: 455 });
  });

  it('requires about seven pixels before a pointer gesture suppresses click', () => {
    expect(isCubeDrag({ x: 10, y: 10 }, { x: 16, y: 13 })).toBe(false);
    expect(isCubeDrag({ x: 10, y: 10 }, { x: 17, y: 11 })).toBe(true);
  });

  it('damps release momentum, clamps edges, and disables motion when reduced', () => {
    const moving = cubeMomentumStep(
      { center: { x: 200, y: 350 }, velocity: { x: .4, y: -.2 } },
      16, { width: 800, height: 700 }, 108, false,
    );
    expect(moving.center.x).toBeGreaterThan(200);
    expect(moving.center.y).toBeLessThan(350);
    expect(Math.hypot(moving.velocity.x, moving.velocity.y)).toBeLessThan(Math.hypot(.4, .2));

    const stopped = cubeMomentumStep(
      { center: { x: 200, y: 350 }, velocity: { x: .4, y: -.2 } },
      16, { width: 800, height: 700 }, 108, true,
    );
    expect(stopped).toEqual({ center: { x: 200, y: 350 }, velocity: { x: 0, y: 0 } });

    const edge = cubeMomentumStep(
      { center: { x: 107, y: 350 }, velocity: { x: -1, y: 0 } },
      32, { width: 800, height: 700 }, 108, false,
    );
    expect(edge.center.x).toBe(106);
    expect(edge.velocity.x).toBe(0);
  });

  it('exposes six named faces and a closed cube transform per axis', () => {
    expect(CUBE_FACES.map(face => face.id)).toEqual(['admin', 'ai', 'voice', 'feeds', 'display', 'system']);
    expect(CUBE_FACES.map(face => face.sticker)).toEqual(['#c41e3a', '#0051ba', '#009e60', '#ff6a00', '#f3f3f3', '#ffd500']);
    expect(CUBE_FACES).toHaveLength(6);
    expect(cubeFaceTransform('front', 108)).toBe('rotateY(0deg) translateZ(54px)');
    expect(cubeFaceTransform('back', 108)).toBe('rotateY(180deg) translateZ(54px)');
    expect(cubeFaceTransform('right', 108)).toBe('rotateY(90deg) translateZ(54px)');
    expect(cubeFaceTransform('left', 108)).toBe('rotateY(-90deg) translateZ(54px)');
    expect(cubeFaceTransform('top', 108)).toBe('rotateX(90deg) translateZ(54px)');
    expect(cubeFaceTransform('bottom', 108)).toBe('rotateX(-90deg) translateZ(54px)');
    expect(cubeFaceTransform('front', 0)).toBe('rotateY(0deg) translateZ(0px)');
  });
});

describe('cube layer turns', () => {
  it('builds 26 cubies with nine stickers on each face', () => {
    expect(CUBE_TWIST_DELAY_MS).toBe(1000);
    expect(CUBE_CUBIES).toHaveLength(26);
    expect(CUBE_CUBIES.filter(cubie => cubie.x === 1)).toHaveLength(9);
    expect(CUBE_FACES.reduce((sum, face) => sum + CUBE_CUBIES.filter(cubie => cubeCubieStickers(cubie).includes(face.axis)).length, 0)).toBe(54);
  });

  it('turns a layer in place and restores after four quarter-turns or the inverse', () => {
    const start = CUBE_CUBIES.map(() => CUBE_IDENTITY);
    let turned = start;
    for (let i = 0; i < 4; i++) turned = cubeApplyMove(turned, 'R');
    expect(turned.map((orient, i) => cubeApply(orient, CUBE_CUBIES[i]))).toEqual(CUBE_CUBIES);
    const once = cubeApplyMove(start, 'U');
    const back = cubeApplyMove(once, "U'");
    expect(back.map((orient, i) => cubeApply(orient, CUBE_CUBIES[i]))).toEqual(CUBE_CUBIES);
  });

  it('inverts a scramble back to the solved cube', () => {
    const scramble = cubeScramble(8, 11);
    expect(scramble).toHaveLength(8);
    const solved = cubeInvertSequence(scramble);
    let orients = CUBE_CUBIES.map(() => CUBE_IDENTITY);
    for (const move of scramble) orients = cubeApplyMove(orients, move);
    for (const move of solved) orients = cubeApplyMove(orients, move);
    expect(orients.map((orient, i) => cubeApply(orient, CUBE_CUBIES[i]))).toEqual(CUBE_CUBIES);
  });
});
