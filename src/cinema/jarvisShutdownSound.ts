let stopPrevious: (() => void) | null = null;

/** A fading motor power-down, independent of the microphone's audio context. */
export function playJarvisShutdownSound() {
  if (typeof window === 'undefined' || typeof AudioContext === 'undefined') return;
  stopPrevious?.();
  let context: AudioContext;
  try { context = new AudioContext(); } catch { return; }
  const nodes: AudioNode[] = [];
  const oscillators: OscillatorNode[] = [];
  let disposed = false;
  // Also release a suspended context if the browser cannot start playback.
  const timeout = window.setTimeout(stop, 3000);
  function stop() {
    if (disposed) return;
    disposed = true;
    window.clearTimeout(timeout);
    for (const oscillator of oscillators) {
      oscillator.onended = null;
      try { oscillator.stop(); } catch {}
    }
    for (const node of nodes) node.disconnect();
    void context.close().catch(() => {});
    if (stopPrevious === stop) stopPrevious = null;
  }
  stopPrevious = stop;
  void context.resume().then(() => {
    if (disposed) return;
    const output = context.createGain();
    nodes.push(output);
    output.gain.value = .22;
    output.connect(context.destination);
    const now = context.currentTime + .02;
    function tone(type: OscillatorType, duration: number, from: number, to: number, gain: number) {
      const oscillator = context.createOscillator(), envelope = context.createGain();
      oscillators.push(oscillator); nodes.push(oscillator, envelope);
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(from, now);
      oscillator.frequency.exponentialRampToValueAtTime(to, now + duration);
      envelope.gain.setValueAtTime(0, now);
      envelope.gain.linearRampToValueAtTime(gain, now + .025);
      envelope.gain.exponentialRampToValueAtTime(.001, now + duration);
      oscillator.connect(envelope); envelope.connect(output);
      oscillator.start(now); oscillator.stop(now + duration + .02);
      return oscillator;
    }
    tone('sine', .55, 880, 220, .35);
    tone('sawtooth', 1.1, 420, 45, .1);
    tone('triangle', 1.6, 180, 32, .7).onended = stop;
  }).catch(stop);
}
