import { DEFAULT_ENVIRONMENT_DATA, environmentZoneStatus } from './zoneEnvironment';
import { FILM_CHAPTERS, type FilmId } from './filmProgram';
import { jarvisMainData } from './jarvisMainData';
import type { SceneObjectPatch } from './sceneDataDocument';
import { MACHINE_PRESENTATIONS, type MachineSubject } from './machinePresentation';

/** chapter opens a scene; patch changes scene object values (docs/standards/scene-data-contract.md). Both may be present. */
export interface JarvisReply { reply: string; source: 'local' | 'ai' | 'unavailable'; chapter?: FilmId; machineSubject?: MachineSubject; patch?: SceneObjectPatch; screenCommands?: import('./screenCommands').ScreenCommand[] }
export function jarvisOverview() {
  const zones = DEFAULT_ENVIRONMENT_DATA.zones;
  return { zones, normal: zones.filter(z => environmentZoneStatus(z) === 'normal').length,
    outside: zones.filter(z => environmentZoneStatus(z) === 'outside'),
    temperature: zones.reduce((sum, z) => sum + z.temperature!, 0) / zones.length,
    humidity: zones.reduce((sum, z) => sum + z.humidity!, 0) / zones.length };
}
export function resolveJarvisCommand(input: string): JarvisReply | null {
  const text = input.trim().toLowerCase().replace(/에스\s*피\s*씨/g, 'spc');
  const overview = jarvisOverview();
  if (/보여|열어|이동|틀어|재생/.test(text)) {
    if (/지\s*마|말아|않/.test(text)) return null;
    const targetText = text.split(/말고|대신/).at(-1)!;
    const carRequested = /자동차|레이싱|f1|포뮬러|차량/.test(targetText);
    const pcbRequested = /pcb|기판|불량\s*부품|투명\s*설비/.test(targetText);
    if (carRequested && pcbRequested) return { source: 'local', reply: 'PCB 불량 분석과 자동차 중 어느 대상을 열까요?' };
    const machineSubject: MachineSubject | undefined = carRequested ? 'car' : pcbRequested ? 'pcb' : undefined;
    if (machineSubject) return { reply: `${MACHINE_PRESENTATIONS[machineSubject].title} 연출을 엽니다.`, source: 'local', chapter: 'machine', machineSubject };
    const aliases: [RegExp, FilmId][] = [[/온습도|온도|습도/, 'wave'], [/spc|공정능력|관리도/, 'spc'], [/cctv|씨씨티비|감시\s*카메라|감시/, 'cctv'],
      [/기어/, 'gears'], [/분해/i, 'machine'], [/에너지/, 'energy'],
      [/코너/, 'corners'], [/막대/, 'bars'], [/파이/, 'pie'], [/바이저.*평면/, 'visorPan'], [/바이저/, 'visor']];
    const id = aliases.find(([pattern]) => pattern.test(targetText))?.[1]
      ?? FILM_CHAPTERS.find(c => targetText.includes(c.title.toLowerCase()))?.id;
    if (id) return { reply: `${FILM_CHAPTERS.find(c => c.id === id)!.title} 연출을 엽니다.`, source: 'local', chapter: id,
      ...(id === 'machine' ? { machineSubject: 'pcb' as const } : {}) };
  }
  const zoneMatch = text.match(/(?:zone|존|구역)\s*0?(10|[1-9])(?!\d)/i)
    ?? text.match(/(?:^|[^\d])(10|[1-9])\s*(?:번\s*)?구역/);
  if (zoneMatch) {
    const zone = overview.zones[Number(zoneMatch[1]) - 1];
    return { source: 'local', reply: `시연 데이터 기준, ${zone.id} ${zone.name}은 온도 ${zone.temperature}도, 습도 ${zone.humidity}퍼센트입니다. 관리 범위는 온도 ${zone.temperatureRange.min}에서 ${zone.temperatureRange.max}도, 습도 ${zone.humidityRange.min}에서 ${zone.humidityRange.max}퍼센트이며 ${environmentZoneStatus(zone) === 'normal' ? '범위 내입니다.' : '범위를 벗어났습니다.'}` };
  }
  if (/이탈|이상|경고|알람/.test(text)) return { source: 'local',
    reply: `시연 데이터에서 관리 범위를 벗어난 구역은 ${overview.outside.length}곳입니다. ${overview.outside.map(z => `${z.id} ${z.name}, 온도 ${z.temperature}도, 습도 ${z.humidity}퍼센트`).join('. ')}. 실제 현장 경보는 연결되지 않았습니다.` };
  if (/온습도|온도|습도/.test(text)) return { source: 'local',
    reply: `시연 중인 10개 구역의 평균 온도는 ${overview.temperature.toFixed(1)}도, 평균 습도는 ${overview.humidity.toFixed(1)}퍼센트입니다. 관리 범위 내 ${overview.normal}곳, 이탈 ${overview.outside.length}곳입니다. 구역 번호를 말씀하시면 상세 값을 알려드리겠습니다.` };
  if (/현황|요약|현장.*상태|상태.*현장/.test(text)) {
    const { energy, bottlenecks, quality } = jarvisMainData;
    return { source: 'local', reply: `시연 데이터 기준, 생산량은 ${energy.production.value}개, 목표 ${energy.production.capacity}개입니다. 공정 병목 ${bottlenecks.length}곳, ${quality.valid ? `SPC 관리 한계 이탈 ${quality.violationCount}개 부분군` : '품질 데이터 확인 필요'}입니다. 사용 전력은 ${energy.power.value}킬로와트입니다. 좌우 정보에서 공정·품질·에너지 상세 연출을 열 수 있습니다.` };
  }
  if (/^(?:(?:hatchery|헤처리|해처리|해쳐리|자비스)[야,\s]*)?(?:안녕(?:하세요)?|도움말|무엇을 할 수 있(?:어|나요))?[.!?\s]*$/.test(text)) return { source: 'local',
    reply: '네, HATCHERY입니다. 현장 요약, 이상 구역, ZONE 6 온습도처럼 질문하거나 SPC 분석 보여줘처럼 연출을 선택해 주세요. 현재 현장 정보는 시연 데이터입니다.' };
  return null;
}
