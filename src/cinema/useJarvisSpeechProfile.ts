'use client';
import { useEffect, useRef, useState } from 'react';
import { koreanSpeechVoices, selectJarvisVoice } from './jarvisSpeechProfile';

export function useJarvisSpeechProfile() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState('');
  const preferredVoice = useRef('');
  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    const synth = window.speechSynthesis;
    const update = () => setVoices(koreanSpeechVoices(synth.getVoices()));
    const frame = requestAnimationFrame(update);
    synth.addEventListener('voiceschanged', update);
    return () => { cancelAnimationFrame(frame); synth.removeEventListener('voiceschanged', update); };
  }, []);
  return { voices, voiceURI, preferredVoice, selected: selectJarvisVoice(voices, voiceURI),
    select(value: string) { preferredVoice.current = value; setVoiceURI(value); } };
}
