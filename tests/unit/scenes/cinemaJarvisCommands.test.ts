import { describe, expect, it } from 'vitest';
import { resolveJarvisCommand, jarvisOverview } from '@/cinema/jarvisCommands';
import { GET, POST } from '@/app/api/cinema/assistant/route';
import { jarvisMainData } from '@/cinema/jarvisMainData';

describe('Jarvis main commands and local endpoint', () => {
  it('summarizes production, process, quality and power while keeping temperature queries specific', () => {
    const overview = jarvisOverview();
    expect(overview.normal).toBe(8);
    expect(overview.outside.map(z => z.id)).toEqual(['ZONE 06', 'ZONE 08']);
    const reply = resolveJarvisCommand('현장 요약')!;
    expect(reply.reply).toContain(String(jarvisMainData.energy.production.value));
    expect(reply.reply).toContain(String(jarvisMainData.energy.power.value));
    expect(reply.reply).toContain('공정 병목');
    expect(reply.reply).toContain('SPC');
    expect(resolveJarvisCommand('온습도 요약')?.reply).toContain(overview.temperature.toFixed(1));
    expect(resolveJarvisCommand('온습도 요약')?.reply).toContain(overview.humidity.toFixed(1));
    expect(reply.reply).toContain('시연');
    expect(resolveJarvisCommand('오늘 현장 상태 알려줘')?.reply).toBe(reply.reply);
  });
  it('answers all ten zones without prefix-matching zone 10 as zone 1', () => {
    for (let n = 1; n <= 10; n++) {
      const zone = jarvisOverview().zones[n - 1];
      expect(resolveJarvisCommand('ZONE ' + n + ' 알려줘')?.reply).toContain(zone.name);
      expect(resolveJarvisCommand('존 ' + n + ' 온습도')?.reply).toContain(String(zone.temperature));
    }
    expect(resolveJarvisCommand('ZONE 100 알려줘')).toBeNull();
    expect(resolveJarvisCommand('6번 구역 알려줘')?.reply).toContain('29.4');
  });
  it('returns explicit menu actions only for requests to open supported scenes', () => {
    expect(resolveJarvisCommand('SPC 분석 보여줘')?.chapter).toBe('spc');
    expect(resolveJarvisCommand('에스 피 씨 분석 보여줘')?.chapter).toBe('spc');
    expect(resolveJarvisCommand('온습도 보여줘')?.chapter).toBe('wave');
    expect(resolveJarvisCommand('바이저 평면 열어줘')?.chapter).toBe('visorPan');
    expect(resolveJarvisCommand('온습도 알려줘')?.chapter).toBeUndefined();
    expect(resolveJarvisCommand('모든 설비 정지해')).toBeNull();
  });
  it('does not swallow free AI questions just because they address HATCHERY', () => {
    expect(resolveJarvisCommand('HATCHERY, 생산성을 어떻게 개선할까?')).toBeNull();
    expect(resolveJarvisCommand('HATCHERY')).toMatchObject({ source: 'local' });
  });
  it.each(['HATCHERY', 'hatchery', '헤처리', '해처리', '해쳐리', '자비스'])('introduces HATCHERY when addressed as %s', name => {
    expect(resolveJarvisCommand(name)).toMatchObject({ source: 'local', reply: expect.stringContaining('HATCHERY입니다.') });
    expect(resolveJarvisCommand(`${name}, 생산성을 어떻게 개선할까?`)).toBeNull();
  });
  it('keeps AI unconnected and handles unknown questions honestly without external calls', async () => {
    expect(await GET().json()).toMatchObject({ aiConfigured: false });
    const response = await POST(new Request('http://localhost:3000/api/cinema/assistant', {
      method: 'POST', body: JSON.stringify({ message: '일반 지식 질문' }) }));
    expect(await response.json()).toMatchObject({ source: 'unavailable' });
  });
  it('validates origin, malformed payloads and request size', async () => {
    for (const body of ['invalid', '{}', '{"message":""}', JSON.stringify({ message: 'a'.repeat(1201) })]) {
      expect((await POST(new Request('http://localhost:3000/api/cinema/assistant', { method: 'POST', body }))).status).toBe(400);
    }
    expect((await POST(new Request('http://localhost:3000/api/cinema/assistant', { method: 'POST',
      body: 'a'.repeat(48001) }))).status).toBe(413);
    expect((await POST(new Request('http://localhost:3000/api/cinema/assistant', { method: 'POST',
      headers: { origin: 'https://unrelated.example' }, body: '{"message":"안녕"}' }))).status).toBe(403);
  });
});
