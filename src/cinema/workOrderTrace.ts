import { FILM_DURATIONS } from './filmProgram';
import { SMT_LINE, type SmtEquipment } from './smtLine';

/** Illustrative order and inspection results, not a live MES production record. */
export const TRACE_WORK_ORDER = {
  id: 'WO-260908-001', product: 'CONTROL PCB', line: 'SMT LINE 01', quantity: 120,
} as const;

export const TRACE_TIMING = {
  createdAt: .6, launchAt: 2.4, unitInterval: .06, stageDuration: 1.25,
  summaryAt: 20, fadeAt: 23, endAt: FILM_DURATIONS.trace,
} as const;

export interface WorkOrderTraceUnit {
  serial: number;
  /** Waiting units have no station yet; completed units retain their exit station. */
  stageIndex: number;
  stageProgress: number;
  status: 'waiting' | 'processing' | 'good' | 'defect';
  defectStageIndex?: number;
}

export interface WorkOrderTraceStage {
  equipment: SmtEquipment;
  index: number;
  entered: number;
  passed: number;
  defects: number;
  wip: number;
  active: boolean;
}

export interface WorkOrderTraceEvent {
  serial: number;
  stageIndex: number;
  at: number;
  label: string;
}

export interface WorkOrderTraceState {
  elapsed: number;
  created: boolean;
  phase: 'creating' | 'running' | 'complete';
  issued: number;
  released: number;
  notStarted: number;
  inProcess: number;
  completedGood: number;
  defectCount: number;
  /** Good units divided by all resolved units; zero until the first result. */
  yieldPercent: number;
  /** Resolved units divided by the issued quantity. */
  progress: number;
  units: WorkOrderTraceUnit[];
  stages: WorkOrderTraceStage[];
  events: WorkOrderTraceEvent[];
  latestEvent?: WorkOrderTraceEvent;
}

const INSPECTION_RESULTS = [
  { serial: 7, equipmentId: 'spi', label: '납량 부족' },
  { serial: 27, equipmentId: 'maoi', label: '부품 위치 편차' },
  { serial: 83, equipmentId: 'maoi', label: '부품 위치 편차' },
  { serial: 61, equipmentId: 'aoi', label: '납땜 브리지' },
] as const satisfies readonly { serial: number; equipmentId: SmtEquipment['id']; label: string }[];

function unitLaunchAt(serial: number): number {
  return TRACE_TIMING.launchAt + (serial - 1) * TRACE_TIMING.unitInterval;
}

const INSPECTION_EVENTS: readonly WorkOrderTraceEvent[] = INSPECTION_RESULTS.map(result => {
  const stageIndex = SMT_LINE.findIndex(equipment => equipment.id === result.equipmentId);
  return {
    serial: result.serial, stageIndex, label: result.label,
    at: unitLaunchAt(result.serial) + (stageIndex + 1) * TRACE_TIMING.stageDuration,
  };
}).sort((a, b) => a.at - b.at);

/** Avoid an extra frame at exact decimal timestamp boundaries after floating point arithmetic. */
function reached(elapsed: number, timestamp: number): boolean {
  return elapsed + 1e-9 >= timestamp;
}

/** Reconstruct the complete order from absolute time so pausing and backward seeking are stable. */
export function workOrderTraceState(time: number): WorkOrderTraceState {
  const elapsed = Number.isFinite(time) ? Math.max(0, Math.min(TRACE_TIMING.endAt, time)) : 0;
  const created = reached(elapsed, TRACE_TIMING.createdAt);
  const issued = created ? TRACE_WORK_ORDER.quantity : 0;
  const stages: WorkOrderTraceStage[] = SMT_LINE.map((equipment, index) => ({
    equipment, index, entered: 0, passed: 0, defects: 0, wip: 0, active: false,
  }));
  const units: WorkOrderTraceUnit[] = [];
  let notStarted = 0, inProcess = 0, completedGood = 0, defectCount = 0;

  for (let serial = 1; serial <= issued; serial++) {
    const launchAt = unitLaunchAt(serial);
    const inspection = INSPECTION_EVENTS.find(event => event.serial === serial);
    if (!reached(elapsed, launchAt)) {
      units.push({ serial, stageIndex: -1, stageProgress: 0, status: 'waiting' });
      notStarted++;
      continue;
    }

    let unit: WorkOrderTraceUnit | undefined;
    for (const stage of stages) {
      const enterAt = launchAt + stage.index * TRACE_TIMING.stageDuration;
      const exitAt = launchAt + (stage.index + 1) * TRACE_TIMING.stageDuration;
      if (!reached(elapsed, enterAt)) break;
      stage.entered++;

      if (!reached(elapsed, exitAt)) {
        stage.wip++;
        stage.active = true;
        unit = {
          serial, stageIndex: stage.index, status: 'processing',
          stageProgress: Math.max(0, Math.min(1, (elapsed - enterAt) / TRACE_TIMING.stageDuration)),
        };
        inProcess++;
        break;
      }

      if (inspection?.stageIndex === stage.index) {
        stage.defects++;
        unit = {
          serial, stageIndex: stage.index, stageProgress: 1, status: 'defect',
          defectStageIndex: stage.index,
        };
        defectCount++;
        break;
      }

      stage.passed++;
      if (stage.index === stages.length - 1) {
        unit = { serial, stageIndex: stage.index, stageProgress: 1, status: 'good' };
        completedGood++;
      }
    }
    if (unit) units.push(unit);
  }

  const released = issued - notStarted;
  const resolved = completedGood + defectCount;
  const events = created ? INSPECTION_EVENTS.filter(event => reached(elapsed, event.at)).map(event => ({ ...event })) : [];
  const phase = issued > 0 && resolved === issued ? 'complete' : released > 0 ? 'running' : 'creating';
  return {
    elapsed, created, phase, issued, released, notStarted, inProcess, completedGood, defectCount,
    yieldPercent: resolved ? completedGood / resolved * 100 : 0,
    progress: issued ? resolved / issued : 0,
    units, stages, events, latestEvent: events.at(-1),
  };
}
