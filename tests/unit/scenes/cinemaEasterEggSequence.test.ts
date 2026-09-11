import { describe, expect, it } from 'vitest';
import { createEasterEggSequence, EASTER_EGG_ORDER } from '@/cinema/easterEggSequence';

describe('reactor click sequence', () => {
  it('runs one effect per click, ignores repeated clicks until completion, and wraps', () => {
    const sequence = createEasterEggSequence();
    const played: string[] = [];
    let finish = () => {};
    for (const id of EASTER_EGG_ORDER) sequence.register(id, done => {
      played.push(id); finish = done; return true;
    });
    expect(played).toEqual([]);
    for (let i = 0; i < 6; i++) {
      expect(sequence.play()).toBe(true);
      expect(sequence.play()).toBe(false);
      expect(played).toHaveLength(i + 1);
      finish();
      expect(played).toHaveLength(i + 1);
    }
    expect(played).toEqual([...EASTER_EGG_ORDER, 'ship']);
  });
  it('skips unavailable effects and ignores an old completion callback', () => {
    const sequence = createEasterEggSequence();
    let oldDone = () => {};
    sequence.register('ship', () => false);
    const remove = sequence.register('globe', done => { oldDone = done; return true; });
    sequence.register('scanner', () => true);
    expect(sequence.play()).toBe(true);
    oldDone(); remove();
    expect(sequence.play()).toBe(true);
    oldDone();
    expect(sequence.active).toBe(true);
    expect(sequence.play()).toBe(false);
  });
});

it('launches the requested scanner without advancing the reactor order', () => {
  const sequence = createEasterEggSequence();
  const played: string[] = [];
  let finish = () => {};
  for (const id of EASTER_EGG_ORDER) sequence.register(id, done => { played.push(id); finish = done; return true; });
  expect(sequence.play('scanner')).toBe(true);
  expect(sequence.play('scanner')).toBe(false);
  finish();
  sequence.play();
  expect(played).toEqual(['scanner', 'ship']);
});
