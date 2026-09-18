import { expect, it, vi } from 'vitest';
import { executeRealtimeScreen } from '@/cinema/realtimeScreenTool';
it('executes direct OEE navigation once through the screen executor', async () => {
  const execute = vi.fn(async () => ({ok:true,message:'이동했습니다.'}));
  expect((await executeRealtimeScreen(JSON.stringify({action:'set',key:'scene',value:'oee'}),execute)).ok).toBe(true);
  expect(execute).toHaveBeenCalledExactlyOnceWith({action:'set',key:'scene',value:'oee'});
});
it('rejects malformed, unknown and analysis-only settings before execution', async () => {
  const execute = vi.fn();
  for (const args of ['bad',JSON.stringify({action:'set',key:'prompt',value:'override'}),JSON.stringify({action:'set',key:'scene',value:'missing'})]) {
    expect((await executeRealtimeScreen(args,execute)).ok).toBe(false);
  }
  expect(execute).not.toHaveBeenCalled();
});
