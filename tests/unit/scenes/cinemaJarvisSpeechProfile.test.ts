import { describe, expect, it } from 'vitest';
import { selectJarvisVoice, isKnownMaleVoice } from '@/cinema/jarvisSpeechProfile';

const voice = (name: string, lang = 'ko-KR', isDefault = false): SpeechSynthesisVoice => ({ name, lang, default: isDefault, voiceURI: name, localService: true });
describe('Jarvis Korean voice selection', () => {
  const female = voice('Microsoft SunHi', 'ko-KR', true), male = voice('Microsoft InJoon');
  it('prefers a recognized Korean male over the default and an English male', () => {
    expect(selectJarvisVoice([voice('English Male', 'en-US', true), female, male])).toBe(male);
  });
  it('honors a manual Korean selection before automatic preference', () => {
    expect(selectJarvisVoice([female, male], female.voiceURI)).toBe(female);
  });
  it('falls back to Korean without labeling a lowered female voice as male', () => {
    expect(isKnownMaleVoice(voice('Korean Female'))).toBe(false);
    expect(selectJarvisVoice([female], 'removed-voice')).toBe(female);
    expect(selectJarvisVoice([voice('English Male', 'en-US')])).toBeNull();
    expect(selectJarvisVoice([])).toBeNull();
  });
});
