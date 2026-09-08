import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { EMPTY_HATCHERY_CONFIG, parseHatcheryConfig, type DataSourceConfig, type HatcheryConfig } from '@/cinema/feedConfig';

/** Server-only file with data source credentials and feed mappings. Never committed. */
export const configPath = () => resolve(process.env.HATCHERY_CONFIG_PATH || 'config/hatchery.sources.json');

export function readConfig(path = configPath()): { config: HatcheryConfig; error?: string } {
  let raw: string;
  try { raw = readFileSync(path, 'utf8'); }
  catch (error) { return (error as NodeJS.ErrnoException).code === 'ENOENT' ? { config: EMPTY_HATCHERY_CONFIG } : { config: EMPTY_HATCHERY_CONFIG, error: `설정 파일을 읽지 못했습니다: ${(error as Error).message}` }; }
  try {
    const parsed = parseHatcheryConfig(JSON.parse(raw));
    return parsed.ok ? { config: parsed.config } : { config: EMPTY_HATCHERY_CONFIG, error: `설정 파일이 잘못됐습니다: ${parsed.reason}` };
  } catch (error) { return { config: EMPTY_HATCHERY_CONFIG, error: `설정 파일이 JSON이 아닙니다: ${(error as Error).message}` }; }
}

export function writeConfig(config: HatcheryConfig, path = configPath()) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(config, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 });
}

export type MaskedSource = Omit<DataSourceConfig, 'password'> & { hasPassword: boolean };
export type MaskedConfig = { sources: MaskedSource[]; feeds: HatcheryConfig['feeds'] };

/** What the admin screen receives: passwords replaced by a presence flag. */
export function maskConfig(config: HatcheryConfig): MaskedConfig {
  return { sources: config.sources.map(({ password, ...source }) => ({ ...source, hasPassword: password.length > 0 })), feeds: config.feeds };
}

/** Incoming sources with an empty password keep the password already on file. */
export function mergePasswords(incoming: HatcheryConfig, current: HatcheryConfig): HatcheryConfig {
  return { ...incoming, sources: incoming.sources.map(source => source.password ? source
    : { ...source, password: current.sources.find(item => item.id === source.id)?.password ?? '' }) };
}
