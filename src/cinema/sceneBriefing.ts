import { FILM_CHAPTERS, type FilmId } from './filmProgram';
import type { FilmSceneData } from './filmSceneData';
import { mounterAnalysisState } from './mounterAnalysis';
import { productionSnapshotState } from './productionSnapshot';
import { hatcheryMainData } from './jarvisMainData';
import { calculateOee } from './oeeData';

/** Scene-local briefing derived from the same snapshot as the renderer. */
export function sceneBriefing(id: FilmId, data: FilmSceneData) {
  const chapter = FILM_CHAPTERS.find(item => item.id === id)!;
  const intro = `${chapter.title}. ${chapter.subtitle}.`;
  if (id === 'oee') return `${intro} ${data.oee.name}. ${data.oee.equipment.map(item => {
    const result = calculateOee(item);
    return `${item.name}: ${result ? `${(result.oee * 100).toFixed(1)}%` : '산출 불가'}`;
  }).join('. ')}.`;
  if (id === 'bars') {
    const state = mounterAnalysisState(data.mounter);
    return `${intro} ${state.name}, 마운터 ${state.mounters.length}대. ${state.mounters.map(machine => `${machine.label}: 기준 이탈 ${machine.metrics.length - machine.normal}개 지표`).join('. ')}.`;
  }
  if (id === 'pie') {
    const state = productionSnapshotState(data.production);
    return `${intro} 총 생산 ${state.total.toLocaleString()} ${state.unit}, 목표 달성률 ${(state.aggregateRatio * 100).toFixed(1)}%. ${state.lines.map(line => `${line.label} ${line.value.toLocaleString()} ${state.unit}`).join(', ')}.`;
  }
  const main = hatcheryMainData(data);
  if (id === 'wave') return `${intro} ${data.environment.zones.map(zone => `${zone.name}: ${zone.temperature ?? '미수신'}°C, ${zone.humidity ?? '미수신'}%`).join('. ')}.`;
  if (id === 'spc') return `${intro} ${main.quality.valid ? `관리 한계 이탈 ${main.quality.violationCount}개 부분군입니다.` : '품질 데이터를 확인해야 합니다.'}`;
  if (id === 'energy') return `${intro} 사용 전력 ${main.energy.power.value}kW, 에너지 효율 ${main.energy.efficiency.value}%.`;
  if (id === 'network') return `${intro} 공정 ${data.network.nodes.length}개, 병목 ${main.bottlenecks.length}곳입니다.`;
  return intro;
}
