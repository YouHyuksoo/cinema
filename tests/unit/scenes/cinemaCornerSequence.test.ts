import { describe, expect, it } from 'vitest';
import { advanceFilm, chapterAt, chapterStart, FILM_DURATIONS } from '@/cinema/filmProgram';
import { CORE_BOUNDS } from '@/cinema/cornerCoreGeometry';
import {
  CORNER_CARD_SIZE, CORNER_FILM_SECONDS, CORNER_ITEMS, CORNER_PRODUCTION, cornerSequenceState,
} from '@/cinema/cornerSequence';

function rectangle(state: { x: number; y: number; scale: number }, width: number, height: number) {
  return {
    left: state.x - width * state.scale / 2, right: state.x + width * state.scale / 2,
    top: state.y - height * state.scale / 2, bottom: state.y + height * state.scale / 2,
  };
}

describe('corner information sequence', () => {
  it('repeats this forty-second scene independently and continues to the next film in sequence mode', () => {
    const start = chapterStart('corners');
    expect(FILM_DURATIONS.corners).toBe(CORNER_FILM_SECONDS);
    const repeated = chapterAt(advanceFilm(start + 39.9, .2, 'chapter'));
    expect(repeated.chapter.id).toBe('corners');
    expect(repeated.localTime).toBeCloseTo(.1, 8);
    const next = chapterAt(advanceFilm(start + 39.9, .2, 'sequence'));
    expect(next.chapter.id).toBe('machine');
    expect(next.localTime).toBeCloseTo(.1, 8);
  });

  it('introduces the four metrics in the requested corner order', () => {
    expect(CORNER_FILM_SECONDS).toBe(40);
    expect(CORNER_ITEMS.map(item => item.kind)).toEqual(['production', 'quality', 'equipment', 'cycle']);
    expect(CORNER_ITEMS.map(item => item.corner)).toEqual([
      { x: 1030, y: 183 }, { x: 1030, y: 527 }, { x: 250, y: 183 }, { x: 250, y: 527 },
    ]);
    expect(CORNER_PRODUCTION.actual + CORNER_PRODUCTION.remaining).toBe(CORNER_PRODUCTION.target);
    expect(CORNER_ITEMS[0].value).toBe((CORNER_PRODUCTION.actual / CORNER_PRODUCTION.target * 100).toFixed(1));
  });

  it('begins with every information card hidden', () => {
    const state = cornerSequenceState(0);
    expect(state.activeIndex).toBeNull();
    expect(state.parkedCount).toBe(0);
    expect(state.finale.opacity).toBe(0);
    expect(state.items.every(item => item.opacity === 0 && item.reveal === 0)).toBe(true);
    expect(cornerSequenceState(-1)).toEqual(state);
    expect(cornerSequenceState(NaN)).toEqual(state);
  });

  it.each([0, 1, 2, 3])('introduces metric %s alone at full size, then settles it before the next introduction', index => {
    const start = 1 + index * 7;
    const introduction = cornerSequenceState(start + 2);
    expect(introduction.activeIndex).toBe(index);
    expect(introduction.parkedCount).toBe(index);
    expect(introduction.items[index]).toMatchObject({ x: 640, y: 350, scale: 1.08, opacity: 1, reveal: 1, parkProgress: 0 });
    expect(introduction.items.filter(item => item.opacity > 0 && item.parkProgress < 1)).toHaveLength(1);
    const moving = cornerSequenceState(start + 5.55).items[index];
    expect(moving.parkProgress).toBeCloseTo(.5, 8);
    expect(moving.scale).toBeGreaterThan(.64);
    expect(moving.scale).toBeLessThan(1.08);
    expect(moving.x).not.toBe(640);
    expect(moving.y).not.toBe(350);
    const settled = cornerSequenceState(start + 6.5);
    expect(settled.parkedCount).toBe(index + 1);
    expect(settled.activeIndex).toBeNull();
    expect(settled.items[index]).toMatchObject({ ...CORNER_ITEMS[index].corner, scale: .64, parkProgress: 1 });
    expect(settled.items[index].opacity).toBeGreaterThanOrEqual(.78);
    expect(cornerSequenceState(start + 6.9).activeIndex).toBeNull();
  });

  it('keeps all four settled cards readable before introducing the central summary', () => {
    expect(cornerSequenceState(28.5).parkedCount).toBe(4);
    expect(cornerSequenceState(29.2).finale.opacity).toBe(0);
    const entering = cornerSequenceState(29.3);
    expect(entering.parkedCount).toBe(4);
    expect(entering.finale.opacity).toBeGreaterThan(0);
    const complete = cornerSequenceState(31.8);
    expect(complete.finale).toMatchObject({ x: 640, y: 350, scale: 1.08, opacity: 1, reveal: 1 });
    expect(complete.activeIndex).toBeNull();
    for (let time = 28.5; time <= 37.5; time += .1) {
      expect(cornerSequenceState(time).items.every(item => item.opacity >= .78)).toBe(true);
    }
  });

  it('reconstructs the same scene when seeking backwards without modifying the metric data', () => {
    const data = JSON.stringify(CORNER_ITEMS), first = cornerSequenceState(5.8);
    cornerSequenceState(32); cornerSequenceState(39);
    expect(cornerSequenceState(5.8)).toEqual(first);
    expect(JSON.stringify(CORNER_ITEMS)).toBe(data);
  });

  it('shrinks and fades the complete composition only during the final release', () => {
    const held = cornerSequenceState(37.5), retreating = cornerSequenceState(38.75), end = cornerSequenceState(40);
    expect(held.release).toBe(1);
    expect(retreating.release).toBeCloseTo(.5, 8);
    expect(retreating.finale.scale).toBeLessThan(held.finale.scale);
    retreating.items.forEach((item, index) => {
      expect(item.scale).toBeLessThan(held.items[index].scale);
      expect(item.opacity).toBeLessThan(held.items[index].opacity);
    });
    expect(end.release).toBe(0);
    expect(end.finale.opacity).toBe(0);
    expect(end.items.every(item => item.opacity === 0)).toBe(true);
  });

  it('keeps visible cards and the summary inside the frame without overlapping earlier cards', () => {
    for (let tick = 0; tick <= 1000; tick++) {
      const time = tick * .04, state = cornerSequenceState(time);
      const panels = state.items.filter(item => item.opacity > .001)
        .map(item => rectangle(item, CORNER_CARD_SIZE.width, CORNER_CARD_SIZE.height));
      if (state.finale.opacity > .001) panels.push(rectangle(state.finale, CORE_BOUNDS.width, CORE_BOUNDS.height));
      for (const panel of panels) {
        expect(Object.values(panel).every(Number.isFinite), `finite panel at ${time}s`).toBe(true);
        expect(panel.left).toBeGreaterThanOrEqual(0);
        expect(panel.right).toBeLessThanOrEqual(1280);
        expect(panel.top).toBeGreaterThanOrEqual(0);
        expect(panel.bottom).toBeLessThanOrEqual(720);
      }
      for (let i = 0; i < panels.length; i++) {
        for (let j = i + 1; j < panels.length; j++) {
          const horizontal = Math.max(0, Math.min(panels[i].right, panels[j].right) - Math.max(panels[i].left, panels[j].left));
          const vertical = Math.max(0, Math.min(panels[i].bottom, panels[j].bottom) - Math.max(panels[i].top, panels[j].top));
          expect(horizontal * vertical, `panel collision at ${time}s`).toBe(0);
        }
      }
    }
  });
});
