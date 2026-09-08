export const JARVIS_STARTUP_MESSAGE = 'JARVIS initializing.';

/** A short, locally synthesized motor spin-up followed by two confirmation tones. */
export function playJarvisStartupSound(context: AudioContext) {
  const output = context.createGain();
  output.gain.value = .22;
  output.connect(context.destination);
  const nodes: { oscillator: OscillatorNode; envelope: GainNode }[] = [];
  let disposed = false;
  let finish!: () => void;
  const finished = new Promise<void>(resolve => { finish = resolve; });
  const now = context.currentTime + .02;
  function tone(type: OscillatorType, delay: number, duration: number, from: number, to: number, gain: number) {
    const oscillator = context.createOscillator(), envelope = context.createGain();
    nodes.push({ oscillator, envelope });
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, now + delay);
    oscillator.frequency.exponentialRampToValueAtTime(to, now + delay + duration);
    envelope.gain.setValueAtTime(0, now + delay);
    envelope.gain.linearRampToValueAtTime(gain, now + delay + .035);
    envelope.gain.exponentialRampToValueAtTime(.001, now + delay + duration);
    oscillator.connect(envelope); envelope.connect(output);
    oscillator.start(now + delay); oscillator.stop(now + delay + duration + .02);
    return oscillator;
  }
  function stop() {
    if (disposed) return;
    disposed = true;
    for (const { oscillator, envelope } of nodes) {
      oscillator.onended = null;
      try { oscillator.stop(); } catch {}
      oscillator.disconnect(); envelope.disconnect();
    }
    output.disconnect(); finish();
  }
  tone('triangle', 0, 1.05, 48, 210, .75);
  tone('sawtooth', .08, .85, 90, 680, .12);
  tone('sine', .9, .14, 740, 740, .42);
  tone('sine', 1.1, .27, 1108, 1108, .38).onended = stop;
  return { finished, stop };
}
