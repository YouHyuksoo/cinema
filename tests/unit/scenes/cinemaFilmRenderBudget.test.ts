import { describe, expect, it } from 'vitest';
import { createFilmRenderBudget, isLowEndDevice } from '@/cinema/filmRenderBudget';

const fastDevice = { cores: 16, memory: 16 };

describe('film render budget', () => {
  it('bounds bitmap pixels and keeps aspect ratio through one shared scale', () => {
    const budget = createFilmRenderBudget(fastDevice);
    expect(budget.ratio(1920, 1080, 1)).toBe(1);
    expect(budget.ratio(3840, 2160, 2)).toBe(1);
    expect(budget.ratio(960, 540, 2)).toBe(2);
  });
  it('reduces sustained expensive frames gradually and restores only after sustained headroom', () => {
    const budget = createFilmRenderBudget(fastDevice);
    for (let t = 0; t <= 3000; t += 20) budget.sample(t, 14, 20);
    expect(budget.ratio(1920, 1080, 1)).toBe(.75);
    for (let t = 3020; t <= 6000; t += 20) budget.sample(t, 2, 16);
    expect(budget.ratio(1920, 1080, 1)).toBe(.75);
    for (let t = 6020; t <= 8000; t += 20) budget.sample(t, 2, 16);
    expect(budget.ratio(1920, 1080, 1)).toBe(.875);
  });
  it('does not lower resolution because of unrelated frame delays or a hidden-tab gap', () => {
    const budget = createFilmRenderBudget(fastDevice);
    for (let t = 0; t <= 5000; t += 50) budget.sample(t, 2, 50);
    budget.sample(10000, 300, 5000);
    expect(budget.ratio(1920, 1080, 1)).toBe(1);
    expect(budget.frameInterval).toBe(0);
  });
  it('caps the painting cadence before the resolution floor so the thread idles between frames', () => {
    const budget = createFilmRenderBudget(fastDevice);
    expect(budget.frameInterval).toBe(0);
    for (let t = 0; t <= 1000; t += 20) budget.sample(t, 14, 20);
    expect(budget.frameInterval).toBeCloseTo(1000 / 30);
    for (let t = 1020; t <= 3000; t += 30) budget.sample(t, 26, 30);
    expect(budget.frameInterval).toBeCloseTo(1000 / 20);
    for (let t = 3030; t <= 5000; t += 50) budget.sample(t, 45, 50);
    expect(budget.frameInterval).toBeCloseTo(1000 / 15);
  });
  it('drops below the normal floor only after the machine stays over budget there', () => {
    const budget = createFilmRenderBudget(fastDevice);
    for (let t = 0; t <= 4000; t += 50) budget.sample(t, 45, 50);
    expect(budget.ratio(1920, 1080, 1)).toBe(.75);
    for (let t = 4050; t <= 7000; t += 50) budget.sample(t, 45, 50);
    expect(budget.ratio(1920, 1080, 1)).toBe(.625);
  });
  it('starts capped on a low-end machine and relaxes once it proves the headroom', () => {
    expect(isLowEndDevice({ cores: 4 })).toBe(true);
    expect(isLowEndDevice({ memory: 4 })).toBe(true);
    expect(isLowEndDevice(fastDevice)).toBe(false);
    expect(isLowEndDevice({})).toBe(false);
    const budget = createFilmRenderBudget({ cores: 2, memory: 4 });
    expect(budget.frameInterval).toBeCloseTo(1000 / 30);
    for (let t = 0; t <= 5000; t += 33) budget.sample(t, 2, 33);
    expect(budget.frameInterval).toBe(0);
  });
});
