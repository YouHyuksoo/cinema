import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JarvisRecognition } from '@/cinema/jarvisAudio';

vi.mock('react', () => ({
  useRef: <T>(value: T) => ({ current: value }),
  useState: <T>(value: T) => [value, vi.fn()],
  useEffect: vi.fn(),
  useCallback: <T extends (...args: never[]) => unknown>(callback: T) => callback,
}));
vi.mock('@/cinema/jarvisShutdownSound', () => ({ playJarvisShutdownSound: vi.fn() }));

import { useInputDictation } from '@/cinema/useInputDictation';

class Recognition implements JarvisRecognition {
  static instances: Recognition[] = [];
  lang = ''; continuous = true; interimResults = true;
  onstart: JarvisRecognition['onstart'] = null;
  onend: JarvisRecognition['onend'] = null;
  onerror: JarvisRecognition['onerror'] = null;
  onresult: JarvisRecognition['onresult'] = null;
  start = vi.fn(() => this.onstart?.());
  abort = vi.fn();
  constructor() { Recognition.instances.push(this); }
}

beforeEach(() => {
  Recognition.instances = [];
  vi.stubGlobal('window', { SpeechRecognition: Recognition });
});

describe('local input dictation', () => {
  it('submits the final transcript once when silence ends the utterance', () => {
    const onInput = vi.fn(), onSubmit = vi.fn();
    const dictation = useInputDictation('기존', onInput, false, onSubmit);
    dictation.toggle();
    const recognition = Recognition.instances[0];
    expect(recognition.continuous).toBe(false);
    recognition.onresult?.({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: '새 질문' } }] });
    expect(onInput).toHaveBeenCalledWith('기존 새 질문');
    recognition.onend?.(); recognition.onend?.();
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith('기존 새 질문');
  });

  it('does not submit when the operator stops dictation manually', () => {
    const onSubmit = vi.fn();
    const dictation = useInputDictation('', vi.fn(), false, onSubmit);
    dictation.toggle();
    const recognition = Recognition.instances[0];
    recognition.onresult?.({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: '보내지 마' } }] });
    dictation.stop(); recognition.onend?.();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
