# HATCHERY 진입 연출: 에어록 문과 큐브 (2026-09-11)

## 목적

/cinema 메인에 처음 들어올 때 닫힌 우주선 문(에어록)이 화면을 가리고, 그 앞에서 관리 큐브가 혼자 섞였다가 풀린다. 그동안 문 뒤에서 HUD가 모두 그려지고, 준비가 끝나면 문이 좌우로 열리며 큐브가 왼쪽 위 도킹 자리로 날아가 착지한다. "화면이 준비되는 시간"을 연출로 바꾼다.

## 확정 요구

- 재생 빈도: 브라우저 탭 세션당 1회. `sessionStorage['hatchery.intro.v1']`에 시작 시점에 기록해 새로고침·장면 다녀오기에는 재생하지 않는다.
- 문: 좌우 2분할 슬라이딩. 중앙 수직 이음선.
- 건너뛰기: 오버레이 클릭 또는 Escape. 문이 즉시 열리고 큐브는 0.3초 안에 도킹 자리로 스냅한다.
- 동작 줄이기(prefers-reduced-motion): 연출 없이 열린 화면으로 시작하되 세션 플래그는 기록한다.
- 문은 HUD가 다 그려진 뒤에만 연다: 큐브 풀기 완료 AND (폰트 로드 완료 AND `main[data-film-theme]` 존재 AND 그 뒤 한 프레임 경과). 둘 중 늦은 쪽에 맞춘다.
- 이미지 파일 없이 CSS/SVG로 그린다(기존 HUD 규칙). 글래스모피즘·보라 그라데이션 금지.

## 타임라인 (기본 약 7.6초)

| 시각 | 무대(문 앞) | 문 | 문 뒤 |
| --- | --- | --- | --- |
| 0.0s | 큐브가 화면 중앙에 1.6배로 나타난다(기존 와이어프레임→색 채움 등장 재사용) | 닫힘, 잠금등 앰버 | HUD 마운트·렌더 시작, 폰트 로드 |
| 0.8s | 섞기 8수 시작(수당 320ms, 기존 `cubeScramble`) | | |
| 3.4s | 역순 풀기 8수 | | |
| 5.9s | 풀기 완료 → `solved` 통지 | | 준비 판정 |
| T0 = max(5.9s, 준비 완료) | | 잠금등 시안으로 전환, 이음선에서 빛이 새며 좌우로 1.1초 동안 열림 | |
| T0+0.4s | 큐브가 중앙에서 도킹 자리로 1.2초 비행(가벼운 포물선, 1.6→1배, 뱅크 ±8°) | | |
| T0+1.6s | 착지 → `docked` 통지, 오버레이 제거 | 완전 개방 | 정상 운영 |

건너뛰기: 어느 시점이든 T0를 즉시로 당기고 큐브는 `snap`(0.3초 직선 이동)으로 도킹한다.

## 무대 디자인 (최종, 2026-09-11)

문 컨셉과 3D HUD 리그 컨셉은 사용자 검토에서 폐기했다(HUD 세계관과 어긋남, 촌스러움). 최종안은 "루빅 큐브 하나만"이다.

- 어두운 남색 방사 배경 위에 관리 큐브의 인트로 복제본이 화면 폭의 18%(--u × 18) 크기로 중앙에 놓인다. 기존 큐브 기하·이동 엔진(filmMenuCube.ts: CUBE_CUBIES, cubeScramble, cubeComposeTurn, cubeApplyMove, cubeCubieTransform)을 그대로 쓰므로 실제 큐브와 동일한 26큐비·54스티커 구조다.
- HUD 형식: 스티커는 루빅 색을 42% 섞은 반투명 패널에 시안 와이어 엣지, 큐비 몸체는 유리질 반투명, 주변에 40초/90초 주기로 도는 분절 조준 링과 코너 브래킷 4개.
- 동작: 고정 기울기(rotateX −26°)로 16초에 한 바퀴 돌면서 0.8초 뒤 8수 섞기(고정 시드 11) → 역순 풀기(수당 320ms + 40ms 간격) → solved 통지. 하단 문구 "HATCHERY 로딩중"(점멸 점 3개)은 출발 시 "준비 완료"로 바뀐다(role=status).
- 관통 대신 도킹 비행: return/snap 큐에서 실제 큐브 버튼([data-cube-control])의 위치·크기를 재서 그 자리로 날아가 겹치고(cubeIntroFlight, 회전은 도킹 자세 rotateX −24° rotateY 32°로 수렴), docked 통지 후 무대가 사라진다. 배경 페이드(--pass)는 별도 .veil 층에 둔다: 3D 큐브 조상에 opacity 애니메이션을 걸면 preserve-3d가 평면화된다.
- 첫 페인트 보장: 무대는 서버 HTML에 포함되고, layout.tsx의 인라인 스크립트가 세션 플래그·동작 줄이기를 페인트 전에 판정해 :root[data-hatchery-intro-seen]로 숨긴다. 은 강제 재생.
- 실제 큐브(FilmMenuCubeView)는 수정하지 않는다. 인수인계는 위치 일치로만 이루어진다.

## 구조

### 모듈

| 파일 | 책임 |
| --- | --- |
| `src/cinema/hatcheryIntro.ts` (신규, 순수) | 상수·타임라인·상태 기계·세션 플래그 판정. DOM 없음. |
| `src/cinema/cubeIntroFlight.ts` (신규, 순수) | 중앙→도킹 비행 자세(`x, y, scale, bank, yaw, done`)와 스냅. |
| `src/cinema/HatcheryIntro.tsx` + `hatcheryIntro.module.css` (신규) | 문 오버레이 렌더, 준비 판정, 큐브와의 신호 교환, 세션 플래그 기록, 건너뛰기 입력. |
| `src/app/cinema/page.tsx` (수정) | `<HatcheryIntro/>`를 SignalFilm 형제로 마운트. 공유 파일(SignalFilm, JarvisMain)은 건드리지 않는다. |
| `src/cinema/FilmMenuCubeView.tsx` (수정, 최소) | 루트 속성을 읽어 무대 배치·섞기·풀기·비행을 수행하고 이벤트로 통지. |

### 신호 계약

- 오버레이 → 큐브: `document.documentElement.dataset.hatcheryIntro` = `'stage'`(중앙 무대, 등장 후 0.8초 뒤 섞기→풀기) | `'return'`(도킹 비행) | `'snap'`(0.3초 스냅). 제거되면 평상시.
- 큐브 → 오버레이: `document.dispatchEvent(new CustomEvent('hatchery-intro-cube', { detail: 'solved' | 'docked' }))`.
- 큐브가 없는 화면(마운트 실패·장면 화면)에서는 오버레이가 3초 안에 `solved`를 못 받으면 큐브 없이 문만 연다(연출이 화면을 영구히 가리지 않는다).

### 상태 기계 (`hatcheryIntro.ts`)

상태: `closed` → `opening` → `done`. 입력: `cubeSolved`, `hudReady`, `skip`, 경과 시간. `closed`에서 (`cubeSolved && hudReady`) 또는 `skip` 또는 `cubeTimeout`이면 `opening`으로, 문 개방 1.1초가 끝나고 `docked`(또는 스냅 완료)면 `done`. 상태마다 루트 속성 값과 문 개방 진행도(0~1)를 낸다. 세션 플래그 판정은 주입된 storage 객체로 하며 저장 불가 환경에서는 현재 세션에서만 1회 재생한다.

### 층 순서

문 오버레이 z-index는 HUD `main` 위, 큐브 레이어 아래. 오버레이가 활성인 동안만 `:root[data-hatchery-intro] [data-cube-layer]`의 z-index를 오버레이보다 높게 올린다. 큐브 이외의 HUD 요소는 문에 가려진다.

### 접근성

오버레이는 `role="dialog" aria-label="HATCHERY 시작"`, 건너뛰기 버튼(시각적으로는 전체 화면 투명, 텍스트 "건너뛰기")에 초점을 둔다. 완료 시 초점을 원래 문서로 돌린다. 문 뒤 HUD는 `inert`로 두어 탭 초점이 문 뒤로 들어가지 않게 한다.

## 검증

- `cinemaHatcheryIntro.test.ts`: 상태 전이, 준비 대기, 건너뛰기, 큐브 타임아웃, 세션 플래그(있음·없음·저장 불가), 동작 줄이기.
- `cinemaCubeIntroFlight.test.ts`: 출발·도착 좌표 일치, 배율 1.6→1, 뱅크 범위, 스냅 0.3초, 비정상 입력.
- `cinemaHatcheryIntroMarkup.test.ts`: 문 마크업(두 판, 이음선, 잠금등 4개, 스텐실 텍스트, 건너뛰기 버튼, role).
- 큐브 연결 소스 계약 테스트.
- Playwright 헤드리스 스크린샷 3장(닫힘·열리는 중·완료)과 세션 플래그 후 재진입 시 연출 없음.

## 범위 밖

문 소리, 장면 화면 진입 연출, 최초 방문 기억(localStorage), 큐브 이외 HUD 요소의 등장 연출.

## 동시 작업 제약

FilmMenuCubeView.tsx는 Codex가 미커밋으로 수정 중이다(2026-09-11 확인). 큐브 연결은 그 변경이 커밋된 뒤 실제 코드를 다시 읽고 얹는다. 순수 모듈·오버레이·page.tsx는 먼저 진행한다.
