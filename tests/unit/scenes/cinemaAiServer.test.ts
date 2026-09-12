import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GET as getAi, PATCH as patchAi, PUT as putAi } from '@/app/api/cinema/admin/ai/route';
import { POST as testAi } from '@/app/api/cinema/admin/ai/test/route';
import { GET as assistantStatus, POST as assistant } from '@/app/api/cinema/assistant/route';
import { POST as realtime } from '@/app/api/cinema/realtime/route';
import { readConfig, writeConfig } from '@/server/cinema/hatcheryConfig';
import { resolveAiRuntime } from '@/server/cinema/aiProviders';
import { realtimeConfiguration } from '@/server/cinema/openai';
import { DEFAULT_JARVIS_PROMPT } from '@/cinema/jarvisPrompt';
import { writeFileSync } from 'node:fs';

const request = (method: string, body?: unknown, contentType = 'application/json') => new Request('http://localhost:3000/api/cinema/x', {
  method, headers: { origin: 'http://localhost:3000', 'Content-Type': contentType }, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
});
const anthropic = { provider: 'anthropic', model: 'claude-sonnet-5', apiKey: 'sk-ant-secret', temperature: 0.4, maxOutputTokens: 600, instructions: '세 문장 이내로.' };
const mistral = { ...anthropic, provider: 'mistral', model: 'mistral-small-latest', apiKey: 'mistral-secret' };
const codexJwt = () => `h.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.s`;

let dir = '';
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'hatchery-ai-'));
  vi.stubEnv('HATCHERY_CONFIG_PATH', join(dir, 'sources.json'));
  vi.stubEnv('CODEX_HOME', join(dir, 'codex-home'));
  vi.stubEnv('OPENAI_API_KEY', '');
  vi.stubGlobal('fetch', vi.fn());
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); rmSync(dir, { recursive: true, force: true }); });

describe('AI settings API', () => {
  it('starts unsaved, saves a provider with its key on the server only, and keeps the key on a blank resave', async () => {
    const initial = await (await getAi(request('GET'))).json();
    expect(initial).toMatchObject({ saved: false, ai: { provider: 'openai', hasApiKey: false, keySource: 'none' } });
    expect(initial.providers.map((provider: { id: string }) => provider.id)).toEqual(['openai', 'chatgpt', 'anthropic', 'gemini', 'mistral']);

    const saved = await (await putAi(request('PUT', anthropic))).json();
    expect(saved).toMatchObject({ saved: true, ai: { provider: 'anthropic', model: 'claude-sonnet-5', hasApiKey: true, keySource: 'config', instructions: '세 문장 이내로.' } });
    expect(JSON.stringify(saved)).not.toContain('sk-ant-secret');
    expect(JSON.parse(readFileSync(join(dir, 'sources.json'), 'utf8')).ai.apiKey).toBe('sk-ant-secret');

    await putAi(request('PUT', { ...anthropic, apiKey: '', temperature: 0.9 }));
    expect(readConfig().config.ai).toMatchObject({ apiKey: 'sk-ant-secret', temperature: 0.9 });
    expect(await (await putAi(request('PUT', { provider: 'nope' }))).status).toBe(400);
  });
  it('switches the voice mode alone from the main screen, keeping provider, key and prompt', async () => {
    expect(await (await patchAi(request('PATCH', { voiceMode: 'phone' }))).status).toBe(400);
    // Nothing saved yet: the mode is recorded and the environment key keeps answering.
    vi.stubEnv('OPENAI_API_KEY', 'env-key');
    expect(await (await patchAi(request('PATCH', { voiceMode: 'browser' }))).json()).toMatchObject({ ai: { provider: 'openai', voiceMode: 'browser', keySource: 'env' } });
    expect(await (await assistantStatus()).json()).toMatchObject({ aiConfigured: true, realtimeAvailable: true, useRealtime: false, voiceMode: 'browser' });
    await putAi(request('PUT', anthropic));
    await patchAi(request('PATCH', { voiceMode: 'browser' }));
    expect(readConfig().config.ai).toMatchObject({ provider: 'anthropic', apiKey: 'sk-ant-secret', instructions: '세 문장 이내로.', voiceMode: 'browser' });
    await patchAi(request('PATCH', { voiceMode: 'realtime' }));
    expect(readConfig().config.ai?.voiceMode).toBe('realtime');
  });
  it('switches the provider from the main screen only among providers with credentials, keeping every key in the vault', async () => {
    expect(await (await patchAi(request('PATCH', {}))).status).toBe(400);
    expect(await (await patchAi(request('PATCH', { provider: 'cohere' }))).status).toBe(400);
    expect(await (await patchAi(request('PATCH', { provider: 'openai', model: 'bad model' }))).status).toBe(400);
    await putAi(request('PUT', anthropic));
    await putAi(request('PUT', { ...anthropic, provider: 'gemini', model: 'gemini-2.5-flash', apiKey: 'AIza1' }));
    // The settings screen saw Anthropic, then Gemini: both keys are on file and the status lists both as switchable.
    let status = await (await assistantStatus()).json();
    expect(status).toMatchObject({ selectedProvider: 'gemini', selectedModel: 'gemini-2.5-flash' });
    expect(status.providers.map((p: { id: string; ready: boolean }) => [p.id, p.ready])).toEqual([['openai', false], ['chatgpt', false], ['anthropic', true], ['gemini', true], ['mistral', false]]);
    expect(JSON.stringify(status)).not.toMatch(/sk-ant-secret|AIza1/);
    // Back to Anthropic from the main screen without re-entering its key; the catalogue's first model applies.
    const switched = await (await patchAi(request('PATCH', { provider: 'anthropic' }))).json();
    expect(switched).toMatchObject({ ai: { provider: 'anthropic', model: 'claude-sonnet-5', hasApiKey: true, keySource: 'config', instructions: '세 문장 이내로.' } });
    expect(readConfig().config.ai).toMatchObject({ provider: 'anthropic', apiKey: 'sk-ant-secret', apiKeys: { gemini: 'AIza1' } });
    expect(resolveAiRuntime()).toMatchObject({ provider: 'anthropic', apiKey: 'sk-ant-secret' });
    // A model alone; and a provider with an explicit model.
    await patchAi(request('PATCH', { model: 'claude-opus-5' }));
    expect(readConfig().config.ai?.model).toBe('claude-opus-5');
    await patchAi(request('PATCH', { provider: 'gemini', model: 'gemini-2.5-pro' }));
    expect(readConfig().config.ai).toMatchObject({ provider: 'gemini', model: 'gemini-2.5-pro', apiKey: 'AIza1', apiKeys: { anthropic: 'sk-ant-secret' } });
    // Nothing saved yet and only the environment key: OpenAI is the selection and the only ready provider.
    rmSync(join(dir, 'sources.json'));
    vi.stubEnv('OPENAI_API_KEY', 'env-key');
    status = await (await assistantStatus()).json();
    expect(status).toMatchObject({ selectedProvider: 'openai', selectedModel: 'gpt-4.1-mini' });
    expect(status.providers.find((p: { id: string }) => p.id === 'openai')).toMatchObject({ ready: true, models: expect.arrayContaining(['gpt-4.1-mini']) });
  });
  it('sends the saved prompt, the voice persona and the operator directives to the realtime session, reference data last', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'env-key');
    const built = realtimeConfiguration('marin').instructions;
    expect(built.startsWith('# 역할')).toBe(true);
    expect(built).toContain('여성 목소리'); expect(built).not.toContain('{{목소리}}');
    expect(built.indexOf('# 규칙')).toBeLessThan(built.indexOf('# 참고 데이터'));
    expect(built).toContain('set_scene_object_values'); expect(built).toContain('LINE-02'); expect(built).toContain('spc: ');
    expect(realtimeConfiguration('cedar').instructions).toContain('남성 목소리');
    await putAi(request('PUT', { provider: 'openai', model: 'gpt-4.1-mini', prompt: '# 역할\n{{목소리}}로 한 문장씩만 답한다.', instructions: '존댓말.' }));
    const custom = realtimeConfiguration('cedar').instructions;
    expect(custom.startsWith('# 역할\n낮고 차분한 남성 목소리로 한 문장씩만 답한다.')).toBe(true);
    expect(custom).not.toContain('# 성격과 말투');
    expect(custom).toContain('# 운영자 추가 지시\n존댓말.');
    expect(custom.indexOf('존댓말.')).toBeLessThan(custom.indexOf('# 참고 데이터'));
    // The screen stores an unchanged prompt as empty, so the built-in text keeps applying.
    await putAi(request('PUT', { provider: 'openai', model: 'gpt-4.1-mini', prompt: '' }));
    expect(realtimeConfiguration('cedar').instructions).toContain(DEFAULT_JARVIS_PROMPT.split('\n')[1]);
  });
  it('leaves the saved AI block alone when the data-source screen writes sources and feeds', () => {
    writeConfig({ sources: [], feeds: [], ai: { ...anthropic, provider: 'anthropic', prompt: '', realtimeModel: 'gpt-realtime-2.1-mini', voiceMode: 'realtime' } });
    writeConfig({ ...readConfig().config, sources: [], feeds: [] });
    expect(readConfig().config.ai?.apiKey).toBe('sk-ant-secret');
  });
  it('resolves the runtime from the saved key first and the environment second', () => {
    expect(resolveAiRuntime()).toBeNull();
    vi.stubEnv('OPENAI_API_KEY', 'env-key'); vi.stubEnv('OPENAI_TEXT_MODEL', 'env-model');
    expect(resolveAiRuntime()).toMatchObject({ provider: 'openai', model: 'env-model', apiKey: 'env-key', keySource: 'env' });
    writeConfig({ sources: [], feeds: [], ai: { ...anthropic, provider: 'anthropic', prompt: '', realtimeModel: 'gpt-realtime-2.1-mini', voiceMode: 'realtime' } });
    expect(resolveAiRuntime()).toMatchObject({ provider: 'anthropic', apiKey: 'sk-ant-secret', keySource: 'config' });
  });
  it('tests a draft against the provider, falling back to the saved key, and reports failures without throwing', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ content: [{ type: 'text', text: '확인' }] }));
    const ok = await (await testAi(request('POST', anthropic))).json();
    expect(ok).toMatchObject({ ok: true, provider: 'anthropic', model: 'claude-sonnet-5', reply: '확인' });
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({ max_tokens: 32 });

    expect(await (await testAi(request('POST', { ...anthropic, apiKey: '' }))).json()).toMatchObject({ ok: false, error: expect.stringContaining('API 키가 없습니다') });
    await putAi(request('PUT', anthropic));
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: 'model not found' } }), { status: 404 }));
    const notFound = await (await testAi(request('POST', { ...anthropic, apiKey: '' }))).json();
    expect(notFound).toMatchObject({ ok: false });
    expect(notFound.error).toContain('모델을 쓸 수 없습니다');
  });
  it('stores a Mistral key server-side, tests it, and keeps it ready after switching providers', async () => {
    await putAi(request('PUT', mistral));
    expect(await (await getAi(request('GET'))).json()).toMatchObject({ ai: { provider: 'mistral', model: 'mistral-small-latest', hasApiKey: true, keySource: 'config' } });
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ choices: [{ message: { content: '확인' } }] }));
    expect(await (await testAi(request('POST', { ...mistral, apiKey: '' }))).json()).toMatchObject({ ok: true, provider: 'mistral', reply: '확인' });
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('https://api.mistral.ai/v1/chat/completions');
    await putAi(request('PUT', anthropic));
    const status = await (await assistantStatus()).json();
    expect(status.providers.find((provider: { id: string }) => provider.id === 'mistral')).toMatchObject({ ready: true });
    expect(JSON.stringify(status)).not.toContain('mistral-secret');
  });
  it('answers free questions through the saved provider and reports it in the status, while realtime stays OpenAI-only', async () => {
    await putAi(request('PUT', anthropic));
    const status = await (await assistantStatus()).json();
    expect(status).toMatchObject({ aiConfigured: true, provider: 'anthropic', textModel: 'claude-sonnet-5', realtimeAvailable: false, realtimeModel: null });
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ content: [{ type: 'text', text: '병목부터 보세요.' }] }));
    const reply = await (await assistant(request('POST', { message: '생산성을 어떻게 개선할까?' }))).json();
    expect(reply).toEqual({ source: 'ai', reply: '병목부터 보세요.' });
    const body = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string);
    expect(body.system).toContain('# 운영자 추가 지시\n세 문장 이내로.');
    expect(body.system).toContain('HATCHERY');
    const voice = await realtime(request('POST', 'v=0\r\nm=audio 9\r\n', 'application/sdp'));
    expect(voice.status).toBe(503);
  });
  it('uses the ChatGPT subscription through the Codex login when saved, and reports the browser voice mode', async () => {
    const home = join(dir, 'codex-home');
    expect(await (await getAi(request('GET'))).json()).toMatchObject({ codexLogin: { ok: false } });
    await putAi(request('PUT', { provider: 'chatgpt', model: 'gpt-6-astra', voiceMode: 'browser' }));
    expect(await (await assistantStatus()).json()).toMatchObject({ aiConfigured: false, useRealtime: false, voiceMode: 'browser' });
    const { mkdirSync } = await import('node:fs');
    mkdirSync(home, { recursive: true });
    writeFileSync(join(home, 'auth.json'), JSON.stringify({ auth_mode: 'chatgpt', tokens: { access_token: codexJwt(), refresh_token: 'rt', account_id: 'acc-9' } }));
    expect(await (await getAi(request('GET'))).json()).toMatchObject({ ai: { provider: 'chatgpt', hasApiKey: true, keySource: 'codex' }, codexLogin: { ok: true } });
    expect(await (await assistantStatus()).json()).toMatchObject({ aiConfigured: true, provider: 'chatgpt', providerLabel: 'ChatGPT 구독 (Codex 로그인)', useRealtime: false, realtimeAvailable: false });
    vi.mocked(fetch).mockResolvedValueOnce(new Response('data: {"type":"response.output_text.delta","delta":"확인"}\n\ndata: [DONE]\n', { headers: { 'Content-Type': 'text/event-stream' } }));
    const test = await (await testAi(request('POST', { provider: 'chatgpt', model: 'gpt-6-astra' }))).json();
    expect(test).toMatchObject({ ok: true, provider: 'chatgpt', reply: '확인' });
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe('https://chatgpt.com/backend-api/codex/responses');
    expect((init as RequestInit).headers).toMatchObject({ 'chatgpt-account-id': 'acc-9' });
    vi.mocked(fetch).mockResolvedValueOnce(new Response('data: {"type":"response.output_text.delta","delta":"병목부터."}\n', { headers: { 'Content-Type': 'text/event-stream' } }));
    expect(await (await assistant(request('POST', { message: '생산성을 어떻게 개선할까?' }))).json()).toEqual({ source: 'ai', reply: '병목부터.' });
  });
});
