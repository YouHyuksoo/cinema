# CINEMA — HATCHERY Manufacturing Assistant

C:\Project\hud의 CINEMA를 분리한 독립 Next.js 프로젝트입니다. HATCHERY 메인 화면과 16개 연출, 카메라 얼굴 추적, 대화 기록 배경, 시동 버튼·기동 효과음, OpenAI Realtime·자유 질문, 로봇 음색 설정을 포함합니다. 제조 정보는 시연 데이터입니다.

## 실행

```powershell
cd C:\Project\cinema
npm ci
npm run dev
```

- 메인: http://localhost:3010
- 기존 주소: http://localhost:3010/cinema
- 개발·프로덕션 모두 기본 포트 3010입니다(원본 HUD의 3000번과 분리). 이 분리 작업은 기존 서버를 종료하지 않습니다.
- 최초 설치 후 빌드 시 next/font/google이 폰트를 받아야 하므로 인터넷 연결이 필요합니다.

## 검증과 프로덕션 실행

```powershell
npm run typecheck
npm run test:unit
npm run build
npm start
```

## 환경 설정

분리 시 기존에 승인된 OpenAI 설정만 .env.local로 복사했습니다. 실제 값은 Git 제외 대상이며 화면이나 문서에 포함하지 않습니다. 키 없이 시각 데모와 로컬 명령은 사용 가능합니다. 키가 있으면 AI 음성·자유 질문 사용량에 따라 OpenAI 비용이 발생합니다. 새 환경에서는 .env.example을 .env.local로 복사하여 설정하세요.

API는 localhost 접속과 동일 출처를 검증합니다. 외부 배포용 인증은 별도로 구성해야 합니다. 카메라는 브라우저 안에서 처리하며 OpenAI에 전송하지 않습니다.

## 구조

- src/app: 메인 및 /cinema 진입점, CINEMA API
- src/cinema: 재사용 연출 부품, 데이터 규격, 재생·테마·카메라·HATCHERY 음성
- src/server/cinema: 서버 전용 OpenAI 요청
- public/cinema: 얼굴 추적 Worker와 모델/WASM, 원본 라이선스
- tests/unit/scenes: CINEMA 관련 단위 테스트
- DESIGN.md: CINEMA 시각 규칙과 파일별 영향 경로

원본 HUD의 일반 대시보드, Claude API, Zustand 스토어, Motion 의존성은 포함하지 않습니다. 두 프로젝트는 이후 자동 동기화되지 않습니다.
## 분리 검증 (2026-09-07)

- 프로덕션 빌드 성공: /, /cinema, 두 CINEMA API 라우트 생성.
- TypeScript 및 ESLint 통과.
- 단위 테스트: 34개 파일, 239개 테스트 통과.
- CINEMA 소스와 자산 154개 SHA-256 비교 일치.
- 자체 node_modules와 cinema 이름의 package-lock.json 사용. 원본 HUD 연결 없음.
- 과거 레이더 테스트가 wave 메뉴를 24초 레이더 장면으로 가정하던 부분만 분리본에서 정리했습니다. 현재 wave는 온습도 장면이며 해당 테스트는 별도로 유지됩니다. 레이더 부품 자체 검증도 유지합니다.
- 원본 코드·서버는 변경하지 않았습니다. 새 서버는 3010번에서 실행되므로 기존 3000번 서버와 나란히 띄울 수 있습니다.
