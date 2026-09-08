export const JARVIS_SPEECH_PROFILE = { pitch: .72, rate: .94, volume: 1 } as const;

export function koreanSpeechVoices(voices: readonly SpeechSynthesisVoice[]) {
  return voices.filter(voice => /^ko(?:[-_]|$)/i.test(voice.lang));
}

/** The browser API has no gender field. Recognize documented names or an explicit male label only. */
export function isKnownMaleVoice(voice: SpeechSynthesisVoice) {
  return /InJoon|Hyunsu|BongJin|GookMin|Junho|\bmale\b|남성/i.test(voice.name);
}

export function selectJarvisVoice(voices: readonly SpeechSynthesisVoice[], voiceURI = '') {
  const korean = koreanSpeechVoices(voices);
  return korean.find(voice => voice.voiceURI === voiceURI)
    ?? korean.find(isKnownMaleVoice)
    ?? korean.find(voice => voice.default)
    ?? korean[0] ?? null;
}

export function configureJarvisSpeech(utterance: SpeechSynthesisUtterance, voices: readonly SpeechSynthesisVoice[], voiceURI = '') {
  utterance.lang = 'ko-KR';
  utterance.voice = selectJarvisVoice(voices, voiceURI);
  Object.assign(utterance, JARVIS_SPEECH_PROFILE);
}
