# 3D 공장 무대 설계서

- 작성일: 2026-09-21
- 상태: 승인된 설계. 구현 또는 배포 완료를 의미하지 않는다.
- 목적: 필름 전체의 배경을 실제 3D 공장 공간으로 바꾸고, 공간을 배경으로 하는 연출을 그 위에서 수행한다.
- 범위: 무대 합성 구조, 공장 모델, 챕터 카메라, 온도 히트맵, 센서 핀 투영. 차트·음성·리액터 연출의 내부 표현은 범위 밖이다.

## 1. 배경

마지막 온습도 모니터링은 정적 이미지 위에 DOM 센서 카드를 얹는 구조였다. 이미지가 구워져 있어
구역별 상태를 색으로 표현할 수 없고, 카메라를 움직일 수 없으며, 센서 위치가 이미지 비율에 묶여 있다.

이미지를 3D 생성 모델로 변환하는 경로는 검증 결과 쓸 수 없다. 단일 물체 복원 모델은 장면을 주면
밀폐된 덩어리를 만든다(실측: watertight=true, 부피/외곽상자 0.07). 벽 안쪽에 공간이 없어 진입이
불가능하다. 따라서 참조 이미지를 설계도로 읽고 도형으로 짓는다.

## 2. 결정

- 필름 내내 3D 공장이 배경으로 살아 있다. 챕터가 바뀌어도 공간은 유지되고 카메라만 이동한다.
- 공간을 배경으로 하는 챕터는 카메라 연출을 받는다: `wave`(온습도), `visor`·`visorPan`(SMT 공장).
  나머지 챕터에서는 공장이 멈춘 배경으로 남는다.
- HUD는 섞는다. 공간에 붙는 것(구역명, 센서 핀, 설비 라벨)은 3D 좌표를 따르고,
  화면 가장자리 패널·차트·자막은 지금처럼 DOM·SVG·Canvas 2D로 위에 올린다.
- 기존 Canvas 2D 공간 장면 코드는 이번 범위에서 제거하지 않는다. 3D가 안정된 뒤 별도로 판단한다.
  다만 무대가 켜진 동안 공간 챕터가 자기 배경을 또 그리면 공장이 두 겹으로 보인다.
  해당 챕터는 무대가 살아 있을 때 자기 공간 묘사를 건너뛰고 HUD만 그린다. 코드는 남기고 호출만 우회한다.
  이 분리가 기존 함수에서 깔끔하지 않을 수 있다는 점이 이 설계의 가장 큰 구현 위험이며, 2·3단계에서 확인한다.

### 2.1 DESIGN.md 규정 변경

DESIGN.md의 "렌더러는 세 층이며 WebGL/Three.js는 쓰지 않는다"(2026-09-08 결정, 09-10 재확인)와
온습도 장면의 "WebGL을 실행하지 않는다"(2026-09-20)는 이 설계로 대체된다.

같은 항목이 엔진 도입 조건을 "자유 카메라·조명·재질이 필요해지기 전에는 추가하지 않는다"로 적어 두었고,
회전·진입·확대가 요구사항이 되면서 그 조건이 충족됐다. 구현과 함께 DESIGN.md를 갱신한다.

## 3. 합성 구조

필름 캔버스는 지금 배경 → 장면 → 질감 순으로 그린다. 3D는 배경 단계 앞에 들어간다.

```
factoryStage.render(pose, frame)      오프스크린 WebGL 캔버스에 공장을 그린다
  ↓
ctx.drawImage(stageCanvas, 0, 0, w, h)   필름 캔버스가 배경으로 받아 그린다
  ↓
drawJarvisBackdrop / drawSignalFilm       기존 장면과 HUD가 그 위에
  ↓
drawTexture(...)                          질감·블룸이 전체에 한 번에 걸린다
```

3D를 별도 DOM 레이어로 두지 않고 필름 캔버스 안에 합성하는 이유는 질감·블룸 후처리 때문이다.
별도 레이어로 두면 3D만 매끈하고 나머지는 거칠어 한 화면으로 보이지 않는다.

`useFilmPlayback`의 렌더 함수에서 `beginFilmViewport` 직후, `drawJarvisBackdrop` 앞에 합성 단계를 넣는다.
three.js는 동적 import로 불러오고, 실패하거나 WebGL을 쓸 수 없으면 stage는 `null`이 되어
합성 단계를 건너뛴다. 이 경우 지금과 동일한 화면이 나온다.

## 4. 공장 모델

`src/cinema/stage/factoryLayout.ts` 가 배치를 데이터로 갖는다.

```ts
export interface StageRoom { id: string; name: string; x0: number; z0: number; x1: number; z1: number }
```

방 경계가 곧 내벽 위치다. 벽에는 문과 창 개구부를 뚫어 카메라가 안으로 들어갈 수 있게 한다.
개구부 없는 방을 두지 않는다. 좌표는 미터를 쓰고 X가 긴 변, Z가 짧은 변, Y가 높이다.

`src/cinema/stage/factoryModel.ts` 가 배치 데이터를 받아 `THREE.Group`을 만든다.
설비는 작은 빌더 함수로 조립한다: 머시닝센터, 작업대, 적재 랙, 지게차, 책상, 제어반, 공조 덕트.
빌더는 그룹 하나에 상자 몇 개를 로컬 좌표로 조합하며, 실루엣을 먼저 잡고 디테일을 얹는다.

재질은 기존 `src/cinema/studio/factoryModel.ts` 의 팔레트를 따른다.
따뜻한 도장 금속, 무광 바닥, 부드러운 주변광이라는 시각 언어를 유지하기 위해서다.
`RoundedBoxGeometry` 로 모서리를 죽이는 처리도 그대로 쓴다.

SMT 라인과 온습도 구역은 같은 바닥 평면에 배치한다. 카메라가 두 구역 사이를 끊지 않고 이동해야 한다.

## 5. 챕터 카메라

`src/cinema/stage/stageCamera.ts` 가 챕터 id와 챕터 내 경과 시간을 받아 카메라 포즈를 돌려준다.

```ts
export interface StagePose { position: Vec3; target: Vec3; fov: number }
export function stagePose(chapter: FilmId, localTime: number, duration: number): StagePose
```

챕터마다 시작 포즈와 끝 포즈를 정의하고 그 사이를 보간한다. 버드뷰에서 라인 안으로 내려가는 식이다.
공간 챕터가 아닌 동안에는 직전 챕터의 끝 포즈를 유지해 배경이 정지한다.

챕터가 바뀌는 순간에는 이전 포즈에서 새 포즈로 짧게 이어 붙여 끊김을 없앤다.

사용자가 화면을 드래그하면 연출을 놓고 자유 카메라로 전환한다.
기존 `SmtFactoryExplorer`·`CctvExplorer`가 쓰는 수동 전환·자동 복귀 패턴을 따르고,
`onAuto` 로 연출에 복귀한다.

## 6. 히트맵과 센서 핀

### 6.1 구역 바닥 색

온습도 챕터에서 구역 바닥 메시의 색을 상태에 따라 바꾼다.
판정은 기존 `environmentZoneStatus`를 그대로 쓰고 새 규칙을 만들지 않는다.
정상·이탈·데이터 없음 세 상태만 구분하며, 색은 기존 센서 카드의 테두리 색 체계를 따른다.

값이 없는 구역은 색을 칠하지 않는다. 시연 데이터와 실데이터의 구분 표시는 기존 규칙을 유지한다.

### 6.2 센서 카드 위치

센서 카드는 DOM으로 남긴다. 글래스 카드 디자인, 키보드 포커스, 이탈 시 앰버 테두리,
작은 화면 2열 재배치가 이미 구현돼 있고 3D 안으로 옮기면 모두 다시 만들어야 한다.

`src/cinema/stage/stageProjection.ts` 가 월드 좌표를 화면 비율로 바꾼다.

```ts
export function projectToScreen(pose: StagePose, point: Vec3, aspect: number): { x: number; y: number; visible: boolean } | null
```

결과를 기존 `--x`·`--y` CSS 변수에 넣는다. 카메라 뒤로 넘어간 센서는 `visible: false` 로 숨긴다.
숫자는 지금처럼 `sceneData.environment` 만 쓴다. 3D 도입이 데이터 출처를 바꾸지 않는다.

## 7. 성능과 폴백

- **재사용**: 카메라 포즈와 장면 데이터가 직전 프레임과 같으면 3D를 다시 그리지 않고
  마지막 결과를 재사용한다. 차트 챕터에서는 공장이 정지 배경으로 남아 비용이 들지 않는다.
- **프레임 게이트**: `FilmFrameKey` 에 카메라 포즈 서명을 추가한다.
  포즈가 바뀌면 다시 그리고, 그대로면 기존 규칙대로 건너뛴다.
- **해상도**: 오프스크린 캔버스의 DPR 상한을 필름 캔버스와 맞춘다. 그림자 맵은 2048을 넘기지 않는다.
- **탭 전환**: 기존 `filmMotion.ts` 의 `watchPageVisibility` 를 쓰고 새 루프를 만들지 않는다.
- **WebGL 없음**: `factoryStage` 생성이 실패하면 합성 단계를 건너뛴다.
  기존 Canvas 2D 장면이 그대로 그려지므로 화면이 비지 않는다.
- **정적 배포**: GitHub Pages 정적 export 모드에서도 WebGL은 브라우저 기능이므로 영향이 없다.

## 8. 영향

새 파일:

```
src/cinema/stage/factoryLayout.ts      방·설비 배치 데이터
src/cinema/stage/factoryModel.ts       배치 → THREE.Group
src/cinema/stage/factoryStage.ts       씬·렌더러·오프스크린 캔버스 수명
src/cinema/stage/stageCamera.ts        챕터 → 카메라 포즈
src/cinema/stage/stageProjection.ts    월드 → 화면 좌표
```

수정:

```
useFilmPlayback.ts        렌더 함수에 합성 단계, 프레임 게이트 키 확장,
                          현재 카메라 포즈를 반환값으로 노출(센서 카드가 읽는다)
filmFrameGate.ts          FilmFrameKey 에 카메라 포즈 서명 추가
SignalFilm.tsx            포즈를 EnvironmentFloorMonitor 로 전달
EnvironmentFloorMonitor.tsx  고정 퍼센트 배열 대신 투영 결과로 센서 위치를 받는다.
                          무대가 없을 때는 기존 고정 배열로 되돌아간다
DESIGN.md                 렌더러 규정과 온습도 장면 규정 갱신
```

센서 카드는 캔버스가 아니라 React 컴포넌트다. 따라서 포즈가 `useFilmPlayback` → `SignalFilm` →
`EnvironmentFloorMonitor` 로 흘러야 한다. 포즈는 매 프레임 바뀌므로 React 상태로 올리면 렌더가 폭주한다.
`camera.frameRef` 처럼 ref 로 전달하고 카드 위치는 CSS 변수로 직접 쓴다.

건드리지 않음: `drawSignalFilm.ts` 의 장면 등록표, 차트·음성·리액터 연출,
`sceneData` 계약, 센서 폴링, 기존 Canvas 2D 공간 장면.

## 9. 단계

각 단계는 화면 확인을 통과해야 다음으로 넘어간다.

| 단계 | 내용 | 확인 |
|---|---|---|
| 1 | 합성 배관. 바닥 한 장만 있는 빈 무대 | 필름 위에 3D가 합성되고 질감이 함께 걸리는가 |
| 2 | 공장 모델(방·벽·개구부·설비) | 참조 배치와 닮았는가, 방마다 들어갈 수 있는가 |
| 3 | 챕터별 카메라 연출 | 전환이 끊기지 않는가, 수동 조작 후 복귀하는가 |
| 4 | 히트맵과 센서 핀 | 구역 색이 상태와 맞는가, 카드가 센서 위에 붙는가 |
| 5 | 기존 Canvas 2D 공간 장면 정리 여부 결정 | 별도 판단 |

## 10. 검증

- `npm run typecheck`, `npm run test:unit`, `npm run build`
- 단계마다 실행 화면 캡처로 육안 확인
- WebGL을 끈 상태에서 기존 화면이 그대로 나오는지 확인
- 프레임 게이트가 정지 구간에서 3D를 다시 그리지 않는지 확인

## 11. 범위 밖

- 차트·음성·리액터 연출의 3D 전환
- 충돌 판정. 벽 통과는 의도된 동작으로 둔다
- 실제 공장 실측 치수 반영. 이번에는 참조 이미지 비례를 따른다
- 센서 개수 확장. 기존 10개 규칙을 유지한다
