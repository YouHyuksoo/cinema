import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

/**
 * ChatGPT subscription access through the Codex CLI login ("Sign in with ChatGPT"). The CLI keeps
 * OAuth tokens in ~/.codex/auth.json; we read them, refresh when expired and write the refreshed
 * tokens back so the CLI and HATCHERY share one session. Nothing here ever reaches the browser.
 */
export interface CodexTokens { accessToken: string; refreshToken: string; accountId: string; expiresAt: number | null }
export interface CodexLoginStatus { ok: boolean; expiresAt: number | null; reason?: string }

const OAUTH_TOKEN_URL = 'https://auth.openai.com/oauth/token';
/** Public client id the Codex CLI registers its PKCE login under. */
const CODEX_CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann';
const REFRESH_SKEW_MS = 60_000;

export const codexAuthPath = () => join(resolve(/*turbopackIgnore: true*/ process.env.CODEX_HOME || join(homedir(), '.codex')), 'auth.json');

/** `exp` claim (ms) of a JWT without verifying it; only used to decide when to refresh. */
export function jwtExpiry(token: string): number | null {
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    const json = JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')) as { exp?: number };
    return typeof json.exp === 'number' ? json.exp * 1000 : null;
  } catch { return null; }
}

export function readCodexTokens(path = codexAuthPath()): CodexTokens | null {
  let raw: string;
  try { raw = readFileSync(path, 'utf8'); } catch { return null; }
  try {
    const data = JSON.parse(raw) as { auth_mode?: string; tokens?: { access_token?: string; refresh_token?: string; account_id?: string } };
    const tokens = data.tokens;
    if (!tokens?.access_token || !tokens.refresh_token || !tokens.account_id) return null;
    if (data.auth_mode && data.auth_mode !== 'chatgpt') return null;
    return { accessToken: tokens.access_token, refreshToken: tokens.refresh_token, accountId: tokens.account_id, expiresAt: jwtExpiry(tokens.access_token) };
  } catch { return null; }
}

export function codexLoginStatus(path = codexAuthPath()): CodexLoginStatus {
  const tokens = readCodexTokens(path);
  if (!tokens) return { ok: false, expiresAt: null, reason: 'Codex CLI의 ChatGPT 로그인을 찾지 못했습니다. 터미널에서 `codex login`을 실행해 주세요.' };
  return { ok: true, expiresAt: tokens.expiresAt };
}

function writeRefreshed(path: string, tokens: CodexTokens) {
  let data: Record<string, unknown> = {};
  try { data = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>; } catch { /* rewrite from scratch */ }
  const existing = (data.tokens ?? {}) as Record<string, unknown>;
  data.tokens = { ...existing, access_token: tokens.accessToken, refresh_token: tokens.refreshToken, account_id: tokens.accountId };
  data.last_refresh = new Date().toISOString();
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 });
}

/** Tokens ready to use: refreshed through the OAuth endpoint when the access token is (nearly) expired. */
export async function codexAccessTokens(signal: AbortSignal, path = codexAuthPath(), now = Date.now()): Promise<CodexTokens> {
  const tokens = readCodexTokens(path);
  if (!tokens) throw new Error('Codex CLI의 ChatGPT 로그인을 찾지 못했습니다. 터미널에서 `codex login`을 실행해 주세요.');
  if (tokens.expiresAt === null || tokens.expiresAt - REFRESH_SKEW_MS > now) return tokens;
  const response = await fetch(OAUTH_TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant_type: 'refresh_token', refresh_token: tokens.refreshToken, client_id: CODEX_CLIENT_ID }),
    signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]), cache: 'no-store' });
  if (!response.ok) throw new Error('ChatGPT 로그인 토큰을 갱신하지 못했습니다. 터미널에서 `codex login`으로 다시 로그인해 주세요.');
  const body = await response.json() as { access_token?: string; refresh_token?: string };
  if (!body.access_token) throw new Error('ChatGPT 로그인 토큰 갱신 응답이 비어 있습니다.');
  const refreshed: CodexTokens = { accessToken: body.access_token, refreshToken: body.refresh_token || tokens.refreshToken, accountId: tokens.accountId, expiresAt: jwtExpiry(body.access_token) };
  try { writeRefreshed(path, refreshed); } catch { /* the CLI file may be read-only; the in-memory tokens still work for this request */ }
  return refreshed;
}
