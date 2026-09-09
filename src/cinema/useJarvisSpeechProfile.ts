'use client';
import { useEffect, useRef, useState } from 'react';
import { hasKnownVoice, koreanSpeechVoices, selectJarvisVoice } from './jarvisSpeechProfile';
import { DEFAULT_VOICE_GENDER, type VoiceGender } from './jarvisVoiceGender';

/** The one voice choice (male/female) shared by the browser engine and the realtime session. */
export function useJarvisSpeechProfile() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [gender, setGenderState] = useState<VoiceGender>(DEFAULT_VOICE_GENDER);
  // Read inside speech callbacks, which must not capture a stale render.
  const preferredGender = useRef<VoiceGender>(DEFAULT_VOICE_GENDER);
  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    const synth = window.speechSynthesis;
    const update = () => setVoices(koreanSpeechVoices(synth.getVoices()));
    const frame = requestAnimationFrame(update);
    synth.addEventListener('voiceschanged', update);
    return () => { cancelAnimationFrame(frame); synth.removeEventListener('voiceschanged', update); };
  }, []);
  return { voices, gender, preferredGender, selected: selectJarvisVoice(voices, gender), recognized: hasKnownVoice(voices, gender),
    setGender(value: VoiceGender) { preferredGender.current = value; setGenderState(value); } };
}
