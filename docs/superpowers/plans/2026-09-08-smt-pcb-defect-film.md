# SMT PCB Defect Film Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement task-by-task with spec then quality review.

**Goal:** PCB 불량 분석을 machine 장면의 기본값으로 구현하고 자동차는 수동 선택 옵션으로 보존한다.

**Architecture:** PCB 데이터/검증/시간 상태와 투영/그리기를 분리한다. 기존 장면 저장소에 PCB 데이터를 등록하고, 분석 대상은 데이터와 독립된 페이지 세션 상태로 전달한다. 자동 PCB→자동차 전환은 절대 없다.

**Tech Stack:** 기존 React/Next.js/TypeScript, Canvas 2D 기반 3D 투영, CSS Modules, Vitest. 의존성 추가 없음.

**Spec:** `docs/superpowers/specs/2026-09-08-smt-pcb-defect-film-design.md` (사용자 OK, 명세 검토 승인).

**Workspace:** 사용자 승인한 현재 `C:/Project/cinema` main 작업폴더에서 진행한다. 기존 서버/포트·타 작업은 보존한다. 커밋/푸시는 별도 요청 전 수행하지 않는다. 스테이징된 설계 문서는 보존한다.

## 사용자 변경 지시 — 최초 시각 구현 확인 후

사용자가 기존 초록 기판과 카메라 확대 연출을 거부하고 **투명 기판은 고정, 포커스만 불량 부품 사이를 이동하며 정보 표시**로 변경했다. 아래 Task 2의 보드 카메라 pan/scale 확대 요구와 기존 설계 문서의 같은 부분은 이 지시로 대체한다. 보드·패드·부품의 투영은 시간에 따라 변하지 않으며, 검사 타깃과 연결선만 움직인다. 새 회귀 테스트도 고정 투영과 이동 포커스를 검증한다. PCB 기본/자동차 수동 선택, 데이터 계약 및 기존 재생 기능은 유지한다.

### 2026-09-09 추가 시각 요청

사용자가 기판을 눕힌 모습과 화려한 등장 액션을 요청했다. 낮은 사선의 수평 PCB로 배치하고 0~4초 동안 바닥 빛 링 → 기판 윤곽 → 회로 점등 → 부품 정착 연출을 추가한다. 등장 이후에는 기판을 고정하고 포커스만 이동하는 규칙을 유지한다. 원래 데이터/수동 자동차/재생 설정 계약은 바꾸지 않는다.

### 통합 검증 기록 (추가 등장 연출 전)

- [x] Task 1 모델/계약: 명세·품질 검토 PASS, 잘못된 판정 및 부정형 명령 회귀 수정.
- [x] Task 2 고정 투명 PCB/이동 포커스: 명세·품질 검토 PASS. 이전 pan/zoom 요구는 취소.
- [x] Task 3 수동 대상 선택/데이터·출처/메뉴·명령: 명세·품질 검토 PASS. 제외 대상 및 일반 별칭의 대상 전달 수정.
- [x] 619개 단위 테스트(78파일), typecheck, lint, build, diff check 통과.
- [x] 기존 localhost:3000에서 PC U1/R12/U3와 요약(40/정상37/불량3/미검사0), 정지 상태에서 PCB↔자동차 선택 후 0초·2배속·장면 반복 보존, 보존 자동차 화면 확인.
- [x] 실제 390×845 브라우저 뷰포트에서 가로 넘침 없음, 모바일 PCB/판독 확인, 구체 드래그 후 메뉴가 열리지 않고 위치 이동 확인. 물리 휴대폰 터치는 미검증.
- 실제 AI 음성·마이크·카메라·DB 검사 데이터 연동은 검증하지 않음. 커밋/푸시는 하지 않음. 같은 체크아웃에 추가된 에너지 장면 커밋 `9625692`는 보존.

## Task 4 — 누운 PCB와 0~4초 등장 액션

- [x] 낮은 고정 사선 투영, 투명 PCB/부품, 검사 중 기판 고정 유지.
- [x] 결정적 등장 상태와 빛 링·윤곽·회로 점등·부품 정착, 4초 이후 검사 포커스와 자연스럽게 연결.
- [x] RED→GREEN, 명세→품질 검토 PASS. 전체 단위 테스트 622개(79파일), typecheck, lint, build 통과.
- [x] 기존 localhost:3000에서 1.8초 회로 점등과 정착 후 U1 포커스 실화면 비교. 낮게 누운 투명 보드가 같은 위치에 유지됨. 모바일 390×845에서 보드/판독 영역 및 가로 넘침 없음 확인.
- 변경 파일: pcbEntrance.ts / components/drawPcbEntrance.ts / pcbInspectionLayout.ts / components/drawPcbAssembly.ts / drawPcbInspectionFilm.ts / cinemaPcbEntrance.test.ts. 실제 휴대폰·AI 음성·카메라·DB는 미검증이며 기존 서버·포트·다른 작업 변경을 보존했다.

## Task 1 — PCB 모델·부품 계약·시간 상태

Files: create `src/cinema/pcbInspection.ts`, `src/cinema/pcbInspectionData.ts`, `src/cinema/pcbInspectionFields.ts`; modify `filmSceneData.ts`, `sceneDataRegistry.ts`, `sceneField.ts`, `sceneFields.ts`, `hatcheryTargets.ts`와 관련 schema 소비자; tests `tests/unit/scenes/cinemaPcbInspection.test.ts`, `cinemaPcbSceneData.test.ts` 및 기존 계약 테스트.

- [x] RED: PCB 시연 세 불량, 정상/미검사/빈 배열, 잘못된 치수/enum/중복 ID/기판 밖 좌표, ID별 패치 원자성/label 보호, 시간 되감기/불량 순회 테스트를 작성한다.
- [x] `npx vitest run tests/unit/scenes/cinemaPcbInspection.test.ts tests/unit/scenes/cinemaPcbSceneData.test.ts`: 미구현 동작으로 실패 확인.
- [x] Implement: `PcbInspectionData { name, serial, width, height, thickness, components }`, `PcbComponent { id, label, partNumber, kind, x, y, rotation, width, height, depth, defect, process }`. 치수/좌표 mm; kind ic/resistor/capacitor/connector, defect none/uninspected/insufficient_solder/offset/bridge, process spi/maoi/aoi. enum 및 라벨은 단일 정의를 공유한다. `pcbInspectionState(time,data)`에서 검증, counts, failed components, selected, focus(0..1), presence, scan, phase를 파생한다. 36초: 0~4 scan, 4~28 count 기반 순회, 28~34.5 summary, 종료 fade. 각 순회 구간은 초반 접근·중간 유지·후반 후퇴다.
- [x] Implement: 독립 pcb 데이터키를 FilmSceneData/store에 추가하고 machine을 PCB L2로 등록. 추가/삭제/geometry는 전체 교체만, defect/process만 ID 패치. invalid 문서/패치는 기존 데이터를 보존한다. 서술자에 필요한 enum 제한을 추가할 경우 schema/format/검증 소비자를 함께 맞춘다. HATCHERY 객체 조회와 코드 값 변경 경로도 같은 배열/서술자를 사용한다. 자동차 데이터나 대상 선택을 데이터 패치로 바꾸지 않는다.
- [x] GREEN: 위 테스트 및 `npm run test:unit`, `npm run typecheck`. 기존 scene 등록 개수/지원목록 단언은 의미에 맞춰 갱신.
- [x] Spec review → quality review → 지적 수정. 커밋은 보류. 비정상/부정형/복수 판정 명령의 정상 오인식 회귀를 RED→GREEN으로 수정하고 두 검토 PASS.

## Task 2 — PCB 3D 렌더러·반응형·자동차 보존

Files: create `src/cinema/pcbInspectionLayout.ts`, `components/drawPcbAssembly.ts`, `components/drawPcbInspectionReadout.ts`, `drawPcbInspectionFilm.ts`, `drawRaceCarFilm.ts`, `machinePresentation.ts`; modify `drawTransparentMachineFilm.ts`; tests `cinemaPcbFilm.test.ts`, `cinemaRaceCar.test.ts` (필요한 렌더러 직접 호출만).

- [ ] RED: projection/zoom에서 부품 중심과 타깃 일치, 모바일 경계, 데이터 반영, 빈/오류/불량 없음, PCB 기본 및 명시적 car 분기, 자동차 기존 텍스트/paint fingerprint를 테스트한다.
- [ ] `npx vitest run tests/unit/scenes/cinemaPcbFilm.test.ts tests/unit/scenes/cinemaRaceCar.test.ts`: 새 동작 실패 확인.
- [ ] Implement: `MachineSubject = 'pcb' | 'car'`, default pcb. 기존 자동차 진입점 코드를 drawRaceCarFilm으로 이름만 옮겨 보존. drawTransparentMachineFilm의 기존 6인자 뒤에 subject, pcb data, provenance(선택)를 추가해 기본 pcb / 명시 car로만 분기한다.
- [ ] Implement: createHoloProjection을 사용한 단일 보드 xy/z 좌표계. 보드/pads/pins/부품/결함/연결선을 같은 카메라로 투영한다. 기판 동박/비아/실크와 부품 종류별 입체 형상, 불량별 접합부 도형을 그린다. 정상은 반투명, 불량은 타깃+문구+강조. 4~28초 실제 선택 부품 중심으로 pan/scale을 보간하고 후퇴한다. 검사 결과는 시간으로 변조하지 않는다.
- [ ] Implement: desktop 중앙 보드/측면 readout, portrait 보드 위/readout 아래. PCB용 viewport transform은 CSS/DPR 도크 inset을 반영한다. 배경/paint 상태는 save/restore로 격리. 시연/출처 라벨을 읽을 수 있게 유지한다.
- [ ] GREEN: targeted tests + typecheck. 다음 Task 3 전 이 task의 실제 UI 검증은 통합 이후 수행한다고 기록한다.
- [ ] Spec review → quality review → 지적 수정. 커밋은 보류.

## Task 3 — 설정·재생·메뉴·기존 명령 연결과 실화면 검증

Files: create `src/cinema/FilmMachineControls.tsx`; modify `useFilmPlayback.ts`, `drawSignalFilm.ts`, `FilmControls.tsx`, `filmProgram.ts`, `FilmChapterIcon.tsx`, `FilmChapterMenu.tsx`, `SignalFilm.tsx`(대상별 aria 텍스트 필요 시), `jarvisCommands.ts` 및 명령 전달 호출부, `DESIGN.md`, `docs/standards/scene-data-contract.md`; tests `cinemaMachineControls.test.ts`, 관련 명령/프레임/갤러리 회귀.

- [ ] RED: default pcb, 명시 car 설정 선택, 변경 시 machine 시작점/정지 상태 보존, 장면 이동 중 선택 보존, 16개/538초 유지, 명시 자동차 요청의 대상 정합성 테스트.
- [ ] Implement: player clock/ref와 React state에 subject를 함께 보관; renderer에 마지막 옵션 인자로 전달해 기존 호출 호환. `changeMachineSubject(value)`는 유효한 값만 허용하고 machine 내에서만 시작점으로 옮기며 paused/speed/mode/theme/texture는 유지. 어느 시간에도 subject를 자동으로 변경하지 않는다.
- [ ] Implement: machine 전용 설정 fieldset `분석 대상`(PCB 불량 분석 / 자동차), 기본 PCB 안내. 메뉴 짧은 라벨/아이콘/설명은 PCB 주제로 변경하되 id/duration/order 유지. 자동차 선택 시 대상별 화면/aria/설정 표기가 맞아야 한다.
- [ ] Implement: PCB/기판/불량 부품 명령은 machine을 호출하고 자동차 명시 명령은 car 대상 전달 또는 선택 필요 안내를 한다. 명시 car 요청에 PCB 실행 성공이라고 답하지 않는다. 음성/AI 실연결 검증은 하지 않는다.
- [ ] Update DESIGN과 계약 영향표: 기본 PCB와 수동 자동차 옵션, 시연/출처, 개별 부품 패치, 표면 한 면, 모바일 조립, 검사 코드. 기존 자동차 전용 규칙은 보존 옵션 설명으로 대체한다.
- [ ] GREEN: `npm run typecheck`, `npm run test:unit`, `npm run lint`, `npm run build`, `git diff --check`.
- [ ] Browser: 기존 localhost:3000 탭, PCB 기본 진입/자동 확대 세 부품/summary, 일시정지/seek, 설정 car→pcb 수동 전환, PC/모바일 화면 경계와 큰 보드, 구체 메뉴 회귀. 실제 목소리/카메라/DB 호출을 시작하지 않는다.
- [ ] Spec review → quality review → 수정/재검증. 최종 결과/미검증 범위를 이 계획에 기록하고 사용자에게 전달한다.
