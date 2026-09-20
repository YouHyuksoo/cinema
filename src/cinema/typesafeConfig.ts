import { z } from 'zod';

export const TYPESAFE_MODES = [
  { id: 'off', label: '끄기', hint: '기존 명령 처리 경로를 사용합니다.' },
  { id: 'shadow', label: '평가만', hint: '기존 처리 경로를 유지하며 미인식 텍스트 명령의 Jev 판단을 비교합니다. Jev 결과로 화면을 조작하지 않습니다.' },
  { id: 'on', label: '명령 실행', hint: '확실한 명령만 실행합니다. 모호한 요청은 확인하고, 연결 실패는 오류로 알립니다.' },
] as const;
export const TYPESAFE_MODELS = ['jev-latest'] as const;
export const TypeSafeConfigSchema = z.object({
  mode: z.enum(['off', 'shadow', 'on']),
  model: z.string().trim().regex(/^jev-[a-zA-Z0-9._-]{1,110}$/, 'Jev 모델 ID를 확인해 주세요.'),
  apiKey: z.string().trim().max(4096).default(''),
});
export type TypeSafeConfig = z.infer<typeof TypeSafeConfigSchema>;
export type MaskedTypeSafeConfig = Omit<TypeSafeConfig, 'apiKey'> & { hasApiKey: boolean; keySource: 'config' | 'env' | 'none' };
export const DEFAULT_TYPESAFE_CONFIG: TypeSafeConfig = { mode: 'off', model: 'jev-latest', apiKey: '' };
export function mergeTypeSafeKey(incoming: TypeSafeConfig, current?: TypeSafeConfig): TypeSafeConfig {
  return { ...incoming, apiKey: incoming.apiKey || current?.apiKey || '' };
}
