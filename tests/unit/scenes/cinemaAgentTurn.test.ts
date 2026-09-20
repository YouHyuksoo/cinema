import { describe, expect, it } from 'vitest';
import { classifyCinemaTurn, combineCinemaTurnReply, commandTextForCinemaTurn } from '@/cinema/agentTurn';
import { activeConfirmation, confirmationReply } from '@/cinema/agentConfirmation';

describe('CINEMA agent turn planning', () => {
  it.each([
    ['SPC 분석 화면을 열어', 'screen_action'],
    ['습도가 왜 높은지 설명해 줘', 'analysis'],
    ['안녕하세요', 'conversation'],
    ['SPC 분석 화면을 열고 현재 품질 상태도 설명해 줘', 'screen_action_with_analysis'],
    ['온습도 모니터링을 보여 주고 이탈 구역을 알려 줘', 'screen_action_with_analysis'],
    ['화면을 바꾸면 어떻게 돼?', 'analysis'],
  ] as const)('classifies %s as %s', (message, expected) => {
    expect(classifyCinemaTurn(message)).toBe(expected);
  });

  it('combines the observed action result with the grounded explanation', () => {
    expect(combineCinemaTurnReply('SPC 분석 화면을 엽니다.', '현재 공정능력은 안정 범위입니다.'))
      .toBe('SPC 분석 화면을 엽니다.\n현재 공정능력은 안정 범위입니다.');
  });

  it('does not invent either half of a response', () => {
    expect(combineCinemaTurnReply('', '현재 상태를 확인했습니다.')).toBe('현재 상태를 확인했습니다.');
    expect(combineCinemaTurnReply('화면을 열지 못했습니다.', '')).toBe('화면을 열지 못했습니다.');
  });

  it.each([
    ['SPC 분석 화면을 열고 현재 품질 상태도 설명해 줘', 'SPC 분석 화면을 열어'],
    ['온습도 모니터링을 보여 주고 이탈 구역을 알려 줘', '온습도 모니터링을 보여 줘'],
    ['에너지 화면으로 가고 사용량을 설명해 줘', '에너지 화면으로 가'],
  ])('extracts one executable action from a combined turn: %s', (message, expected) => {
    expect(commandTextForCinemaTurn(message)).toBe(expected);
  });
});

describe('CINEMA agent confirmation context', () => {
  it.each(['응', '그래', '진행해', '그렇게 해'])('accepts a short affirmative only: %s', message => {
    expect(confirmationReply(message)).toBe('confirm');
  });
  it.each(['아니', '취소해', '하지 마'])('cancels a pending proposal: %s', message => {
    expect(confirmationReply(message)).toBe('cancel');
  });
  it('treats a correction as a new turn and expires stale context', () => {
    expect(confirmationReply('아니 큐브 메뉴 열어')).toBe('continue');
    const pending = { command: { action: 'set' as const, key: 'menu', value: 'false' }, expiresAt: 100 };
    expect(activeConfirmation(pending, 99)).toBe(pending);
    expect(activeConfirmation(pending, 100)).toBeNull();
  });
});
