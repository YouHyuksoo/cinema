/**
 * The only voice choice HATCHERY exposes: a male or a female voice. Each maps to one OpenAI realtime
 * voice and to a persona line the instructions adopt; the browser engine picks a Korean voice by name.
 */
export type VoiceGender = 'male' | 'female';

export interface VoiceGenderOption {
  id: VoiceGender;
  label: string;
  /** OpenAI realtime voice id (see JARVIS_REALTIME_VOICES). */
  realtimeVoice: 'cedar' | 'marin';
  /** How the persona section describes the delivery for this voice. */
  persona: string;
  /** Browser speech profile; the male profile keeps the deliberate low robot register. */
  speech: { pitch: number; rate: number; volume: number };
}

export const VOICE_GENDERS: readonly VoiceGenderOption[] = [
  { id: 'male', label: '남성', realtimeVoice: 'cedar', persona: '낮고 차분한 남성 목소리', speech: { pitch: .72, rate: .94, volume: 1 } },
  { id: 'female', label: '여성', realtimeVoice: 'marin', persona: '또렷하고 차분한 여성 목소리', speech: { pitch: 1, rate: .96, volume: 1 } },
];
export const DEFAULT_VOICE_GENDER: VoiceGender = 'male';

export const isVoiceGender = (value: unknown): value is VoiceGender => VOICE_GENDERS.some(option => option.id === value);
export const voiceGenderOption = (gender: VoiceGender) => VOICE_GENDERS.find(option => option.id === gender) ?? VOICE_GENDERS[0];
export const realtimeVoiceFor = (gender: VoiceGender) => voiceGenderOption(gender).realtimeVoice;
/** Realtime voice id back to the gender the persona should follow; unknown or legacy ids count as male. */
export const voiceGenderOf = (voice: string): VoiceGender => VOICE_GENDERS.find(option => option.realtimeVoice === voice)?.id ?? DEFAULT_VOICE_GENDER;
