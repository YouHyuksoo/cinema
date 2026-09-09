import { describe, expect, it } from 'vitest';
import { configureJarvisSpeech, hasKnownVoice, isKnownFemaleVoice, isKnownMaleVoice, selectJarvisVoice } from '@/cinema/jarvisSpeechProfile';
import { VOICE_GENDERS, realtimeVoiceFor, voiceGenderOf } from '@/cinema/jarvisVoiceGender';

const voice = (name: string, lang = 'ko-KR', isDefault = false): SpeechSynthesisVoice => ({ name, lang, default: isDefault, voiceURI: name, localService: true });
describe('Jarvis Korean voice selection by gender', () => {
  const female = voice('Microsoft SunHi', 'ko-KR', true), male = voice('Microsoft InJoon'), unknown = voice('Korean Voice 3');
  it('prefers a recognized Korean voice of the requested gender over the default and an English one', () => {
    expect(selectJarvisVoice([voice('English Male', 'en-US', true), female, male], 'male')).toBe(male);
    expect(selectJarvisVoice([voice('English Female', 'en-US', true), male, female], 'female')).toBe(female);
    expect(selectJarvisVoice([female, male])).toBe(male);
  });
  it('avoids a voice recognized as the other gender before falling back to any Korean voice', () => {
    expect(selectJarvisVoice([female, unknown], 'male')).toBe(unknown);
    expect(selectJarvisVoice([male, unknown], 'female')).toBe(unknown);
    expect(selectJarvisVoice([female], 'male')).toBe(female);
    expect(hasKnownVoice([female], 'male')).toBe(false); expect(hasKnownVoice([female], 'female')).toBe(true);
    expect(isKnownMaleVoice(voice('Korean Female'))).toBe(false); expect(isKnownFemaleVoice(voice('Korean Female'))).toBe(true);
    expect(selectJarvisVoice([voice('English Male', 'en-US')])).toBeNull();
    expect(selectJarvisVoice([])).toBeNull();
  });
  it('applies the low robot register to the male voice and a natural pitch to the female voice', () => {
    const utterance = { lang: '', voice: null, pitch: 1, rate: 1, volume: 1 } as unknown as SpeechSynthesisUtterance;
    configureJarvisSpeech(utterance, [female, male], 'male');
    expect(utterance).toMatchObject({ lang: 'ko-KR', voice: male, pitch: .72, rate: .94 });
    configureJarvisSpeech(utterance, [female, male], 'female');
    expect(utterance).toMatchObject({ voice: female, pitch: 1 });
  });
  it('maps the two genders onto one realtime voice each and back', () => {
    expect(VOICE_GENDERS.map(option => option.id)).toEqual(['male', 'female']);
    expect(realtimeVoiceFor('male')).toBe('cedar'); expect(realtimeVoiceFor('female')).toBe('marin');
    expect(voiceGenderOf('marin')).toBe('female'); expect(voiceGenderOf('cedar')).toBe('male'); expect(voiceGenderOf('ash')).toBe('male');
  });
});
