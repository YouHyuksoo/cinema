import { describe, expect, it, vi } from 'vitest';
import { robotVoiceParameters, createRobotVoice } from '@/cinema/robotVoice';

const param = () => ({ value: 0, cancelScheduledValues: vi.fn(), setTargetAtTime: vi.fn() });
function fixture() {
  const nodes: ReturnType<typeof node>[] = [];
  function node() { return { connect: vi.fn(), disconnect: vi.fn(), gain: param(), frequency: param(), Q: param(),
    threshold: param(), knee: param(), ratio: param(), attack: param(), release: param(), delayTime: param(),
    start: vi.fn(), stop: vi.fn(), type: '', fftSize: 0, curve: null, oversample: 'none' }; }
  const make = () => { const value = node(); nodes.push(value); return value; };
  const context = { currentTime: 1, destination: node(), createGain: make, createBiquadFilter: make,
    createOscillator: make, createWaveShaper: make, createDynamicsCompressor: make, createAnalyser: make };
  const source = node();
  return { context, nodes, source };
}
describe('Robot voice DSP', () => {
  it('fully bypasses effects for natural voice or zero intensity', () => {
    expect(robotVoiceParameters({ style: 'natural', strength: 1 })).toMatchObject({ dry: 1, wet: 0 });
    expect(robotVoiceParameters({ style: 'android', strength: 0 })).toMatchObject({ dry: 1, wet: 0 });
  });
  it('keeps dry/wet levels bounded and makes android more metallic than Jarvis', () => {
    const android = robotVoiceParameters({ style: 'android', strength: 1 });
    const jarvis = robotVoiceParameters({ style: 'jarvis', strength: 1 });
    expect(android.depth).toBeGreaterThan(jarvis.depth);
    for (const strength of [-3, 0, .5, 1, 5, NaN]) {
      const value = robotVoiceParameters({ style: 'radio', strength });
      expect(value.dry + value.wet).toBeCloseTo(1);
      expect(value.wet).toBeGreaterThanOrEqual(0); expect(value.wet).toBeLessThanOrEqual(1);
    }
  });
  it('uses a single audible output and disposes oscillators and nodes once', () => {
    const { context, source, nodes } = fixture();
    const effect = createRobotVoice(context as unknown as AudioContext, source as unknown as AudioNode, { style: 'android', strength: .75 });
    expect(nodes.filter(n => n.connect.mock.calls.some(([to]) => to === context.destination))).toHaveLength(1);
    expect(source.connect).not.toHaveBeenCalledWith(context.destination);
    effect.update({ style: 'natural', strength: 0 });
    expect(nodes.some(n => n.gain.setTargetAtTime.mock.calls.some(([value]) => value === 0))).toBe(true);
    effect.dispose(); effect.dispose();
    expect(nodes.reduce((sum, n) => sum + n.stop.mock.calls.length, 0)).toBe(1);
    expect(nodes.every(n => n.disconnect.mock.calls.length === 1)).toBe(true);
  });
});
