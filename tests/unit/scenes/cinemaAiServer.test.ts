import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GET as getAi, PUT as putAi } from '@/app/api/cinema/admin/ai/route';
import { POST as testAi } from '@/app/api/cinema/admin/ai/test/route';
import { GET as assistantStatus, POST as assistant } from '@/app/api/cinema/assistant/route';
import { POST as realtime } from '@/app/api/cinema/realtime/route';
import { readConfig, writeConfig } from '@/server/cinema/hatcheryConfig';
import { resolveAiRuntime } from '@/server/cinema/aiProviders';
import { writeFileSync } from 'node:fs';

const request = (method: string, body?: unknown, contentType = 'application/json') => new Request('http://localhost:3000/api/cinema/x', {
  method, headers: { origin: 'http://localhost:3000', 'Content-Type': contentType }, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
});
const anthropic = { provider: 'anthropic', model: 'claude-sonnet-5', apiKey: 'sk-ant-secret', temperature: 0.4, maxOutputTokens: 600, instructions: '세 문장 이내로.' };
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
    expect(initial.providers.map((provider: { id: string }) => provider.id)).toEqual(['openai', 'chatgpt', 'anthropic', 'gemini']);

    const saved = await (await putAi(request('PUT', anthropic))).json();
    expect(saved).toMatchObject({ saved: true, ai: { provider: 'anthropic', model: 'claude-sonnet-5', hasApiKey: true, keySource: 'config', instructions: '세 문장 이내로.' } });
    expect(JSON.stringify(saved)).not.toContain('sk-ant-secret');
    expect(JSON.parse(readFileSync(join(dir, 'sources.json'), 'utf8')).ai.apiKey).toBe('sk-ant-secret');

    await putAi(request('PUT', { ...anthropic, apiKey: '', temperature: 0.9 }));
    expect(readConfig().config.ai).toMatchObject({ apiKey: 'sk-ant-secret', temperature: 0.9 });
    expect(await (await putAi(request('PUT', { provider: 'nope' }))).status).toBe(400);
  });
  it('leaves the saved AI block alone when the data-source screen writes sources and feeds', () => {
    writeConfig({ sources: [], feeds: [], ai: { ...anthropic, provider: 'anthropic', realtimeModel: 'gpt-realtime-2.1-mini', voiceMode: 'realtime' } });
    writeConfig({ ...readConfig().config, sources: [], feeds: [] });
    expect(readConfig().config.ai?.apiKey).toBe('sk-ant-secret');
  });
  it('resolves the runtime from the saved key first and the environment second', () => {
    expect(resolveAiRuntime()).toBeNull();
    vi.stubEnv('OPENAI_API_KEY', 'env-key'); vi.stubEnv('OPENAI_TEXT_MODEL', 'env-model');
    expect(resolveAiRuntime()).toMatchObject({ provider: 'openai', model: 'env-model', apiKey: 'env-key', keySource: 'env' });
    writeConfig({ sources: [], feeds: [], ai: { ...anthropic, provider: 'anthropic', realtimeModel: 'gpt-realtime-2.1-mini', voiceMode: 'realtime' } });
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
  it('answers free questions through the saved provider and reports it in the status, while realtime stays OpenAI-only', async () => {
    await putAi(request('PUT', anthropic));
    const status = await (await assistantStatus()).json();
    expect(status).toMatchObject({ aiConfigured: true, provider: 'anthropic', textModel: 'claude-sonnet-5', realtimeAvailable: false, realtimeModel: null });
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ content: [{ type: 'text', text: '병목부터 보세요.' }] }));
    const reply = await (await assistant(request('POST', { message: '생산성을 어떻게 개선할까?' }))).json();
    expect(reply).toEqual({ source: 'ai', reply: '병목부터 보세요.' });
    const body = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string);
    expect(body.system).toContain('운영자 추가 지시:\n세 문장 이내로.');
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
