import { createHash } from 'node:crypto';
import type { DataSourceConfig } from '@/cinema/feedConfig';
import type { DatabaseHealth } from '@/cinema/scannerConnectionStatus';
import { testOracleSource } from './oracleSource';

type Probe=(source:DataSourceConfig)=>Promise<{ok:boolean}>;
/** Coalesces overlapping polls and caches both success/failure for 30s; configuration changes invalidate evidence. */
export function createDatabaseHealthService(probe:Probe=testOracleSource,now:()=>number=Date.now) {
  const entries=new Map<string,{expires:number; pending:Promise<{ok:boolean;at:number}>}>();
  return { async check(sources:DataSourceConfig[]):Promise<DatabaseHealth> {
    const keys=sources.map(source=>createHash('sha256').update(JSON.stringify(source)).digest('hex'));
    for (const key of entries.keys()) if (!keys.includes(key)) entries.delete(key);
    const results:{ok:boolean;at:number}[]=[];
    // Bound concurrent connections when multiple DB sources are registered.
    for (let offset=0;offset<sources.length;offset+=4) {
      results.push(...await Promise.all(sources.slice(offset,offset+4).map(async(source,index)=>{
        const key=keys[offset+index];
        let entry=entries.get(key);
        if (!entry||entry.expires<=now()) {
          const next={expires:Infinity,pending:Promise.resolve({ok:false,at:now()})};
          next.pending=Promise.resolve().then(()=>source.password ? probe(source) : {ok:false})
            .then(result=>({ok:result?.ok===true,at:now()}),()=>({ok:false,at:now()}))
            .then(result=>{next.expires=now()+30_000;return result;});
          entries.set(key,next);entry=next;
        }
        return entry.pending;
      })));
    }
    return {total:sources.length,connected:results.filter(item=>item.ok).length,
      checkedAt:new Date(results.length?Math.min(...results.map(item=>item.at)):now()).toISOString()};
  } };
}
declare global { var hatcheryDatabaseHealth:ReturnType<typeof createDatabaseHealthService>|undefined }
export function databaseHealthService() {
  return globalThis.hatcheryDatabaseHealth??=createDatabaseHealthService();
}
