import type { FilmId } from './filmProgram';
import type { SceneFieldDescriptor } from './sceneField';
import { PRODUCTION_LINE_FIELDS } from './productionLineFields';
import { SCENE_FIELDS } from './sceneFields';
import { DEFAULT_FILM_SCENE_DATA, type FilmSceneData } from './filmSceneData';
import { SMT_LINE } from './smtLine';
import { TRACE_WORK_ORDER } from './workOrderTrace';
import { RACE_DIAGNOSTICS } from './raceCar';

/**
 * Domain feeds: what a database view has to deliver, declared once from the demo data shapes.
 * A feed is one header record plus one or more object collections; scenes consume feeds, never
 * tables. Column definitions from a real MES are mapped onto these later, feed by feed.
 */
export type FeedRefresh = 'realtime' | 'fast' | 'normal' | 'event' | 'static';
export type FeedStatus = 'live' | 'partial' | 'planned';
export interface DomainExtraField { label: string; schema: Record<string, unknown>; optional?: boolean; description?: string }
export interface DomainObjectType {
  type: string;
  /** Property name of the collection inside the feed data. */
  collection: string;
  label: string;
  fields: readonly SceneFieldDescriptor[];
  /** Nested keys the descriptors cannot express (coordinates, ranges, histories). */
  extra?: Record<string, DomainExtraField>;
}
export interface DomainFeed {
  feed: string;
  label: string;
  refresh: FeedRefresh;
  refreshHint: string;
  header: readonly SceneFieldDescriptor[];
  objects: readonly DomainObjectType[];
  scenes: readonly FilmId[];
  status: FeedStatus;
  note: string;
  example(data: FilmSceneData): Record<string, unknown>;
}

const text = (field: string, label: string, more: Partial<SceneFieldDescriptor> = {}): SceneFieldDescriptor => ({ field, label, kind: 'text', ...more });
const number = (field: string, label: string, more: Partial<SceneFieldDescriptor> = {}): SceneFieldDescriptor => ({ field, label, kind: 'number', ...more });
const range = { type: 'object', properties: { min: { type: 'number' }, max: { type: 'number' } }, required: ['min', 'max'] };
const point = { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } }, required: ['x', 'y', 'z'] };

const STATION_KINDS: Record<string, string> = { loader: 'transport', printer: 'production', spi: 'quality', mounter: 'production', maoi: 'quality', reflow: 'thermal', aoi: 'quality', unloader: 'transport' };

export const DOMAIN_FEEDS: readonly DomainFeed[] = [
  {
    feed: 'production', label: '라인 생산 실적', refresh: 'normal', refreshHint: '10~30초 폴링',
    header: [text('unit', '수량 단위', { description: '예: EA' }), number('target', '라인당 목표', { min: 0 }),
      text('selectedId', '강조 라인 id', { optional: true, description: '없으면 목표 미달 중 달성률 최저 라인을 강조' })],
    objects: [{ type: 'productionLine', collection: 'lines', label: '생산 라인', fields: PRODUCTION_LINE_FIELDS,
      extra: { color: { label: '표시 색', schema: { type: 'string' }, optional: true }, accent: { label: '강조 표시', schema: { type: 'boolean' }, optional: true } } }],
    scenes: ['bars', 'pie', 'corners', 'unfold'], status: 'live',
    note: '막대·파이가 읽는다. 코너·펼침의 생산 달성·잔여와 상단 지표 카드도 이 피드에서 파생될 예정이다.',
    example: data => ({ ...data.production }),
  },
  {
    feed: 'equipment', label: '설비 마스터 · 상태', refresh: 'fast', refreshHint: '5~10초 폴링 또는 상태 변경 푸시',
    header: [number('lines', '라인 수', { min: 1 })],
    objects: [{ type: 'station', collection: 'stations', label: '설비', fields: [
      text('english', '영문 이름', { optional: true }), number('line', '라인 번호', { min: 1, decimals: 0 }), number('order', '공정 순서', { min: 1, decimals: 0 }),
      text('kind', '설비 종류', { optional: true, description: 'transport | production | quality | thermal' }),
      text('status', '가동 상태', { optional: true, description: 'running | idle | alarm | maintenance' }),
      number('temperature', '공정 온도', { unit: '°C', decimals: 1, optional: true, patchable: true, aliases: /온도/ }),
      number('fan', '냉각 팬', { unit: '%', min: 0, max: 100, decimals: 0, optional: true, patchable: true, aliases: /팬|냉각/ }),
    ] }],
    scenes: ['visor', 'visorPan', 'scan', 'gears', 'console'], status: 'planned',
    note: '바이저 3D(라인 5개 × 설비 8대), 바이저 평면(리플로우 냉각), 설비 스캔, 기어, 정보 콘솔이 같은 설비 목록과 온도·냉각 값을 읽도록 이관한다. 배치 좌표는 화면이 순서(line·order)로 계산한다.',
    example: () => ({ lines: 5, stations: Array.from({ length: 5 }, (_, line) => SMT_LINE.map((station, order) => ({
      id: `L${line + 1}-${station.id}`, label: `L${line + 1} ${station.label}`, english: station.english, line: line + 1, order: order + 1,
      kind: STATION_KINDS[station.id], status: 'running',
      ...(station.id === 'reflow' ? { temperature: 78.2, fan: 62 } : {}) }))).flat() }),
  },
  {
    feed: 'process', label: '공정 처리능력 · 대기', refresh: 'normal', refreshHint: '10~30초 폴링',
    header: [text('title', '공정망 이름'), number('demandPerHour', '시간당 수요', { min: 0, decimals: 0 })],
    objects: [
      { type: 'processNode', collection: 'nodes', label: '공정', fields: [text('code', '공정 코드'), ...SCENE_FIELDS.network],
        extra: { position: { label: '3D 위치', schema: point, description: '화면 배치용 좌표. 없으면 순서로 배치할 예정' },
          recovery: { label: '회복 시나리오 값', schema: { type: 'object', properties: { cycleSeconds: { type: 'number' }, capacityPerHour: { type: 'number' }, queue: { type: 'number' } } }, optional: true } } },
      { type: 'processLink', collection: 'links', label: '공정 연결', fields: [text('from', '출발 공정 id'), text('to', '도착 공정 id'), number('bend', '곡선 정도', { optional: true })] },
    ],
    scenes: ['network', 'corners', 'unfold'], status: 'partial',
    note: '공정망이 읽는다. 코너·펼침의 사이클 타임과 상단 지표의 병목도 파생 예정.',
    example: data => {
      const label = (id: string) => data.network.nodes.find(node => node.id === id)?.label ?? id;
      return { ...data.network, links: data.network.links.map(link => ({ id: [link.from, link.to].join('>'), label: [label(link.from), label(link.to)].join(' → '), ...link })) };
    },
  },
  {
    feed: 'environment', label: '환경 구역 온습도', refresh: 'fast', refreshHint: '30~60초 폴링 또는 센서 푸시',
    header: [text('title', '화면 제목'), number('historyEnd', '이력 마지막 시각(epoch ms)', { optional: true })],
    objects: [{ type: 'zone', collection: 'zones', label: '구역', fields: [text('name', '구역 이름'), ...SCENE_FIELDS.wave],
      extra: { temperatureRange: { label: '온도 관리 범위', schema: range }, humidityRange: { label: '습도 관리 범위', schema: range },
        temperatureHistory: { label: '24시간 온도 이력', schema: { type: 'array', items: { type: 'object', properties: { at: { type: 'number' }, value: { type: 'number' } }, required: ['at', 'value'] } }, optional: true } } }],
    scenes: ['wave'], status: 'live',
    note: '온습도 장면이 읽는다. 최대 10구역까지 표시하고 초과분은 생략한다. 상단 지표의 평균·이탈도 파생.',
    example: data => ({ ...data.environment, zones: data.environment.zones.map(zone => ({ label: zone.name, ...zone, temperatureHistory: zone.temperatureHistory?.slice(0, 3) })) }),
  },
  {
    feed: 'quality', label: '품질 SPC 측정', refresh: 'event', refreshHint: '부분군 완성 시 이벤트, 또는 1~5분 폴링',
    header: [text('name', '측정 항목'), text('unit', '단위'), number('nominal', '공칭값'), number('lsl', '규격 하한'), number('usl', '규격 상한'), number('cpkTarget', 'Cpk 목표', { min: 0 })],
    objects: [{ type: 'spcSubgroup', collection: 'subgroups', label: '부분군', fields: SCENE_FIELDS.spc }],
    scenes: ['spc', 'corners', 'unfold'], status: 'partial',
    note: 'SPC 장면이 읽는다(부분군 수·크기 무관). 코너·펼침의 양품률과 상단 지표의 이탈 수도 파생 예정.',
    example: data => ({ ...data.spc, subgroups: data.spc.subgroups.slice(0, 5).map(group => ({ label: group.id, ...group })) }),
  },
  {
    feed: 'energy', label: '에너지 사용', refresh: 'fast', refreshHint: '5~30초 폴링',
    header: [text('name', '설비/라인 이름')],
    objects: [{ type: 'energyReading', collection: 'readings', label: '에너지 지표', fields: [
      number('value', '현재 값', { min: 0, patchable: true, aliases: /값|사용량/, default: true }), number('capacity', '용량·목표', { min: 0 }), text('unit', '단위')] }],
    scenes: ['energy'], status: 'partial',
    note: '지금 화면은 power·production·efficiency 고정 키 구조(L1)를 받는다. 이 피드는 id가 power | production | efficiency인 배열이며 이관 시 화면이 배열을 읽도록 바꾼다.',
    example: data => ({ name: data.energy.name, readings: (['power', 'production', 'efficiency'] as const).map(id => ({ id, label: { power: '전력', production: '생산량', efficiency: '효율' }[id], ...data.energy[id] })) }),
  },
  {
    feed: 'workOrder', label: '워크오더 · 불량', refresh: 'event', refreshHint: '워크오더 생성·완료와 검사 판정 이벤트',
    header: [text('orderId', '워크오더 번호'), text('product', '제품'), text('line', '라인'), number('quantity', '지시 수량', { min: 1, decimals: 0 })],
    objects: [{ type: 'defect', collection: 'defects', label: '불량 판정', fields: [number('serial', '개체 일련번호', { min: 1, decimals: 0 }), text('equipmentId', '판정 설비 id'), text('label', '불량 유형')] }],
    scenes: ['trace'], status: 'planned',
    note: '변화 추적 장면이 워크오더와 불량 목록을 읽도록 이관한다. PCB 이동 연출은 시간으로 계산한다. 설비 순서는 equipment 피드를 따른다.',
    example: () => ({ orderId: TRACE_WORK_ORDER.id, product: TRACE_WORK_ORDER.product, line: TRACE_WORK_ORDER.line, quantity: TRACE_WORK_ORDER.quantity,
      defects: [{ id: 'D-0007', label: '납량 부족', serial: 7, equipmentId: 'spi' }, { id: 'D-0027', label: '부품 위치 편차', serial: 27, equipmentId: 'maoi' },
        { id: 'D-0061', label: '납땜 브리지', serial: 61, equipmentId: 'aoi' }, { id: 'D-0083', label: '부품 위치 편차', serial: 83, equipmentId: 'maoi' }] }),
  },
  {
    feed: 'inspection', label: '제품 내부 검사', refresh: 'event', refreshHint: '검사 완료 이벤트',
    header: [text('name', '제품 이름'), text('serial', '제품 시리얼')],
    objects: [{ type: 'measurement', collection: 'measurements', label: '측정 부위', fields: [
      number('nominal', '공칭값'), number('actual', '실측값'), number('tolerance', '허용 공차', { min: 0 }), text('unit', '단위'), number('decimals', '표시 소수 자릿수', { min: 0, decimals: 0 })] }],
    scenes: ['product'], status: 'partial',
    note: '지금 화면은 zone 유니언(shaft | bearing | winding)으로 부위를 찾는다(L1). 이 피드의 id가 그 역할을 맡도록 이관한다. 최대 3부위.',
    example: data => ({ name: data.product.name, serial: data.product.serial,
      measurements: data.product.measurements.map(item => ({ id: item.zone, label: item.label, nominal: item.nominal, actual: item.actual, tolerance: item.tolerance, unit: item.unit, decimals: item.decimals })) }),
  },
  {
    feed: 'machine', label: '설비 계통 진단(예시 장면)', refresh: 'fast', refreshHint: '5~10초 폴링',
    header: [text('name', '설비 이름')],
    objects: [{ type: 'systemReading', collection: 'systems', label: '계통 값', fields: [number('value', '값', { patchable: true, aliases: /값/, default: true }), text('unit', '단위', { optional: true })] }],
    scenes: ['machine'], status: 'planned',
    note: '투명 설비 분석 장면의 계통 값(배터리·냉각수·유량·엔진·배기·압력·하중)을 읽도록 이관한다. 브레이크·서스펜션 4개 값은 id에 위치를 붙인다(brake-fl 등).',
    example: () => ({ name: 'HYBRID RACE CAR / DEMO', systems: [
      { id: 'battery', label: '배터리', value: RACE_DIAGNOSTICS.battery, unit: '%' }, { id: 'coolant', label: '냉각수', value: RACE_DIAGNOSTICS.coolant, unit: '°C' },
      { id: 'flow', label: '유량', value: RACE_DIAGNOSTICS.flow, unit: 'L/min' }, { id: 'engine', label: '엔진', value: RACE_DIAGNOSTICS.engine, unit: '°C' },
      { id: 'exhaust', label: '배기', value: RACE_DIAGNOSTICS.exhaust, unit: '°C' }, { id: 'pressure', label: '압력', value: RACE_DIAGNOSTICS.pressure, unit: 'bar' },
      { id: 'frontLoad', label: '전방 하중', value: RACE_DIAGNOSTICS.frontLoad, unit: '%' }, { id: 'rearLoad', label: '후방 하중', value: RACE_DIAGNOSTICS.rearLoad, unit: '%' },
      ...RACE_DIAGNOSTICS.brakes.map((value, index) => ({ id: `brake-${['fl', 'fr', 'rl', 'rr'][index]}`, label: `브레이크 ${['FL', 'FR', 'RL', 'RR'][index]}`, value, unit: '°C' })),
      ...RACE_DIAGNOSTICS.suspension.map((value, index) => ({ id: `suspension-${['fl', 'fr', 'rl', 'rr'][index]}`, label: `서스펜션 ${['FL', 'FR', 'RL', 'RR'][index]}`, value, unit: 'mm' })),
    ] }),
  },
];

export const domainFeed = (feed: string) => DOMAIN_FEEDS.find(item => item.feed === feed);

const fieldSchema = (field: SceneFieldDescriptor): Record<string, unknown> => {
  const base: Record<string, unknown> = { description: [field.label, field.unit ? `단위 ${field.unit}` : '', field.description ?? ''].filter(Boolean).join(' · ') };
  if (field.kind === 'text') return { ...base, type: 'string', minLength: 1, ...(field.allowedValues ? { enum: [...field.allowedValues] } : {}) };
  const number: Record<string, unknown> = { type: 'number', ...(field.min !== undefined ? { minimum: field.min } : {}), ...(field.max !== undefined ? { maximum: field.max } : {}) };
  if (field.kind === 'number[]') return { ...base, type: 'array', items: number, minItems: field.length ?? 1, ...(field.length ? { maxItems: field.length } : {}) };
  return { ...base, ...number };
};

/** JSON Schema (draft-07) of one feed's data object: header fields plus one array per object type. */
export function feedJsonSchema(feed: DomainFeed): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const field of feed.header) { properties[field.field] = fieldSchema(field); if (!field.optional) required.push(field.field); }
  for (const object of feed.objects) {
    const itemProperties: Record<string, unknown> = { id: { type: 'string', minLength: 1, description: '도메인 코드(자연키), 목록 안에서 유일' }, label: { type: 'string', minLength: 1, description: '표시 이름' } };
    const itemRequired = ['id', 'label'];
    for (const field of object.fields) { itemProperties[field.field] = fieldSchema(field); if (!field.optional) itemRequired.push(field.field); }
    for (const [key, extra] of Object.entries(object.extra ?? {})) { itemProperties[key] = { description: extra.label, ...extra.schema }; if (!extra.optional) itemRequired.push(key); }
    properties[object.collection] = { type: 'array', description: object.label, items: { type: 'object', properties: itemProperties, required: itemRequired } };
    required.push(object.collection);
  }
  return { $schema: 'http://json-schema.org/draft-07/schema#', $id: `hatchery/feeds/${feed.feed}`, title: `${feed.label} (${feed.feed})`,
    description: `${feed.note} 갱신: ${feed.refreshHint}. 장면: ${feed.scenes.join(', ')}.`, type: 'object', properties, required, additionalProperties: true };
}

export function feedExample(feed: DomainFeed, data: FilmSceneData = DEFAULT_FILM_SCENE_DATA) {
  return { feed: feed.feed, version: 1, source: 'static', at: '2026-09-08T09:00:00+09:00', data: feed.example(data) };
}

const STATUS_LABEL: Record<FeedStatus, string> = { live: '연결됨', partial: '일부 연결', planned: '이관 예정' };
const REFRESH_LABEL: Record<FeedRefresh, string> = { realtime: '실시간 푸시', fast: '빠른 폴링', normal: '보통 폴링', event: '이벤트', static: '정적' };
const kindLabel = (field: SceneFieldDescriptor) => field.kind === 'number[]' ? '숫자 목록' : field.kind === 'number' ? '숫자' : '문자열';
const rangeLabel = (field: SceneFieldDescriptor) => field.min !== undefined || field.max !== undefined ? `${field.min ?? ''}~${field.max ?? ''}` : field.length ? `길이 ${field.length}` : '';
const row = (cells: string[]) => `| ${cells.map(cell => cell.replace(/\|/g, '\\|')).join(' | ')} |`;

function fieldRows(fields: readonly SceneFieldDescriptor[]) {
  return fields.map(field => row([`\`${field.field}\``, kindLabel(field), field.unit ?? '', rangeLabel(field), field.optional ? '선택' : '필수', field.label + (field.description ? ` — ${field.description}` : '') + (field.patchable ? ' (패치 가능)' : '')]));
}

/** Markdown for docs/database/domain-feeds.md: one summary table and per-feed column tables. */
export function feedsMarkdown(verifiedCommit: string) {
  const lines: string[] = ['---', 'sources:', '  - src/cinema/domainFeeds.ts', '  - src/cinema/sceneFields.ts', '  - src/cinema/productionLineFields.ts', `verifiedCommit: ${verifiedCommit}`, '---', '',
    '# 도메인 피드 — DB가 보내야 하는 기대값', '',
    '이 문서는 `src/cinema/domainFeeds.ts`에서 생성된다(`npm run docs:feeds`). 손으로 고치지 말고 선언을 고친다. 시연 데이터 구조를 기준으로 선언했으며 실제 MES 컬럼은 피드별로 매핑한다.', '',
    '피드 문서 봉투는 `{ feed, version: 1, source, at, data }`이고 `data`의 스키마는 `public/cinema/data/schemas/<feed>.schema.json`, 예시는 같은 폴더의 `<feed>.example.json`이다. 모든 객체는 `id`(도메인 코드, 자연키)와 `label`(표시 이름)을 가진다.', '',
    '## 피드 요약', '', row(['피드', '이름', '갱신', '상태', '컬렉션', '소비 장면']), row(['---', '---', '---', '---', '---', '---']),
    ...DOMAIN_FEEDS.map(feed => row([`\`${feed.feed}\``, feed.label, `${REFRESH_LABEL[feed.refresh]} (${feed.refreshHint})`, STATUS_LABEL[feed.status], feed.objects.map(object => `\`${object.collection}\``).join(', '), feed.scenes.join(', ')])), ''];
  for (const feed of DOMAIN_FEEDS) {
    lines.push(`## ${feed.label} — \`${feed.feed}\``, '', feed.note, '', `- 갱신: ${REFRESH_LABEL[feed.refresh]} · ${feed.refreshHint}`, `- 상태: ${STATUS_LABEL[feed.status]}`, `- 스키마: \`public/cinema/data/schemas/${feed.feed}.schema.json\` · 예시: \`${feed.feed}.example.json\``, '');
    if (feed.header.length) {
      lines.push('### 헤더', '', row(['컬럼', '종류', '단위', '범위', '필수', '설명']), row(['---', '---', '---', '---', '---', '---']), ...fieldRows(feed.header), '');
    }
    for (const object of feed.objects) {
      lines.push(`### ${object.label} — \`${object.collection}[]\` (객체 타입 \`${object.type}\`)`, '', row(['컬럼', '종류', '단위', '범위', '필수', '설명']), row(['---', '---', '---', '---', '---', '---']),
        row(['`id`', '문자열', '', '', '필수', '도메인 코드(자연키), 목록 안에서 유일']), row(['`label`', '문자열', '', '', '필수', '표시 이름']), ...fieldRows(object.fields));
      for (const [key, extra] of Object.entries(object.extra ?? {})) lines.push(row([`\`${key}\``, '구조', '', '', extra.optional ? '선택' : '필수', extra.label + (extra.description ? ` — ${extra.description}` : '') + ` (JSON Schema 참조)`]));
      lines.push('');
    }
  }
  return lines.join('\n');
}

export interface FeedMappingRow { field: string; label: string; optional: boolean }
/** Every collection maps a domain code and a display name before its own descriptors. */
const BASE_MAPPING_ROWS: readonly FeedMappingRow[] = [
  { field: 'id', label: '도메인 코드', optional: false },
  { field: 'label', label: '표시 이름', optional: true },
];

/**
 * Column-mapping rows for one collection: base rows, the object's descriptors, then JSON extras,
 * one row per field. An object that declares `id`/`label` itself (e.g. defect labels) keeps its own
 * wording in the base slot instead of appearing twice.
 */
export function feedMappingRows(object: DomainObjectType): FeedMappingRow[] {
  const rows: FeedMappingRow[] = [];
  const push = (row: FeedMappingRow) => { if (!rows.some(existing => existing.field === row.field)) rows.push(row); };
  const own = new Map(object.fields.map(field => [field.field, field]));
  for (const base of BASE_MAPPING_ROWS) {
    const declared = own.get(base.field);
    push(declared ? { field: declared.field, label: declared.label, optional: declared.optional === true } : base);
  }
  for (const field of object.fields) push({ field: field.field, label: field.label, optional: field.optional === true });
  for (const [key, extra] of Object.entries(object.extra ?? {})) push({ field: key, label: `${extra.label} (JSON)`, optional: extra.optional === true });
  return rows;
}
