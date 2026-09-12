import { describe, expect, it } from 'vitest';
import { SCREEN_SETTINGS, resolveScreenCommands, validateScreenCommand } from '@/cinema/screenCommands';

describe('screen command contract', () => {
  it('opens the orbit menu as two ordered actions, without a model', () => {
    expect(resolveScreenCommands('구체형 메뉴 열어줘')).toEqual([
      { action: 'set', key: 'menuLayout', value: 'orbit' }, { action: 'set', key: 'menu', value: 'true' },
    ]);
    expect(resolveScreenCommands('메뉴 접어줘')).toEqual([{ action: 'set', key: 'menu', value: 'false' }]);
  });
  it('does not execute negated requests or questions about how to operate', () => {
    for (const text of ['메뉴 열지마', '구체 메뉴 말고 다른 거', '카메라 연결 어떻게 켜?', '재생 속도 바꾸면 어떻게 돼?']) expect(resolveScreenCommands(text)).toBeNull();
  });
  it('resolves settings and values from the shared catalog', () => {
    expect(resolveScreenCommands('재생 속도 1.5로 바꿔줘')).toEqual([{ action: 'set', key: 'speed', value: '1.5' }]);
    expect(resolveScreenCommands('색상 테마 블루로 바꿔줘')).toEqual([{ action: 'set', key: 'theme', value: 'blue' }]);
    expect(resolveScreenCommands('연출 설정 열어줘')).toEqual([{ action: 'set', key: 'settings', value: 'true' }]);
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
