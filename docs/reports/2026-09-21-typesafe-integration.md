# TypeSafe / Jev 연동 구현과 검증

- 작성일: 2026-09-21
- 목적: CINEMA의 텍스트·브라우저 음성·Realtime 화면 명령 판단과 AI 환경설정 연결.

## 구현 결과

- 로컬 미인식 요청을 처리하는 서버 판단 API와 공유 명령 카탈로그·실행 라우터를 추가했다.
- TypeSafe/Jev 설정 UI를 기존 AI 화면과 오버레이에 추가했다. 모드·모델·키·연결 테스트·전용 저장을 제공한다.
- 키는 별도 서버 설정 블록에 보관하고 API 응답에서는 저장 여부만 반환한다. 일반 AI 및 데이터 소스 저장 시 Jev 설정을 보존한다.
- Realtime의 동일 발화 실행을 한 Promise로 묶고 새 발화·세션 종료 시 취소한다. 모델이 명령 원문을 바꿀 수 없도록 실제 전사를 사용한다.
- 대화·분석으로 분류된 요청은 읽기 전용이며, API 오류 시 다른 제공자로 자동 전환하지 않는다.
- 한국어 100문장 fixture와 평가 전용 실행 도구를 추가했다.

## 검증

| 항목 | 결과 |
|---|---|
| 변경 전 전체 단위 테스트 | 1,118개 중 1,033 통과 / 85 실패 |
| 변경 후 전체 단위 테스트 | 1,153개 중 1,068 통과 / 85 실패 |
| 기존 실패 비교 | 실패 항목 이름 차이 0건. 기존 51개 스냅샷 실패 포함 |
| TypeSafe·API·설정·Realtime·기존 화면 명령·AI 저장 관련 6개 파일 | 62개 통과 |
| 타입 검사 | 통과 |
| 프로덕션 빌드 | 최종 Jev 설정 UI와 admin/typesafe, admin/typesafe/test, intent 경로 포함 통과 |
| ESLint | 실행 차단: node_modules/@babel/core/lib/index.js가 ./transformation/file/file.js를 찾지 못함 |
| 실제 3010 API | /api/cinema/intent에서 HTTP 200, mode=off, configured=false 확인 |
| Aside 실제 화면 | /cinema/ai의 Jev 섹션·선택지·입력·버튼 표시 확인. 키 없는 연결 테스트 오류와 실행 모드 저장 차단 확인 |

실제 화면 캡처: `test-results/typesafe/ai-settings-desktop.jpeg` (로컬 검증 파일, Git 제외).

검증 명령:

```powershell
npm run typecheck
npm run test:unit
npm run build
npx vitest run tests/unit/scenes/cinemaRealtimeRouting.test.ts tests/unit/scenes/cinemaTypesafe.test.ts tests/unit/scenes/cinemaIntentRoute.test.ts tests/unit/scenes/cinemaTypesafeSettings.test.ts tests/unit/scenes/cinemaAiServer.test.ts tests/unit/scenes/cinemaScreenCommands.test.ts
```

## 키 설정 후 실제 연결 검증

사용자가 제공한 키를 서버 설정에 저장했다. 현재 `shadow`(평가만), `jev-latest`, `hasApiKey=true`, `keySource=config`다. 설정 파일은 Git 제외 대상으로 확인했다.

- 공식 API 직접 호출: HTTP 200, 실제 모델 `jev-1.13.0`, 약 9.7초. 인증 성공.
- CINEMA 연결 테스트 API: 연속 3회 HTTP 200, 서버 측 소요 시간 8,195 / 835 / 357ms. 별도 호출도 1,596ms에 성공했다.
- ASIDE 실제 연결 테스트: 네트워크 회복 후 성공. `jev-1.13.0`, 1,226ms를 화면에서 확인했다. 이전의 `UND_ERR_CONNECT_TIMEOUT`도 재현됐으므로 연결 장애 이력은 유지한다.
- 한국어 100문장 최종 평가: 99/100, 오실행 0건, p50 394ms, p95 471ms. 도메인 선택지 설명과 실측 점수 경계를 보정해 설정한 95% 기준을 충족했다.
- DNS로 확인된 두 IPv4 주소의 TLS 연결은 각각 약 530ms에 성공했다. 간헐적인 연결 실패의 근본 원인은 아직 확정하지 못했다.
- 응답 제한을 5초에서 20초로 늘리고 연결 오류와 응답 대기 시간 초과를 구분했다. 이 변경만으로 연결 오류가 해결되지는 않았다.
- 후속 타입 검사, TypeSafe 단위 테스트 17개, 프로덕션 빌드가 모두 통과했다.

실행 모드로 전환한 뒤 ASIDE에서 `관리도 화면 좀 띄워 주세요`를 1회 입력했다. 실제 SPC 분석 장면 전환, 출처 `TypeSafe 명령 판단`, 결과 `장면: SPC 분석 적용을 확인했습니다.`를 확인했다.

최신 ASIDE 증거: `C:\Users\hsyou\.aside\u\0\sessions\2026-09-21_8j5L9Gt7HB9B7sPE\tmp\cinema-spc.png` 및 `cinema-after-main.png`.

## 남은 작업

연결은 회복됐지만 간헐적인 연결 실패 이력이 있다. 텍스트 명령 실행은 검증했고 현재 실행 모드다. 실제 마이크 왕복은 미검증이다.

1. 실제 마이크 왕복과 새 발화에 의한 이전 요청 취소를 ASIDE에서 검증한다.
2. `node scripts/evaluate-typesafe.mjs`로 100문장 평가. 오실행·확인 요청 비율·응답 지연·토큰 사용량을 확인한다.
3. 기준을 충족하면 명령 실행 모드로 저장하고 실제 텍스트 화면 이동을 확인한다.
4. Realtime을 다시 연결해 마이크 입력, 반복 호출, 끼어들기, 세션 종료를 확인한다.
5. ESLint 의존성 누락은 기존 설치 상태를 조사한 뒤 별도 복구한다.

운영 안내와 변경 영향 경로: [TypeSafe 연동 가이드](../guides/typesafe-integration.md).
