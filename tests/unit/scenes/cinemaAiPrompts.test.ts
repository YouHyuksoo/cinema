import { expect, it } from 'vitest';
import { aiPromptFor, DEFAULT_ANALYSIS_PROMPT } from '@/cinema/aiPrompts';
import { DEFAULT_AI_CONFIG, parseAiConfig } from '@/cinema/aiConfig';
import { DEFAULT_JARVIS_PROMPT } from '@/cinema/jarvisPrompt';
it('keeps voice and analysis prompts and directives independent through saving', () => {
  const result = parseAiConfig({ ...DEFAULT_AI_CONFIG, prompt: 'analysis only', instructions: 'analysis extra', voicePrompt: 'voice only', voiceInstructions: 'voice extra' });
  if (!result.ok) throw new Error(result.reason);
  expect(aiPromptFor(result.config, 'analysis')).toEqual({prompt:'analysis only',extra:'analysis extra'});
  expect(aiPromptFor(result.config, 'voice')).toEqual({prompt:'voice only',extra:'voice extra'});
  expect(aiPromptFor(undefined,'analysis').prompt).toBe(DEFAULT_ANALYSIS_PROMPT);
  expect(aiPromptFor({prompt:'legacy'},'voice').prompt).toBe(DEFAULT_JARVIS_PROMPT);
});
