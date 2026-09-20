export type CinemaTurnKind = 'conversation' | 'analysis' | 'screen_action' | 'screen_action_with_analysis';

const ANALYSIS_PATTERN = /(?:왜|어떻게|무엇|뭐(?:야|지|가)|이유|원인|뜻|번역|설명(?:해|해\s*줘|해줘)?|요약(?:해|해\s*줘|해줘)?|알려(?:\s*줘)?|현황|상태|몇|얼마|분석해(?:\s*줘)?|\?)/;
const ACTION_PATTERN = /(?:열(?:어|고)|띄워|보여\s*(?:줘|주고)?|넘겨\s*(?:줘|주고)?|이동해|전환해|바꿔|변경해|설정해|켜\s*줘|꺼\s*줘|닫아|접어|펼쳐|숨겨|재생해|계속해|시작해|멈춰|정지해|일시정지해|선택해|골라\s*줘|돌아가|복귀해|틀어\s*줘|표시해|해\s*줘|(?:으로\s*)?가(?:자|줘)?)/;
const ACTION_TARGET_PATTERN = /(?:화면|페이지|메뉴|장면|연출|모니터링|차트|그래프|SPC|CCTV|관리도|온도|습도|온습도|에너지|터빈|큐브|재생|모드|그거|그걸|이거|이걸|저거|저걸|뭔가|홈|메인)/i;
const NEGATED_ACTION_PATTERN = /(?:지\s*마|말아|않|안\s*돼|금지)/;
const COMBINED_PATTERN = /(?:열고|띄우고|보여\s*주고|넘겨\s*주고|이동하고|전환하고|바꾸고|가고).*(?:왜|설명|요약|알려|현황|상태|분석)/;

export function classifyCinemaTurn(message: string): CinemaTurnKind {
  const normalized = message.trim();
  if (!normalized) return 'conversation';
  const contextualAction = /(?:아까\s*그거|똑같이\s*해\s*줘|^골라\s*줘$)/.test(normalized);
  const action = contextualAction || (ACTION_PATTERN.test(normalized) && ACTION_TARGET_PATTERN.test(normalized));
  const analysis = ANALYSIS_PATTERN.test(normalized);
  if (NEGATED_ACTION_PATTERN.test(normalized)) return analysis ? 'analysis' : 'conversation';
  if (action && analysis && COMBINED_PATTERN.test(normalized)) return 'screen_action_with_analysis';
  if (analysis) return 'analysis';
  if (action) return 'screen_action';
  return 'conversation';
}

export function combineCinemaTurnReply(actionReply: string, analysisReply: string) {
  return [actionReply.trim(), analysisReply.trim()].filter(Boolean).join('\n');
}

const ACTION_CONNECTORS: Record<string, string> = {
  '열고': '열어', '띄우고': '띄워', '보여 주고': '보여 줘', '넘겨 주고': '넘겨 줘',
  '이동하고': '이동해', '전환하고': '전환해', '바꾸고': '바꿔', '가고': '가',
};

/** Jev에는 복합 발화 전체가 아니라 실제로 실행할 한 가지 화면 조작만 전달한다. */
export function commandTextForCinemaTurn(message: string) {
  if (classifyCinemaTurn(message) !== 'screen_action_with_analysis') return message.trim();
  const connectors = Object.keys(ACTION_CONNECTORS).join('|');
  const match = message.trim().match(new RegExp(`^(.*?)(?:${connectors})(?=\\s|$)`));
  if (!match) return message.trim();
  const connector = Object.keys(ACTION_CONNECTORS).find(value => match[0].endsWith(value));
  return connector ? `${match[1]}${ACTION_CONNECTORS[connector]}`.trim() : message.trim();
}
