let stopPrevious: (() => void) | null = null;

/** Short holographic sweep used only for explicit scene transitions. */
export function playFilmTransitionSound() {
  if (typeof window === 'undefined' || typeof AudioContext === 'undefined') return;
  stopPrevious?.();
  let context: AudioContext;
  try { context = new AudioContext(); } catch { return; }
  const nodes: AudioNode[] = [];
  const oscillators: OscillatorNode[] = [];
  let disposed = false;
  const timeout = window.setTimeout(stop, 1800);
  function stop() {
    if (disposed) return;
    disposed = true; window.clearTimeout(timeout);
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
    const output = context.createGain(); nodes.push(output);
    output.gain.value = .16; output.connect(context.destination);
    const now = context.currentTime + .01;
    const tone = (type: OscillatorType, delay: number, duration: number, from: number, to: number, gain: number) => {
      const oscillator = context.createOscillator(), envelope = context.createGain();
      oscillators.push(oscillator); nodes.push(oscillator, envelope);
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(from, now + delay);
      oscillator.frequency.exponentialRampToValueAtTime(to, now + delay + duration);
      envelope.gain.setValueAtTime(.001, now + delay);
      envelope.gain.linearRampToValueAtTime(gain, now + delay + .025);
      envelope.gain.exponentialRampToValueAtTime(.001, now + delay + duration);
      oscillator.connect(envelope); envelope.connect(output);
      oscillator.start(now + delay); oscillator.stop(now + delay + duration + .02);
      return oscillator;
    };
    tone('sine', 0, .42, 170, 760, .7);
    tone('triangle', .05, .5, 360, 1180, .3);
    tone('sine', .31, .22, 1320, 980, .42).onended = stop;
  }).catch(stop);
}
