import { describe, expect, it } from 'vitest';
import { AI_PROVIDERS, DEFAULT_AI_CONFIG, aiKeyVault, aiProviderReadiness, maskAiConfig, mergeAiKey, parseAiConfig, type AiConfig } from '@/cinema/aiConfig';
import { DEFAULT_JARVIS_PROMPT, JARVIS_VOICE_PLACEHOLDER, effectiveJarvisPrompt, renderJarvisPrompt } from '@/cinema/jarvisPrompt';
import { parseHatcheryConfig } from '@/cinema/feedConfig';
import { CODEX_RESPONSES_URL, buildChatRequest, extractChatText, extractSseText } from '@/server/cinema/aiProviders';
import { jwtExpiry, readCodexTokens } from '@/server/cinema/codexAuth';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const saved: AiConfig = { provider: 'anthropic', model: 'claude-sonnet-5', apiKey: 'sk-ant-secret', temperature: 0.4, maxOutputTokens: 600,
  instructions: '세 문장 이내로 답할 것.', prompt: '', realtimeModel: 'gpt-realtime-2.1-mini', voiceMode: 'realtime' };

describe('AI settings model', () => {
  it('lists four providers, OpenAI API alone realtime-capable and the ChatGPT subscription keyless', () => {
    expect(AI_PROVIDERS.map(provider => provider.id)).toEqual(['openai', 'chatgpt', 'anthropic', 'gemini']);
    expect(AI_PROVIDERS.filter(provider => provider.realtime).map(provider => provider.id)).toEqual(['openai']);
    expect(AI_PROVIDERS.find(provider => provider.id === 'chatgpt')?.auth).toBe('codex');
  });
  it('validates provider, model, ranges and instruction length, filling defaults for omitted settings', () => {
    expect(parseAiConfig({ provider: 'openai', model: 'gpt-4.1-mini' })).toEqual({ ok: true, config: { ...DEFAULT_AI_CONFIG } });
    expect(parseAiConfig({ provider: 'cohere', model: 'x' })).toMatchObject({ ok: false });
    expect(parseAiConfig({ provider: 'gemini', model: '' })).toMatchObject({ ok: false });
    expect(parseAiConfig({ provider: 'gemini', model: 'bad model name' })).toMatchObject({ ok: false });
    expect(parseAiConfig({ provider: 'openai', model: 'gpt-5', temperature: 3 })).toMatchObject({ ok: false });
    expect(parseAiConfig({ provider: 'openai', model: 'gpt-5', maxOutputTokens: 10 })).toMatchObject({ ok: false });
    expect(parseAiConfig({ provider: 'openai', model: 'gpt-5', instructions: 'x'.repeat(4001) })).toMatchObject({ ok: false });
    const parsed = parseAiConfig({ provider: 'anthropic', model: ' claude-sonnet-5 ', apiKey: ' k ', temperature: '0.456', maxOutputTokens: 900, instructions: ' 짧게 ' });
    expect(parsed).toEqual({ ok: true, config: { provider: 'anthropic', model: 'claude-sonnet-5', apiKey: 'k', temperature: 0.46, maxOutputTokens: 900, instructions: '짧게', prompt: '', realtimeModel: DEFAULT_AI_CONFIG.realtimeModel, voiceMode: 'realtime' } });
    expect(parseAiConfig({ provider: 'openai', model: 'gpt-5', prompt: ' # 역할\n짧게. ' })).toMatchObject({ ok: true, config: { prompt: '# 역할\n짧게.' } });
    expect(parseAiConfig({ provider: 'openai', model: 'gpt-5', prompt: 'x'.repeat(12001) })).toMatchObject({ ok: false });
    expect(parseAiConfig({ provider: 'openai', model: 'gpt-5', apiKeys: { anthropic: ' sk-a ', gemini: '', cohere: 'x', openai: 7 } })).toMatchObject({ ok: true, config: { apiKeys: { anthropic: 'sk-a' } } });
    expect(parseAiConfig({ provider: 'openai', model: 'gpt-5', apiKeys: { gemini: '' } }).ok && 'apiKeys' in (parseAiConfig({ provider: 'openai', model: 'gpt-5', apiKeys: { gemini: '' } }) as { config: AiConfig }).config).toBe(false);
    expect(parseAiConfig({ provider: 'chatgpt', model: 'gpt-6-astra', voiceMode: 'browser' })).toMatchObject({ ok: true, config: { provider: 'chatgpt', apiKey: '', voiceMode: 'browser' } });
    expect(parseAiConfig({ provider: 'openai', model: 'gpt-5', voiceMode: 'phone' })).toMatchObject({ ok: false });
  });
  it('masks the key and reports where it comes from', () => {
    expect(maskAiConfig(saved, true)).toEqual({ provider: 'anthropic', model: 'claude-sonnet-5', temperature: 0.4, maxOutputTokens: 600,
      instructions: '세 문장 이내로 답할 것.', prompt: '', realtimeModel: 'gpt-realtime-2.1-mini', voiceMode: 'realtime', hasApiKey: true, keySource: 'config' });
    expect(JSON.stringify(maskAiConfig({ ...saved, apiKeys: { gemini: 'AIza-secret' } }, true))).not.toContain('AIza-secret');
    expect(maskAiConfig({ ...saved, provider: 'chatgpt', apiKey: '' }, true, true)).toMatchObject({ hasApiKey: true, keySource: 'codex' });
    expect(maskAiConfig({ ...saved, provider: 'chatgpt', apiKey: '' }, true, false)).toMatchObject({ hasApiKey: false, keySource: 'none' });
    expect(maskAiConfig(undefined, true)).toMatchObject({ provider: 'openai', hasApiKey: true, keySource: 'env' });
    expect(maskAiConfig(undefined, false)).toMatchObject({ hasApiKey: false, keySource: 'none' });
    expect(maskAiConfig({ ...saved, apiKey: '' }, true)).toMatchObject({ hasApiKey: false, keySource: 'none' });
    expect(JSON.stringify(maskAiConfig(saved, true))).not.toContain('sk-ant-secret');
  });
  it('keeps the saved key when the screen sends none for the same provider only', () => {
    expect(mergeAiKey({ ...saved, apiKey: '' }, saved).apiKey).toBe('sk-ant-secret');
    expect(mergeAiKey({ ...saved, apiKey: 'new' }, saved).apiKey).toBe('new');
    expect(mergeAiKey({ ...saved, provider: 'gemini', apiKey: '' }, saved).apiKey).toBe('');
    expect(mergeAiKey({ ...saved, apiKey: '' }, undefined)).toEqual({ ...saved, apiKey: '' });
  });
  it('moves the previous provider key into the vault and brings it back when that provider is re-selected', () => {
    const gemini = mergeAiKey({ ...saved, provider: 'gemini', model: 'gemini-2.5-flash', apiKey: 'AIza1' }, saved);
    expect(gemini).toMatchObject({ provider: 'gemini', apiKey: 'AIza1', apiKeys: { anthropic: 'sk-ant-secret' } });
    const back = mergeAiKey({ ...gemini, provider: 'anthropic', apiKey: '' }, gemini);
    expect(back).toMatchObject({ provider: 'anthropic', apiKey: 'sk-ant-secret', apiKeys: { gemini: 'AIza1' } });
    // The ChatGPT route has no key of its own but keeps everyone else's.
    const chatgpt = mergeAiKey({ ...back, provider: 'chatgpt', apiKey: 'ignored' }, back);
    expect(chatgpt).toMatchObject({ provider: 'chatgpt', apiKey: '', apiKeys: { gemini: 'AIza1', anthropic: 'sk-ant-secret' } });
    expect(aiKeyVault(chatgpt)).toEqual({ gemini: 'AIza1', anthropic: 'sk-ant-secret' });
    expect(aiKeyVault(undefined)).toEqual({});
    // A fresh key for the active provider wins over the vault copy.
    expect(mergeAiKey({ ...back, apiKey: 'sk-ant-new' }, { ...back, apiKeys: { anthropic: 'stale', gemini: 'AIza1' } })).toMatchObject({ apiKey: 'sk-ant-new', apiKeys: { gemini: 'AIza1' } });
  });
  it('reports which providers the main screen may switch to', () => {
    expect(aiProviderReadiness(undefined, false, false)).toEqual({ openai: false, chatgpt: false, anthropic: false, gemini: false });
    expect(aiProviderReadiness(undefined, true, true)).toMatchObject({ openai: true, chatgpt: true, anthropic: false });
    expect(aiProviderReadiness({ ...saved, apiKeys: { gemini: 'AIza1' } }, false, false)).toEqual({ openai: false, chatgpt: false, anthropic: true, gemini: true });
  });
  it('renders the editable prompt with the voice persona and falls back to the built-in text', () => {
    expect(DEFAULT_JARVIS_PROMPT).toContain(JARVIS_VOICE_PLACEHOLDER);
    expect(DEFAULT_JARVIS_PROMPT.indexOf('# 성격과 말투')).toBeLessThan(DEFAULT_JARVIS_PROMPT.indexOf('# 규칙'));
    expect(effectiveJarvisPrompt('')).toBe(DEFAULT_JARVIS_PROMPT); expect(effectiveJarvisPrompt(undefined)).toBe(DEFAULT_JARVIS_PROMPT);
    expect(effectiveJarvisPrompt(' 짧게. ')).toBe('짧게.');
    const female = renderJarvisPrompt(DEFAULT_JARVIS_PROMPT, 'female');
    expect(female).toContain('여성 목소리'); expect(female).not.toContain(JARVIS_VOICE_PLACEHOLDER); expect(female).not.toContain('남성');
    expect(renderJarvisPrompt(DEFAULT_JARVIS_PROMPT, 'male')).toContain('남성 목소리');
    expect(renderJarvisPrompt('자리표시자 없음', 'female')).toBe('자리표시자 없음');
  });
  it('rides along inside the hatchery config file and stays optional', () => {
    expect(parseHatcheryConfig({ sources: [], feeds: [] })).toEqual({ ok: true, config: { sources: [], feeds: [] } });
    expect(parseHatcheryConfig({ sources: [], feeds: [], ai: saved })).toEqual({ ok: true, config: { sources: [], feeds: [], ai: saved } });
    expect(parseHatcheryConfig({ sources: [], feeds: [], ai: { provider: 'nope' } })).toMatchObject({ ok: false });
  });
});

describe('provider wire formats', () => {
  const turns = [{ role: 'user' as const, content: '안녕' }, { role: 'assistant' as const, content: '네' }, { role: 'user' as const, content: '상태는?' }];
  it('builds an OpenAI Responses call with instructions, sampling and no storage', () => {
    const { url, init } = buildChatRequest({ ...DEFAULT_AI_CONFIG, apiKey: 'sk-1', temperature: 0.2 }, 'SYS', turns);
    expect(url).toBe('https://api.openai.com/v1/responses');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk-1');
    expect(JSON.parse(init.body as string)).toMatchObject({ model: 'gpt-4.1-mini', store: false, instructions: 'SYS', temperature: 0.2, max_output_tokens: 800, input: turns });
  });
  it('builds an Anthropic Messages call with the system prompt separate and temperature capped at 1', () => {
    const { url, init } = buildChatRequest({ ...saved, temperature: 1.6 }, 'SYS', turns, 50);
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(init.headers).toMatchObject({ 'x-api-key': 'sk-ant-secret', 'anthropic-version': '2023-06-01' });
    expect(JSON.parse(init.body as string)).toEqual({ model: 'claude-sonnet-5', max_tokens: 50, temperature: 1, system: 'SYS', messages: turns });
  });
  it('builds a Gemini generateContent call with model roles and the key in a header, not the URL', () => {
    const { url, init } = buildChatRequest({ ...saved, provider: 'gemini', model: 'gemini-2.5-flash', apiKey: 'AIza1' }, 'SYS', turns);
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent');
    expect(url).not.toContain('AIza1');
    expect(init.headers).toMatchObject({ 'x-goog-api-key': 'AIza1' });
    const body = JSON.parse(init.body as string);
    expect(body.systemInstruction).toEqual({ parts: [{ text: 'SYS' }] });
    expect(body.contents.map((item: { role: string }) => item.role)).toEqual(['user', 'model', 'user']);
    expect(body.generationConfig).toEqual({ temperature: 0.4, maxOutputTokens: 600 });
  });
  it('talks to the Codex backend with the ChatGPT login and reads its SSE stream', () => {
    const codex = { accessToken: 'at', refreshToken: 'rt', accountId: 'acc-1', expiresAt: null };
    const { url, init } = buildChatRequest({ ...DEFAULT_AI_CONFIG, provider: 'chatgpt', model: 'gpt-6-astra' }, 'SYS', turns, 800, codex);
    expect(url).toBe(CODEX_RESPONSES_URL);
    expect(init.headers).toMatchObject({ Authorization: 'Bearer at', 'chatgpt-account-id': 'acc-1', 'OpenAI-Beta': 'responses=experimental' });
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ model: 'gpt-6-astra', instructions: 'SYS', store: false, stream: true });
    expect(body.temperature).toBeUndefined(); expect(body.max_output_tokens).toBeUndefined();
    expect(body.input[0]).toEqual({ type: 'message', role: 'user', content: [{ type: 'input_text', text: '안녕' }] });
    expect(body.input[1].content[0].type).toBe('output_text');
    const stream = ['event: response.output_text.delta', 'data: {"type":"response.output_text.delta","delta":"확"}', '',
      'data: {"type":"response.output_text.delta","delta":"인"}', '', 'data: [DONE]'].join('\n');
    expect(extractSseText(stream)).toBe('확인');
    const completed = 'data: {"type":"response.completed","response":{"output":[{"type":"message","content":[{"type":"output_text","text":"최종"}]}]}}';
    expect(extractSseText(stream + '\n' + completed)).toBe('최종');
    // The Codex backend's completed event usually has no text: fall back to the deltas.
    const emptyCompleted = 'data: {"type":"response.completed","response":{"output":[{"type":"reasoning"}]}}';
    expect(extractSseText(`${stream}\n${emptyCompleted}`)).toBe('확인');
  });
  it('reads the Codex CLI login file and its token expiry without exposing anything', () => {
    const dir = mkdtempSync(join(tmpdir(), 'codex-'));
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const jwt = `h.${Buffer.from(JSON.stringify({ exp })).toString('base64url')}.s`;
    writeFileSync(join(dir, 'auth.json'), JSON.stringify({ auth_mode: 'chatgpt', tokens: { access_token: jwt, refresh_token: 'rt', account_id: 'acc' } }));
    expect(jwtExpiry(jwt)).toBe(exp * 1000);
    expect(readCodexTokens(join(dir, 'auth.json'))).toEqual({ accessToken: jwt, refreshToken: 'rt', accountId: 'acc', expiresAt: exp * 1000 });
    writeFileSync(join(dir, 'auth.json'), JSON.stringify({ auth_mode: 'apikey', tokens: { access_token: jwt, refresh_token: 'rt', account_id: 'acc' } }));
    expect(readCodexTokens(join(dir, 'auth.json'))).toBeNull();
    expect(readCodexTokens(join(dir, 'missing.json'))).toBeNull();
    rmSync(dir, { recursive: true, force: true });
  });
  it('extracts reply text from each provider shape', () => {
    expect(extractChatText('openai', { output: [{ type: 'reasoning' }, { type: 'message', content: [{ type: 'output_text', text: ' 확인 ' }] }] })).toBe('확인');
    expect(extractChatText('anthropic', { content: [{ type: 'text', text: '확인' }, { type: 'tool_use' }] })).toBe('확인');
    expect(extractChatText('gemini', { candidates: [{ content: { parts: [{ text: '확' }, { text: '인' }] } }] })).toBe('확\n인');
    expect(extractChatText('gemini', {})).toBe('');
  });
});
