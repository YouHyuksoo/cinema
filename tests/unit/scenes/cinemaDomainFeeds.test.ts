import { describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { DOMAIN_FEEDS, domainFeed, feedExample, feedJsonSchema, feedsMarkdown } from '@/cinema/domainFeeds';
import { DEFAULT_FILM_SCENE_DATA } from '@/cinema/filmSceneData';
import { FILM_CHAPTERS } from '@/cinema/filmProgram';
import { validateSceneObjectFields } from '@/cinema/sceneField';

const root = join(__dirname, '..', '..', '..');
const schemaDir = join(root, 'public', 'cinema', 'data', 'schemas');
const docPath = join(root, 'docs', 'database', 'domain-feeds.md');
const update = process.env.FEED_DOCS_UPDATE === '1';
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

describe('domain feed declarations', () => {
  it('declares nine feeds with unique collections and covers every chapter at least once', () => {
    expect(DOMAIN_FEEDS.map(feed => feed.feed)).toEqual(['production', 'equipment', 'process', 'environment', 'quality', 'energy', 'workOrder', 'inspection', 'machine']);
    for (const feed of DOMAIN_FEEDS) {
      const collections = feed.objects.map(object => object.collection);
      expect(new Set(collections).size).toBe(collections.length);
      expect(feed.scenes.length).toBeGreaterThan(0);
    }
    const covered = new Set(DOMAIN_FEEDS.flatMap(feed => feed.scenes));
    expect(FILM_CHAPTERS.map(chapter => chapter.id).filter(id => !covered.has(id))).toEqual([]);
  });

  it('produces examples that satisfy their own header and object descriptors', () => {
    for (const feed of DOMAIN_FEEDS) {
      const data = feed.example(DEFAULT_FILM_SCENE_DATA);
      const header = validateSceneObjectFields(feed.header, data, { required: true });
      expect(header, `${feed.feed} header: ${!header.ok ? header.reason : ''}`).toEqual({ ok: true });
      for (const object of feed.objects) {
        const items = data[object.collection];
        expect(Array.isArray(items), `${feed.feed}.${object.collection} is an array`).toBe(true);
        for (const item of items as unknown[]) {
          expect(record(item) && typeof item.id === 'string' && typeof item.label === 'string', `${feed.feed}.${object.collection} item has id/label`).toBe(true);
          const result = validateSceneObjectFields(object.fields, item as Record<string, unknown>, { required: true });
          expect(result, `${feed.feed}.${object.collection} ${JSON.stringify(item).slice(0, 80)}: ${!result.ok ? result.reason : ''}`).toEqual({ ok: true });
        }
        const ids = (items as { id: string }[]).map(item => item.id);
        expect(new Set(ids).size, `${feed.feed}.${object.collection} ids unique`).toBe(ids.length);
      }
    }
  });

  it('builds JSON Schemas with required columns, ranges and nested structures', () => {
    const production = feedJsonSchema(domainFeed('production')!) as { properties: Record<string, { items?: { required: string[]; properties: Record<string, Record<string, unknown>> } }>; required: string[] };
    expect(production.required).toEqual(['unit', 'target', 'lines']);
    expect(production.properties.lines.items!.required).toEqual(['id', 'label', 'value']);
    expect(production.properties.lines.items!.properties.value).toMatchObject({ type: 'number', minimum: 0 });
    const environment = feedJsonSchema(domainFeed('environment')!) as { properties: Record<string, { items?: { required: string[]; properties: Record<string, Record<string, unknown>> } }> };
    expect(environment.properties.zones.items!.properties.humidity).toMatchObject({ maximum: 100 });
    expect(environment.properties.zones.items!.required).toContain('temperatureRange');
    expect(environment.properties.zones.items!.required).not.toContain('temperatureHistory');
    const quality = feedJsonSchema(domainFeed('quality')!) as { properties: Record<string, { items?: { properties: Record<string, Record<string, unknown>> } }> };
    expect(quality.properties.subgroups.items!.properties.values).toMatchObject({ type: 'array', minItems: 1 });
  });

  it('keeps the generated schemas, examples and the database doc in sync with the declarations', () => {
    const generated = new Map<string, string>();
    for (const feed of DOMAIN_FEEDS) {
      generated.set(join(schemaDir, `${feed.feed}.schema.json`), JSON.stringify(feedJsonSchema(feed), null, 2) + '\n');
      generated.set(join(schemaDir, `${feed.feed}.example.json`), JSON.stringify(feedExample(feed), null, 2) + '\n');
    }
    const stamp = update ? execSync('git rev-parse --short HEAD', { cwd: root }).toString().trim()
      : (existsSync(docPath) ? readFileSync(docPath, 'utf8').match(/^verifiedCommit: (\S+)$/m)?.[1] : undefined) ?? 'unstamped';
    generated.set(docPath, feedsMarkdown(stamp) + '\n');
    if (update) {
      mkdirSync(schemaDir, { recursive: true }); mkdirSync(join(root, 'docs', 'database'), { recursive: true });
      for (const [path, content] of generated) writeFileSync(path, content);
    }
    const stale = [...generated].filter(([path, content]) => !existsSync(path) || readFileSync(path, 'utf8').replace(/\r\n/g, '\n') !== content);
    expect(stale.map(([path]) => path.replace(root, '')), 'run `npm run docs:feeds` to regenerate').toEqual([]);
  });
});
