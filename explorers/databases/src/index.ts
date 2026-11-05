import type { ExplorerConfig } from '@howitflows/engine';
import { CATEGORIES, DATABASES as RAW } from './data';
import type { Category, DatabaseInfo } from './types';

export * from './types';
export { generate, isSupported, LANGS, OPS } from './snippets';

/** Each data model owns a palette hue; it becomes the page accent. */
export const CATEGORY_VAR: Record<Category, string> = {
  Relational: 'var(--hue-blue)',
  Document: 'var(--hue-green)',
  'Key-Value': 'var(--hue-coral)',
  'Wide-Column': 'var(--hue-amber)',
  Graph: 'var(--hue-violet)',
  Search: 'var(--hue-teal)',
};

const GLYPH: Record<string, string> = {
  postgres: 'Pg', mysql: 'My', sqlite: 'SL', mssql: 'MS', mongodb: 'Mg', redis: 'Rd', cassandra: 'Ca', neo4j: 'N4', elasticsearch: 'Es', dynamodb: 'Dy',
};

export const DATABASES: DatabaseInfo[] = RAW.map((d) => ({ ...d, glyph: GLYPH[d.id] }));
export { CATEGORIES };

export const DATABASES_CONFIG: ExplorerConfig<DatabaseInfo> = {
  id: 'databases',
  title: 'Databases',
  basePath: '/databases',
  noun: 'databases',
  groups: CATEGORIES.map((name) => ({ name, hue: CATEGORY_VAR[name] })),
  subjects: DATABASES,
};
