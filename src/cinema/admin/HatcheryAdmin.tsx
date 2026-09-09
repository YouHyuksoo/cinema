'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { DOMAIN_FEEDS, type DomainFeed } from '../domainFeeds';
import { mappingTemplate, type FeedMappingConfig } from '../feedConfig';
import type { MaskedConfig, MaskedSource } from '@/server/cinema/hatcheryConfig';
import type { FeedRunResult, FeedStatus } from '@/server/cinema/feedRunner';
import styles from './hatcheryAdmin.module.css';
import { CINEMA_BASE_PATH, cinemaApi } from '../cinemaApi';

type SourceDraft = MaskedSource & { password: string };
type TestResult = { ok: true; elapsedMs: number; version: string } | { ok: false; error: string };
const api = cinemaApi;
const emptySource = (): SourceDraft => ({ id: '', name: '', kind: 'oracle', host: '', port: 1521, serviceName: '', user: '', hasPassword: false, password: '' });

/** Data source, feed mapping and run status management. Server only: a static deployment shows a notice. */
export function HatcheryAdmin() {
  const [mode, setMode] = useState<'loading' | 'server' | 'static'>('loading');
  const [sources, setSources] = useState<SourceDraft[]>([]);
  const [feeds, setFeeds] = useState<Record<string, FeedMappingConfig>>({});
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [tests, setTests] = useState<Record<string, TestResult | 'running'>>({});
  const [previews, setPreviews] = useState<Record<string, FeedRunResult | 'running'>>({});
  const [status, setStatus] = useState<{ feeds: FeedStatus[]; at: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await api('admin/config');
      if (response.status === 404 || !(response.headers.get('content-type') ?? '').includes('json')) { setMode('static'); return; }
      const body = await response.json() as MaskedConfig & { error?: string };
      setSources(body.sources.map(source => ({ ...source, password: '' })));
      setFeeds(Object.fromEntries(DOMAIN_FEEDS.map(feed => [feed.feed, body.feeds.find(item => item.feed === feed.feed) ?? mappingTemplate(feed)])));
      if (body.error) setNotice({ kind: 'error', text: body.error });
      setMode('server');
    } catch { setMode('static'); }
  }, []);
  const refreshStatus = useCallback(async () => {
    try { const body = await (await api('feed')).json(); setStatus({ feeds: body.feeds ?? [], at: new Date().toLocaleTimeString('ko-KR') }); }
    catch { setStatus(null); }
  }, []);
  useEffect(() => { void load(); void refreshStatus(); }, [load, refreshStatus]);

  const feedList = useMemo(() => DOMAIN_FEEDS.map(feed => ({ feed, mapping: feeds[feed.feed] ?? mappingTemplate(feed) })), [feeds]);
  const updateSource = (index: number, change: Partial<SourceDraft>) => setSources(list => list.map((source, i) => i === index ? { ...source, ...change } : source));
  const updateFeed = (feed: DomainFeed, change: Partial<FeedMappingConfig>) => setFeeds(map => ({ ...map, [feed.feed]: { ...(map[feed.feed] ?? mappingTemplate(feed)), ...change } }));

  async function save() {
    setSaving(true); setNotice(null);
    const payload = { sources, feeds: Object.values(feeds).filter(feed => feed.enabled || feed.sourceId || feed.sql.trim()) };
    try {
      const response = await api('admin/config', { method: 'PUT', body: JSON.stringify(payload) });
      const body = await response.json();
      if (!response.ok) { setNotice({ kind: 'error', text: body.error ?? '저장하지 못했습니다.' }); return; }
      setSources((body as MaskedConfig).sources.map(source => ({ ...source, password: '' })));
      setNotice({ kind: 'ok', text: '저장했습니다. 활성 피드는 다음 폴링부터 새 설정으로 실행됩니다.' });
      void refreshStatus();
    } catch (error) { setNotice({ kind: 'error', text: error instanceof Error ? error.message : '저장하지 못했습니다.' }); }
    finally { setSaving(false); }
  }
  async function testSource(source: SourceDraft) {
    setTests(map => ({ ...map, [source.id]: 'running' }));
    try { setTests(map => ({ ...map, [source.id]: null as never })); const body = await (await api('admin/sources/test', { method: 'POST', body: JSON.stringify(source) })).json(); setTests(map => ({ ...map, [source.id]: body.error && body.ok === undefined ? { ok: false, error: body.error } : body })); }
    catch (error) { setTests(map => ({ ...map, [source.id]: { ok: false, error: error instanceof Error ? error.message : '연결 테스트 실패' } })); }
  }
  async function previewFeed(mapping: FeedMappingConfig) {
    setPreviews(map => ({ ...map, [mapping.feed]: 'running' }));
    try { const body = await (await api('admin/feeds/preview', { method: 'POST', body: JSON.stringify({ mapping }) })).json(); setPreviews(map => ({ ...map, [mapping.feed]: body.error && body.feed === undefined ? { ...emptyRun(mapping.feed), error: body.error } : body })); }
    catch (error) { setPreviews(map => ({ ...map, [mapping.feed]: { ...emptyRun(mapping.feed), error: error instanceof Error ? error.message : '미리보기 실패' } })); }
  }

  if (mode === 'loading') return <main className={styles.page}><p className={styles.muted}>설정을 읽는 중…</p></main>;
  if (mode === 'static') return <main className={styles.page}>
    <h1 className={styles.title}>HATCHERY 데이터 소스 관리</h1>
    <p className={styles.notice} data-kind="error">이 배포에는 서버가 없어 관리 기능을 쓸 수 없습니다. <code>npm run dev</code> 또는 <code>npm run start</code>로 실행한 서버에서 여세요. 정적 배포는 <code>public/cinema/data/scenes.json</code>으로 데이터를 받습니다.</p>
  </main>;

  return <main className={styles.page}>
    <header className={styles.header}>
      <div><h1 className={styles.title}>HATCHERY 데이터 소스 관리</h1>
        <p className={styles.muted}>DB 접속 · 피드 매핑 · 실행 상태. 화면은 장면 데이터 계약(<code>docs/database/domain-feeds.md</code>)대로만 데이터를 받습니다.</p></div>
      <div className={styles.actions}>
        <a className={styles.button} href={`${CINEMA_BASE_PATH}/cinema`}>화면으로</a>
        <button type="button" className={styles.button} data-primary onClick={() => void save()} disabled={saving}>{saving ? '저장 중…' : '저장'}</button>
      </div>
    </header>
    {notice && <p className={styles.notice} data-kind={notice.kind}>{notice.text}</p>}

    <section className={styles.section}>
      <h2>1. 데이터 소스</h2>
      {sources.length === 0 && <p className={styles.muted}>등록된 데이터 소스가 없습니다.</p>}
      {sources.map((source, index) => {
        const test = tests[source.id];
        return <div key={index} className={styles.card}>
          <div className={styles.grid}>
            <label>ID<input value={source.id} onChange={event => updateSource(index, { id: event.target.value })} placeholder="mes" /></label>
            <label>이름<input value={source.name} onChange={event => updateSource(index, { name: event.target.value })} /></label>
            <label>Host<input value={source.host} onChange={event => updateSource(index, { host: event.target.value })} /></label>
            <label>Port<input type="number" value={source.port} onChange={event => updateSource(index, { port: Number(event.target.value) })} /></label>
            <label>Service<input value={source.serviceName} onChange={event => updateSource(index, { serviceName: event.target.value })} /></label>
            <label>User<input value={source.user} onChange={event => updateSource(index, { user: event.target.value })} /></label>
            <label>Password<input type="password" value={source.password} autoComplete="new-password" onChange={event => updateSource(index, { password: event.target.value })}
              placeholder={source.hasPassword ? '저장된 비밀번호 유지' : '비밀번호'} /></label>
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.button} onClick={() => void testSource(source)} disabled={test === 'running'}>{test === 'running' ? '연결 중…' : '연결 테스트'}</button>
            <button type="button" className={styles.button} data-danger onClick={() => setSources(list => list.filter((_, i) => i !== index))}>삭제</button>
            {test && test !== 'running' && <span className={styles.result} data-ok={test.ok}>{test.ok ? `연결 성공 · ${test.elapsedMs}ms · Oracle ${test.version}` : `실패 · ${test.error}`}</span>}
          </div>
        </div>;
      })}
      <button type="button" className={styles.button} onClick={() => setSources(list => [...list, emptySource()])}>+ 데이터 소스 추가</button>
    </section>

    <section className={styles.section}>
      <h2>2. 피드 매핑</h2>
      <p className={styles.muted}>피드마다 조회문 하나(SELECT만)와 컬럼 매핑을 둡니다. 헤더 값은 첫 행에서 읽습니다. 미리보기는 50행까지만 가져옵니다.</p>
      {feedList.map(({ feed, mapping }) => {
        const preview = previews[feed.feed];
        return <details key={feed.feed} className={styles.card} open={mapping.enabled}>
          <summary className={styles.summary}>
            <span><strong>{feed.label}</strong> <code>{feed.feed}</code> · {feed.scenes.join(', ')}</span>
            <span className={styles.badge} data-status={feed.status}>{feed.status === 'live' ? '연결 가능' : feed.status === 'partial' ? '일부 연결' : '화면 이관 전'}</span>
          </summary>
          <div className={styles.grid}>
            <label>데이터 소스<select value={mapping.sourceId} onChange={event => updateFeed(feed, { sourceId: event.target.value })}>
              <option value="">선택</option>{sources.map(source => <option key={source.id} value={source.id}>{source.name || source.id}</option>)}</select></label>
            <label>갱신 주기(초)<input type="number" min={5} value={mapping.intervalSeconds} onChange={event => updateFeed(feed, { intervalSeconds: Number(event.target.value) })} /></label>
            <label className={styles.check}><input type="checkbox" checked={mapping.enabled} onChange={event => updateFeed(feed, { enabled: event.target.checked })} /> 활성</label>
          </div>
          <label className={styles.block}>조회문 (SELECT)<textarea rows={5} value={mapping.sql} spellCheck={false} onChange={event => updateFeed(feed, { sql: event.target.value })} /></label>
          <div className={styles.mappings}>
            {feed.header.length > 0 && <table className={styles.table}><caption>헤더 (첫 행)</caption><tbody>
              {feed.header.map(field => <tr key={field.field}><th>{field.label} <code>{field.field}</code>{field.optional ? ' (선택)' : ''}</th>
                <td><input value={mapping.header[field.field] ?? ''} placeholder="컬럼명" onChange={event => updateFeed(feed, { header: { ...mapping.header, [field.field]: event.target.value } })} /></td></tr>)}
            </tbody></table>}
            {feed.objects.map(object => <table key={object.collection} className={styles.table}><caption>{object.label} <code>{object.collection}[]</code></caption><tbody>
              {[{ field: 'id', label: '도메인 코드', optional: false }, { field: 'label', label: '표시 이름', optional: true }, ...object.fields,
                ...Object.entries(object.extra ?? {}).map(([key, extra]) => ({ field: key, label: `${extra.label} (JSON)`, optional: extra.optional }))].map(field =>
                <tr key={field.field}><th>{field.label} <code>{field.field}</code>{field.optional ? ' (선택)' : ''}</th>
                  <td><input value={mapping.collections[object.collection]?.fields[field.field] ?? ''} placeholder="컬럼명"
                    onChange={event => updateFeed(feed, { collections: { ...mapping.collections, [object.collection]: { ...mapping.collections[object.collection], fields: { ...(mapping.collections[object.collection]?.fields ?? {}), [field.field]: event.target.value } } } })} /></td></tr>)}
              {feed.objects.length > 1 && <tr><th>이 컬렉션 전용 조회문 (선택)</th><td><input value={mapping.collections[object.collection]?.sql ?? ''} placeholder="비우면 피드 조회문 사용"
                onChange={event => updateFeed(feed, { collections: { ...mapping.collections, [object.collection]: { fields: mapping.collections[object.collection]?.fields ?? {}, sql: event.target.value } } })} /></td></tr>}
            </tbody></table>)}
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.button} onClick={() => void previewFeed(mapping)} disabled={preview === 'running'}>{preview === 'running' ? '실행 중…' : '미리보기'}</button>
            <button type="button" className={styles.button} onClick={() => updateFeed(feed, mappingTemplate(feed))}>매핑 초기화</button>
          </div>
          {preview && preview !== 'running' && <PreviewResult result={preview} />}
        </details>;
      })}
    </section>

    <section className={styles.section}>
      <h2>3. 실행 상태 <button type="button" className={styles.button} onClick={() => void refreshStatus()}>새로고침</button> {status && <span className={styles.muted}>{status.at}</span>}</h2>
      {!status || status.feeds.length === 0 ? <p className={styles.muted}>활성 피드가 없습니다.</p>
        : <table className={styles.table}><thead><tr><th>피드</th><th>상태</th><th>마지막 실행</th><th>행 수</th><th>다음 실행</th><th>메시지</th></tr></thead><tbody>
          {status.feeds.map(feed => <tr key={feed.feed}><td><code>{feed.feed}</code></td>
            <td><span className={styles.result} data-ok={feed.enabled ? feed.ok : undefined}>{!feed.enabled ? '비활성' : feed.ok ? '정상' : '오류'}</span></td>
            <td>{feed.at ? new Date(feed.at).toLocaleTimeString('ko-KR') : '—'}{feed.elapsedMs !== undefined ? ` (${feed.elapsedMs}ms)` : ''}</td>
            <td>{Object.entries(feed.counts).map(([collection, count]) => `${collection} ${count.kept}/${count.rows}`).join(', ') || '—'}</td>
            <td>{feed.nextAt ? new Date(feed.nextAt).toLocaleTimeString('ko-KR') : '—'}</td>
            <td className={styles.message}>{feed.error ?? feed.issues.slice(0, 3).join(' · ')}</td></tr>)}
        </tbody></table>}
    </section>
  </main>;
}

const emptyRun = (feed: string): FeedRunResult => ({ feed, ok: false, at: new Date().toISOString(), elapsedMs: 0, issues: [], counts: {}, columns: [], sample: [], documents: [] });

function PreviewResult({ result }: { result: FeedRunResult }) {
  return <div className={styles.preview} data-ok={result.ok}>
    <p><strong>{result.ok ? '실행 성공' : '실행 실패'}</strong> · {result.elapsedMs}ms
      {result.ok && <> · {Object.entries(result.counts).map(([collection, count]) => `${collection} ${count.kept}/${count.rows}행`).join(', ')} · 장면 문서 {result.documents.length}건</>}
      {result.error && <> · {result.error}</>}</p>
    {result.columns.length > 0 && <p className={styles.muted}>결과 컬럼: {result.columns.join(', ')}</p>}
    {result.issues.length > 0 && <ul className={styles.issues}>{result.issues.slice(0, 10).map((issue, index) => <li key={index}>{issue}</li>)}{result.issues.length > 10 && <li>… 외 {result.issues.length - 10}건</li>}</ul>}
    {result.sample.length > 0 && <div className={styles.scroll}><table className={styles.table}><thead><tr>{Object.keys(result.sample[0]).map(column => <th key={column}>{column}</th>)}</tr></thead>
      <tbody>{result.sample.map((row, index) => <tr key={index}>{Object.keys(result.sample[0]).map(column => <td key={column}>{String(row[column] ?? '')}</td>)}</tr>)}</tbody></table></div>}
  </div>;
}
