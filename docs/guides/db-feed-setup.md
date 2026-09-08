---
sources:
  - src/cinema/feedConfig.ts
  - src/cinema/feedMapping.ts
  - src/cinema/feedScenes.ts
  - src/cinema/feedPolling.ts
  - src/server/cinema/hatcheryConfig.ts
  - src/server/cinema/oracleSource.ts
  - src/server/cinema/feedRunner.ts
  - src/app/api/cinema/admin
  - src/app/api/cinema/feed/route.ts
  - src/cinema/admin/HatcheryAdmin.tsx
  - config/hatchery.sources.example.json
verifiedCommit: ba62575
---

# DB를 HATCHERY 피드에 연결하기

HATCHERY 화면은 장면 데이터 계약(`docs/standards/scene-data-contract.md`)대로만 데이터를 받는다. DB는 **도메인 피드**(`docs/database/domain-feeds.md`) 단위로 연결하며, 피드마다 조회문 하나와 컬럼 매핑을 관리 화면에서 등록한다. 브라우저는 DB에 닿지 않고 서버 라우트만 접속한다.

## 1. 준비

- 서버 실행이 필요하다(`npm run dev` 또는 `npm run build && npm run start`). GitHub Pages 같은 정적 배포에는 서버가 없어 관리 화면과 폴링이 동작하지 않는다. 정적 배포는 `public/cinema/data/scenes.json`으로 데이터를 받는다.
- Oracle은 `oracledb` thin 모드를 쓴다. Oracle 클라이언트 설치가 필요 없다.
- DB 계정은 **읽기 전용**으로 만든다. 관리 화면의 조회문은 SELECT/WITH만 허용되지만 계정 권한이 최종 안전장치다.

## 2. 설정 파일

- 위치: `config/hatchery.sources.json` (git 제외). 환경변수 `HATCHERY_CONFIG_PATH`로 바꿀 수 있다.
- 예시: `config/hatchery.sources.example.json`을 복사해 시작한다.
- 비밀번호는 이 파일에만 저장된다. 관리 API 응답은 비밀번호를 `hasPassword`로만 표시하고, 저장 시 비밀번호 칸을 비워 두면 기존 값을 유지한다.

```json
{
  "sources": [{ "id": "mes", "name": "SOLMAX MES", "kind": "oracle", "host": "…", "port": 1521, "serviceName": "SVEHICLEPDB", "user": "READ_ONLY", "password": "…" }],
  "feeds": [{ "feed": "production", "sourceId": "mes", "enabled": true, "intervalSeconds": 30,
    "sql": "SELECT … AS ID, … AS LABEL, … AS VALUE, … AS TARGET, 'EA' AS UNIT FROM …",
    "header": { "unit": "UNIT", "target": "TARGET" },
    "collections": { "lines": { "fields": { "id": "ID", "label": "LABEL", "value": "VALUE" } } } }]
}
```

## 3. 관리 화면 — `/cinema/admin` (localhost 전용)

1. **데이터 소스**: host·port·service·계정을 넣고 **연결 테스트**로 확인한다. 성공하면 응답 시간과 Oracle 버전이 보인다.
2. **피드 매핑**: 피드마다 데이터 소스, 갱신 주기, 조회문, 컬럼 매핑을 채운다.
   - 헤더 필드(단위·목표 등)는 결과의 **첫 행**에서 읽는다. 조회문에서 상수 컬럼으로 내보내면 된다(`'EA' AS UNIT`).
   - 객체 컬렉션(`lines[]` 등)은 행마다 하나씩 만든다. `id`는 도메인 코드(라인 코드·설비 코드) 그대로, `label`은 표시 이름. `label`이 비면 `id`를 쓴다.
   - 숫자 필드는 숫자 또는 숫자 문자열, 숫자 목록은 JSON 배열 문자열 또는 쉼표 구분, 중첩 구조(좌표·범위·이력)는 JSON 문자열 컬럼으로 준다.
   - 컬렉션이 둘인 피드(공정망의 nodes·links)는 컬렉션별 조회문을 따로 둘 수 있다.
   - **미리보기**는 50행까지 실행해 결과 컬럼, 검증 문제, 표본 행, 만들어진 장면 문서 수를 보여 준다. 검증에 걸린 행은 버려지고 사유가 표시된다.
3. **저장** 후 **실행 상태**에서 피드별 마지막 실행·행 수·다음 실행·오류를 본다.

## 4. 동작 방식

- 브라우저는 `/api/cinema/feed`를 폴링한다(`feedPolling.ts`). 서버는 주기가 지난 활성 피드만 다시 실행하고 캐시를 돌려주며, 실패하면 마지막 성공 문서를 유지한다.
- 피드 결과는 서술자로 검증된 뒤 장면 문서로 변환된다(`feedScenes.ts`). 아직 화면이 이관되지 않은 피드(설비·워크오더·설비 계통)는 검증만 되고 화면에는 나타나지 않는다.
- 우선순위는 계약대로 **마지막 갱신이 이긴다**. HATCHERY 음성으로 바꾼 값은 다음 폴링에서 DB 값으로 덮인다.

## 5. 새 DB에 붙일 때 체크리스트

1. 피드 문서(`docs/database/domain-feeds.md`)에서 그 피드의 컬럼 표를 본다.
2. DB에 뷰를 만들어 계약 컬럼 이름으로 내보낸다(권장). 뷰가 어려우면 조회문에서 `AS` 별칭으로 맞춘다.
3. 관리 화면에서 소스 등록 → 연결 테스트 → 매핑 → 미리보기 → 저장.
4. 화면에서 해당 장면을 열어 값과 개수를 확인한다.

## 6. 문제 해결

| 증상 | 확인할 것 |
|---|---|
| 연결 테스트 실패 `ORA-12541` 등 | host·port·service, 방화벽, 리스너 |
| 미리보기 `SELECT 또는 WITH로 시작…` | 조회문 앞의 주석·공백, 세미콜론 제거 |
| 행이 전부 버려짐 | `id` 컬럼 매핑, 숫자 필드에 문자열이 들어오는지, 필수 컬럼 누락 |
| 화면이 안 바뀜 | 피드 활성 여부, 실행 상태의 오류, 브라우저가 서버 주소로 열렸는지(정적 배포는 폴링 없음) |
