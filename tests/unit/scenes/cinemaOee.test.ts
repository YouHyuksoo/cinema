import { expect, it } from 'vitest';
import { calculateOee, DEFAULT_OEE_DATA } from '@/cinema/oeeData';
import { drawOeeFilm } from '@/cinema/drawOeeFilm';
import { canvasFixture } from '../support/canvasFixture';
it('calculates OEE from raw counts and reconciles all losses to planned time', () => {
  const result = calculateOee({ id: 'test', name: 'test', plannedSeconds: 1000, stopSeconds: 100, idealCycleSeconds: 2, totalCount: 400, goodCount: 380 })!;
  expect(result.availability).toBe(.9); expect(result.performance).toBeCloseTo(8/9);
  expect(result.quality).toBe(.95); expect(result.oee).toBeCloseTo(.76);
  expect(result.oee + result.losses.reduce((a,b) => a+b,0)).toBeCloseTo(1);
  expect(calculateOee({ ...DEFAULT_OEE_DATA.equipment[0], goodCount: 99999 })).toBeNull();
});
it('renders every seeded equipment with balanced canvas state', () => {
  DEFAULT_OEE_DATA.equipment.forEach((machine, index) => {
    const {ctx,texts,stack} = canvasFixture();
    drawOeeFilm(ctx,1280,900,index*6+3);
    expect(texts.some(text => text.value === machine.name)).toBe(true);
    expect(texts.some(text => text.value === 'OEE')).toBe(true);
    expect(stack).toHaveLength(0);
  });
});
