import { describe, expect, it } from 'vitest';
import { SPC_CONTROL_SIZE } from '@/cinema/components/drawSpcControlCharts';
import { SPC_HISTOGRAM_SIZE } from '@/cinema/components/drawSpcHistogram';
import { CORE_BOUNDS } from '@/cinema/cornerCoreGeometry';
import { SPC_FILM_SECONDS, spcPanelProjection, spcSceneState, type SpcPanelPose } from '@/cinema/spcScene';

function corners(pose: SpcPanelPose, size: { width: number; height: number }) {
  const project = spcPanelProjection(pose);
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => project(x * size.width / 2, y * size.height / 2));
}

function projectedArea(pose: SpcPanelPose, size: { width: number; height: number }) {
  const points = corners(pose, size);
  return Math.abs(points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + point.x * next.y - next.x * point.y;
  }, 0)) / 2;
}

function bounds(points: { x: number; y: number }[]) {
  return { left: Math.min(...points.map(point => point.x)), right: Math.max(...points.map(point => point.x)),
    top: Math.min(...points.map(point => point.y)), bottom: Math.max(...points.map(point => point.y)) };
}

describe('SPC cinematic surfaces', () => {
  it('keeps both visible chart surfaces inside the header and dock safe area throughout the complete tour', () => {
    const extremes = {
      minX: { value: Infinity, time: 0, panel: '' }, maxX: { value: -Infinity, time: 0, panel: '' },
      minY: { value: Infinity, time: 0, panel: '' }, maxY: { value: -Infinity, time: 0, panel: '' },
    };
    let inspected = 0;
    for (let time = 0; time <= SPC_FILM_SECONDS; time += .25) {
      const state = spcSceneState(time);
      for (const panel of [
        { name: 'controls', pose: state.controls, opacity: state.controlsOpacity, size: SPC_CONTROL_SIZE },
        { name: 'histogram', pose: state.histogram, opacity: state.histogramOpacity, size: SPC_HISTOGRAM_SIZE },
      ]) {
        if (panel.opacity <= .01) continue;
        inspected++;
        for (const point of corners(panel.pose, panel.size)) {
          expect(Number.isFinite(point.x + point.y), `${panel.name} at ${time}s`).toBe(true);
          if (point.x < extremes.minX.value) extremes.minX = { value: point.x, time, panel: panel.name };
          if (point.x > extremes.maxX.value) extremes.maxX = { value: point.x, time, panel: panel.name };
          if (point.y < extremes.minY.value) extremes.minY = { value: point.y, time, panel: panel.name };
          if (point.y > extremes.maxY.value) extremes.maxY = { value: point.y, time, panel: panel.name };
        }
      }
    }
    const evidence = JSON.stringify(extremes);
    if (process.env.SPC_BOUNDS_REPORT === '1') process.stdout.write(`SPC projected bounds: ${evidence}\n`);
    expect(inspected).toBeGreaterThan(200);
    expect(extremes.minX.value, evidence).toBeGreaterThanOrEqual(52);
    expect(extremes.maxX.value, evidence).toBeLessThanOrEqual(1228);
    expect(extremes.minY.value, evidence).toBeGreaterThanOrEqual(122);
    expect(extremes.maxY.value, evidence).toBeLessThanOrEqual(625);
  });

  it('moves each completed chart back in depth, shrinks it and turns it toward the central result', () => {
    const control = spcSceneState(9), distribution = spcSceneState(20), capability = spcSceneState(30);
    expect(control.phase).toBe('control');
    expect(distribution.phase).toBe('distribution');
    expect(capability.phase).toBe('capability');
    expect(spcSceneState(39).phase).toBe('return');
    expect(control.controls.depth).toBeGreaterThan(distribution.controls.depth);
    expect(Math.abs(distribution.controls.yaw)).toBeGreaterThan(Math.abs(control.controls.yaw));
    expect(projectedArea(distribution.controls, SPC_CONTROL_SIZE)).toBeLessThan(projectedArea(control.controls, SPC_CONTROL_SIZE) * .4);
    expect(distribution.histogram.depth).toBeGreaterThan(capability.histogram.depth);
    expect(Math.abs(capability.histogram.yaw)).toBeGreaterThan(Math.abs(distribution.histogram.yaw));
    expect(projectedArea(capability.histogram, SPC_HISTOGRAM_SIZE)).toBeLessThan(projectedArea(distribution.histogram, SPC_HISTOGRAM_SIZE) * .4);
    expect(distribution.controls.x).toBeLessThan(400);
    expect(capability.histogram.x).toBeGreaterThan(900);
    expect(control.coreOpacity).toBe(0);
    expect(capability.coreOpacity).toBe(1);
  });

  it('keeps the visible central capability core separate from chart surfaces during entry and return', () => {
    const overlaps: { time: number; panel: string; core: ReturnType<typeof bounds>;
      surface: ReturnType<typeof bounds>; overlapWidth: number; overlapHeight: number }[] = [];
    let checked = 0;
    for (let step = 0; step <= SPC_FILM_SECONDS * 20; step++) {
      const time = step / 20;
      const state = spcSceneState(time);
      if (state.coreOpacity <= .1) continue;
      const core = {
        left: state.core.x - CORE_BOUNDS.width * state.core.scale / 2,
        right: state.core.x + CORE_BOUNDS.width * state.core.scale / 2,
        top: state.core.y - CORE_BOUNDS.height * state.core.scale / 2,
        bottom: state.core.y + CORE_BOUNDS.height * state.core.scale / 2,
      };
      for (const panel of [
        { name: 'controls', pose: state.controls, opacity: state.controlsOpacity, size: SPC_CONTROL_SIZE },
        { name: 'histogram', pose: state.histogram, opacity: state.histogramOpacity, size: SPC_HISTOGRAM_SIZE },
      ]) {
        if (panel.opacity <= .1) continue;
        checked++;
        const surface = bounds(corners(panel.pose, panel.size));
        const overlapWidth = Math.min(core.right, surface.right) - Math.max(core.left, surface.left);
        const overlapHeight = Math.min(core.bottom, surface.bottom) - Math.max(core.top, surface.top);
        if (overlapWidth > 0 && overlapHeight > 0) {
          overlaps.push({ time, panel: panel.name, core, surface, overlapWidth, overlapHeight });
        }
      }
    }
    expect(checked).toBeGreaterThan(200);
    expect(overlaps, JSON.stringify({ count: overlaps.length, first: overlaps.slice(0, 8), last: overlaps.at(-1) })).toEqual([]);
  });

  it('keeps the projected centre attached to its pose during movement and perspective changes', () => {
    for (const time of [0, 9, 13.75, 20, 25.5, 30, 37.25, 40]) {
      const state = spcSceneState(time);
      for (const pose of [state.controls, state.histogram]) {
        const center = spcPanelProjection(pose)(0, 0);
        expect(center.x).toBeCloseTo(pose.x, 10);
        expect(center.y).toBeCloseTo(pose.y, 10);
      }
    }
  });

  it('reconstructs the same transforms after backward seeks without a second animation clock', () => {
    const before = spcSceneState(25.25);
    const beforeControl = corners(before.controls, SPC_CONTROL_SIZE);
    const beforeHistogram = corners(before.histogram, SPC_HISTOGRAM_SIZE);
    spcSceneState(39.5);
    spcSceneState(2);
    const after = spcSceneState(25.25);
    expect(after).toEqual(before);
    expect(corners(after.controls, SPC_CONTROL_SIZE)).toEqual(beforeControl);
    expect(corners(after.histogram, SPC_HISTOGRAM_SIZE)).toEqual(beforeHistogram);
  });

  it('fades every surface at the end and clamps negative, excessive and non-finite scene times', () => {
    const start = spcSceneState(0), end = spcSceneState(SPC_FILM_SECONDS);
    expect(start.reveal).toBe(0);
    expect(end.reveal).toBe(0);
    expect(end.controlsOpacity).toBe(0);
    expect(end.histogramOpacity).toBe(0);
    expect(end.coreOpacity).toBe(0);
    expect(spcSceneState(39).reveal).toBeGreaterThan(0);
    expect(spcSceneState(39).reveal).toBeLessThan(spcSceneState(38).reveal);
    expect(spcSceneState(-1)).toEqual(start);
    expect(spcSceneState(NaN)).toEqual(start);
    expect(spcSceneState(Infinity)).toEqual(start);
    expect(spcSceneState(-Infinity)).toEqual(start);
    expect(spcSceneState(100)).toEqual(end);
  });
});
