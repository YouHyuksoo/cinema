import { SCREEN_SETTINGS, SCREEN_CONTROL_TOOL, validateScreenCommand, type ScreenExecutor } from './screenCommands';

const keys = new Set(['scene', 'home', 'menu', 'turbineMenu', 'cubeMenu', 'menuLayout', 'settings',
  'playing', 'restart', 'mode', 'seek', 'speed', 'theme', 'background', 'texture', 'intensity',
  'machine', 'pieStyle', 'voiceGender']);
export const REALTIME_SCREEN_TOOL = {
  ...SCREEN_CONTROL_TOOL,
  description: `명확한 화면 이동·메뉴·재생·표시 설정을 직접 실행합니다. 상대 변경은 get으로 확인합니다. 성공 결과를 받은 뒤에만 완료를 알립니다. 분석이나 원인 판단은 delegate_analysis로 위임합니다. 설정: ${JSON.stringify(SCREEN_SETTINGS.filter(s => keys.has(s.key)))}`,
  parameters: { ...SCREEN_CONTROL_TOOL.parameters, properties: {
    ...SCREEN_CONTROL_TOOL.parameters.properties, key: { type: 'string', enum: [...keys] },
  } },
};
export async function executeRealtimeScreen(argumentsText: string | undefined, execute?: ScreenExecutor) {
  let raw: unknown;
  try { raw = JSON.parse(argumentsText ?? ''); } catch { return { ok: false, message: '조작 인자가 올바른 JSON이 아닙니다.' }; }
  const command = validateScreenCommand(raw);
  if (!command || !keys.has(command.key)) return { ok: false, message: '허용되지 않거나 잘못된 화면 조작입니다.' };
  if (!execute) return { ok: false, message: '화면 조작 기능이 연결되지 않았습니다.' };
  try { return await execute(command); }
  catch { return { ok: false, message: '화면 조작 실행에 실패했습니다.' }; }
}
