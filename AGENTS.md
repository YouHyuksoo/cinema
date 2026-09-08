# CINEMA

독립 CINEMA 프로젝트. 원본은 C:\Project\hud이며 이 프로젝트는 원본 디렉터리를 참조하지 않는다.

- 한국어로 소통한다. 변경 전 현재 소스와 실행 상태를 확인한다.
- 기본 포트: 3000. 이미 점유 중이면 다른 포트로 자동 변경하거나 기존 프로세스를 종료하지 않는다.
- src/app은 화면 조립 및 API 진입점만 둔다. 연출·음성·카메라 코드는 src/cinema, 서버 OpenAI 호출은 src/server/cinema에 둔다.
- 화면은 / 및 /cinema, API는 /api/cinema/assistant 및 /api/cinema/realtime이다.
- 공통 시각 규칙과 변경 영향 경로는 DESIGN.md에 기록한다.
- .env.local은 서버 전용이다. 비밀 값을 출력하거나 커밋하지 않는다.
- node_modules와 빌드 결과는 이 프로젝트 자체에 생성한다. 원본 HUD에 대한 링크를 만들지 않는다.
- 검증: npm run typecheck, npm run test:unit, npm run build. 기존 lint 오류는 새 변경과 구분한다.
- Next.js 코드를 수정하기 전에 node_modules/next/dist/docs/의 관련 가이드를 확인한다.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
