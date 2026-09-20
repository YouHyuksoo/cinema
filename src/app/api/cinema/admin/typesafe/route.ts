import { rejectExternalRequest } from '@/server/cinema/openai';
import { maskedTypeSafeSettings, resolveTypeSafeRuntime } from '@/server/cinema/typesafeRuntime';
import { readTypeSafeDraft } from '@/server/cinema/typesafeSettings';
import { readConfig, writeConfig } from '@/server/cinema/hatcheryConfig';
import { mergeTypeSafeKey } from '@/cinema/typesafeConfig';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  const rejected = rejectExternalRequest(request); if (rejected) return rejected;
  try { return Response.json({ settings: maskedTypeSafeSettings() }, { headers: { 'Cache-Control': 'no-store' } }); }
  catch { return Response.json({ error: 'Jev 설정을 읽지 못했습니다.' }, { status: 500 }); }
}
export async function PUT(request: Request) {
  const rejected = rejectExternalRequest(request); if (rejected) return rejected;
  const parsed = await readTypeSafeDraft(request);
  if (!parsed.config) return Response.json({ error: parsed.error }, { status: 400 });
  const current = readConfig();
  if (current.error) return Response.json({ error: '기존 서버 설정을 읽지 못해 저장을 중단했습니다.' }, { status: 500 });
  const settings = mergeTypeSafeKey(parsed.config, current.config.typesafe);
  if (settings.mode !== 'off' && !resolveTypeSafeRuntime(settings).apiKey)
    return Response.json({ error: 'Jev API 키를 입력한 뒤 평가 또는 실행 모드를 저장해 주세요.' }, { status: 400 });
  try {
    writeConfig({ ...current.config, typesafe: settings });
    return Response.json({ settings: maskedTypeSafeSettings(), saved: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return Response.json({ error: 'Jev 설정을 저장하지 못했습니다.' }, { status: 500 }); }
}
