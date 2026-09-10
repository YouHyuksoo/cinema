import { describe, expect, it, vi } from 'vitest';
import { createDatabaseHealthService } from '@/server/cinema/databaseHealth';
import type { DataSourceConfig } from '@/cinema/feedConfig';

const source:DataSourceConfig = { id:'db',name:'DB',kind:'oracle',host:'private-host',port:1521,serviceName:'PDB',user:'reader',password:'secret' };
describe('database health cache', () => {
  it('does not connect without a configured source; exposes counts, not credentials', async () => {
    const probe=vi.fn(async()=>({ok:true}));
    const service=createDatabaseHealthService(probe);
    expect(await service.check([])).toMatchObject({total:0,connected:0});
    expect(probe).not.toHaveBeenCalled();
    const health=await service.check([source]);
    expect(health).toMatchObject({total:1,connected:1});
    expect(JSON.stringify(health)).not.toMatch(/secret|private-host|reader/);
  });
  it('deduplicates concurrent checks, caches results, and rechecks changed config or expired evidence', async () => {
    let time=1000;
    const probe=vi.fn(async()=>({ok:true}));
    const service=createDatabaseHealthService(probe,()=>time);
    await Promise.all([service.check([source]),service.check([source])]);
    await service.check([source]);
    expect(probe).toHaveBeenCalledTimes(1);
    await service.check([{...source,password:'changed'}]);
    expect(probe).toHaveBeenCalledTimes(2);
    time+=31000;
    await service.check([{...source,password:'changed'}]);
    expect(probe).toHaveBeenCalledTimes(3);
  });
  it('counts failures without exposing driver errors and removes deleted sources', async () => {
    const probe=vi.fn().mockResolvedValueOnce({ok:true}).mockRejectedValueOnce(new Error('private-host secret'));
    const service=createDatabaseHealthService(probe);
    expect(await service.check([source,{...source,id:'second'}])).toMatchObject({total:2,connected:1});
    expect(await service.check([])).toMatchObject({total:0,connected:0});
  });
});
