// Calls the local decision endpoint only; never executes screen commands or reads secrets.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
const base = 'http://localhost:3010/api/cinema/intent';
const statusResponse = await fetch(base, { signal: AbortSignal.timeout(10000) });
if (!statusResponse.ok) throw new Error(`Intent status HTTP ${statusResponse.status}`);
const status = await statusResponse.json();
if (!status.configured || status.mode !== 'shadow') throw new Error('AI 설정 > TypeSafe / Jev에서 API 키와 평가만 모드를 저장한 뒤 실행하세요.');
const cases = JSON.parse(await readFile(new URL('../tests/fixtures/typesafe-korean.json', import.meta.url), 'utf8'));
const limit = process.argv.find(value => value.startsWith('--limit='))?.split('=')[1];
const selected = limit ? cases.slice(0, Number(limit)) : cases;
if (!selected.length) throw new Error('No evaluation cases selected.');
const rows = [];
for (const item of selected) {
  const started = performance.now();
  const response = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: item.message, screenState: item.screenState }), signal: AbortSignal.timeout(25000) });
  const body = await response.json();
  if (!response.ok) throw new Error(`Case ${item.id}: HTTP ${response.status}: ${body.error ?? 'request failed'}`);
  if (body.kind !== 'shadow') throw new Error('Evaluation mode changed; stopped.');
  const decision = body.candidate;
  const actual = decision.kind === 'command' ? `${decision.command.key}:${decision.command.value}` : decision.kind;
  rows.push({ ...item, actual, correct: actual === item.expected,
    falseAction: decision.kind === 'command' && actual !== item.expected,
    elapsedMs: Math.round(performance.now() - started), metrics: body.metrics });
  console.log(`${item.id}: ${actual === item.expected ? 'PASS' : 'FAIL'} (${actual})`);
}
const times = rows.map(row => row.elapsedMs).sort((a, b) => a - b);
const summary = { date: new Date().toISOString(), mode: 'shadow', count: rows.length,
  correct: rows.filter(row => row.correct).length, falseActions: rows.filter(row => row.falseAction).length,
  p50Ms: times[Math.ceil(times.length * 0.5) - 1], p95Ms: times[Math.ceil(times.length * 0.95) - 1],
  inputTokens: rows.reduce((sum, row) => sum + (row.metrics?.inputTokens ?? 0), 0),
  outputTokens: rows.reduce((sum, row) => sum + (row.metrics?.outputTokens ?? 0), 0) };
await mkdir(new URL('../artifacts/', import.meta.url), { recursive: true });
await writeFile(new URL('../artifacts/typesafe-evaluation.json', import.meta.url), JSON.stringify({ summary, rows }, null, 2));
console.log(JSON.stringify(summary, null, 2));
if (summary.falseActions || summary.correct / summary.count < 0.95) process.exitCode = 1;
