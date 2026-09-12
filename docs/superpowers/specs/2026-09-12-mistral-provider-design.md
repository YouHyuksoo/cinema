# Mistral 채팅 제공자 설계

## 목표

CINEMA의 기존 AI 설정과 메인 화면 모델 선택에 Mistral을 추가한다. 운영자는 서버에 저장되는 Mistral API 키를 설정하고 `mistral-small-latest`, `mistral-medium-latest`, `mistral-large-latest` 중 하나를 채팅 모델로 선택할 수 있어야 한다. 음성 처리는 기존 OpenAI Realtime 설정을 유지한다.

## 구조

- `aiConfig.ts`의 제공자 카탈로그에 `mistral`을 추가한다. 기본 모델은 응답 속도와 비용을 고려해 `mistral-small-latest`로 둔다.
- 기존 `apiKeys` 보관소와 마스킹 로직을 그대로 사용해 Mistral 키를 저장한다. API 응답, 로그, 문서에는 키 원문을 노출하지 않는다.
- `aiProviders.ts`에 Mistral Chat Completions 요청과 응답 추출 분기를 추가한다. 요청은 `POST https://api.mistral.ai/v1/chat/completions`, Bearer 인증, JSON 본문을 사용한다. 본문에는 시스템 메시지, 대화 이력, `temperature`, `max_tokens`를 전달한다.
- 응답의 `choices[0].message.content`가 문자열인 경우와 텍스트 블록 배열인 경우를 모두 일반 텍스트로 정규화한다.
- AI 설정 화면, 메인 화면 제공자 선택, 화면 명령 제공자 목록은 공통 카탈로그 또는 같은 제공자 ID를 사용해 Mistral을 노출한다.
- Mistral은 텍스트 채팅 제공자다. 음성 입력·출력과 화면 제어를 위한 OpenAI Realtime 경로는 변경하지 않는다.

## 데이터 흐름

1. 운영자가 `/cinema/ai`에서 Mistral을 선택하고 API 키와 모델을 저장한다.
2. 서버는 키 원문을 설정 파일의 AI 키 보관소에만 저장하고, 클라이언트에는 저장 여부만 반환한다.
3. 메인 화면에서 Mistral 모델을 선택하면 기존 AI 설정 PATCH 경로가 제공자와 모델을 갱신한다.
4. 채팅 요청 시 서버가 저장된 키로 Mistral Chat Completions API를 호출하고 `choices[0].message.content`를 화면에 반환한다.

## 오류 처리

- 키가 없으면 제공자를 준비되지 않은 상태로 표시하고 설정 화면으로 안내한다.
- Mistral HTTP 오류는 기존 `AiProviderFailure` 경로로 상태 코드와 안전하게 정리된 메시지를 반환한다.
- 응답에 텍스트가 없으면 기존 빈 응답 오류 처리를 사용한다.
- 서버 배포 전 전달받은 키로 실제 Mistral API 연결을 검증하되 키와 응답 원문은 로그에 출력하지 않는다.

## 검증

- 제공자 카탈로그, 키 보관·전환·마스킹, 준비 상태 단위 테스트
- Mistral 요청 URL·헤더·본문과 응답 추출 단위 테스트
- AI 설정 API 및 메인 상태 API에서 Mistral 준비 상태 확인
- `npm run typecheck`, `npm run test:unit`, `npm run build`
- JSIDC2 배포 후 외부 API 상태와 Mistral 실제 채팅 응답 확인

## 문서 영향

`DESIGN.md`와 `README.md`의 지원 제공자 및 모델 설명을 Mistral까지 확장한다.
