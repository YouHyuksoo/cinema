import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { EnvironmentFloorMonitor } from '../../../src/cinema/EnvironmentFloorMonitor';

it('renders supplied readings on a static floor plan without fabricating history', () => {
  const html = renderToStaticMarkup(createElement(EnvironmentFloorMonitor, { data: { title: '현장', zones: [{
    id: 'sensor-1', name: '조립', temperature: 24.7, humidity: null,
    temperatureRange: { min: 20, max: 28 }, humidityRange: { min: 30, max: 60 },
  }] } }));
  expect(html).toContain('environment-factory.png');
  expect(html).toContain('24.7');
  expect(html).toContain('—');
  expect(html).toContain('온도 이력 없음');
  expect(html).toContain('설치 위치는 예시');
  expect(html).toContain('설비 환경 · 온습도 센서');
  expect(html).toContain('data-status="missing"><path');
  expect(html.match(/<circle/g)).toHaveLength(10);
  expect(html).not.toContain('<canvas');
  expect(html.match(/<button/g)).toHaveLength(10);
  expect(html.match(/disabled=""/g)).toHaveLength(9);
  expect(html).toContain('센서 슬롯 10 미연결');
});

it('shows all ten supplied sensors without adding placeholder readings', () => {
  const zones = Array.from({length:10}, (_, i) => ({id:`sensor-${i}`, name:`구역 ${i}`, temperature:20+i, humidity:45,
    temperatureRange:{min:18,max:30}, humidityRange:{min:30,max:60}}));
  const html = renderToStaticMarkup(createElement(EnvironmentFloorMonitor, {data:{title:'현장',zones}}));
  expect(html.match(/<button/g)).toHaveLength(10);
  expect(html).not.toContain('미연결');
  expect(html).toContain('구역 9');
});
