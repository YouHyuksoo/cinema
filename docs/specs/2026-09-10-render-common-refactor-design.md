# 렌더 공통화 리팩터 설계 (2026-09-10)

## 배경

CINEMA(HATCHERY)는 WebGL/Three.js 없이 세 층으로 그린다.

| 층 | 용도 | 규모 |
| --- | --- | --- |
| Canvas 2D + 자체 원근 투영 | 19개 장면, 리액터, 비행 연출 | draw 모듈 94개, 약 9,400줄 |
| CSS 3D 변환 | 메뉴 큐브·구체, HUD 프레임, 자이로 | 약 1,600줄 |
| SVG / React DOM | 아이콘, 게이지, 브리핑 텍스트 | — |

이 구성은 유지한다. 카메라가 거의 고정된 얕은 원근이라 Canvas 2D가 충분하고, Three.js는 번들·학습 비용만 늘린다(2026-09-08 구체 설계에서 이미 같은 결론).

## 진단

복잡성은 렌더러 종류가 아니라 반복되는 보일러플레이트에서 온다.

1. **원근 투영 4계열 + 독립 구현 3개.** 공용 계열은 이미 있다: `createHoloProjection`(holoSpace.ts, 객체 중심 yaw→pitch, 11곳), `InspectionCamera`(inspectionSpace.ts, 월드 카메라 + near 클리핑, 4곳), `focusProjection`(filmFocus.ts, 2D 접근 확대, 6곳). 그런데 `cornerCoreGeometry.ts`, `cornerProjection.ts`, `voiceReactorGeometry.ts`는 같은 "pitch→yaw(→roll) 회전 후 LENS/(LENS+depth)" 커널을 각자 갖고 있고, `cubeReactorFlight.ts`·`filmFocus.ts`는 같은 렌즈 배율 공식을 따로 쓴다.
2. **RAF 루프 11곳.** `requestAnimationFrame`을 직접 도는 파일 11개, `prefers-reduced-motion` matchMedia 10개. 가시성(visibilitychange) 처리는 의미가 제각각이고(재개/취소/장치 해제) JarvisHeading·JarvisCamera는 처리 자체가 없다.
3. **DESIGN.md 273줄**이 헤더 2개 아래 날짜 순으로 쌓여 있어 시스템 규칙과 날짜별 교정이 섞여 있다.

## 결정

### 1. 렌즈 투영 공용 모듈 `filmLens.ts`

- `lensScale(lens, depth)` = `lens / (lens + depth)`. cubeReactorFlight·filmFocus·voiceReactor가 사용.
- `createLensProjection({ lens, yaw, pitch, roll, depth, originX, originY, centerX, centerY })` → `(x, y, z=0) => { x, y, depth }`. 회전 순서는 pitch → yaw → roll 고정. cornerCore·cornerReading·voiceReactor가 사용.
- **픽셀 불변 조건**: 연산 순서를 기존과 동일하게 유지해 부동소수 결과가 비트 단위로 같아야 한다. `roll=0`, `yaw=0`, `origin=0`, `center=0`일 때 `x*1 + t*0`, `0 + v` 형태는 IEEE 754에서 항등이므로 특수 분기 없이 하나의 커널로 표현한다.
- 검증: 리팩터 전 캡처한 골든 값 테스트 + `cinemaFilmFingerprint` 스냅샷 무변경 + 기존 corner/voiceCore/reactorRear/cubeReactorFlight/focus 테스트.
- `createHoloProjection`(yaw→pitch 순서), `InspectionCamera`, `glassPieGeometry`(tilt 단일 카메라), `raceProject`(고정 사선 아핀)는 회전 순서·모델이 달라 합치면 픽셀이 바뀌므로 그대로 둔다. 대신 DESIGN.md에 4계열의 용도를 명시한다.

### 2. 프레임 루프 공용 모듈 `filmMotion.ts`

effect 내부에서 쓰는 비-훅 헬퍼. 훅으로 만들면 값 변경마다 effect가 재실행돼 기존 동작(연출 중 취소 안 함 등)이 바뀌므로 채택하지 않는다.

- `createFrameLoop(tick)` → `{ start(), stop(), running }`. tick 안에서 `stop()`을 부르면 다음 프레임을 예약하지 않는다.
- `watchReducedMotion(listener)` → `{ reduced, stop() }`. 현재값 getter + change 구독.
- `watchPageVisibility(listener)` → `stop()`. `document.hidden`을 인자로 전달.
- `fitCanvasToBox(canvas, ctx, cssWidth, cssHeight, maxDpr=2)` → dpr. `Math.round(css*dpr)`로 크기가 다를 때만 재설정하고 `setTransform(dpr,0,0,dpr,0,0)`.
- 적용 대상: JarvisHeading, JarvisCamera, ScannerTeslaEffect, ReactorMenuPrank, JarvisWave, useDriftScroll. 헤딩·카메라에는 숨김 시 정지·복귀 시 재개를 새로 추가한다(일관성).
- 제외: FilmMenuCubeView·useFilmMenuGlobe(수요 기반 스케줄러로 연속 루프가 아님), useFilmPlayback(시킹·배속을 가진 장면 시계), useJarvisLocalVoice·useJarvisSpeechProfile(장치 수명 관리).
- 검증: filmMotion 유닛 테스트(전역 스텁) + tsc + lint + 브라우저에서 메인 화면 리액터·스캐너 호버 동작 확인.

### 3. DESIGN.md 재편

- 맨 위에 `## 렌더링 구조` 절을 새로 쓴다: 세 층, 투영 4계열과 선택 기준, 프레임 루프 규칙(filmMotion 사용).
- 기존 항목은 **문장을 고치지 않고** 영역별 헤더 아래로 이동만 한다(영향 경로·검증 문구 보존). 헤더: 공통 원칙 / 테마·질감·전체 화면 / 메인 화면(중앙·스트림·레이아웃) / 메뉴(큐브·구체·터빈·도크) / 장면별 규칙 / 참고 자료.
- DESIGN.md는 Codex와 겹치는 파일이므로 작업 직전 `git status`로 깨끗한지 확인하고 한 번의 커밋으로 끝낸다.

## 범위 밖

렌더러 교체, 장면 시각 변경, 지문 스냅샷 갱신, 큐브·구체 스케줄러 수정, useFilmPlayback 수정.
