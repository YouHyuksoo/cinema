import { describe, expect, it } from 'vitest';
import { SCREEN_SETTINGS, resolveScreenCommands, validateScreenCommand } from '@/cinema/screenCommands';

describe('screen command contract', () => {
  it('opens the orbit menu as two ordered actions, without a model', () => {
    expect(resolveScreenCommands('구체형 메뉴 열어줘')).toEqual([
      { action: 'set', key: 'menuLayout', value: 'orbit' }, { action: 'set', key: 'menu', value: 'true' },
    ]);
    expect(resolveScreenCommands('메뉴 접어줘')).toEqual([{ action: 'set', key: 'menu', value: 'false' }]);
    expect(resolveScreenCommands('그 메뉴 닫아')).toBeNull();
    expect(resolveScreenCommands('터빈 메뉴 펼쳐')).toEqual([{ action: 'set', key: 'turbineMenu', value: 'true' }]);
    expect(resolveScreenCommands('터빈 메뉴 접어')).toEqual([{ action: 'set', key: 'turbineMenu', value: 'false' }]);
    expect(resolveScreenCommands('설정 메뉴 열어줘')).toEqual([{ action: 'set', key: 'turbineMenu', value: 'true' }]);
    expect(resolveScreenCommands('설정메뉴 닫아')).toEqual([{ action: 'set', key: 'turbineMenu', value: 'false' }]);
    for (const text of ['작업메뉴 열어줘', '화면 메뉴 펼쳐줘', '구체형 네비게이션 메뉴 열어줘']) {
      expect(resolveScreenCommands(text)).toEqual([
        { action: 'set', key: 'menuLayout', value: 'orbit' }, { action: 'set', key: 'menu', value: 'true' },
      ]);
    }
    expect(resolveScreenCommands('관리 큐브 메뉴 열어')).toEqual([{ action: 'set', key: 'cubeMenu', value: 'true' }]);
    expect(resolveScreenCommands('큐브 메뉴 닫아')).toEqual([{ action: 'set', key: 'cubeMenu', value: 'false' }]);
  });
  it('returns to the main screen from common home-menu phrases', () => {
    for (const text of ['메인 메뉴로 가', '홈 화면으로 이동해', '메인으로 돌아가']) {
      expect(resolveScreenCommands(text)).toEqual([{ action: 'set', key: 'home', value: 'true' }]);
    }
  });
  it('does not execute negated requests or questions about how to operate', () => {
    for (const text of ['메뉴 열지마', '구체 메뉴 말고 다른 거', '카메라 연결 어떻게 켜?', '재생 속도 바꾸면 어떻게 돼?']) expect(resolveScreenCommands(text)).toBeNull();
  });
  it('resolves settings and values from the shared catalog', () => {
    expect(resolveScreenCommands('재생 속도 1.5로 바꿔줘')).toEqual([{ action: 'set', key: 'speed', value: '1.5' }]);
    expect(resolveScreenCommands('색상 테마 블루로 바꿔줘')).toEqual([{ action: 'set', key: 'theme', value: 'blue' }]);
    expect(resolveScreenCommands('연출 설정 열어줘')).toEqual([{ action: 'set', key: 'settings', value: 'true' }]);
  });
  it('maps every operator-adjustable screen setting to a deterministic command', () => {
    const cases: [string, string, string][] = [
      ['theme', '색상 테마 로즈로 변경해', 'rose'], ['background', '중앙 배경 스틸 오비트로 변경해', 'steel-orbit'],
      ['texture', '화면 질감 홀로그램으로 변경해', 'hologram'], ['intensity', '질감 강도 70퍼센트로 변경해', '70'],
      ['speed', '재생 속도 1.5로 변경해', '1.5'], ['playing', '재생 정지해', 'false'],
      ['mode', '재생 방식 현재 장면 반복으로 변경해', 'chapter'], ['seek', '재생 위치 12초로 이동해', '12'],
      ['machine', '검사 대상 자동차로 변경해', 'car'], ['pieStyle', '차트를 산포로 변경해', 'scatter'],
      ['pieDimension', '차트 형태 입체로 변경해', '3d'], ['pieDepth', '차트 두께 120퍼센트로 변경해', '120'],
      ['camera', '카메라 연결 켜줘', 'true'],
      ['cameraPopup', '영상 창 열어줘', 'true'], ['mirror', '거울 모드 켜줘', 'true'],
      ['zoom', '카메라 줌 1.4로 변경해', '1.4'], ['blur', '얼굴 블러 30으로 변경해', '30'],
      ['cctvMode', 'CCTV 직접 감시로 변경해', 'manual'], ['cctvCamera', 'CCTV 3번 카메라 선택해', '3'],
      ['factoryMode', '설비 직접 탐색으로 변경해', 'manual'], ['factoryStation', '2라인 마운터 선택해', 'L2-mounter'],
      ['factoryFocus', '선택한 설비로 이동해', 'true'], ['factoryReset', '설비 입구 시점으로 이동해', 'true'],
      ['environmentZone', 'ZONE 6 선택해', 'ZONE 06'],
      ['voiceGender', '목소리 여성으로 변경해', 'female'], ['voiceMode', '브라우저 음성으로 변경해', 'browser'],
      ['provider', 'AI 제공자 mistral로 변경해', 'mistral'], ['model', '채팅 모델 gpt-5-mini로 변경해', 'gpt-5-mini'],
      ['realtimeModel', '실시간 음성 모델 gpt-realtime-2.1-mini로 변경해', 'gpt-realtime-2.1-mini'],
      ['temperature', 'temperature 0.4로 변경해', '0.4'], ['maxOutputTokens', '최대 출력 토큰 1200으로 변경해', '1200'],
      ['instructions', '추가 지시 "세 문장 이내로 답해"로 설정해', '세 문장 이내로 답해'],
      ['prompt', '시스템 프롬프트 "현장 데이터만 설명해"로 설정해', '현장 데이터만 설명해'],
    ];
    for (const [key, phrase, value] of cases) {
      const commands = resolveScreenCommands(phrase);
      expect(commands, key).not.toBeNull();
      expect(commands, key).toContainEqual({ action: 'set', key, value });
    }
    expect(resolveScreenCommands('처음부터 다시 시작해')).toEqual([{ action: 'set', key: 'restart', value: 'true' }]);
  });
  it('maps the remaining visible object controls without relying on the model', () => {
    const cases: [string, string, string][] = [
      ['metricsScroll', '상단 지표 스크롤 멈춰', 'false'],
      ['leftScroll', '왼쪽 카드 자동 스크롤 재개해', 'true'],
      ['rightScroll', '오른쪽 분석 카드 멈춰', 'false'],
      ['focusCard', '생산 진행 카드 확대해', 'right:production'],
      ['cardFocus', '확대한 카드 닫아', 'false'],
      ['scannerEffect', '신호 감지기 실행해', 'true'],
      ['reactorEffect', '중앙 리액터 다음 효과 실행해', 'true'],
      ['cctvStep', '다음 CCTV 카메라 보여줘', 'next'],
      ['factoryZoom', '3D 설비 화면 확대해', 'in'],
      ['factoryDeselect', '설비 선택 해제해', 'true'],
      ['environmentStep', '다음 온습도 구역 보여줘', 'next'],
      ['environmentClear', '온습도 구역 선택 해제해', 'true'],
    ];
    for (const [key, phrase, value] of cases) {
      expect(resolveScreenCommands(phrase), key).toContainEqual({ action: 'set', key, value });
    }
    expect(resolveScreenCommands('재생해')).toEqual([{ action: 'set', key: 'playing', value: 'true' }]);
  });
  it('accepts natural multi-part commands instead of dropping the whole utterance', () => {
    expect(resolveScreenCommands('색상 테마 블루로 변경해 그리고 재생 속도 1.5로 변경해')).toEqual([
      { action: 'set', key: 'theme', value: 'blue' },
      { action: 'set', key: 'speed', value: '1.5' },
    ]);
  });
  it('rejects unknown keys, out of range numbers and invalid enums before mutation', () => {
    for (const [key, value] of [['speed', '500'], ['zoom', '0'], ['blur', 'NaN'], ['intensity', ''], ['theme', 'invented'], ['apiKey', 'secret']]) {
      expect(validateScreenCommand({ action: 'set', key, value })).toBeNull();
    }
    expect(validateScreenCommand({ action: 'set', key: 'menu', value: true })).toBeNull();
    expect(validateScreenCommand({ action: 'delete', key: 'theme' })).toBeNull();
  });
  it('accepts every exposed option and numeric boundary', () => {
    expect(new Set(SCREEN_SETTINGS.map(s => s.key)).size).toBe(SCREEN_SETTINGS.length);
    for (const s of SCREEN_SETTINGS) {
      for (const option of s.options ?? []) expect(validateScreenCommand({ action: 'set', key: s.key, value: option.value })).not.toBeNull();
      if (s.min !== undefined) for (const value of [s.min, s.max]) expect(validateScreenCommand({ action: 'set', key: s.key, value: String(value) })).not.toBeNull();
    }
  });
});
