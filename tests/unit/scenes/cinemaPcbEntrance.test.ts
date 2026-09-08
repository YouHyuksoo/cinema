import { describe, expect, it } from 'vitest';
import { drawPcbInspectionFilm } from '@/cinema/drawPcbInspectionFilm';
import { pcbEntranceState } from '@/cinema/pcbEntrance';
import { pcbInspectionState } from '@/cinema/pcbInspection';
import { DEFAULT_PCB_INSPECTION_DATA } from '@/cinema/pcbInspectionData';
import { createPcbInspectionProjection, pcbInspectionLayout } from '@/cinema/pcbInspectionLayout';
import { canvasFixture } from '../support/canvasFixture';

describe('PCB lying projection and entrance choreography', () => {
  it.each([[1280, 720], [390, 845]])('looks straight toward a receding board at %i x %i', (width, height) => {
    const data = DEFAULT_PCB_INSPECTION_DATA;
    const layout = pcbInspectionLayout(width, height);
    const { project, boardTop } = createPcbInspectionProjection(layout, pcbInspectionState(8), data);
    const backLeft = project({ x: -data.width / 2, y: -data.height / 2, z: boardTop });
    const backRight = project({ x: data.width / 2, y: -data.height / 2, z: boardTop });
    const frontLeft = project({ x: -data.width / 2, y: data.height / 2, z: boardTop });
    const frontRight = project({ x: data.width / 2, y: data.height / 2, z: boardTop });
    expect(frontRight.x - frontLeft.x).toBeGreaterThan((backRight.x - backLeft.x) * 1.35);
    expect(frontLeft.y).toBeCloseTo(frontRight.y, 8);
    expect(backLeft.y).toBeCloseTo(backRight.y, 8);
    expect(frontLeft.y).toBeGreaterThan(backLeft.y);
    expect((frontLeft.x + frontRight.x) / 2).toBeCloseTo((backLeft.x + backRight.x) / 2, 8);
    const elevated = project({ x: 0, y: 0, z: boardTop - 10 });
    expect(elevated.y).toBeLessThan(project({ x: 0, y: 0, z: boardTop }).y);
  });

  it('projects the fixed board as a wide, low plane after it has arrived', () => {
    const layout = pcbInspectionLayout(1280, 720, { bottomInset: 156 });
    const projection = createPcbInspectionProjection(layout, pcbInspectionState(8), DEFAULT_PCB_INSPECTION_DATA);
    const { width, height } = DEFAULT_PCB_INSPECTION_DATA, z = projection.boardTop;
    const corners = [[-width / 2, -height / 2], [width / 2, -height / 2], [width / 2, height / 2], [-width / 2, height / 2]]
      .map(([x, y]) => projection.project({ x, y, z }));
    const projectedWidth = Math.max(...corners.map(point => point.x)) - Math.min(...corners.map(point => point.x));
    const projectedHeight = Math.max(...corners.map(point => point.y)) - Math.min(...corners.map(point => point.y));
    const longEdge = { x: corners[1].x - corners[0].x, y: corners[1].y - corners[0].y };
    expect(projectedWidth).toBeGreaterThan(layout.board.width * .82);
    expect(projectedHeight / projectedWidth).toBeLessThan(.46);
    expect(Math.abs(longEdge.y / longEdge.x)).toBeLessThan(.22);
  });

  it('builds ground light, outline, circuits, particles, components and lock in distinct deterministic phases', () => {
    const snapshots = [0, .7, 1.4, 2.2, 3.1, 4].map(pcbEntranceState);
    expect(snapshots[0]).toMatchObject({ ground: 0, outline: 0, circuits: 0, particles: 0, components: 0, lock: 0, complete: false });
    expect(snapshots[1].ground).toBeGreaterThan(0);
    expect(snapshots[2].outline).toBeGreaterThan(0);
    expect(snapshots[3].circuits).toBeGreaterThan(0);
    expect(snapshots[3].particles).toBeGreaterThan(0);
    expect(snapshots[4].components).toBeGreaterThan(0);
    expect(snapshots[5]).toMatchObject({ ground: 1, outline: 1, circuits: 1, particles: 0, components: 1, lock: 1, complete: true });
    pcbEntranceState(3.8);
    expect(pcbEntranceState(2.2)).toEqual(snapshots[3]);
    expect(pcbEntranceState(20)).toEqual(pcbEntranceState(4));
  });

  it('keeps the film paint stack isolated throughout entrance and settled frames', () => {
    for (const time of [0, .8, 1.6, 2.5, 3.4, 4, 12]) {
      const fixture = canvasFixture({ globalAlpha: .63, shadowBlur: 9, lineDash: [7, 3] });
      drawPcbInspectionFilm(fixture.ctx, 1280, 720, time, undefined, { bottomInset: 156 });
      expect(fixture.stack, `stack at ${time}s`).toHaveLength(0);
    }
  });
});
