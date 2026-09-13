# 실시간 화면 객체 관리창 설계

## 목적

메인 화면의 상단 지표 카드 8개를 하나의 스트립이 아니라 독립 화면 객체로 취급한다. 각 객체는 MCP 도구처럼 자신의 식별자, 역할, 입력 데이터 계약, 현재 상태, 데이터 출처와 실행 가능한 화면 메서드를 공개한다. 운영자는 좌측 상단 관리 큐브의 `화면` 타일에서 이 정보를 확인한다. 피드 값과 매핑은 이 관리창에서 수정하지 않는다.

## 진입과 화면 구조

- `SignalFilm`이 `objectInspectorOpen` 상태를 소유한다.
- `FilmMenuCube`의 `display` 선택은 페이지 이동 없이 관리창을 연다.
- 관리창은 메인 화면 위의 모달이며, 왼쪽에 객체 목록, 오른쪽에 선택 객체의 명세와 현재 상태를 표시한다.
- 닫기 버튼과 `Escape`로 닫는다. `useFilmEscapeToHome`보다 안쪽 모달 이벤트에 의존하지 않고, 전역 콜백이 최신 `objectInspectorOpen`을 먼저 검사한다. 열려 있으면 관리창만 닫고 반환하며, 닫힌 상태에서 다시 누를 때만 전체 중지·메인 복귀를 수행한다.
- 모달을 여는 동안 `SignalFilm`, `sceneDataStore`, 화면 객체 레지스트리는 마운트 상태를 유지한다.
- 관리창은 `createPortal`로 `document.body` 아래의 전용 portal 루트에 렌더링하고 `role="dialog"`, `aria-modal="true"`를 사용한다. portal의 형제인 `SignalFilm`의 `<main>`만 `inert`로 두어 관리창 자체는 활성 상태를 유지한다. 최초 초점은 객체 목록에 두며 Tab 순환을 모달 안에 가두고, 닫을 때 관리 큐브 컨트롤로 초점을 복원한다.

## 객체 명세

`ScreenObjectRegistration`에 선택적 데이터 명세를 추가한다.

```ts
interface ScreenObjectDataBinding {
  feedId: string;
  sceneKey: FilmSceneDataKey;
  snapshotFields: { path: string; type: string; unit?: string; description: string }[];
  readOnly: true;
  getSnapshot(): unknown;
  getProvenance?(): SceneDataProvenance | undefined;
  getFeedStatus?(): ScreenObjectFeedStatus | undefined;
}

interface ScreenObjectPresentation {
  detailChapter: FilmId;
}

interface ScreenObjectFeedStatus {
  mode: FeedPollSummary['mode'];
  ok: boolean;
  at?: string;
  error?: string;
  issues: string[];
}

interface ScreenObjectRegistration {
  id: string;
  description: string;
  methods: Record<string, ScreenObjectMethod>;
  getState?(): unknown;
  bindings?: ScreenObjectDataBinding[];
  presentation?: ScreenObjectPresentation;
}

interface ScreenObjectCatalogEntry {
  id: string;
  description: string;
  state?: unknown;
  methods: { id: string; description: string; parameters?: ScreenObjectMethod['parameters'] }[];
  bindings: { feedId: string; sceneKey: FilmSceneDataKey; snapshotFields: ScreenObjectDataBinding['snapshotFields']; readOnly: true;
    snapshot: unknown; provenance?: SceneDataProvenance; feedStatus?: ScreenObjectFeedStatus }[];
  detailChapter?: FilmId;
}
```

새 속성은 모두 선택 사항이므로 기존 화면 객체 등록은 그대로 유효하다. 카탈로그 결과에서는 `bindings`를 빈 배열로 정규화한다.

`ScreenObjectCatalogEntry`는 다음 정보를 반환한다.

- `id`, `description`
- 메서드 이름·설명·매개변수
- 바인딩별 피드 ID·장면 키·정규화된 스냅샷 필드·읽기 전용 여부
- 호출 시점의 현재 스냅샷, 장면 출처·갱신 시각, 피드 성공·오류·이슈
- 상세 연출 ID `detailChapter`

`ScreenObjectRegistration`은 `bindings: ScreenObjectDataBinding[]`을 가져 한 카드가 여러 피드에 의존할 수 있게 한다. 현재 스냅샷의 필드 설명은 정규화된 `FilmSceneData` 구조이고, 원본 피드 JSON Schema는 `domainFeeds.ts`의 `DOMAIN_FEEDS`와 `feedJsonSchema()`를 그대로 표시한다. 두 계약을 복사해 새로 정의하지 않는다.

스냅샷은 카탈로그 등록 시 복사하지 않고 `catalog()`를 호출할 때 `getSnapshot()`으로 읽는다. 레지스트리는 `subscribe(listener)`, 단조 증가 정수 `getRevision()`, `notify()`를 제공한다. 등록·해제·`notify()` 때 revision을 증가시키고 구독자에게 알린다. 관리창의 `useSyncExternalStore`는 안정적인 숫자 revision만 snapshot으로 구독하며, revision이 바뀔 때 `useMemo`로 `catalog()`를 다시 읽는다. `catalog()`가 매번 새 배열을 반환하는 문제를 React snapshot으로 직접 사용하지 않는다. 피드 갱신 후 `SignalFilm`이 `notify()`를 호출하므로 열린 관리창도 최신 값을 다시 읽는다. 관리창은 데이터 값을 쓰는 API를 제공하지 않는다.

`getFeedStatus()`는 개별 `FeedPollStatus`만 반환하지 않고 현재 `FeedPollSummary`를 기준으로 정규화한 `ScreenObjectFeedStatus`를 반환한다. `mode: 'error'`이고 `feeds`가 비어 있으면 최상위 `summary.error`를 모든 피드 바인딩의 전역 오류 fallback으로 표시한다. `mode: 'static'`은 `DEMO / 기본 데이터`, `mode: 'server'`에서는 동일 `feedId`의 개별 상태를 사용한다.

## 상단 지표 객체

카드는 다음 ID로 각각 등록한다.

| 객체 ID | 현재 피드 | 장면 키 | 상세 연출 | 주요 입력 |
|---|---|---|---|---|
| `metric.production` | `energy` | `energy` | `energy` | 생산 실적·목표 |
| `metric.process` | `process` | `network` | `network` | 요구량·노드 처리능력·대기량 |
| `metric.quality` | `quality` | `spc` | `spc` | 부분군 측정값·관리한계 |
| `metric.power` | `energy` | `energy` | `energy` | 전력 사용량·용량 |
| `metric.efficiency` | `energy` | `energy` | `energy` | 효율 실적·기준 |
| `metric.inspection` | `inspection` | `product` | `product` | 검사 측정값·허용차 |
| `metric.temperature` | `environment` | `environment` | `wave` | 구역별 온도·관리범위 |
| `metric.humidity` | `environment` | `environment` | `wave` | 구역별 습도·관리범위 |

`metric.production`은 현행 `hatcheryMetrics()`가 `data.energy.production`을 읽으므로 `energy` 바인딩 하나만 선언한다. 향후 생산 카드가 `production` 피드의 라인 합계를 읽도록 바뀌면 두 번째 바인딩을 추가하거나 기존 바인딩을 교체하는 별도 이관으로 처리한다.

모든 카드가 제공하는 메서드는 다음과 같다.

- `focus`: 해당 카드를 중앙 확대 카드로 연다.
- `openDetail`: 카드에 대응하는 상세 연출을 연다.

`getState`는 실행 메서드로 중복 등록하지 않고 기존 레지스트리의 상태 getter로 유지한다. `catalog()` 결과의 `state`에 호출 시점의 표시값·단위·설명·경고 여부를 포함한다. `focus`와 `openDetail`은 화면 동작만 수행하며 데이터는 변경하지 않는다. 기존 `metrics.setAutoScroll`은 스트립 객체의 메서드로 유지한다.

관리창에서 `focus` 또는 `openDetail`이 성공하면 관리창을 먼저 닫고 다음 프레임에 결과 화면으로 초점을 옮긴다. 실패하면 관리창을 유지하고 실제 실패 메시지를 표시한다. `openDetail`로 메인 지표 객체가 언마운트되는 과정은 관리창을 닫은 뒤 일어나므로 빈 목록이 화면에 노출되지 않는다.

## 컴포넌트 경계

- `screenObjectRegistry.ts`: 선택적 `bindings`·`presentation`, 실시간 카탈로그 결과, 안정적인 revision 기반 `subscribe`·`notify`를 정의한다.
- `ScreenObjectContext.tsx`: 객체 등록 훅과 레지스트리 조회 훅을 제공한다.
- `JarvisMetricCards.tsx`: 8개 카드 명세와 현재 파생값을 등록한다.
- `JarvisMain.tsx`: 카드 focus 요청을 기존 `JarvisCardFocus`에 연결한다.
- `ScreenObjectInspector.tsx`: body portal에서 목록·명세·현재 상태·메서드 버튼을 렌더링하고 메인만 inert 처리한다.
- `screenObjectInspector.module.css`: 기존 HUD 토큰으로 모달과 두 열 레이아웃을 표현한다.
- `SignalFilm.tsx`: 관리창 열림 상태와 큐브 `display` 선택을 연결한다.

## 오류와 상태 변화

- 현재 화면에 없는 객체는 목록에서 제거된다.
- 장면 출처가 없으면 `DEMO / 기본 데이터`로 표시한다. 피드 오류는 해당 바인딩의 상태에서 읽고, HTTP·네트워크 실패로 개별 상태가 없으면 `FeedPollSummary`의 최상위 오류를 사용해 최근 성공 스냅샷과 함께 표시한다.
- 메서드 실행 실패는 성공으로 표시하지 않고 레지스트리의 실제 결과 메시지를 보여준다.
- 레지스트리 구독 결과에서 선택한 객체가 사라지면 첫 번째 사용 가능한 객체를 선택한다.
- 빈 목록은 `현재 등록된 화면 객체가 없습니다`로 표시한다.

## 검증

- 레지스트리 카탈로그가 원본 피드 계약과 정규화 스냅샷 계약을 구분하고 현재 스냅샷·출처·피드 상태를 호출 시점에 반환하는지 단위 테스트한다.
- `subscribe`가 등록·해제·`notify()`를 전달하고 `getRevision()`이 변경 때만 증가하여 `useSyncExternalStore` snapshot이 안정적인지 확인한다.
- 지표 8개가 서로 다른 ID로 등록되고 예상 피드·장면 키를 공개하는지 확인한다.
- 관리 큐브의 `화면` 선택으로 모달이 열리고 닫기·Escape가 관리창만 먼저 닫는지 확인한다.
- `focus`, `openDetail` 실행 결과와 실제 화면 상태가 일치하는지 확인한다.
- `npm run typecheck`와 관련 단위 테스트만 실행한다. 빌드는 요청할 때만 실행한다.
