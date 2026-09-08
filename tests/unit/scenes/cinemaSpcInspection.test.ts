import { describe, expect, it } from 'vitest';
import { drawSpcInspection } from '@/cinema/components/drawSpcInspection';
import { DEFAULT_FONTS } from '@/cinema/filmDrawing';
import { DEFAULT_SPC_DATA } from '@/cinema/spcData';
import { analyzeSpc } from '@/cinema/spcStatistics';

/** Run the real renderer and text helper; only Canvas path operations are omitted. */
function inspectionText(scale: number, unit: string) {
  const data = {
    ...DEFAULT_SPC_DATA, unit,
    nominal: DEFAULT_SPC_DATA.nominal * scale,
    lsl: DEFAULT_SPC_DATA.lsl * scale, usl: DEFAULT_SPC_DATA.usl * scale,
    subgroups: DEFAULT_SPC_DATA.subgroups.map(group => ({
      ...group, values: group.values.map(value => value * scale),
    })),
  };
  const analysis = analyzeSpc(data);
  if (!analysis.valid) throw new Error(analysis.reason);
  const texts: string[] = [];
  const noop = () => undefined;
  const ctx = {
    save: noop, restore: noop, beginPath: noop, moveTo: noop, lineTo: noop,
    closePath: noop, stroke: noop, fill: noop, arc: noop, fillRect: noop,
    fillText: (value: string) => texts.push(value),
  } as unknown as CanvasRenderingContext2D;
  drawSpcInspection(ctx, DEFAULT_FONTS, data, analysis, { time: 10, focus: 1, opacity: 1 });
  const rawStart = texts.findIndex(value => value.startsWith('원시 측정값'));
  const summaryStart = texts.indexOf('군 평균  X̄');
  expect(rawStart).toBeGreaterThan(-1);
  expect(summaryStart).toBeGreaterThan(rawStart);
  return { raw: texts.slice(rawStart + 1, summaryStart), summary: texts.slice(summaryStart + 2) };
}

describe('SPC inspection measurement precision', () => {
  it('shows the five SG-18 readings and exact mean/range in millimetres', () => {
    const result = inspectionText(1, 'mm');
    expect(result.raw).toEqual(['10.0360', '10.0440', '10.0470', '10.0520', '10.0560']);
    expect(result.summary).toEqual(['10.0470', '0.0200']);
  });

  it('retains distinct readings and the same measurement resolution after conversion to metres', () => {
    const result = inspectionText(.001, 'm');
    expect(result.raw).toEqual(['0.0100360', '0.0100440', '0.0100470', '0.0100520', '0.0100560']);
    expect(result.summary).toEqual(['0.0100470', '0.0000200']);
  });
});
