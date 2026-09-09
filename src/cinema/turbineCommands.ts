export const TURBINE_COMMANDS = [
  { id: 'home', label: '메인메뉴', angle: 0 },
  { id: 'pause', label: '정지', angle: 72 },
  { id: 'conversation', label: 'AI대화', angle: 144 },
  { id: 'play', label: '시작', angle: 216 },
  { id: 'briefing', label: '브리핑', angle: 288 },
] as const;
export type TurbineCommand = typeof TURBINE_COMMANDS[number]['id'];
export type TurbineActions = Record<TurbineCommand, () => void>;
export function runTurbineCommand(command: TurbineCommand, actions: TurbineActions) { actions[command](); }
