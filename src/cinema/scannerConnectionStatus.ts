import type { FeedPollSummary } from './feedPolling';

/** Public evidence contains no source names, addresses, SQL, credentials, or driver errors. */
export interface DatabaseHealth { checkedAt:string; total:number; connected:number }
export type ConnectionState = 'on'|'off'|'warning'|'unknown'|'unconfigured';
export interface ScannerConnection { id:'db'|'mq'|'sensor'|'feed'; label:string; state:ConnectionState; detail:string }
export const CONNECTION_LABELS:Record<ConnectionState,string> = { on:'ON',off:'OFF',warning:'주의',unknown:'미확인',unconfigured:'미연결' };
export const CONNECTION_STALE_MS = 90_000;
const age = (at:string|undefined,now:number) => at ? now-Date.parse(at) : NaN;

/** ON means recent evidence, never merely configured or displaying last-good cached data. */
export function scannerConnectionStatus(summary:FeedPollSummary|null|undefined, now:number):ScannerConnection[] {
  const db:ScannerConnection = { id:'db',label:'DB',state:'unknown',detail:'DB 접속 검사 결과를 기다리는 중' };
  const feed:ScannerConnection = { id:'feed',label:'FEED',state:'unknown',detail:'피드 처리 결과를 기다리는 중' };
  const set=(item:ScannerConnection,state:ConnectionState,detail:string)=>Object.assign(item,{state,detail});
  const enabled=summary?.feeds.filter(item=>item.enabled)??[];
  if (summary?.mode==='static') {
    set(db,'unknown','서버 상태 API를 사용할 수 없음');
    set(feed,'unconfigured','정적·시연 데이터만 표시 중');
  } else if (summary?.mode==='error'||summary?.error) {
    set(db,'unknown','서버 상태를 확인할 수 없음 — DB 장애로 단정하지 않음');
    set(feed,'off','피드 서버 응답 또는 설정 오류');
  } else if (summary) {
    const evidence=summary.database, elapsed=age(evidence?.checkedAt,now);
    if (evidence && Number.isFinite(elapsed) && elapsed>=-5000
      && Number.isInteger(evidence.total) && Number.isInteger(evidence.connected)
      && evidence.total>=0 && evidence.connected>=0 && evidence.connected<=evidence.total) {
      if (elapsed>CONNECTION_STALE_MS) set(db,'warning','DB 접속 검사 결과가 오래됨');
      else if (!evidence.total) set(db,'unconfigured','등록된 DB 없음');
      else set(db,evidence.connected===evidence.total?'on':evidence.connected?'warning':'off',
        `DB ${evidence.connected}/${evidence.total} 응답 · 마지막 검사 ${evidence.checkedAt}`);
    }
    if (!enabled.length) set(feed,'unconfigured','활성화된 피드 없음');
    else if (!enabled.some(item=>item.ok)) set(feed,'off','활성 피드의 최근 조회 실패 — 이전 데이터가 남아 있을 수 있음');
    else if (!Number.isFinite(age(summary.at,now)) || age(summary.at,now)>CONNECTION_STALE_MS || age(summary.at,now)<-5000
      || enabled.some(item=>!Number.isFinite(age(item.at,now)) || now>Math.max(Date.parse(item.nextAt??'')||0,Date.parse(item.at??'')||0)+30_000)) {
      set(feed,'warning','피드 갱신 지연 또는 수신 시각 미확인');
    } else if (enabled.some(item=>!item.ok||item.issues.length) || summary.rejected.length || summary.applied===0) {
      set(feed,'warning',`조회 실패 ${enabled.filter(item=>!item.ok).length} · 매핑 경고 ${enabled.reduce((sum,item)=>sum+item.issues.length,0)} · 반영 거부 ${summary.rejected.length} · 문서 반영 ${summary.applied}`);
    } else set(feed,'on',`활성 피드 ${enabled.length}개 정상 · 문서 ${summary.applied}개 반영`);
  }
  return [db,
    {id:'mq',label:'MQ',state:'unconfigured',detail:'MQ 수신부 구축 전 — 브로커 연결·구독 상태 미연동'},
    {id:'sensor',label:'SENSOR',state:'unconfigured',detail:'센서 수집부 구축 전 — 마지막 수신·하트비트 상태 미연동'},feed];
}
