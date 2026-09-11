import { describe, expect, it } from 'vitest';
import {
  GLOBE_AWAKE_SCALE, GLOBE_GROW_MS, GLOBE_REST_DELAY_MS, GLOBE_REST_SCALE, GLOBE_SHRINK_MS, globeRestScale, globeRestStep,
  clampGlobeCenter,
  globeDiameter,
  globeFaceSize,
  globeMomentumStep,
  globePose,
  globeRestingCenter,
  isGlobeDrag,
  mixMenuPose,
  SOCCER_INSET_SEAMS,
  SOCCER_PANELS,
  SOCCER_SEAMS,
  soccerHexPoses,
  soccerHexScreenPoses,
  soccerPattern,
  soccerSeamPoses,
} from '@/cinema/filmMenuGlobe';
import { ringPose } from '@/cinema/filmMenuRing';

describe('floating menu globe geometry', () => {
  it('reanchors on both viewport growth and shrink instead of retaining old pixels', () => {
    const small = { width: 800, height: 600 }, large = { width: 1440, height: 900 };
    const remembered = { x: 400, y: 300 };
    for (const [before, after] of [[small, large], [large, small]]) {
      const size = globeDiameter(after.width, after.height) * .5;
      expect(globeRestingCenter(after, size, remembered, before))
        .toEqual(globeRestingCenter(after, size));
    }
    expect(globeRestingCenter(large, 120, remembered, large)).toEqual(remembered);
  });
  it.each([
    { width: 1200, height: 805, expected: { x: 1064, y: 637 } },
    // Desktop keeps the 16px edge and 28px bottom clearance; small screens (≤680 wide or ≤480 tall) tuck 6px into the corner.
    { width: 390, height: 845, expected: { x: 324, y: 775 } },
    { width: 843, height: 390, expected: { x: 777, y: 320 } },
  ])('docks at bottom right with edge clearance in $width x $height', ({ width, height, expected }) => {
    expect(globeRestingCenter({ width, height }, globeDiameter(width, height))).toEqual(expected);
  });

  it('preserves a dragged center until collapse clears it, then uses the current viewport corner', () => {
    const viewport = { width: 1200, height: 805 }, dragged = { x: 400, y: 300 };
    expect(globeRestingCenter(viewport, 240, dragged)).toEqual(dragged);
    expect(globeRestingCenter(viewport, 240, null)).toEqual({ x: 1064, y: 637 });
    expect(globeRestingCenter({ width: 1440, height: 900 }, 240, null)).toEqual({ x: 1304, y: 732 });
  });

  it('rests on the signal scanner axis when one is published, clamped to the edge', () => {
    // Bottom clearance is unchanged; only the horizontal anchor moves from the corner to the axis.
    expect(globeRestingCenter({ width: 1440, height: 900 }, 240, null, undefined, 1280)).toEqual({ x: 1280, y: 732 });
    expect(globeRestingCenter({ width: 1440, height: 900 }, 240, null, undefined, 1400)).toEqual({ x: 1304, y: 732 });
    // A remembered drag position still wins over the axis, and NaN falls back to the corner.
    expect(globeRestingCenter({ width: 1440, height: 900 }, 240, { x: 400, y: 300 }, undefined, 1280)).toEqual({ x: 400, y: 300 });
    expect(globeRestingCenter({ width: 1440, height: 900 }, 240, null, undefined, Number.NaN)).toEqual({ x: 1304, y: 732 });
  });

  it('uses the requested desktop, mobile, and short-screen diameters', () => {
    expect(globeDiameter(1440, 900)).toBe(240);
    expect(globeDiameter(1000, 900)).toBe(240);
    expect(globeDiameter(680, 900)).toBe(177);
    expect(globeDiameter(1440, 500)).toBe(150);
    expect(globeDiameter(680, 500)).toBe(150);
    expect(globeDiameter(400, 900)).toBe(120);
  });

  it('shrinks only as needed to keep the globe, float, and caption on screen', () => {
    expect(globeDiameter(200, 900)).toBe(120);
    expect(globeDiameter(900, 160)).toBe(92);
    expect(globeDiameter(30, 30)).toBe(0);
  });

  it('clamps remembered centers with edge, float, and caption clearance', () => {
    expect(clampGlobeCenter({ x: -20, y: 900 }, { width: 400, height: 700 }, 240))
      .toEqual({ x: 126, y: 570 });
    expect(clampGlobeCenter({ x: -20, y: 900 }, { width: 1000, height: 700 }, 240))
      .toEqual({ x: 136, y: 532 });
    expect(clampGlobeCenter({ x: 200, y: 455 }, { width: 400, height: 700 }, 240))
      .toEqual({ x: 200, y: 455 });
    expect(clampGlobeCenter({ x: 0, y: 350 }, { width: 360, height: 700 }, 180).x).toBe(96);
    expect(clampGlobeCenter({ x: 999, y: 350 }, { width: 360, height: 700 }, 180).x).toBe(264);
  });

  it('requires about seven pixels before a pointer gesture suppresses click', () => {
    expect(isGlobeDrag({ x: 10, y: 10 }, { x: 16, y: 13 })).toBe(false);
    expect(isGlobeDrag({ x: 10, y: 10 }, { x: 17, y: 11 })).toBe(true);
  });

  it('damps release momentum, clamps edges, and disables motion when reduced', () => {
    const moving = globeMomentumStep(
      { center: { x: 200, y: 350 }, velocity: { x: .4, y: -.2 } },
      16, { width: 800, height: 700 }, 240, false,
    );
    expect(moving.center.x).toBeGreaterThan(200);
    expect(moving.center.y).toBeLessThan(350);
    expect(Math.hypot(moving.velocity.x, moving.velocity.y)).toBeLessThan(Math.hypot(.4, .2));

    const stopped = globeMomentumStep(
      { center: { x: 200, y: 350 }, velocity: { x: .4, y: -.2 } },
      16, { width: 800, height: 700 }, 240, true,
    );
    expect(stopped).toEqual({ center: { x: 200, y: 350 }, velocity: { x: 0, y: 0 } });

    const edge = globeMomentumStep(
      { center: { x: 679, y: 350 }, velocity: { x: 1, y: 0 } },
      32, { width: 800, height: 700 }, 240, false,
    );
    expect(edge.center.x).toBe(664);
    expect(edge.velocity.x).toBe(0);
  });

  it('places distinct centers on the sphere at every rotation', () => {
    for (const angle of [0, .9, Math.PI, Math.PI * 2]) {
      const poses = Array.from({ length: 16 }, (_, i) => globePose(i, 16, 56, angle));
      expect(new Set(poses.map(p => `${p.x},${p.y},${p.z}`)).size).toBe(16);
      for (const pose of poses) {
        expect(Math.hypot(pose.x, pose.y, pose.z)).toBeCloseTo(56);
        expect(Object.values(pose).every(Number.isFinite)).toBe(true);
      }
    }
  });

  it('orients CSS rotateY then rotateX normals outward', () => {
    for (let i = 0; i < 16; i++) {
      const pose = globePose(i, 16, 56, .8);
      const yaw = pose.yaw * Math.PI / 180, pitch = pose.pitch * Math.PI / 180;
      expect(Math.sin(yaw) * Math.cos(pitch)).toBeCloseTo(pose.x / 56);
      expect(-Math.sin(pitch)).toBeCloseTo(pose.y / 56);
      expect(Math.cos(yaw) * Math.cos(pitch)).toBeCloseTo(pose.z / 56);
    }
  });

  it('returns the same geometry after a full revolution', () => {
    const first = globePose(5, 16, 56, .3), full = globePose(5, 16, 56, .3 + Math.PI * 2);
    for (const key of ['x', 'y', 'z', 'yaw', 'pitch', 'scale', 'opacity'] as const) {
      expect(full[key]).toBeCloseTo(first[key]);
    }
  });

  it('bounds every face diameter to leave a gap between all centers', () => {
    for (const count of [2, 3, 16, 32]) {
      const size = globeFaceSize(count, 56);
      expect(size).toBeGreaterThan(0);
      const poses = Array.from({ length: count }, (_, i) => globePose(i, count, 56, .9));
      for (let i = 0; i < count; i++) for (let j = i + 1; j < count; j++) {
        const distance = Math.hypot(poses[i].x - poses[j].x, poses[i].y - poses[j].y, poses[i].z - poses[j].z);
        expect(size).toBeLessThanOrEqual(distance * .75 + 1e-10);
      }
      expect(globeFaceSize(count, 28)).toBeCloseTo(size / 2);
    }
  });

  it('handles empty and single-face menus with finite geometry', () => {
    expect(globePose(0, 0, 56, 0)).toEqual({ x: 0, y: 0, z: 0, yaw: 0, pitch: 0, scale: 0, opacity: 0 });
    expect(globeFaceSize(0, 56)).toBe(0);
    const single = globePose(0, 1, 56, 0);
    expect(single.x).toBe(0);
    expect(single.y).toBe(0);
    expect(single.z).toBe(56);
    expect(globeFaceSize(1, 56)).toBe(42);
  });

  it('rejects invalid counts, wraps indices, and sanitizes nonfinite inputs', () => {
    for (const count of [NaN, Infinity, -1, 1.5]) {
      expect(globePose(0, count, 56, 0).opacity).toBe(0);
      expect(globeFaceSize(count, 56)).toBe(0);
    }
    expect(globePose(-1, 16, 56, 0)).toEqual(globePose(15, 16, 56, 0));
    expect(globePose(NaN, 16, 56, Infinity)).toEqual(globePose(0, 16, 56, 0));
    for (const radius of [NaN, Infinity, -56, 0, Number.MAX_VALUE]) {
      expect(Object.values(globePose(0, 16, radius, NaN)).every(Number.isFinite)).toBe(true);
      expect(Number.isFinite(globeFaceSize(2, radius))).toBe(true);
    }
  });
});

describe('menu pose transition', () => {
  const from = { x: 0, y: 10, z: -10, yaw: 170, pitch: 20, scale: 1, opacity: .4 };
  const to = { x: 20, y: -10, z: 10, yaw: -170, pitch: -20, scale: .5, opacity: 1 };

  it('preserves endpoints and clamps progress', () => {
    expect(mixMenuPose(from, to, 0)).toEqual(from);
    expect(mixMenuPose(from, to, 1)).toEqual(to);
    expect(mixMenuPose(from, to, -1)).toEqual(from);
    expect(mixMenuPose(from, to, 2)).toEqual(to);
    expect(mixMenuPose(from, to, NaN)).toEqual(from);
    expect(mixMenuPose(from, to, Infinity)).toEqual(to);
  });

  it('interpolates coordinates and appearance while crossing the shortest angular seam', () => {
    expect(mixMenuPose(from, to, .5)).toEqual({ x: 10, y: 0, z: 0, yaw: 180, pitch: 0, scale: .75, opacity: .7 });
    const forward = mixMenuPose(from, to, .25), reverse = mixMenuPose(to, from, .75);
    expect(reverse.x).toBe(forward.x);
    expect(reverse.pitch).toBe(forward.pitch);
    expect(Math.cos(reverse.yaw * Math.PI / 180)).toBeCloseTo(Math.cos(forward.yaw * Math.PI / 180));
    expect(Math.sin(reverse.yaw * Math.PI / 180)).toBeCloseTo(Math.sin(forward.yaw * Math.PI / 180));
  });

  it('accepts existing ring poses with a zero pitch default', () => {
    const ring = ringPose(0, 0, 16, 300);
    expect(mixMenuPose(ring, globePose(0, 16, 56, 0), 0)).toEqual({ ...ring, pitch: 0 });
  });
});

describe('globe resting size', () => {
  it('grows to 70% on hover and shrinks immediately when idle', () => {
    expect(GLOBE_AWAKE_SCALE).toBeCloseTo(.7);
    expect(globeRestScale(0)).toBe(GLOBE_AWAKE_SCALE);
    expect(globeRestScale(1)).toBe(GLOBE_REST_SCALE);
    expect(GLOBE_REST_DELAY_MS).toBe(0);
    let rest = 0;
    rest = globeRestStep(rest, 0, 16, false);
    expect(rest).toBeGreaterThan(0);
    for (let idle = 0; idle < GLOBE_SHRINK_MS + 16; idle += 16) rest = globeRestStep(rest, idle, 16, false);
    expect(rest).toBe(1);
    expect(globeRestScale(.5)).toBeGreaterThan(GLOBE_REST_SCALE);
    expect(globeRestScale(.5)).toBeLessThan(GLOBE_AWAKE_SCALE);
    let grown = rest;
    for (let step = 0; step < GLOBE_GROW_MS / 16 + 1; step++) grown = globeRestStep(grown, 0, 16, true);
    expect(grown).toBe(0);
  });
});

describe('soccer ball globe lattice', () => {
  it('wraps the globe with inset panels that leave gaps between cells', () => {
    expect(SOCCER_PANELS).toHaveLength(32);
    expect(SOCCER_INSET_SEAMS).toHaveLength(180);
    expect(SOCCER_SEAMS).toHaveLength(90);
    const hexes = soccerHexPoses(56, .4);
    expect(hexes).toHaveLength(20);
    for (const pose of hexes) expect(Math.hypot(pose.x, pose.y, pose.z)).toBeCloseTo(56);
    const shared = SOCCER_SEAMS[0];
    expect(soccerPattern({ x: shared.a.x + shared.b.x, y: shared.a.y + shared.b.y, z: shared.a.z + shared.b.z })).toBe('gap');
    const inset = SOCCER_INSET_SEAMS[0];
    expect(soccerPattern({ x: inset.a.x + inset.b.x, y: inset.a.y + inset.b.y, z: inset.a.z + inset.b.z })).toBe('seam');
    const cell = soccerHexPoses(1, 0)[0];
    expect(soccerPattern({ x: cell.x, y: cell.y, z: cell.z })).toBe('cell');
  });

  it('orients hex cells outward so chapter tiles can sit on the surface', () => {
    const hexes = soccerHexPoses(56, .8);
    for (const pose of hexes) {
      const yaw = pose.yaw * Math.PI / 180, pitch = pose.pitch * Math.PI / 180;
      expect(Math.sin(yaw) * Math.cos(pitch)).toBeCloseTo(pose.x / 56);
      expect(-Math.sin(pitch)).toBeCloseTo(pose.y / 56);
      expect(Math.cos(yaw) * Math.cos(pitch)).toBeCloseTo(pose.z / 56);
    }
  });

  it('projects hex menus with the same orthographic rotation as the painted sphere', () => {
    const cells = soccerHexPoses(1, 0);
    const front = cells.reduce((best, pose, index, list) => pose.z > list[best].z ? index : best, 0);
    const screens = soccerHexScreenPoses(100, 0);
    const nearest = screens.reduce((best, pose, index, list) =>
      Math.hypot(pose.x, pose.y) < Math.hypot(list[best].x, list[best].y) ? index : best, 0);
    expect(nearest).toBe(front);
    expect(screens[front].opacity).toBeGreaterThan(.8);
    const right = cells.reduce((best, pose, index, list) => pose.x > list[best].x ? index : best, 0);
    const turn = Math.atan2(cells[right].x, cells[right].z);
    const turned = soccerHexScreenPoses(100, turn);
    const nearestTurned = turned.reduce((best, pose, index, list) =>
      Math.hypot(pose.x, pose.y) < Math.hypot(list[best].x, list[best].y) ? index : best, 0);
    expect(nearestTurned).toBe(right);
    expect(screens.filter(pose => pose.opacity > .15).length).toBeGreaterThan(6);
  });

  it('returns the same lattice after a full revolution and hides invalid radii', () => {
    const first = soccerSeamPoses(56, .3), full = soccerSeamPoses(56, .3 + Math.PI * 2);
    first.forEach((pose, index) => {
      expect(full[index].x).toBeCloseTo(pose.x);
      expect(full[index].y).toBeCloseTo(pose.y);
      expect(full[index].z).toBeCloseTo(pose.z);
      expect(full[index].length).toBeCloseTo(pose.length);
    });
    expect(soccerSeamPoses(0, 0).every(seam => seam.length === 0)).toBe(true);
    expect(soccerHexPoses(NaN, 1).every(pose => pose.opacity === 0)).toBe(true);
  });
});

describe('turbine mirrors the globe on small screens', () => {
  it('folds the turbine to the globe diameter and opens it only as far as the left edge allows', async () => {
    const { turbineOrbMetrics, TURBINE_ART_SIZE, TURBINE_FOLDED_EXTENT, TURBINE_CORNER_INSET, GLOBE_REST_SCALE } = await import('@/cinema/filmMenuGlobe');
    // Phone: layout diameter 120 → the globe rests at 60px; the folded rotor (¾ of its plate) matches that visually.
    const phone = turbineOrbMetrics(globeDiameter(390, 844));
    expect(phone.diameter).toBe(120 * GLOBE_REST_SCALE);
    expect(phone.scale).toBeCloseTo(60 / (TURBINE_ART_SIZE * TURBINE_FOLDED_EXTENT));
    expect(phone.scale * TURBINE_ART_SIZE * TURBINE_FOLDED_EXTENT).toBeCloseTo(60);
    // Tucked 6px into the corner the hub is only 36px from the edge, so opening cannot grow the rotor; it only unfurls.
    expect(phone.openScale).toBe(phone.scale);
    const tablet = turbineOrbMetrics(globeDiameter(680, 900));
    expect(tablet.diameter).toBe(177 * GLOBE_REST_SCALE);
    expect(tablet.openScale).toBeGreaterThanOrEqual(tablet.scale);
    expect(tablet.openScale).toBeLessThanOrEqual(Math.max(tablet.scale, (TURBINE_CORNER_INSET + tablet.diameter / 2) / (TURBINE_ART_SIZE / 2)) + 1e-9);
    expect(turbineOrbMetrics(Number.NaN)).toEqual({ diameter: 0, scale: 0, openScale: 0 });
  });
});

describe('signal axis docking', () => {
  it('reads the published signal bay centerline and re-docks when it changes', async () => {
    const { readFileSync } = await import('node:fs');
    const hook = readFileSync('src/cinema/useFilmMenuGlobe.ts', 'utf8');
    expect(hook).toContain(`'--hatchery-signal-cx'`);
    // The bay is desktop-only (hidden at ≤680px), so the axis is ignored on tight viewports.
    expect(hook).toContain('GLOBE_TIGHT_MAX_WIDTH');
    // Preview toggles do not resize the viewport: a style-attribute watcher re-measures.
    expect(hook).toContain(`attributeFilter: ['style']`);
  });
});

it('keeps the folded sphere on the turbine centre as its diameter changes', () => {
  const viewport = { width: 1440, height: 900 };
  for (const diameter of [120, 168]) {
    expect(globeRestingCenter(viewport, diameter, null, undefined, 1280, 760)).toEqual({ x: 1280, y: 760 });
  }
});
