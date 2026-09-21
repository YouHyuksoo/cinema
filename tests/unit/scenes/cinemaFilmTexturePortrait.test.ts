import { describe, expect, it } from 'vitest';
import { filmBloomSurfaceSize, filmTextureTransform } from '@/cinema/filmTexture';

const VIEW_WIDTH = 1280, VIEW_HEIGHT = 720;

describe('filmTexture 세로(portrait) 보정 — Round 8', () => {
  it('가로 1280×720(원래 논리 캔버스 크기)에서는 항등 변환·기존 블룸 크기 그대로다', () => {
    expect(filmTextureTransform(VIEW_WIDTH, VIEW_HEIGHT)).toEqual({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
    expect(filmBloomSurfaceSize(VIEW_WIDTH, VIEW_HEIGHT)).toEqual({ width: 320, height: 180 });
  });

  // 회귀 방지의 핵심: 가로(16:9 근처) 화면은 이 수정 이전과 정확히 같은 값을 내야 한다.
  it.each([[1920, 1080], [1024, 768], [1280, 800], [800, 600]])('가로 %sx%s 는 원래 비균일 공식(width/1280, height/720)과 정확히 같고, 블룸은 항상 320×180이다', (width, height) => {
    expect(width / height).toBeGreaterThanOrEqual(.85); // 전제 확인 — 이 크기들은 "가로"로 분류된다.
    expect(filmTextureTransform(width, height)).toEqual({ a: width / VIEW_WIDTH, b: 0, c: 0, d: height / VIEW_HEIGHT, e: 0, f: 0 });
    expect(filmBloomSurfaceSize(width, height)).toEqual({ width: 320, height: 180 });
  });

  it.each([[390, 844], [430, 932], [320, 640], [645, 1350]])('세로 %sx%s 는 x·y 스케일이 완전히 같다(사각형이 아니라 균일 스케일 — 줄무늬의 원인이던 비균일 스케일을 없앤다)', (width, height) => {
    expect(width / height).toBeLessThan(.85); // 전제 확인 — 이 크기들은 "세로"로 분류된다.
    const m = filmTextureTransform(width, height);
    expect(m.a).toBe(m.d); // 핵심 단언: 가로/세로 배율이 하나(cover)다.
    expect(m.a).toBeCloseTo(Math.max(width / VIEW_WIDTH, height / VIEW_HEIGHT), 10);
    expect(m.b).toBe(0); expect(m.c).toBe(0);
    // 옛 비균일 공식(가로 분기)을 그대로 썼다면 나왔을 값과는 달라야 한다 — 그게 버그였다.
    const legacy = { a: width / VIEW_WIDTH, d: height / VIEW_HEIGHT };
    expect(m.a).not.toBeCloseTo(legacy.a, 2);
  });

  // Round 8 수정: "같은 총 픽셀 수" 로 세로 표면 크기를 정했더니(첫 시도) 세로 축소율이 기존
  // 844/180≈4.7배에서 2.4배로 약해져, 밝은 요소가 덜 옅어진 채 screen 합성으로 돌아와 화면이
  // 하얗게 날아갔다. "같은 축소 배율(4배)" 로 고쳤다 — 이 테스트가 그 배율을 고정한다.
  it.each([[390, 844], [430, 932], [320, 640], [645, 1350]])('세로 %sx%s 의 블룸 축소 배율은 가로(320/1280=180/720=4배)와 같다 — 밝기 톤이 가로와 같아야 한다', (width, height) => {
    const size = filmBloomSurfaceSize(width, height);
    // 정수 반올림 오차만 허용한다(표면 크기는 정수 픽셀이라 4배에서 최대 0.5px 어긋날 수 있다).
    expect(width / size.width).toBeCloseTo(4, 1);
    expect(height / size.height).toBeCloseTo(4, 1);
    // 두 축의 축소율이 같아야(등방) 흐림 반경도 방향과 무관하게 같다 — 줄무늬 수정은 그대로 유지한다.
    expect(width / size.width).toBeCloseTo(height / size.height, 1);
  });

  it('세로 표면은 가로(320×180=57,600픽셀)보다 오히려 작다 — 비용을 늘리지 않는다', () => {
    for (const [width, height] of [[390, 844], [430, 932], [320, 640], [645, 1350]] as const) {
      const size = filmBloomSurfaceSize(width, height);
      expect(size.width * size.height).toBeLessThanOrEqual(320 * 180);
    }
  });

  it('16:9 를 벗어나도 가로 판정 경계(.85)에 딱 걸치면 여전히 기존 공식이다', () => {
    const width = 850, height = 1000; // 0.85 — 경계값은 "가로" 쪽에 포함된다(>=).
    expect(width / height).toBeCloseTo(.85, 5);
    expect(filmTextureTransform(width, height)).toEqual({ a: width / VIEW_WIDTH, b: 0, c: 0, d: height / VIEW_HEIGHT, e: 0, f: 0 });
  });
});
