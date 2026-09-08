import { describe, expect, it } from 'vitest';
import { advanceFilm, chapterAt, chapterStart, FILM_DURATIONS } from '@/cinema/filmProgram';
import { TRACE_LOOP, TRACE_TIMING } from '@/cinema/workOrderTraceTiming';
import { workOrderTraceState } from '@/cinema/workOrderTrace';

const start = chapterStart('trace');

describe('trace production repeat without rebuilding the line', () => {
  it('plays the introduction on entry and returns to the first PCB instead of zero on repeat', () => {
    expect(chapterAt(start).localTime).toBe(0);
    expect(chapterAt(advanceFilm(start, 1, 'chapter')).localTime).toBe(1);
    const before = start + TRACE_LOOP.end - .01;
    const repeated = chapterAt(advanceFilm(before, .02, 'chapter'));
    expect(repeated.chapter.id).toBe('trace');
    expect(repeated.localTime).toBeCloseTo(2.41);
    const initialFlow = workOrderTraceState(repeated.localTime);
    expect(initialFlow).toMatchObject({ created: true, released: 1, completedGood: 0, defectCount: 0 });
    expect(initialFlow.units[0]).toMatchObject({ stageIndex: 0, status: 'processing' });
  });

  it('stays in the installed-line interval over many loops and preserves large frame overshoot', () => {
    let position = start;
    for (let frame = 0; frame < 800; frame++) {
      position = advanceFilm(position, .2, 'chapter');
      const current = chapterAt(position);
      expect(current.chapter.id).toBe('trace');
      expect(current.localTime).toBeLessThan(TRACE_LOOP.end);
      if ((frame + 1) * .2 >= TRACE_LOOP.end) expect(current.localTime).toBeGreaterThanOrEqual(TRACE_LOOP.start - 1e-9);
    }
    const length = TRACE_LOOP.end - TRACE_LOOP.start;
    const advanced = chapterAt(advanceFilm(start + TRACE_LOOP.end - .01, length * 4 + .21, 'chapter'));
    expect(advanced.localTime).toBeCloseTo(TRACE_LOOP.start + .2);
    expect(chapterAt(advanceFilm(start + 23.9, .2, 'chapter')).localTime).toBeCloseTo(3.5);
  });

  it('shows the completed order before repeating and reconstructs the same inspections in the next pass', () => {
    const completed = workOrderTraceState(TRACE_LOOP.end - .001);
    expect(completed).toMatchObject({ phase: 'complete', issued: 120, completedGood: 116, defectCount: 4, inProcess: 0 });
    const repeatStart = advanceFilm(start + TRACE_LOOP.end - .1, .1, 'chapter');
    const nextInspection = chapterAt(advanceFilm(repeatStart, 10 - TRACE_LOOP.start, 'chapter'));
    expect(nextInspection.localTime).toBeCloseTo(10);
    const original = workOrderTraceState(10), repeated = workOrderTraceState(nextInspection.localTime);
    expect(repeated).toMatchObject({ released: original.released, inProcess: original.inProcess,
      completedGood: original.completedGood, defectCount: original.defectCount,
      stages: original.stages, events: original.events });
    expect(TRACE_LOOP.start).toBe(TRACE_TIMING.launchAt);
    expect(TRACE_LOOP.end).toBe(TRACE_TIMING.fadeAt);
  });

  it('retains the full scene duration and next scene in sequence playback', () => {
    const next = chapterAt(advanceFilm(start + FILM_DURATIONS.trace - .1, .2, 'sequence'));
    expect(next.chapter.id).toBe('console');
    expect(next.localTime).toBeCloseTo(.1);
    const beforeExit = chapterAt(advanceFilm(start + 22.9, .2, 'sequence'));
    expect(beforeExit.chapter.id).toBe('trace');
    expect(beforeExit.localTime).toBeCloseTo(23.1);
    // Explicit chapter entry/restart still uses the original zero point.
    expect(workOrderTraceState(chapterAt(chapterStart('trace')).localTime).created).toBe(false);
  });
});
