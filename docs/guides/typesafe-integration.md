---
sources:
  - src/cinema/typesafeConfig.ts
  - src/cinema/commandDecision.ts
  - src/cinema/commandRouter.ts
  - src/cinema/admin/TypesafeSettings.tsx
  - src/cinema/useJarvisLocalVoice.ts
  - src/cinema/useJarvisVoice.ts
  - src/cinema/jarvisRealtimeSession.ts
  - src/server/cinema/typesafeClient.ts
  - src/server/cinema/typesafeRuntime.ts
  - src/server/cinema/commandDecision.ts
  - src/server/cinema/hatcheryConfig.ts
  - src/app/api/cinema/intent/route.ts
  - src/app/api/cinema/admin/typesafe/
  - scripts/evaluate-typesafe.mjs
verifiedCommit: c381e2e
---

# TypeSafe / Jev 명령 판단 연동

2026-09-21 작업 트리 기준. 위 커밋 이후 미커밋 구현도 포함한다.

## 설정

1. `/cinema/ai` 또는 관리 큐브 → AI 설정을 연다.
2. 상단 **TypeSafe / Jev · 명령 판단**에서 API 키와 모델을 입력한다.
3. **Jev 연결 테스트**를 누른다. 현재 입력값으로 작은 Noul 질문을 한 번 호출한다. 저장하거나 화면 명령을 실행하지 않는다.
4. **평가만**을 선택하고 **Jev 설정 저장**을 누른다. 상단의 일반 AI 저장 버튼과 별도다.
5. 한국어 평가와 실제 화면 검증 후 **명령 실행**으로 전환한다. Realtime 음성은 다시 연결한다.

저장된 키는 응답에 포함하지 않으며, 빈 키 입력은 기존 키를 유지한다. 기존 대화 프로바이더와 Jev는 함께 사용한다.
서버 설정 파일 `config/hatchery.sources.json`의 별도 `typesafe` 블록에 저장한다. 파일 위치는 기존 `HATCHERY_CONFIG_PATH`를 따른다.
저장된 모드·모델이 환경 변수보다 우선하며, 키는 새 입력 → 저장된 키 → `TYPESAFE_API_KEY` 순서다.
저장된 값이 없으면 `TYPESAFE_MODE=off`, `TYPESAFE_MODEL=jev-latest`가 기본이다.

| 모드 | 텍스트·브라우저 음성 | Realtime 음성 |
|---|---|---|
| 끄기 | 기존 경로 | 기존 경로 |
| 평가만 | 로컬 미인식 요청의 Jev 판단을 기록하고 기존 경로로 처리 | 기존 경로 |
| 명령 실행 | 로컬 미인식 요청을 Jev로 판단·검증·실행 | `route_command`를 통해 동일 판단·실행기를 사용 |

평가만 모드의 **Jev 결과**는 화면을 바꾸지 않는다. 기존 명령 처리 경로는 평소대로 동작한다.

## 판단과 실행

- 기존에 인식되던 로컬 명령을 우선 처리한다.
- Jev의 신규 판단 범위: 장면 이동(검사 대상 선택이 필요한 machine 제외), 홈 복귀, 작업·터빈·큐브 메뉴, 재생, 차트 형식.
- 지원 선택지는 `SCREEN_SETTINGS`에서 생성한다. API 키·프롬프트·자유 입력 값을 AI 명령으로 생성하지 않는다.
- 의도 Choice, 유효 명령 Choice, 명시적 요청 Noul을 한 API 호출에 묶는다.
- 초기 자동 실행 기준: 의도·명령 confidence 각각 0.9 이상, 명시적 요청 Noul 0.95 이상. 이는 한국어 실측으로 보정해야 하는 초기 정책이며 정확도 보장이 아니다.
- 차트 형식 변경은 현재 `scene=pie`일 때만 실행한다.
- 모호하거나 미지원인 요청은 확인 메시지를 반환한다. 대화·설명은 기존 AI로 보내되 서버 도구를 제공하지 않고 클라이언트에서도 화면 명령·패치를 적용하지 않는다.
- 인증·한도·통신·응답 오류는 사용자에게 알린다. 실패 시 다른 제공자로 자동 전환하지 않는다.

## Realtime 중복·취소 처리

서버가 SDP 응답의 `X-Cinema-Command-Router`로 세션에 적용한 경로를 알린다.
명령 실행 모드에서는 모델의 직접 `control_screen` 호출을 막고, `route_command`가 전사 원문을 사용한다.
이미 인식된 로컬 명령은 전사 직후 처리하므로 모델이 도구를 호출하지 않아도 실행된다. 후속 도구 호출은 발화별 Promise의 결과를 재사용한다.
새 발화나 세션 종료는 이전 판단 요청을 취소한다. 이전 발화의 전사와 늦은 결과는 적용하지 않는다.
기존 Realtime 허용 키 검증을 유지하며, 분석 위임은 읽기 전용으로 처리한다.

## 데이터와 관측

공식 `POST https://api.typesafe.ai/v1/systemone`을 서버에서만 호출한다. 제한 시간은 20초다. 실제 연결 확인에서 약 9.7초가 걸려 기존 5초 제한을 조정했다.
사용자 문장과 최소 화면 상태(`scene`, `playing`, `menu`)만 보낸다. 전체 장면 데이터·프롬프트·키는 전달하지 않는다.
로그에는 모드·판정 종류·모델·소요 시간·토큰 수만 남긴다. 발화나 API 키는 남기지 않는다.

## 한국어 평가

AI 설정에서 키와 **평가만**을 저장하고 3010 개발 서버가 실행 중인 상태에서:

```powershell
node scripts/evaluate-typesafe.mjs --limit=5
node scripts/evaluate-typesafe.mjs
```

`tests/fixtures/typesafe-korean.json`의 100문장을 판단 API에 전달한다. 화면 실행기를 호출하지 않는다.
결과는 `artifacts/typesafe-evaluation.json`에 기록한다. 오실행 수, 일치율, p50/p95, 토큰 사용량을 포함하며 실제 API 비용이 발생한다.
오실행이 하나라도 있거나 기대 결과 일치율이 95% 미만이면 종료 코드 1이다. 이 기준은 평가 목표이며 현재 측정 성적이 아니다.
평가 중 오류나 모드 변경이 발생하면 중단한다. 키 없음·끄기 상태에서는 실제 호출 없이 중단한다.

## 변경 영향 경로

| 변경 | 함께 확인할 위치 |
|---|---|
| 키·모드·모델 | typesafeConfig → feedConfig → hatcheryConfig → typesafeRuntime → admin/typesafe API → TypesafeSettings |
| 지원 명령 | screenCommands → commandDecision(공유 카탈로그) → server/commandDecision → commandRouter |
| 텍스트·브라우저 음성 | useJarvisLocalVoice → intent API → commandRouter → 기존 screen 실행기 |
| 실시간 음성 | realtime API/openai 설정 → jarvisRealtimeSession → useJarvisVoice → commandRouter |
| 판단 품질 | 한국어 fixture → evaluate-typesafe → 판단 기준·확인 메시지 |

## 비용 최소화 경로

- 로컬에서 확정되는 화면 명령은 외부 판단 API를 호출하지 않는다.
- 질문, 설명, 요약, 인사는 Jev를 호출하지 않고 텍스트 대화 모델로 바로 보낸다.
- 로컬에서 놓친 명시적 화면 조작만 Jev가 판단한다. 요청 영역에 따라 메뉴, 재생, 차트 스타일, 홈, 화면 후보 중 필요한 그룹만 전송한다.
- Realtime 음성은 음성 연결과 전사 자체에 OpenAI 비용이 발생한다. 같은 발화의 화면 판단은 한 번만 만들고 결과를 재사용한다. 비용을 가장 낮추려면 AI 설정에서 `브라우저 음성 + 텍스트 모델`을 선택한다.

키 설정 후 실제 인증과 ASIDE 연결 테스트가 성공했다. 보정 후 한국어 100문장 평가는 99/100, 오실행 0건으로 95% 기준을 충족해 명령 실행 모드로 전환했다. ASIDE 텍스트 명령으로 SPC 분석 장면 전환과 `TypeSafe 명령 판단` 출처도 확인했다. 간헐적인 `UND_ERR_CONNECT_TIMEOUT` 이력과 자세한 측정값은 [검증 보고서](../reports/2026-09-21-typesafe-integration.md)를 참조한다.
