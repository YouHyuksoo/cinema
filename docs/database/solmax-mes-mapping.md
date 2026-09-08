---
sources:
  - config/hatchery.sources.example.json
  - src/cinema/domainFeeds.ts
  - src/cinema/feedScenes.ts
verifiedCommit: 3c0ed6e
---

# SOLMAX MES(SVEHICLEPDB) → HATCHERY 피드 매핑

Infinity21 SMT MES(Oracle `SVEHICLEPDB`, 외부 접속 프로필 `SVEHICLEPDBEXT`)의 테이블·뷰를 도메인 피드(`docs/database/domain-feeds.md`)에 연결한 실제 매핑이다. 조회문과 컬럼 매핑의 원본은 `config/hatchery.sources.example.json`이며(자격증명 없음), 운영 설정은 `config/hatchery.sources.json`(git 제외)에 있다. 컬럼 의미는 WEBDISPLAY 프로젝트(`C:\PROJECT\WEBDISPLAY`)의 `data/ai-context/schema-cache.json`(Oracle 컬럼 코멘트 캐시)과 Infinity21 MES 소스(`C:\Project\MES\Infinity21 MES SMT_SOLUM_VC`)에서 확인했다.

2026-09-08 실 DB 검증: production(라인 12), environment(구역 6), quality(부분군 25), process(공정 6 · 연결 5) 미리보기·폴링 성공. equipment(설비 50), workOrder(불량 50) 미리보기 성공, 화면 이관 전이라 비활성.

## 피드별 매핑

| 피드 | 원천 테이블/뷰 | 핵심 컬럼 → 계약 필드 | 상태 |
|---|---|---|---|
| production | `IP_PRODUCT_LINE`(라인 마스터) + `IP_PRODUCT_SMD_PLAN`(계획·실적) | `LINE_CODE→id`, `LINE_NAME→label`, `SUM(ACTUAL_QTY)→value`, `DAY_PLAN_QTY→target`, 'EA'→unit | 활성 |
| environment | `IMCN_MACHINE`(`MACHINE_TYPE='TEMP'` 센서 마스터) + `ICOM_TEMPERATURE_DATA`(최신 측정) | `MACHINE_CODE→id`, `MACHINE_NAME→label/name`, `ROOM_TEMPERATURE→temperature`, `HUMIDITY→humidity`, `MIN/MAX_TEMP_VALUE→temperatureRange`, `MIN/MAX_HUMIDITY_VALUE→humidityRange` | 활성 |
| quality | `LOG_EOL`(EOL 검사 로그, 항목 `NAME='TURN 2'`) | 최근 125건을 5개씩 25개 부분군으로: `TO_NUMBER(MEAS_2)→values`, `MIN_2/TYP_2/MAX_2_2→lsl/nominal/usl` | 활성 |
| process | `IP_PRODUCT_WORKSTAGE`(공정 마스터) + `IP_PRODUCT_WORKSTAGE_IO`(공정 입출고, 24시간) | `WORKSTAGE_CODE→id/code`, `WORKSTAGE_NAME→label`, `ST_VALUE→cycleSeconds`, `UPH_VALUE→capacityPerHour`, IN−OUT 수량→queue, 정렬순서로 위치·연결 생성 | 활성 |
| equipment | `IMCN_MACHINE`(`MES_DISPLAY_YN='Y'`, 온습도 센서 제외) | `MACHINE_CODE→id`, `MACHINE_NAME→label`, `LINE_CODE→line`, 공정 순서→order, `MACHINE_TYPE→kind`, `MACHINE_STATUS_CODE`('N'=running)→status | 매핑만, 비활성 |
| workOrder | `IP_PRODUCT_RUN_CARD`(런카드=워크오더) + `IP_PRODUCT_WORK_QC`(개체 불량, 7일) | `RUN_NO→orderId`, `MODEL_NAME→product`, `LINE_CODE→line`, `LOT_SIZE→quantity`; `SERIAL_NO-QC_SEQUENCE→id`, `BAD_REASON_CODE`(A 외관·B 기능·C 규격)→label, `MACHINE_CODE→equipmentId` | 매핑만, 비활성 |
| energy | 없음 | MES에 전력·에너지 시계열 테이블이 없다. `IMCN_MACHINE.POWER_CONSUMPTION`은 명판 문자열. 계측기 연동 전까지 시연 데이터 유지 | 미연결 |
| inspection | `LOG_EOL`(항목별 `TYP_2/MEAS_2/공차`) 후보 | 제품검사 장면이 부위 3개 고정(L1)이라 이관 후 매핑 | 미연결 |
| machine | 없음 | 설비 계통 진단 데이터 없음(`IQ_MACHINE_*_RAW`는 미사용 원시 로그) | 미연결 |

## 코드 값 (Oracle 컬럼 코멘트 기준)

- `IP_PRODUCT_LINE.LINE_STATUS`: `N`=정상, `S`=정지. `LINE_STATUS_CODE`: `N`=정상, `STOP001`=S/PRINT STOP, `STOP002`=SPI STOP, `STOP003`=MOUNT STOP, `STOP004`=M-AOI STOP, `STOP005`=REFLOW STOP, `STOP006`=S-AOI STOP, `STOP007`=모델교환, `STOP008`=Quality Stop, `STOP009`=계획정지, `STOP010`=LUNCH Time, `STOP011`=휴식, `STOP012`=Clean Time, `STOP013`=F/Test Stop, `STOP014`=Equip Stop 외.
- `IP_PRODUCT_LINE.LINE_DIVISION`: `A`=ASSEMBLE, `D`=SMD, `E`=ETC. `LINE_PRODUCT_DIVISION`: ASSEMBLE / COMMON / INSPECT / PBA / REPAIR / SMD.
- `IP_PRODUCT_WORKSTAGE.WORKSTAGE_TYPE`: `I`=일반, `L`=최종, `Q`=검사, `S`=MOUNTER. `WORKSTAGE_STATUS`: `S`=작업중, `P`=정지, `A`=설비고장, `B`=불량품발생, `C`=인원부족, `L`=자재부족, `R`=수리 외.
- `IP_PRODUCT_RUN_CARD.RUN_STATUS`: `1`=대기, `2`=준비완료, `3`=키팅스캔, `4`=SMT투입, `5`=AOI, `6`=QC, `7`=포장, `8`=OBA, `9`=입고, `10`=출하. `PRODUCT_RUN_TYPE`: `P`=양산, `S`=샘플, `D`=개발, `T`=실험 외.
- `IP_PRODUCT_WORK_QC.BAD_REASON_CODE`: `A`=외관불량, `B`=기능불량, `C`=규격불량, `D`=기타. `QC_RESULT`: `N`=진성불량, `O`=가성불량, `W`=대기.
- 온습도 판정(WEBDISPLAY 기준): 관리범위 안이고 경고 오프셋 밖이면 OK, 오프셋 안이면 WN, 범위 밖이면 NG. 센서 `GATHER_DATE`가 10분 이상 지났으면 통신 끊김으로 본다.

## 알려진 한계

- 온습도 센서의 관리범위(`MIN/MAX_*`)가 DB에 비어 있어 조회문에서 온도 18~28, 습도 30~60을 기본값으로 넣는다. 센서 측정치가 2026-06 이후 갱신되지 않은 상태다.
- 공정 마스터의 `ST_VALUE`·`UPH_VALUE`가 0인 공정이 많아 공정망의 처리능력·사이클이 0으로 보인다. 수요(`demandPerHour`)는 상수 480이다.
- 라인 실적은 최근 14일 계획 실적 합계다. 당일 실적은 뷰 `IRPT_PRODUCT_LINE_MONITORING`의 `DAY_ACTUAL_QTY`(교대 기준)로 바꿀 수 있다.
- SPC는 `TURN 2` 항목 하나에 고정돼 있다. 항목 선택은 관리 화면의 조회문에서 `NAME` 조건을 바꾸면 된다.
- 조회문에 한글 리터럴을 넣지 않는다(클라이언트 인코딩에 따라 깨질 수 있다). 표시 제목은 영문 상수를 쓴다.
