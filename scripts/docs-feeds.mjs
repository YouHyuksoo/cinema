// Regenerates the domain feed contract files (schemas, examples, docs/database/domain-feeds.md)
// by running the golden-file test in update mode. Works the same in cmd, PowerShell and bash.
import { spawnSync } from 'node:child_process';
const result = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['vitest', 'run', 'tests/unit/scenes/cinemaDomainFeeds.test.ts'],
  { stdio: 'inherit', env: { ...process.env, FEED_DOCS_UPDATE: '1' }, shell: process.platform === 'win32' });
process.exit(result.status ?? 1);
