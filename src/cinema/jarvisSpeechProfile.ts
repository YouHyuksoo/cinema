import { DEFAULT_VOICE_GENDER, voiceGenderOption, type VoiceGender } from './jarvisVoiceGender';

/** The male profile: the deliberate low robot register HATCHERY started with. */
export const JARVIS_SPEECH_PROFILE = voiceGenderOption('male').speech;

export function koreanSpeechVoices(voices: readonly SpeechSynthesisVoice[]) {
  return voices.filter(voice => /^ko(?:[-_]|$)/i.test(voice.lang));
}

/** The browser API has no gender field. Recognize documented names or an explicit label only. */
export function isKnownMaleVoice(voice: SpeechSynthesisVoice) {
  return /InJoon|Hyunsu|BongJin|GookMin|Junho|Minsu|\bmale\b|남성/i.test(voice.name);
}
export function isKnownFemaleVoice(voice: SpeechSynthesisVoice) {
  return /SunHi|Heami|JiMin|SeoHyeon|SoonBok|YuJin|Yuna|Sora|Suhyun|Jian|Google 한국의|\bfemale\b|여성/i.test(voice.name);
}

/**
 * A Korean voice for the requested gender: a recognized name first, then any Korean voice not
 * recognized as the other gender (the default one preferred), then whatever Korean voice exists.
 */
export function selectJarvisVoice(voices: readonly SpeechSynthesisVoice[], gender: VoiceGender = DEFAULT_VOICE_GENDER) {
  const korean = koreanSpeechVoices(voices);
  const wanted = gender === 'male' ? isKnownMaleVoice : isKnownFemaleVoice;
  const other = gender === 'male' ? isKnownFemaleVoice : isKnownMaleVoice;
  return korean.find(wanted)
    ?? korean.find(voice => !other(voice) && voice.default)
    ?? korean.find(voice => !other(voice))
    ?? korean.find(voice => voice.default)
    ?? korean[0] ?? null;
}

/** True when the list holds a voice recognized as the requested gender, so the pick is not a fallback. */
export function hasKnownVoice(voices: readonly SpeechSynthesisVoice[], gender: VoiceGender) {
  return koreanSpeechVoices(voices).some(gender === 'male' ? isKnownMaleVoice : isKnownFemaleVoice);
}

export function configureJarvisSpeech(utterance: SpeechSynthesisUtterance, voices: readonly SpeechSynthesisVoice[], gender: VoiceGender = DEFAULT_VOICE_GENDER) {
  utterance.lang = 'ko-KR';
  utterance.voice = selectJarvisVoice(voices, gender);
  Object.assign(utterance, voiceGenderOption(gender).speech);
}
