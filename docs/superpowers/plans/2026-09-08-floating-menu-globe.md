# Floating Menu Globe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 메인/연출 화면의 링 메뉴를 클릭해서 펼칠 수 있는 부유 육각 구체로 축소한다.

**Architecture:** 메뉴 상태를 preview와 분리하고 기존 chapter 목록·아이콘·링 선택 로직을 유지한다. 순수 구체 geometry와 독립된 전환 계층을 사용해 ID별 메뉴 조각이 링과 구체 사이를 실제로 이동하게 한다. 서버·장치·재생 데이터는 변경하지 않는다.

**Tech Stack:** Next.js 16, React 19, TypeScript, CSS Modules/3D transforms, SVG, Vitest. 새 의존성 없음.

**Approved spec:** `docs/superpowers/specs/2026-09-08-floating-menu-globe-design.md`

## 최종 구현·검증 결과

- Task 1~4 구현 및 각 명세/품질 검토 완료. Task 6의 사용자 실화면 피드백까지 구현한 최종 명세/품질 검토도 승인됐다.
- 최종 위치 변경 후 실행: `npm run typecheck`, `npm run test:unit`(73파일/590개), `npm run build`, `git diff --check` 모두 exit 0. 구체 본체 구현 시 `npm run lint`도 통과했다.
- 실제 화면: PC 240px / 모바일 약 390×845에서 180px / 가로 843×390에서 132px, 닫힌 공통 예약 32px, 페이지 가로 넘침 없음.
- 페이지 최초 진입·새로고침은 닫힌 구체로 시작한다. 초기 위치와 매번 축소할 때의 목적지는 오른쪽 하단이며, 드래그한 위치는 다음 축소 전까지만 유지한다.
- 마우스 드래그와 감속 정착, 오른쪽/아래 경계와 안내 문구, 모바일 너비에서 이동과 왼쪽 경계, 드래그 후 재축소 시 우하단 복귀를 확인했다. 구체 밖 기존 화면은 조작 가능하다.
- 메인 축소/장면 실행 자동 축소/메인 복귀 펼침, 정지시킨 장면의 25.6초 시간 보존, 설정 우선 Escape와 구체/정면 초점, Enter/Space 3회 반복을 확인했다.
- 동작 줄이기에서 구체 transform 정지, 직접 드래그 가능, 즉시 펼침/축소를 확인했다. 임시 viewport·모션·터치 에뮬레이션 설정은 복원했다.
- 검증 제한: 실제 터치 이벤트 주입은 in-app Browser의 `Input.dispatchTouchEvent` 미지원으로 실행하지 못했다. 터치는 공통 Pointer Events/캡처/클릭 억제 코드로 구현됐지만 실제 휴대폰 터치는 미검증이다. 실제 음성/카메라 연결은 시작하지 않았다.
- 기존 서버/포트와 다른 작업의 변경을 유지한다. 구현 커밋은 사용자 요청 시 이 작업 파일만 포함하며 푸시는 별도 요청 시에만 수행한다.

아래 체크리스트는 최초 계획의 세부 기록이다. 최초 작은 하단 구체 규칙은 Task 6과 위 최종 결과로 대체한다.

**Workspace:** 사용자가 보는 기존 `C:\Project\cinema`와 3000 서버를 보존한다. 다른 디렉터리/포트로 자동 전환하지 않는다. 작업 전 dirty tree를 확인하고 겹치는 타 작업 변경이 있으면 보존한다. 구현 커밋은 사용자 요청 범위와 현재 작업 경계를 확인한 뒤 수행하며 푸시는 하지 않는다.

## 파일 책임

| 파일 | 책임 |
|---|---|
| `src/cinema/filmMenuGlobe.ts` (신규) | 구면 위치·법선·크기, 유한 입력 검증, 링↔구체 pose 보간 |
| `src/cinema/FilmMenuGlobeView.tsx` (신규) | 장식 면과 구체 펼침 버튼, 기존 아이콘 재사용. Windows에서 filmMenuGlobe.ts와의 대소문자 충돌 회피 |
| `src/cinema/filmMenuGlobe.module.css` (신규) | 육각 면·원근·부유·반응형·모션 줄이기 |
| `src/cinema/useFilmMenuGlobe.ts` (신규) | 연속 회전/전환 진행률, DOM 크기 관찰·RAF 정리 |
| `src/cinema/FilmChapterMenu.tsx` | 기존 링과 구체의 chapter ID 및 현재 turn 연결, 전환 시각 계층 연결 |
| `src/cinema/FilmDock.tsx` | 축소 버튼·구체 펼침 명령·설정과 초점 처리 |
| `src/cinema/SignalFilm.tsx` | preview와 독립된 menuOpen, 진입/복귀 연결 |
| `src/cinema/filmDock.module.css`, `film.module.css` | 사각 앵커 제거·예약 높이·상태 스타일 |
| `tests/unit/scenes/cinemaMenuGlobe.test.ts` (신규) | geometry, pose 보간과 reduced-motion 상태 순수 테스트 |
| `tests/unit/scenes/cinemaPersistentDock.test.ts` | 메인/연출의 펼침·축소 DOM/접근성 회귀 |
| `DESIGN.md` | 새 공간 예약·입체 메뉴 규칙 및 영향 경로 |

## Task 1: 구체 geometry와 전환 기반

검증 완료: 구면 계산/간격/최단 회전 보간 신규 9개 포함 전체 554개 테스트 통과. 독립 명세 검토 및 코드 품질 검토 승인. `globeFaceSize`는 호출부에서 count/radius별로 메모한다.

- [ ] 관련 Next 로컬 CSS/client 가이드를 읽는다. `filmMenuRing.ts`, `FilmChapterMenu.tsx`, `FilmChapterIcon.tsx`와 현재 도크를 확인한다.
- [ ] 실패 테스트 작성: `globePose(index,count,radius,angle)`로 16개 면의 중심이 radius에 있고 모든 좌표가 유한함을 검증한다. count 0/1, NaN 입력 처리와 간격도 검증한다. faceSize는 가장 가까운 중심 간 거리의 0.75 이하로 제한하여 틈을 보장한다.
- [ ] `npm run test:unit -- tests/unit/scenes/cinemaMenuGlobe.test.ts` 실행, 신규 모듈 없음으로 실패를 확인한다.
- [ ] 순수 함수 구현. 분포 기본식은 `y=1-2*(index+.5)/count`, `theta=index*Math.PI*(3-Math.sqrt(5))+angle`, `x=Math.sqrt(1-y*y)*Math.sin(theta)`, `z=Math.sqrt(1-y*y)*Math.cos(theta)`이다. CSS 좌표로 radius를 곱하고 면 법선은 정규화된 동일 벡터를 사용한다. yaw/pitch는 법선에서 구한다. 회전각은 초 단위 UI 시간으로만 변하고 장면 시간에 연결하지 않는다.
- [ ] `mixMenuPose(from,to,t)`는 진행률을 0~1로 제한하고 좌표·크기·불투명도를 보간한다. 회전은 최단 각 경로로 보간한다. t=0, .5, 1 및 역방향 테스트를 추가하고 통과를 확인한다.

## Task 2: 기존 링↔구체 조각 전환

- [ ] `FilmMenuGlobe` 정적 마크업 테스트를 먼저 추가한다. 모든 chapter ID/아이콘이 장식 면으로 한 번씩 있고, 구체 펼침은 단일 네이티브 버튼이며 개별 면에는 클릭 동작이 없음을 검증한다. 펼침 버튼의 aria-expanded/aria-controls를 검증하고 실제 브라우저에서 최소 44×44px 터치 영역을 확인한다.
- [ ] 기존 링 레이아웃은 `FilmChapterMenu`에 유지한다. 구체 및 전환 조각을 동일 stage 좌표계에 렌더링하고 링의 `turn`과 `ringPose`를 전달한다. 링의 최대 폭, stage margin, 중심 오프셋, 짧은 화면 top 비율을 그대로 반영한다. 실제 버튼의 중심과 전환 조각의 링 endpoint가 일치해야 한다.
- [ ] `useFilmMenuGlobe`는 open/closed 목표·현재 전환 pose·구체 회전각을 관리한다. closed idle에서만 저속 회전하고, 전환 시작 시 각도를 고정해 시작 pose를 보존한다. 650ms 동안 ID별 면이 ringPose↔globePose 사이를 이동한다. 시각 proxy는 항상 aria-hidden이며 전환 전후 동일 ID의 실제 링/구체 면과 인계한다. 단순 opacity 교체로 대체하지 않는다.
- [ ] 빠른 재입력은 현재 보간 pose에서 새 목표로 출발하도록 한다. 취소된 RAF와 전환 완료 콜백은 실행되지 않게 세대 번호 또는 cleanup으로 보호한다. resize 시 새 endpoint를 사용하고 지연 타이머 하나에 완료를 의존하지 않는다.
- [ ] 부유는 전환 좌표와 다른 래퍼에 적용한다. CSS 테마 변수와 기존 SVG 프레임을 재사용한다. 구체는 지름 112/88/68px, 4px 부유, 30초 회전. 뒤쪽 면은 어둡게 하거나 backface-hidden 처리한다.
- [ ] `visibilitychange`에서 회전 RAF를 중지/재개하고 숨김 시간을 누적하지 않는다. `matchMedia('(prefers-reduced-motion: reduce)')` 변경도 관찰해 회전/부유를 정지하고 전환을 즉시 목표로 맞춘다. 언마운트 시 RAF·이벤트·ResizeObserver를 모두 정리한다.
- [ ] 렌더 단계에서는 현재 목표 상태의 의미 있는 컨트롤만 활성화한다. 구체/전환 아이콘 중첩 버튼 금지, 닫힌 링 inert, 열린 구체 tabIndex=-1 및 aria-hidden. transition 동안 아래 Canvas로 pointer 이벤트가 통과하지 않게 한다.
- [ ] geometry/마크업 테스트를 다시 실행해 통과를 확인한다.

## Task 3: 메인에서도 축소 가능한 메뉴 상태

실행 조정: Task 3과 Task 4는 같은 FilmDock DOM·CSS 높이에 의존하므로 하나의 통합 구현 담당자가 순서대로 처리한다. 시각 계층 구현 검토를 통과한 뒤 시작하며, 통합 명세/품질 검토와 실제 화면 검증을 거친다.

- [ ] `cinemaPersistentDock.test.ts`를 확장해 preview=true/false 각각 open=true/false를 테스트한다. 닫힌 메인에도 '하단 메뉴 펼치기', 열린 상태에는 '메뉴 축소', 닫힌 패널에는 inert/aria-hidden이 있어야 한다. 이전 메인 강제 펼침 기대값을 교체하고 실패를 확인한다.
- [ ] `SignalFilm`에서 `const [menuOpen,setMenuOpen]=useState(true)`로 독립 상태를 둔다. `openPreview`와 메인 복귀 성격의 `enable`은 true, `closePreview`는 false로 설정한다. 기존 camera.stop, environment.clear, resumeTour, 데이터 actions 전달을 보존한다.
- [ ] `FilmDock` 작업 행에 '메뉴 축소'를 추가한다. 동작은 설정 닫기 → onMenuOpenChange(false). 기존 사각 앵커를 구체로 교체한다. 구체 클릭은 설정 닫기 → onMenuOpenChange(true)만 호출하며 player.selectChapter/togglePlay/camera.start를 호출하지 않는다.
- [ ] 구체를 FilmChapterMenu 안에 배치할 경우 inert는 navigation 안의 링 컨트롤 부분에만 적용한다. 조상 panel 전체를 inert 처리하여 펼침 버튼까지 막지 않는다. 도크의 제목/작업/설정도 별도 inert 영역으로 묶는다. 닫힘에도 장식 sphere stage는 도크 공간 안에 남긴다.
- [ ] Escape는 설정 닫기 우선, 그 다음 menuOpen이면 preview와 무관하게 축소한다. 초기 마운트 초점 이동은 하지 않는다. 명시적 축소와 도크 안에서 자동 축소는 구체로, 구체 클릭 후에는 정면 메뉴로 이동한다. 자동 축소 시 도크 밖 살아 있는 입력 초점을 보존한다.
- [ ] 설정 표시·3회 연속 축소/확대·음성/정보 카드 경유 장면 실행 후 상태가 설계와 맞는지 확인한다. 기존 링 드래그/정렬/실행 코드는 그대로 재사용한다.

## Task 4: 화면 공간과 문서

- [ ] `film.module.css`에서 모든 열린 메뉴 예약 높이를 208px(짧은 화면 172px), 닫힌 메뉴를 144/120/100px로 설정한다. 680px 너비 규칙보다 500px 높이 규칙이 우선하도록 한다. safe-area-inset-bottom이 기본 여백보다 크면 추가분을 콘텐츠 예약 높이에도 반영한다.
- [ ] `filmDock.module.css`에서 사각 앵커 스타일을 제거하고 링 조작 행은 좁은 화면에서 가로 스크롤 가능하게 한다. 닫힌 도크에서 빈 패널 높이·배경·불필요한 gap을 제거한다. 변환 중 조각이 잘리지 않도록 시각 계층의 overflow와 stage 높이를 조절하되 페이지 가로 overflow를 만들지 않는다.
- [ ] 기존 `useFilmPlayback` 속성 관찰이 새 menuOpen 변경과 같은 `--film-dock-space`를 사용함을 확인한다. 온습도/설비 포인터 역변환은 독립된 고정 숫자를 추가하지 않는다.
- [ ] `DESIGN.md`의 기존 앵커/메인 강제 펼침/예약 높이 규칙을 새 규칙으로 대체하고 새 파일 영향 경로를 기록한다.

## Task 5: 최종 검증과 인계

실화면 피드백 변경: 사용자가 작은 하단 구체 대신 큰 전면 부유 구체와 마우스/터치 이동을 요청했다. 기존 Task 1~4의 상태/선택/전환 기반은 유지하고 아래 Task 6을 먼저 구현한 뒤 최종 검증한다. 기존 112/88/68 지름과 144/120/100 닫힘 예약 높이는 새 규칙으로 대체한다.

- [ ] `npm run typecheck`, `npm run test:unit`, `npm run lint`, `npm run build` 실행. 목표는 모두 exit 0, 새 테스트 포함 전체 통과다. 기존/타 작업 오류가 있으면 새 변경과 구분하여 보고하고 그 파일을 덮어쓰지 않는다. Windows spawn EPERM이면 같은 명령의 권한 승인으로 재시도하고 다른 런타임/서버로 바꾸지 않는다.
- [ ] browser 스킬로 현재 3000 탭을 검사한다. 메인 축소 → 구체 부유/회전 → 펼침 → 링 선택 → 자동 축소 → 메인 복귀를 수행한다. 세 번 반복하고 구체 클릭으로 장면/시간/재생이 초기화되지 않는지 확인한다.
- [ ] 데스크톱, 390×844 모바일, 짧은 가로 화면을 검사한다. 구체 지름·깊이·틈·전환 중간 화면·페이지 overflow·입력창/안내와 겹침을 확인하고 임시 viewport를 복원한다.
- [ ] 키보드 Enter/Space, Escape 우선순위, focus-visible, 닫힌 링 tab 제외, reduced-motion 정지 구체/즉시 전환을 검증한다. 실제 마이크/카메라는 시작하지 않는다.
- [ ] 온습도 장면에서 닫힌/열린 메뉴 각각 카드 선택을 검증한다. 도크 높이가 변경돼도 그려진 카드와 터치 위치가 일치해야 한다.
- [ ] `git diff --check`와 최종 변경 파일 목록을 확인한다. 완료 항목을 체크하고 남은 검증 제약이 있으면 기록한다. 사용자에게 구현 결과·검증·커밋 여부를 간결하게 보고한다.

## Task 6: 사용자 실화면 피드백 — 큰 전면 드래그 구체

- [ ] 구체 지름을 PC 240px / 모바일 180px / 짧은 화면 132px로 확대하고 전면 오버레이로 배치한다. 최초 중심은 화면 중앙보다 아래쪽, 이후 위치는 세션 안에서 기억한다.
- [ ] 구체 밖은 기존 화면을 조작할 수 있도록 두고 닫힌 하단 예약은 32px + safe-area 초과분으로 줄인다. 안내 문구와 부유 여백까지 화면 안에 제한한다.
- [ ] Pointer Events와 capture로 마우스·터치 드래그를 지원한다. 이동 임계값을 넘긴 제스처는 메뉴 펼침 클릭으로 처리하지 않는다. 짧게 눌렀을 때와 Enter/Space는 기존 펼침을 유지한다.
- [ ] 놓은 뒤 짧은 감쇠 관성 이동 후 그 자리에서 부유한다. 새 드래그·펼침에서 관성을 중단한다. 모션 줄이기에서는 관성과 부유/회전을 정지하되 직접 위치 이동은 가능하게 한다.
- [ ] 구체 좌표를 기존 모프에 연결해 마지막 이동 위치와 링 사이를 전환한다. resize/작은 화면 경계, 빠른 전환, pointercancel, 화면 비활성 처리와 정리를 검증한다.
- [ ] 크기/경계/감쇠/드래그 클릭 억제 순수 테스트와 실제 데스크톱·모바일 드래그/재펼침 검증을 추가한다. DESIGN.md의 새 크기·전면 배치·조작 규칙과 영향 경로를 갱신한다.
