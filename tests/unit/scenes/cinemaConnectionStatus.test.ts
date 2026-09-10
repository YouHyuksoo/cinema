import { describe, expect, it } from 'vitest';
import { scannerConnectionStatus } from '@/cinema/scannerConnectionStatus';
import type { FeedPollSummary } from '@/cinema/feedPolling';

const now = Date.parse('2026-09-10T10:00:00Z');
const at = new Date(now).toISOString();
const live:FeedPollSummary = { mode:'server', at, applied:1, rejected:[],
  database:{ checkedAt:at, connected:1, total:1 },
  feeds:[{ feed:'production', enabled:true, ok:true, at, nextAt:new Date(now+30000).toISOString(), issues:[], counts:{} }] };
const states = (value:FeedPollSummary|null, time=now) => Object.fromEntries(scannerConnectionStatus(value,time).map(item=>[item.id,item.state]));

describe('scanner connection truth', () => {
  it('only turns DB/feed on from fresh checks and never invents MQ/sensor connectivity', () => {
    expect(states(live)).toEqual({ db:'on', mq:'unconfigured', sensor:'unconfigured', feed:'on' });
    expect(states(null)).toMatchObject({ db:'unknown', feed:'unknown' });
    expect(states({ ...live, feeds:[], applied:0, database:{ checkedAt:at,total:0,connected:0 } })).toMatchObject({ db:'unconfigured',feed:'unconfigured' });
  });
  it('distinguishes failed, partial, empty and invalid feed results even with cached documents', () => {
    expect(states({ ...live, feeds:[{ ...live.feeds[0],ok:false }] })).toMatchObject({ db:'on',feed:'off' });
    expect(states({ ...live, database:{ checkedAt:at,connected:1,total:2 }, feeds:[...live.feeds,{ ...live.feeds[0],feed:'energy',ok:false }] })).toMatchObject({ db:'warning',feed:'warning' });
    expect(states({ ...live,applied:0 })).toMatchObject({ feed:'warning' });
    expect(states({ ...live,rejected:['bad document'] })).toMatchObject({ feed:'warning' });
    expect(states({ ...live,feeds:[{ ...live.feeds[0],issues:['missing values'] }] })).toMatchObject({ feed:'warning' });
  });
  it('ages out old success and does not call a browser/server outage a DB failure', () => {
    expect(states(live,now+95000)).toMatchObject({ db:'warning',feed:'warning' });
    expect(states({ ...live,mode:'error' })).toMatchObject({ db:'unknown',feed:'off' });
    expect(states({ ...live,mode:'static' })).toMatchObject({ db:'unknown',feed:'unconfigured' });
    expect(states({ ...live,database:undefined })).toMatchObject({ db:'unknown' });
    expect(states({ ...live,database:{ checkedAt:'bad',total:1,connected:1 } })).toMatchObject({ db:'unknown' });
  });
});
