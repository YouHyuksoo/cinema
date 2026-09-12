import type { FilmSceneData } from './filmSceneData';
import type { FilmId } from './filmProgram';
import type { SceneDataResult, SceneObjectChange, SceneObjectPatch } from './sceneDataDocument';
import { formatSceneField, validateSceneField, type SceneFieldDescriptor } from './sceneField';
import { isPatchableScene, PATCHABLE_SCENES, SCENE_FIELDS, type PatchableScene } from './sceneFields';

/** Scenes whose objects HATCHERY may change and the fields it may touch, derived from the scene field descriptors. */
export const HATCHERY_PATCH_SCENES = PATCHABLE_SCENES;
export type HatcheryPatchScene = PatchableScene;
export type HatcheryField = SceneFieldDescriptor & { aliases: RegExp };
const commandField = (field: SceneFieldDescriptor): field is HatcheryField => Boolean(field.patchable && field.aliases);
export const HATCHERY_FIELDS: Record<HatcheryPatchScene, readonly HatcheryField[]> = Object.fromEntries(
  PATCHABLE_SCENES.map(scene => [scene, SCENE_FIELDS[scene].filter(commandField)])) as unknown as Record<HatcheryPatchScene, readonly HatcheryField[]>;
export const HATCHERY_SCENE_LABELS: Record<HatcheryPatchScene, string> = { bars: '막대', wave: '환경', network: '공정망', spc: 'SPC', machine: 'PCB 검사' };
const NUMBER_REFERENCES: Record<HatcheryPatchScene, RegExp[]> = {
  bars: [/(?:라인|line)[\s\-_]*0?(\d{1,2})(?!\d)/gi, /(?<!\d)0?(\d{1,2})\s*번?\s*라인/g],
  wave: [/(?:zone|존|구역)[\s\-_]*0?(\d{1,2})(?!\d)/gi, /(?<!\d)0?(\d{1,2})\s*번?\s*구역/g],
  network: [],
  machine: [],
  spc: [/(?:부분군|sg)[\s\-_]*0?(\d{1,2})(?!\d)/gi],
};
const QUESTION = /알려|얼마|몇|뭐|무엇|\?/;

/** What the film player hands the assistant: current data to resolve targets, and the patch entry point. */
export interface HatcheryActions { sceneData(): FilmSceneData; applySceneObjects(input: unknown): SceneDataResult; screen?: import('./screenCommands').ScreenExecutor }
export interface HatcheryObject { id: string; label: string; aliases: string[]; number?: number }

const norm = (value: string) => value.toLowerCase().replace(/[\s\-_]+/g, '');
const trailingNumber = (value: string) => { const match = value.match(/(\d+)\s*$/); return match ? Number(match[1]) : undefined; };
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const aliasPattern = (alias: string) => new RegExp(escape(alias.trim()).replace(/[\s\-_]+/g, '[\\s\\-_]*'), 'gi');

export function hatcheryObjects(data: FilmSceneData, scene: HatcheryPatchScene): HatcheryObject[] {
  switch (scene) {
    case 'machine': return data.pcb.components.map(component => ({ id: component.id, label: component.label, aliases: [component.id, component.label] }));
    case 'bars': return data.production.lines.map(line => ({ id: line.id, label: line.label, aliases: [line.id, line.label], number: trailingNumber(line.id) ?? trailingNumber(line.label) }));
    case 'wave': return data.environment.zones.map(zone => ({ id: zone.id, label: `${zone.id} ${zone.name}`, aliases: [zone.id, zone.name], number: trailingNumber(zone.id) }));
    case 'network': return data.network.nodes.map(node => ({ id: node.id, label: node.label, aliases: [node.id, node.label, node.code] }));
    case 'spc': return data.spc.subgroups.map(group => ({ id: group.id, label: group.id, aliases: [group.id], number: trailingNumber(group.id) }));
  }
}

/** Accepts an id, label, code or a numbered reference ("라인 2", "zone 3", "sg 18"); case, spaces and hyphens are ignored. */
export function resolveHatcheryTarget(data: FilmSceneData, scene: HatcheryPatchScene, reference: string): HatcheryObject | undefined {
  const wanted = norm(reference ?? '');
  if (!wanted) return undefined;
  const objects = hatcheryObjects(data, scene);
  const exact = objects.find(object => object.aliases.some(alias => norm(alias) === wanted));
  if (exact) return exact;
  const numeric = wanted.match(/^(?:line|라인|zone|존|구역|sg|부분군)?0*(\d{1,3})(?:번|번라인|번구역)?$/);
  return numeric ? objects.find(object => object.number === Number(numeric[1])) : undefined;
}

interface Candidate { scene: HatcheryPatchScene; object: HatcheryObject; start: number; end: number }
function findCandidates(text: string, data: FilmSceneData): Candidate[] {
  const found: Candidate[] = [];
  const push = (candidate: Candidate) => {
    if (!found.some(item => item.scene === candidate.scene && item.object.id === candidate.object.id)) found.push(candidate);
  };
  for (const scene of HATCHERY_PATCH_SCENES) {
    const objects = hatcheryObjects(data, scene);
    for (const object of objects) {
      for (const alias of object.aliases) {
        if (!alias.trim()) continue;
        const pattern = aliasPattern(alias);
        const match = (scene === 'machine' ? new RegExp(`(?<![a-z0-9])${pattern.source}(?![a-z0-9])`, 'gi') : pattern).exec(text);
        if (match) push({ scene, object, start: match.index, end: match.index + match[0].length });
      }
    }
    for (const pattern of NUMBER_REFERENCES[scene]) {
      pattern.lastIndex = 0;
      for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
        const object = objects.find(item => item.number === Number(match![1]));
        if (object) push({ scene, object, start: match.index, end: match.index + match[0].length });
      }
    }
  }
  return found;
}

export function hatcheryPatch(scene: HatcheryPatchScene, objects: readonly SceneObjectChange[], at = new Date().toISOString()): SceneObjectPatch {
  return { scene, source: 'hatchery', at, objects };
}

export type HatcheryValueCommand =
  | { kind: 'patch'; patch: SceneObjectPatch; reply: string; chapter: FilmId; label: string; field: HatcheryField }
  | { kind: 'clarify'; reply: string };

const valueText = (field: HatcheryField, value: string | number | number[], unit: string) => `${formatSceneField(field, value)}${field.unit ? '' : unit}`;

function enumValue(field: HatcheryField, text: string): string | undefined {
  // Be conservative: negated or ambiguous verdicts must never silently clear a defect.
  if (/아니|아님|않|말아|지\s*마|말고|not\b/i.test(text)) return undefined;
  const matches = field.allowedValues?.filter(value => {
    const code = new RegExp(`(?<![a-z0-9_])${escape(value)}(?![a-z0-9_])`, 'i');
    const label = field.valueLabels?.[value];
    const labelPattern = label ? new RegExp(`(?<![\\p{L}\\p{N}_])${escape(label).replace(/\s+/g, '\\s*')}(?=(?:으로|로|을|를|이|가|은|는)?(?:$|[\\s.,!?]))`, 'iu') : undefined;
    return code.test(text) || Boolean(label && label.toLowerCase() !== value.toLowerCase() && labelPattern?.test(text));
  });
  return matches?.length === 1 ? matches[0] : undefined;
}

/** Deterministic "change this object's value" sentences; anything else returns null for the other handlers. */
export function resolveHatcheryValueCommand(input: string, data: FilmSceneData): HatcheryValueCommand | null {
  const text = input.trim();
  if (!text || QUESTION.test(text)) return null;
  const fieldHits = HATCHERY_PATCH_SCENES.flatMap(scene => HATCHERY_FIELDS[scene].flatMap(field => {
    const match = new RegExp(field.aliases.source, 'i').exec(text);
    return match ? [{ scene, field, start: match.index, end: match.index + match[0].length }] : [];
  }));
  let candidates = findCandidates(text, data);
  if (!candidates.length) return null;
  if (fieldHits.length) candidates = candidates.filter(candidate => fieldHits.some(hit => hit.scene === candidate.scene));
  if (!candidates.length) return null;
  const scenes = [...new Set(candidates.map(candidate => candidate.scene))];
  if (scenes.length > 1) {
    const names = candidates.map(candidate => `${HATCHERY_SCENE_LABELS[candidate.scene]}의 ${candidate.object.label}`).join('과 ');
    return { kind: 'clarify', reply: `${candidates[0].object.aliases[1] ?? candidates[0].object.label}은 ${names}에 모두 있습니다. 온도·습도처럼 바꿀 항목을 함께 말씀해 주세요.` };
  }
  const scene = scenes[0];
  const target = candidates.find(candidate => candidate.scene === scene)!;
  const hit = fieldHits.find(item => item.scene === scene);
  const field = hit?.field ?? HATCHERY_FIELDS[scene].find(item => item.default)!;
  const spans = [[target.start, target.end], ...(hit ? [[hit.start, hit.end]] : [])] as [number, number][];
  let remaining = text;
  for (const [start, end] of spans.sort((a, b) => b[0] - a[0])) remaining = remaining.slice(0, start) + ' ' + remaining.slice(end);
  const numbers = (remaining.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number).filter(Number.isFinite);
  const value = field.kind === 'text' ? enumValue(field, remaining) : field.kind === 'number[]' ? numbers : numbers[numbers.length - 1];
  if (value === undefined || (Array.isArray(value) && !value.length)) return null;
  const unit = scene === 'bars' ? data.production.unit : scene === 'spc' ? data.spc.unit : '';
  const patch = hatcheryPatch(scene, [{ id: target.object.id, [field.field]: value }]);
  return { kind: 'patch', patch, chapter: scene, label: target.object.label, field,
    reply: `${target.object.label} ${field.label}를 ${valueText(field, value, unit)}로 갱신했습니다. 시연 데이터이며 실제 설비는 바뀌지 않습니다.` };
}

/** Spoken confirmation for a patch built from a tool call (no local command sentence available). */
export function describeHatcheryPatch(patch: SceneObjectPatch) {
  const scene = isPatchableScene(patch.scene) ? patch.scene : undefined;
  const changes = patch.objects.map(object => Object.entries(object).filter(([key]) => key !== 'id').map(([key, value]) => {
    const field = scene ? HATCHERY_FIELDS[scene].find(item => item.field === key) : undefined;
    return `${object.id} ${field?.label ?? key} ${field ? formatSceneField(field, value) : Array.isArray(value) ? value.join(', ') : String(value)}`;
  }).join(', ')).join(', ');
  return `${changes}로 갱신했습니다. 시연 데이터이며 실제 설비는 바뀌지 않습니다.`;
}

/** Sentence for the assistant after the store answered. */
export function describeSceneDataResult(command: Extract<HatcheryValueCommand, { kind: 'patch' }>, result: SceneDataResult) {
  if (!result.ok) return `${command.label} 값을 바꾸지 못했습니다. ${result.reason}`;
  return result.ignored.length ? `${command.reply} 찾지 못한 객체: ${result.ignored.join(', ')}.` : command.reply;
}

const ALL_FIELDS = [...new Set(HATCHERY_PATCH_SCENES.flatMap(scene => HATCHERY_FIELDS[scene].map(field => field.field)))];
const ALL_TEXT_VALUES = [...new Set(HATCHERY_PATCH_SCENES.flatMap(scene => HATCHERY_FIELDS[scene].flatMap(field => field.allowedValues ?? [])))];
/** One function tool shared by the Responses (text) and Realtime (voice) sessions. */
export const SET_SCENE_OBJECT_VALUES_TOOL = {
  type: 'function', name: 'set_scene_object_values',
  description: '사용자가 명시적으로 요청한 HUD 화면 객체의 시연 값을 바꿉니다. 설비 제어나 DB 변경이 아닙니다. id에는 카탈로그의 id 또는 label을 쓰세요.',
  parameters: {
    type: 'object',
    properties: {
      scene: { type: 'string', enum: [...HATCHERY_PATCH_SCENES] },
      objects: { type: 'array', minItems: 1, items: {
        type: 'object',
        properties: { id: { type: 'string' }, field: { type: 'string', enum: ALL_FIELDS },
          value: { anyOf: [{ type: 'number' }, { type: 'string', enum: ALL_TEXT_VALUES }] }, values: { type: 'array', items: { type: 'number' } } },
        required: ['id', 'field'], additionalProperties: false } },
    },
    required: ['scene', 'objects'], additionalProperties: false,
  },
} as const;

/** Validates tool arguments against the live data and returns a contract patch. */
export function toolCallToPatch(args: unknown, data: FilmSceneData): { ok: true; patch: SceneObjectPatch } | { ok: false; reason: string } {
  if (!args || typeof args !== 'object') return { ok: false, reason: '도구 인자가 없습니다.' };
  const { scene, objects } = args as { scene?: unknown; objects?: unknown };
  if (!isPatchableScene(scene)) return { ok: false, reason: `값을 바꿀 수 없는 장면입니다: ${String(scene)}` };
  if (!Array.isArray(objects) || !objects.length) return { ok: false, reason: 'objects가 비어 있습니다.' };
  const changes: SceneObjectChange[] = [];
  for (const entry of objects as { id?: unknown; field?: unknown; value?: unknown; values?: unknown }[]) {
    const target = typeof entry?.id === 'string' ? resolveHatcheryTarget(data, scene, entry.id) : undefined;
    if (!target) return { ok: false, reason: `${HATCHERY_SCENE_LABELS[scene]} 장면에 없는 객체입니다: ${String(entry?.id)}` };
    const field = HATCHERY_FIELDS[scene].find(item => item.field === entry.field);
    if (!field) return { ok: false, reason: `${HATCHERY_SCENE_LABELS[scene]} 장면에서 바꿀 수 없는 항목입니다: ${String(entry?.field)}` };
    const list = field.kind === 'number[]';
    const checked = validateSceneField(field, list ? entry.values : entry.value);
    if (!checked.ok) return { ok: false, reason: `${checked.reason} (${list ? 'values' : 'value'})` };
    changes.push({ id: target.id, [field.field]: Array.isArray(checked.value) ? [...checked.value] : checked.value });
  }
  return { ok: true, patch: hatcheryPatch(scene, changes) };
}

/** Compact id/label/field listing for the assistant instructions. */
export function hatcheryObjectCatalog(data: FilmSceneData) {
  return HATCHERY_PATCH_SCENES.map(scene => {
    const objects = hatcheryObjects(data, scene);
    const fields = HATCHERY_FIELDS[scene].map(field => `${field.field}(${field.label}${field.unit ? `, ${field.unit}` : ''}${field.kind === 'number[]' ? ', 숫자 목록' : ''}${field.allowedValues ? `, ${field.allowedValues.map(value => `${value}=${field.valueLabels?.[value] ?? value}`).join('|')}` : ''}${field.min !== undefined || field.max !== undefined ? `, 범위 ${field.min ?? ''}~${field.max ?? ''}` : ''})`).join(', ');
    const ids = scene === 'spc' && objects.length > 3 ? `${objects[0].id}~${objects[objects.length - 1].id}` : objects.map(object => `${object.id}(${object.label})`).join(', ');
    return `${scene}(${HATCHERY_SCENE_LABELS[scene]}) 필드: ${fields}; 객체: ${ids}`;
  }).join('\n');
}
