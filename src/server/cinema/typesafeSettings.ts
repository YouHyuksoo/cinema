import { TypeSafeConfigSchema } from '@/cinema/typesafeConfig';

export async function readTypeSafeDraft(request: Request) {
  const text = await request.text();
  if (text.length > 6000) return { error: 'Jev 설정 요청이 너무 큽니다.' } as const;
  try {
    const result = TypeSafeConfigSchema.safeParse(JSON.parse(text));
    return result.success ? { config: result.data } : { error: '적용 모드·Jev 모델·API 키를 확인해 주세요.' };
  } catch { return { error: '올바른 JSON 설정이 필요합니다.' }; }
}
