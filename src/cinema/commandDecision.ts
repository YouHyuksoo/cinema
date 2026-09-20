import { SCREEN_SETTINGS, validateScreenCommand, type ScreenCommand } from './screenCommands';

const keys = new Set(['scene', 'home', 'menu', 'turbineMenu', 'cubeMenu', 'playing', 'pieStyle']);
/** Single source of finite choices. Free text, credentials and camera permissions are not routed here. */
export const TYPESAFE_COMMANDS: Record<string, { label: string; command: ScreenCommand }> = Object.fromEntries(
  SCREEN_SETTINGS.filter(setting => keys.has(setting.key)).flatMap(setting => (setting.options ?? [])
    .filter(option => !(setting.key === 'home' && option.value !== 'true') && !(setting.key === 'scene' && option.value === 'machine'))
    .map(option => [`${setting.key}:${option.value}`, {
      label: `${setting.label}: ${option.label}`,
      command: { action: 'set' as const, key: setting.key, value: option.value },
    }])),
);
export type IntentInput = { message: string; screenState?: {
  scene?: string; playing?: boolean; menu?: boolean; turbineMenu?: boolean; cubeMenu?: boolean; pieStyle?: string;
} };
export type CommandDecision = (
  | { kind: 'command'; command: ScreenCommand; confidence?: number }
  | { kind: 'clarify'; message: string; proposal?: ScreenCommand }
  | { kind: 'conversation' }
  | { kind: 'disabled' }
  | { kind: 'shadow'; candidate: unknown }) & { metrics?: {
    model?: string; durationMs: number; inputTokens?: number; outputTokens?: number;
    intent?: { choice: string; confidence: number };
    command?: { choice: string; confidence: number };
    explicit?: number;
  } };

export function allowedTypeSafeCommand(input: unknown): ScreenCommand | null {
  const command = validateScreenCommand(input);
  if (!command || command.action !== 'set') return null;
  return TYPESAFE_COMMANDS[`${command.key}:${command.value}`]?.command ?? null;
}
export function minimalScreenState(state?: Record<string, unknown>): IntentInput['screenState'] {
  return {
    ...(typeof state?.scene === 'string' ? { scene: state.scene } : {}),
    ...(typeof state?.playing === 'boolean' ? { playing: state.playing } : {}),
    ...(typeof state?.menu === 'boolean' ? { menu: state.menu } : {}),
    ...(typeof state?.turbineMenu === 'boolean' ? { turbineMenu: state.turbineMenu } : {}),
    ...(typeof state?.cubeMenu === 'boolean' ? { cubeMenu: state.cubeMenu } : {}),
    ...(typeof state?.pieStyle === 'string' ? { pieStyle: state.pieStyle } : {}),
  };
}
