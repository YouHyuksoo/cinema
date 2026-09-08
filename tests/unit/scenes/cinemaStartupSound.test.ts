import { expect, it, vi } from 'vitest';
import { playJarvisStartupSound } from '@/cinema/jarvisStartupSound';

it('stops every scheduled tone and disconnects the output when startup is cancelled', async () => {
  const param = () => ({ value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() });
  const oscillators: { frequency: ReturnType<typeof param>; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn>; onended: (() => void) | null }[] = [];
  const gains: { gain: ReturnType<typeof param>; connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }[] = [];
  const context = { currentTime: 0, destination: {}, createGain() {
    const node = { gain: param(), connect: vi.fn(), disconnect: vi.fn() }; gains.push(node); return node;
  }, createOscillator() {
    const node = { frequency: param(), start: vi.fn(), stop: vi.fn(), connect: vi.fn(), disconnect: vi.fn(), onended: null as (() => void) | null }; oscillators.push(node); return node;
  } } as unknown as AudioContext;
  const sound = playJarvisStartupSound(context);
  expect(oscillators).toHaveLength(4);
  sound.stop(); sound.stop(); await sound.finished;
  for (const node of [...oscillators, ...gains]) expect(node.disconnect).toHaveBeenCalledOnce();
  for (const node of oscillators) { expect(node.stop).toHaveBeenCalledTimes(2); expect(node.onended).toBeNull(); }
});
