export const ROBOT_VOICE_STYLES = [
  { id: 'natural', label: '자연 음성', description: '전자음 효과 없이 기본 음색으로 말합니다.' },
  { id: 'jarvis', label: 'HATCHERY형', description: '명료한 목소리에 은은한 금속 울림을 더합니다.' },
  { id: 'android', label: '안드로이드형', description: '강한 전자음이 겹쳐지는 기계 목소리입니다.' },
  { id: 'radio', label: '통신 로봇형', description: '무전기 같은 좁은 음역과 거친 질감을 만듭니다.' },
] as const;
export type RobotVoiceStyle = (typeof ROBOT_VOICE_STYLES)[number]['id'];
export interface RobotVoiceSettings { style: RobotVoiceStyle; strength: number }
export const DEFAULT_ROBOT_VOICE: RobotVoiceSettings = { style: 'android', strength: .75 };
export function robotVoiceParameters(settings: RobotVoiceSettings) {
  const strength = Number.isFinite(settings.strength) ? Math.max(0, Math.min(1, settings.strength)) : 0;
  const presets = {
    natural: { highpass: 70, lowpass: 10000, frequency: 40, depth: 0, mix: 0 },
    jarvis: { highpass: 100, lowpass: 6500, frequency: 38, depth: .35, mix: .7 },
    android: { highpass: 140, lowpass: 4800, frequency: 82, depth: .9, mix: 1 },
    radio: { highpass: 420, lowpass: 2600, frequency: 52, depth: .55, mix: 1 },
  };
  const preset = presets[settings.style] ?? presets.natural;
  const wet = strength * preset.mix;
  return { ...preset, wet, dry: 1 - wet };
}

/** A single speaker path for remote audio; microphone capture never enters this graph. */
export function createRobotVoice(context: AudioContext, source: AudioNode, settings: RobotVoiceSettings) {
  const dry = context.createGain(), wet = context.createGain(), modulator = context.createGain();
  const carrier = context.createOscillator(), depth = context.createGain();
  const highpass = context.createBiquadFilter(), lowpass = context.createBiquadFilter();
  const shaper = context.createWaveShaper(), limiter = context.createDynamicsCompressor();
  const volume = context.createGain(), analyser = context.createAnalyser();
  const nodes = [dry, wet, modulator, carrier, depth, highpass, lowpass, shaper, limiter, volume, analyser];
  highpass.type = 'highpass'; lowpass.type = 'lowpass'; highpass.Q.value = .7; lowpass.Q.value = .7;
  const curve = new Float32Array(2049);
  for (let i = 0; i < curve.length; i++) { const x = i / (curve.length - 1) * 2 - 1; curve[i] = Math.tanh(1.8 * x) / Math.tanh(1.8); }
  shaper.curve = curve; shaper.oversample = '2x';
  limiter.threshold.value = -6; limiter.knee.value = 12; limiter.ratio.value = 8;
  limiter.attack.value = .003; limiter.release.value = .12; volume.gain.value = .85;
  analyser.fftSize = 1024; carrier.type = 'sine';
  source.connect(dry); dry.connect(limiter);
  source.connect(highpass); highpass.connect(lowpass); lowpass.connect(shaper); shaper.connect(modulator);
  carrier.connect(depth); depth.connect(modulator.gain); modulator.connect(wet); wet.connect(limiter);
  limiter.connect(volume); volume.connect(analyser); analyser.connect(context.destination);
  let disposed = false;
  function update(next: RobotVoiceSettings, initial = false) {
    if (disposed) return;
    const value = robotVoiceParameters(next);
    const set = (param: AudioParam, number: number) => {
      if (initial) param.value = number;
      else { param.cancelScheduledValues(context.currentTime); param.setTargetAtTime(number, context.currentTime, .03); }
    };
    set(dry.gain, value.dry); set(wet.gain, value.wet);
    set(highpass.frequency, value.highpass); set(lowpass.frequency, value.lowpass);
    set(carrier.frequency, value.frequency); set(depth.gain, value.depth); set(modulator.gain, 1 - value.depth);
  }
  update(settings, true); carrier.start();
  return { analyser, update, dispose() {
    if (disposed) return; disposed = true;
    carrier.stop(); source.disconnect(dry); source.disconnect(highpass);
    nodes.forEach(node => node.disconnect());
  } };
}
