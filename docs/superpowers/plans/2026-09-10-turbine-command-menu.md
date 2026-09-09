# Floating turbine command menu

**Goal:** 승인된 5날 터빈을 모든 CINEMA 연출 화면의 왼쪽 아래에 표시한다.

**Architecture:** SVG 금속 날개와 HTML 버튼을 같은 CSS 변환 좌표에 놓는다. 호버·키보드 초점·터치 클릭으로 펼침 상태를 제어하고 경계 이탈 시 접는다. SignalFilm의 공통 명령 컨트롤러가 기존 플레이어와 음성 세션을 공유하며 JarvisMain은 동일한 음성 상태를 표시한다.

**Tech Stack:** React, CSS Modules, inline SVG, Vitest.

- [ ] 명령 라우팅·5개 버튼·접힘 접근성 테스트 작성 및 실패 확인.
- [ ] FilmTurbineMenu / filmTurbineMenu.module.css: 참조 이미지에 맞춘 다섯 금속 날개, 축, 네온 테마, 떠다님·펼침·접힘, reduced motion.
- [ ] turbineCommands.ts: 메인메뉴 / 현장 브리핑 / 재생 정지 / 재생 시작 / AI대화 동작 분리.
- [ ] SignalFilm에서 단일 음성 훅을 공유하고 모든 장면에 터빈 배치. 기존 단독 JarvisMain 사용은 래퍼로 호환.
- [ ] 단위 테스트·타입 검사·빌드 및 실제 호버/이탈/장면 이동/재생 버튼 확인.

## Boundaries

기존 구체·큐브 메뉴와 사용자 변경을 유지한다. 이미지 비트맵을 UI에 사용하지 않는다. 호버만으로 명령을 실행하거나 카메라/마이크를 켜지 않는다. AI대화 클릭만 기존 음성 시작 동작을 호출한다. 브리핑은 메인 화면에서 현장 요약을 보여준다. 외부 AI 호출/마이크 브라우저 검증은 실제 실행하지 않고 라우팅 테스트로 확인한다. 자동 커밋하지 않는다.
