import { describe, expect, it } from 'vitest';
import { createFilmRenderBudget } from '@/cinema/filmRenderBudget';

describe('film render budget', () => {
  it('bounds bitmap pixels and keeps aspect ratio through one shared scale', () => {
    const budget = createFilmRenderBudget();
    expect(budget.ratio(1920, 1080, 1)).toBe(1);
    expect(budget.ratio(3840, 2160, 2)).toBe(1);
    expect(budget.ratio(960, 540, 2)).toBe(2);
  });
  it('reduces sustained expensive frames gradually and restores only after sustained headroom', () => {
    const budget = createFilmRenderBudget();
    for (let t = 0; t <= 3000; t += 20) budget.sample(t, 14, 20);
    expect(budget.ratio(1920, 1080, 1)).toBe(.75);
    for (let t = 3020; t <= 6000; t += 20) budget.sample(t, 2, 16);
    expect(budget.ratio(1920, 1080, 1)).toBe(.75);
    for (let t = 6020; t <= 8000; t += 20) budget.sample(t, 2, 16);
    expect(budget.ratio(1920, 1080, 1)).toBe(.875);
  });
  it('does not lower resolution because of unrelated frame delays or a hidden-tab gap', () => {
    const budget = createFilmRenderBudget();
    for (let t = 0; t <= 5000; t += 50) budget.sample(t, 2, 50);
    budget.sample(10000, 300, 5000);
    expect(budget.ratio(1920, 1080, 1)).toBe(1);
  });
});
