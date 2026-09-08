import { assertSelectOnly, MAX_FEED_ROWS, type DataSourceConfig } from '@/cinema/feedConfig';
import type { FeedRow } from '@/cinema/feedMapping';

/** node-oracledb thin mode: no Oracle client install, loaded lazily so tests and static builds never touch it. */
async function driver() {
  const imported = await import('oracledb');
  const oracledb = imported.default ?? imported;
  oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
  oracledb.fetchAsString = [oracledb.CLOB, oracledb.NUMBER];
  return oracledb;
}
const dsn = (source: DataSourceConfig) => `${source.host}:${source.port}/${source.serviceName}`;

export interface OracleQueryResult { rows: FeedRow[]; columns: string[]; elapsedMs: number; truncated: boolean }

export async function queryOracle(source: DataSourceConfig, sql: string, maxRows = MAX_FEED_ROWS): Promise<OracleQueryResult> {
  const violation = assertSelectOnly(sql);
  if (violation) throw new Error(violation);
  const oracledb = await driver();
  const started = Date.now();
  const connection = await oracledb.getConnection({ user: source.user, password: source.password, connectString: dsn(source) });
  try {
    const limit = Math.max(1, Math.min(MAX_FEED_ROWS, maxRows));
    const result = await connection.execute<FeedRow>(sql, [], { maxRows: limit + 1 });
    const rows = result.rows ?? [];
    return { rows: rows.slice(0, limit), columns: (result.metaData ?? []).map(column => column.name), elapsedMs: Date.now() - started, truncated: rows.length > limit };
  } finally { await connection.close(); }
}

export async function testOracleSource(source: DataSourceConfig): Promise<{ ok: true; elapsedMs: number; version: string } | { ok: false; error: string }> {
  try {
    const oracledb = await driver();
    const started = Date.now();
    const connection = await oracledb.getConnection({ user: source.user, password: source.password, connectString: dsn(source) });
    try {
      await connection.execute('SELECT 1 FROM DUAL');
      return { ok: true, elapsedMs: Date.now() - started, version: connection.oracleServerVersionString };
    } finally { await connection.close(); }
  } catch (error) { return { ok: false, error: describeOracleError(error) }; }
}

/** Driver messages can include the DSN; keep the Oracle code and text, never the credentials. */
export function describeOracleError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/password[^\s]*/gi, 'password ***').slice(0, 400);
}
