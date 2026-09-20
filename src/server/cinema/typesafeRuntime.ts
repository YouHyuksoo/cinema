import { DEFAULT_TYPESAFE_CONFIG, type TypeSafeConfig, type MaskedTypeSafeConfig } from '@/cinema/typesafeConfig';
import { readConfig } from './hatcheryConfig';

export function resolveTypeSafeRuntime(draft?: TypeSafeConfig) {
  const { config, error } = readConfig();
  if (error) throw new Error('서버 설정 파일을 읽지 못했습니다. Jev 설정을 확인해 주세요.');
  const saved = config.typesafe;
  const envMode = process.env.TYPESAFE_MODE;
  const mode = draft?.mode ?? saved?.mode ?? (envMode === 'on' || envMode === 'shadow' ? envMode : 'off');
  const apiKey = draft?.apiKey || saved?.apiKey || process.env.TYPESAFE_API_KEY?.trim() || '';
  const keySource = draft?.apiKey || saved?.apiKey ? 'config' as const : apiKey ? 'env' as const : 'none' as const;
  return { mode, model: draft?.model ?? saved?.model ?? (process.env.TYPESAFE_MODEL || DEFAULT_TYPESAFE_CONFIG.model), apiKey, keySource };
}
export function maskedTypeSafeSettings(): MaskedTypeSafeConfig {
  const { apiKey, ...settings } = resolveTypeSafeRuntime();
  return { ...settings, hasApiKey: Boolean(apiKey) };
}
