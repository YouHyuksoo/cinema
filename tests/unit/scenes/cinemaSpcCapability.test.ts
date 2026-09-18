import { expect, it } from 'vitest';
import { drawSpcCapability } from '@/cinema/components/drawSpcCapability';
import { DEFAULT_FONTS } from '@/cinema/filmDrawing';
import { DEFAULT_SPC_TARGETS } from '@/cinema/spcData';
import { analyzeSpc } from '@/cinema/spcStatistics';
import { canvasFixture } from '../support/canvasFixture';

it('positions the mean to either side of the unchanged target on the measurement axis', () => {
  const base = DEFAULT_SPC_TARGETS[0];
  const positions: number[] = [];
  for (const shift of [-8, 8]) {
    const data = { ...base, subgroups: base.subgroups.map(group => ({ ...group, values: group.values.map(() => base.nominal + shift) })) };
    const analysis = analyzeSpc(data);
    if (!analysis.valid) throw new Error(analysis.reason);
    const { ctx, texts, stack } = canvasFixture();
    // A constant dataset must stay finite and report that curve estimation is unavailable.
    drawSpcCapability(ctx, DEFAULT_FONTS, data, analysis);
    expect(texts.some(text => text.value.includes('분포 추정 불가'))).toBe(true);
    expect(texts.some(text => text.value.includes(`${shift > 0 ? '+' : ''}${shift.toFixed(3)}`))).toBe(true);
    positions.push(texts.find(text => text.value === '목표')!.x);
    expect(stack).toHaveLength(0);
  }
  expect(positions[0]).toBe(positions[1]);
});
