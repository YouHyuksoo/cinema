import { describe, expect, it, vi } from 'vitest';
import { createScreenObjectRegistry } from '@/cinema/screenObjectRegistry';

describe('screen object registry', () => {
  it('exposes and invokes registered object methods', async () => {
    const registry = createScreenObjectRegistry();
    const setPaused = vi.fn();
    registry.register({ id: 'stream.left', description: '좌측 카드 스트림', getState: () => ({ paused: true }), methods: {
      setAutoScroll: { description: '자동 스크롤 상태 변경', parameters:{enabled:{type:'boolean'}}, execute: args => { setPaused(args.enabled); return { ok: true, message: '적용' }; } },
    } });
    expect(registry.catalog()).toEqual([{ id: 'stream.left', description: '좌측 카드 스트림', state:{paused:true}, detailChapter:undefined, bindings:[], methods: [{ id: 'setAutoScroll', description: '자동 스크롤 상태 변경', parameters:{enabled:{type:'boolean'}} }] }]);
    expect(registry.getState('stream.left')).toEqual({ paused: true });
    expect(await registry.execute('stream.left', 'setAutoScroll', { enabled: false })).toMatchObject({ ok: true });
    expect(setPaused).toHaveBeenCalledWith(false);
  });

  it('rejects duplicate object ids and invalid method arguments', async () => {
    const registry = createScreenObjectRegistry();
    registry.register({ id:'reactor',description:'reactor',methods:{play:{description:'play',parameters:{repeat:{type:'number'}},execute:()=>({ok:true,message:'played'})}} });
    expect(() => registry.register({ id:'reactor',description:'duplicate',methods:{} })).toThrow(/중복/);
    expect(await registry.execute('reactor','play',{repeat:'twice'})).toMatchObject({ok:false});
    expect(await registry.execute('reactor','play',{repeat:2})).toMatchObject({ok:true});
  });
  it('unregisters objects and reports missing objects and methods', async () => {
    const registry=createScreenObjectRegistry();
    const unregister=registry.register({id:'scanner',description:'scanner',methods:{play:{description:'play',execute:()=>({ok:true,message:'played'})}}});
    expect(await registry.execute('scanner','missing')).toMatchObject({ok:false});
    unregister();
    expect(registry.catalog()).toEqual([]);
    expect(await registry.execute('scanner','play')).toMatchObject({ok:false});
  });
  it('converts method exceptions into a failed result', async () => {
    const registry=createScreenObjectRegistry();
    registry.register({id:'camera',description:'camera',getState:()=>({connected:false}),methods:{connect:{description:'connect',execute:()=>{throw new Error('denied');}}}});
    expect(await registry.execute('camera','connect')).toEqual({ok:false,message:'camera.connect 실행에 실패했습니다.',state:{connected:false}});
  });

  it('publishes live read-only data bindings and revision notifications', () => {
    const registry = createScreenObjectRegistry();
    const listener = vi.fn();
    const unsubscribe = registry.subscribe(listener);
    let value = 92.4;
    const unregister = registry.register({ id:'metric.power', description:'전력 카드', presentation:{detailChapter:'energy'}, methods:{}, bindings:[{
      feedId:'energy', sceneKey:'energy', snapshotFields:['power.value'], readOnly:true,
      feedSchema:{type:'object'}, getSnapshot:()=>({power:{value}}), getProvenance:()=>({source:'static',at:'2026-09-14T00:00:00Z'}),
      getFeedStatus:()=>({mode:'server',ok:true,issues:[]}),
    }] });
    expect(registry.getRevision()).toBe(1);
    expect(registry.catalog()[0]).toMatchObject({ detailChapter:'energy', bindings:[{ feedId:'energy', readOnly:true, snapshot:{power:{value:92.4}} }] });
    value = 94.8; registry.notify();
    expect(registry.getRevision()).toBe(2);
    expect(registry.catalog()[0].bindings[0].snapshot).toEqual({power:{value:94.8}});
    unregister(); unsubscribe();
    expect(listener).toHaveBeenCalledTimes(3);
  });
});
