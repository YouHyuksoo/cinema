import { describe, expect, it } from 'vitest';
import { drawPcbInspectionFilm } from '@/cinema/drawPcbInspectionFilm';
import { drawRaceCarFilm } from '@/cinema/drawRaceCarFilm';
import { drawTransparentMachineFilm } from '@/cinema/drawTransparentMachineFilm';
import { DEFAULT_MACHINE_SUBJECT } from '@/cinema/machinePresentation';
import { createPcbInspectionProjection, pcbInspectionFocus, pcbInspectionLayout } from '@/cinema/pcbInspectionLayout';
import { pcbInspectionState } from '@/cinema/pcbInspection';
import { DEFAULT_PCB_INSPECTION_DATA, type PcbInspectionData } from '@/cinema/pcbInspectionData';
import { canvasFixture } from '../support/canvasFixture';

const inset = { bottomInset: 156 };
const textValues = (fixture: ReturnType<typeof canvasFixture>) => fixture.texts.map(item => item.value);

describe('PCB machine presentation', () => {
  it('uses PCB by default and preserves the original car only for an explicit car subject', () => {
    expect(DEFAULT_MACHINE_SUBJECT).toBe('pcb');
    const pcb = canvasFixture();
    drawTransparentMachineFilm(pcb.ctx, 1280, 720, 7, undefined, inset);
    expect(textValues(pcb)).toContain('SMT PCB 검사 시연');
    expect(textValues(pcb)).not.toContain('AERO / X-RAY');

    const car = canvasFixture();
    drawTransparentMachineFilm(car.ctx, 1280, 720, 7, undefined, inset, 'car');
    expect(textValues(car)).toContain('AERO / X-RAY');
    expect(textValues(car)).not.toContain('SMT PCB 검사 시연');
  });

  it('keeps every board part fixed while the focus moves smoothly through actual defect anchors', () => {
    const layout = pcbInspectionLayout(1280, 720, inset);
    const points = (time: number) => {
      const state = pcbInspectionState(time, DEFAULT_PCB_INSPECTION_DATA);
      const projection = createPcbInspectionProjection(layout, state, DEFAULT_PCB_INSPECTION_DATA);
      return DEFAULT_PCB_INSPECTION_DATA.components.map(component => projection.project({
        x: component.x, y: component.y, z: projection.boardTop - component.depth,
      }));
    };
    const fixed = points(0);
    for (const time of [7, 15, 23, 30]) expect(points(time)).toEqual(fixed);

    const focusAt = (time: number) => pcbInspectionFocus(layout, pcbInspectionState(time, DEFAULT_PCB_INSPECTION_DATA), DEFAULT_PCB_INSPECTION_DATA);
    expect(focusAt(7)?.component.id).toBe('U1');
    expect(focusAt(15)?.component.id).toBe('R12');
    expect(focusAt(23)?.component.id).toBe('U3');
    const before = focusAt(11.99)!, moving = focusAt(12.5)!, after = focusAt(14)!;
    expect(moving.point.x).toBeGreaterThan(Math.min(before.point.x, after.point.x));
    expect(moving.point.x).toBeLessThan(Math.max(before.point.x, after.point.x));
    expect(moving.point).not.toEqual(after.point);
  });

  it('lays portrait content out at readable logical width and is invariant across DPR', () => {
    const normal = pcbInspectionLayout(390, 844, { bottomInset: 390 });
    const retina = pcbInspectionLayout(780, 1688, { bottomInset: 780 });
    expect(normal.portrait).toBe(true);
    expect(normal.logicalWidth).toBeLessThanOrEqual(440);
    expect(retina.logicalWidth).toBe(normal.logicalWidth);
    expect(retina.logicalHeight).toBeCloseTo(normal.logicalHeight);
    expect(retina.header).toEqual(normal.header);
    expect(retina.board).toEqual(normal.board);
    expect(retina.readout).toEqual(normal.readout);
    expect(retina.scale).toBeCloseTo(normal.scale * 2);
    expect(normal.header.y + normal.header.height).toBeLessThanOrEqual(normal.board.y);
    expect(normal.board.y + normal.board.height).toBeLessThanOrEqual(normal.readout.y);
    expect(normal.readout.y + normal.readout.height).toBeLessThanOrEqual(normal.logicalHeight);
  });

  it('renders injected data, empty and invalid documents without inventing a defect', () => {
    const injected: PcbInspectionData = {
      name: 'INJECTED BOARD', serial: 'SN-INJECTED', width: 80, height: 50, thickness: 1.2,
      components: [{ id: 'C99', label: 'Injected capacitor', partNumber: 'CAP-99', kind: 'capacitor', x: 0, y: 0,
        rotation: 0, width: 5, height: 3, depth: 1, defect: 'none', process: 'aoi' }],
    };
    const connected = canvasFixture();
    drawPcbInspectionFilm(connected.ctx, 1280, 720, 30, undefined, inset, injected,
      { source: 'mes', at: '2026-09-08T09:00:00+09:00' });
    expect(textValues(connected).join(' ')).toEqual(expect.stringContaining('INJECTED BOARD'));
    expect(textValues(connected).join(' ')).toEqual(expect.stringContaining('SN-INJECTED'));
    expect(textValues(connected)).toContain('MES · 2026-09-08T09:00:00+09:00');
    expect(textValues(connected).join(' ')).toContain('불량 0');

    const empty = canvasFixture();
    drawPcbInspectionFilm(empty.ctx, 390, 844, 10, undefined, { bottomInset: 390 }, { ...injected, components: [] });
    expect(textValues(empty)).toContain('검사 대상 없음');
    expect(textValues(empty)).not.toContain('U1');

    const invalid = canvasFixture();
    drawPcbInspectionFilm(invalid.ctx, 1280, 720, 10, undefined, inset, { ...injected, width: -1 });
    expect(textValues(invalid).join(' ')).toContain('데이터 오류');
    expect(textValues(invalid)).not.toContain('C99');
  });

  it('keeps the extracted racing-car paint and diagnostic text fingerprint unchanged', () => {
    const direct = canvasFixture(), wrapper = canvasFixture();
    drawRaceCarFilm(direct.ctx, 1280, 720, 13, undefined, inset);
    drawTransparentMachineFilm(wrapper.ctx, 1280, 720, 13, undefined, inset, 'car');
    expect(textValues(wrapper)).toEqual(textValues(direct));
    const paintFingerprint = (fills: typeof direct.fills) => fills.map(fill => ({ ...fill, fillStyle: typeof fill.fillStyle }));
    expect(paintFingerprint(wrapper.fills)).toEqual(paintFingerprint(direct.fills));
    expect(textValues(direct)).toEqual(expect.arrayContaining([
      'AERO / X-RAY', 'RACING CHASSIS · STRUCTURAL TELEMETRY', 'LAP  44 / 57', 'SIMULATED VEHICLE DATA',
    ]));
    expect(direct.fills[0]?.rect).toEqual(expect.arrayContaining([expect.any(Number), expect.any(Number)]));
    expect(direct.stack).toHaveLength(0);
    expect(wrapper.stack).toHaveLength(0);
  });
});
