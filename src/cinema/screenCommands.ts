import { FILM_THEMES } from './filmThemes';
import { FILM_TEXTURE_STYLES } from './filmTexture';
import { CENTER_BACKGROUNDS } from './jarvisCenterBackground';
import { FILM_CHAPTERS } from './filmProgram';
import { AI_LIMITS } from './aiConfig';
import { PLAYBACK_RATE_OPTIONS } from './playbackRates';

type Setting = { key: string; label: string; options?: readonly { value: string; label: string }[]; min?: number; max?: number; maxLength?: number };
const onOff = [{ value: 'true', label: '켜기' }, { value: 'false', label: '끄기' }];
export const SCREEN_SETTINGS: readonly Setting[] = [
  { key: 'menu', label: '메뉴 열기', options: onOff },
  { key: 'menuLayout', label: '메뉴 펼침 방식', options: [{ value: 'orbit', label: '구체링' }, { value: 'dock', label: '하단 링' }] },
  { key: 'settings', label: '연출설정 열기', options: onOff },
  { key: 'home', label: '메인 화면', options: onOff },
  { key: 'scene', label: '장면', options: FILM_CHAPTERS.map(x => ({ value: x.id, label: x.title })) },
  { key: 'theme', label: '색상 테마', options: FILM_THEMES.map(x => ({ value: x.id, label: x.label })) },
  { key: 'background', label: '중앙 배경', options: CENTER_BACKGROUNDS.map(x => ({ value: x.id, label: x.label })) },
  { key: 'texture', label: '화면 질감', options: FILM_TEXTURE_STYLES },
  { key: 'intensity', label: '질감 강도 퍼센트', min: 0, max: 100 },
  { key: 'speed', label: '재생 속도', options: PLAYBACK_RATE_OPTIONS },
  { key: 'playing', label: '재생', options: onOff },
  { key: 'mode', label: '재생 방식', options: [{ value: 'sequence', label: '전체 연속' }, { value: 'chapter', label: '현재 장면 반복' }] },
  { key: 'seek', label: '재생 위치 초', min: 0, max: 3600 },
  { key: 'machine', label: '검사 대상', options: [{ value: 'pcb', label: 'PCB' }, { value: 'car', label: '자동차' }] },
  ...(['bars', 'pie'] as const).flatMap(kind => [
    { key: `${kind}Dimension`, label: `${kind === 'bars' ? '막대' : '파이'} 형태`, options: [{ value: '2d', label: '평면' }, { value: '3d', label: '입체' }] },
    { key: `${kind}Depth`, label: `${kind === 'bars' ? '막대' : '파이'} 두께 퍼센트`, min: 40, max: 160 },
  ]),
  { key: 'camera', label: '카메라 연결', options: onOff },
  { key: 'cameraPopup', label: '영상 창', options: onOff },
  { key: 'mirror', label: '거울 모드', options: onOff },
  { key: 'zoom', label: '얼굴 확대', min: 1, max: 2 },
  { key: 'blur', label: '얼굴 블러', min: 0, max: 100 },
  { key: 'voiceGender', label: '목소리 성별', options: [{ value: 'male', label: '남성' }, { value: 'female', label: '여성' }] },
  { key: 'voiceMode', label: '음성 방식', options: [{ value: 'browser', label: '브라우저 음성' }, { value: 'realtime', label: '실시간 음성' }] },
  { key: 'provider', label: 'AI 제공자', options: ['openai', 'chatgpt', 'anthropic', 'gemini', 'mistral'].map(value => ({ value, label: value })) },
  { key: 'model', label: 'AI 모델' },
  { key: 'realtimeModel', label: '실시간 음성 모델' },
  { key: 'temperature', label: 'AI 응답 다양성', min: AI_LIMITS.temperature.min, max: AI_LIMITS.temperature.max },
  { key: 'maxOutputTokens', label: '최대 출력 토큰', min: AI_LIMITS.maxOutputTokens.min, max: AI_LIMITS.maxOutputTokens.max },
  { key: 'instructions', label: 'AI 추가 지시', maxLength: AI_LIMITS.instructions },
  { key: 'prompt', label: 'AI 시스템 프롬프트', maxLength: AI_LIMITS.prompt },
];
export interface ScreenCommand { action: 'get' | 'set'; key: string; value?: string }
export interface ScreenResult { ok: boolean; message: string; state?: Record<string, unknown> }
export type ScreenExecutor = (input: unknown) => Promise<ScreenResult>;
export function describeScreenState(state: Record<string, unknown>, key = 'all') {
  return Object.entries(state).filter(([name, value]) => value !== undefined && (key === 'all' || name === key)).map(([name, value]) => {
    const setting = SCREEN_SETTINGS.find(s => s.key === name);
    const display = setting?.options?.find(o => o.value === String(value))?.label ?? value;
    return `${setting?.label ?? name}: ${display}`;
  }).join('\n');
}
export function validateScreenCommand(input: unknown): ScreenCommand | null {
  if (!input || typeof input !== 'object') return null;
  const c = input as ScreenCommand;
  if (c.action === 'get' && (c.key === 'all' || SCREEN_SETTINGS.some(s => s.key === c.key))) return { action: 'get', key: c.key };
  const setting = SCREEN_SETTINGS.find(s => s.key === c.key);
  if (c.action !== 'set' || !setting || typeof c.value !== 'string' || c.value.length > (setting.maxLength ?? 120)) return null;
  if (setting.options && !setting.options.some(o => o.value === c.value)) return null;
  if (setting.min !== undefined && (!c.value.trim() || !Number.isFinite(Number(c.value)) || Number(c.value) < setting.min || Number(c.value) > setting.max!)) return null;
  if (['model', 'realtimeModel'].includes(c.key) && !/^[a-zA-Z0-9._:/-]{1,120}$/.test(c.value)) return null;
  if (c.key === 'maxOutputTokens' && !Number.isInteger(Number(c.value))) return null;
  return { action: 'set', key: c.key, value: c.value };
}
export const SCREEN_CONTROL_TOOL = { type: 'function', name: 'control_screen',
  description: `현재 화면 설정 조회/변경. 실행 결과 ok를 확인한 뒤만 완료라고 말한다. 카메라 권한 거절은 실패로 안내한다. 연결 중인 AI 설정을 바꾸면 현재 세션은 유지하며 다음 연결부터 적용된다. 메뉴 열기는 menu=true, 구체 방식은 menuLayout=orbit 후 menu=true. 상대 변경은 먼저 get으로 현재 값 확인. API 키/비밀번호는 도구로 조회하거나 변경하지 않는다. 사용 가능한 설정: ${JSON.stringify(SCREEN_SETTINGS)}`,
  parameters: { type: 'object', properties: { action: { type: 'string', enum: ['get', 'set'] }, key: { type: 'string', enum: ['all', ...SCREEN_SETTINGS.map(s => s.key)] }, value: { type: 'string', description: '설정값. 숫자와 boolean도 문자열, 퍼센트는 0~100 단위.' } }, required: ['action', 'key'], additionalProperties: false },
};

/** Deterministic common commands also work without a configured model. */
export function resolveScreenCommands(text: string): ScreenCommand[] | null {
  const t = text.toLowerCase().replace(/\s/g, '');
  if (/하지마|지마|말아|말고|않/.test(t)) return null;
  if (/그리고|하고|바꾸고|[;\n]|\[첨부:/.test(t)) return null;
  if (/방법|어떻게|왜|하면|설명/.test(t)) return null;
  const settingQuery = /설정.*(알려|보여|뭐|확인)/.test(t);
  if (settingQuery && !/열어/.test(t)) return [{ action: 'get', key: 'all' }];
  const close = /닫|접어|꺼|끄기|중지|정지/.test(t);
  if (/메뉴/.test(t) && /열|펼|닫|접/.test(t)) {
    const commands: ScreenCommand[] = [];
    if (/구체|둘레/.test(t)) commands.push({ action: 'set', key: 'menuLayout', value: 'orbit' });
    else if (/하단|바닥/.test(t)) commands.push({ action: 'set', key: 'menuLayout', value: 'dock' });
    commands.push({ action: 'set', key: 'menu', value: String(!close) }); return commands;
  }
  if (/연출설정|설정창|설정모달/.test(t) && /열|닫|펼/.test(t)) return [{ action: 'set', key: 'settings', value: String(!close) }];
  const aliases: Record<string, RegExp> = { speed: /재생속도|속도/, theme: /색상|테마/, background: /중앙배경|배경/, texture: /질감/,
    intensity: /질감강도/, mirror: /거울|미러/, zoom: /얼굴확대|카메라줌/, blur: /블러|흐림/, voiceGender: /목소리|음성성별/,
    barsDimension: /막대.*(?:형태|평면|입체|2d|3d)/, pieDimension: /파이.*(?:형태|평면|입체|2d|3d)/,
    barsDepth: /막대.*두께/, pieDepth: /파이.*두께/ };
  if (!/바꿔|변경|설정|해줘|켜|꺼|끄기|재생|정지|열|확대|블러|알려|확인/.test(t)) return null;
  for (const s of SCREEN_SETTINGS) {
    if (!t.includes(s.label.replace(/\s|퍼센트|초/g, '').toLowerCase()) && !aliases[s.key]?.test(t)) continue;
    if (/알려|확인/.test(t)) return [{ action: 'get', key: s.key }];
    const choice = s.key === 'speed' ? s.options?.find(o => o.value === text.match(/\d+(?:\.\d+)?/)?.[0])
      : s.options?.find(o => t.includes(o.label.replace(/\s/g, '').toLowerCase()) || t.includes(o.value));
    const value = s.options === onOff ? String(!close) : choice?.value ?? (!s.options ? text.match(/\d+(?:\.\d+)?/)?.[0] : undefined);
    const c = validateScreenCommand({ action: 'set', key: s.key, value });
    if (c) return [c];
  }
  return null;
}
