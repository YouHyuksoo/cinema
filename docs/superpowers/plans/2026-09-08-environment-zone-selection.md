# Environment ZONE Selection Implementation Plan

**Goal:** 온습도 카드 클릭으로 ZONE을 고정 선택하고 빈 공간 클릭으로 자동 선택에 복귀한다.

**Architecture:** 기존 ZONE ID와 상태 계산을 사용한다. 화면에 실제 그린 프레임을 상호작용 세션에 보관하여 좌표 판정과 렌더링을 일치시킨다. 수동 선택은 자동 선택보다 우선하지만 기존 계기 조립·퇴장·그래프·히트맵 시간은 유지한다.

**Tech Stack:** React, TypeScript, Canvas 2D, Vitest, Next.js 16.3.4.

사용자가 현재 작업에서 구현 진행을 승인했다. 현재 체크아웃에서 작업하며 구현 방법에 대한 추가 승인 단계는 두지 않는다.

## 1. 객체·선택 규칙

- [x] `tests/unit/scenes/cinemaEnvironmentSelection.test.ts`에 수동 선택 우선, 해제, 부유·기울기·크기에 따른 경계, 겹침, 퇴장, 히트맵 전환 테스트 작성.
- [x] `npm run test -- tests/unit/scenes/cinemaEnvironmentSelection.test.ts`로 미구현 실패 확인.
- [x] `zoneEnvironment.ts`에 선택 ID 옵션과 동일한 카드 가시성 계산 추가. 온습도 값과 시간은 변경하지 않는다.
- [x] `environmentLayout.ts`에 실제 그리기 순서와 카드 윤곽을 공유. `environmentSceneObjects.ts`는 ID, 종류, 변환된 경계와 역순 선택 판정 제공.
- [x] `environmentSelection.ts`는 마지막 렌더 상태, 수동 ID, select/pick/clear/update를 관리한다. update(null), 보이지 않는 카드, 히트맵 시작에서 선택을 제거한다.
- [x] 동일 시간 반복·역방향 탐색과 자동 선택 복귀를 검사하고 테스트 통과 확인.

## 2. 렌더링·입력 연결

- [x] `useEnvironmentSelection.ts`가 세션을 React와 연결한다. 매 프레임 계산은 세션에, 선택 ID 변경만 React에 반영한다.
- [x] `useFilmPlayback.ts`에서 현재 chapter와 preview를 확인해 세션에 시간 또는 null을 전달. 선택 장면 이동·재시작 때 clear, seek 때 즉시 재검증한다.
- [x] `drawSignalFilm.ts` → `drawWaveFilm.ts`에 동일한 계산 상태를 전달. 기존 렌더 호출은 선택 상태 인자를 생략할 수 있다.
- [x] `components/drawZoneEnvironment.ts`에 공유 그리기 순서와 수동 선택 접점 강조를 적용한다. 중앙 계기 값·연결은 선택 상태를 사용한다.
- [x] `EnvironmentZoneInteraction.tsx`와 전용 CSS에서 Canvas 입력 계층과 짧은 조작 안내를 제공한다. CSS 크기/DPR/dock 보정 후 판정하고 빈 공간 클릭은 해제한다. 방향키 선택과 Escape 해제도 제공한다.
- [x] `SignalFilm.tsx`에서 wave 입력과 기존 화면 클릭 재생 버튼의 충돌을 없앤다. 재생은 하단의 기존 재생 버튼으로 조작한다.

## 3. 검증·문서

- [x] 렌더 회귀 테스트에 수동 ZONE 이름/값 전달 및 해제 후 자동 복귀 검증 추가.
- [x] `npm run typecheck`, `npm run test:unit`, `npm run build` 실행. 관련 파일 lint 검사.
- [x] 3000 포트에서 프로젝트가 실행되는지 확인하고 브라우저에서 카드 선택, 빈 공간 해제, 정지 중 선택, 크기 변경, 장면 이동을 검증한다. 실행 경로가 막히면 정확한 실패를 기록한다.
- [x] `DESIGN.md`에 조작법과 변경 영향 경로를 추가하고 결과를 보고한다.

## 실행 결과 (2026-09-08)

- 타입 검사·48개 테스트 파일/394개 테스트·프로덕션 빌드·전체 lint 통과.
- 초기 테스트 실행의 spawn EPERM은 승인된 실행으로 재시도했다. 새 객체 모듈 미구현 실패를 확인한 뒤 구현했다.
- 3000 포트는 기존 C:/Project/cinema/node_modules/next/dist/server/lib/start-server.js가 사용 중임을 확인했다. 새 dev 실행은 EADDRINUSE로 종료됐으며 기존 프로젝트 개발 서버에서 변경 반영을 확인했다.
- 브라우저: 정지 상태에서 ZONE 08 클릭 → 23.9°C/64% 및 연결선 갱신, 빈 공간 클릭·Esc 해제, 방향키 선택, 장면 변경 후 초기화 확인.
- 축소 화면의 브라우저 캡처와 입력 좌표 차이는 Canvas CSS 크기/DPR로 확인하고 브라우저 CDP 입력을 통해 ZONE 06 선택을 검증했다. 임시 viewport 설정은 원복했다.
- 테스트용 온습도 화면은 ZONE 08 선택·일시정지 상태로 유지했다.
