import type { ConnConfig, Lang, OpId } from '../types';

export type QueryOp = Exclude<OpId, 'docker'>;

export interface ApiLang {
  driver: string;
  install: string;
  hl?: string;
  file?: string;
  notes?: string;
  wrap: (c: ConnConfig, body: string, op: QueryOp) => string;
  ops: Record<QueryOp, (c: ConnConfig) => string>;
}
export type ApiDb = Partial<Record<Lang, ApiLang>>;

/** Indent each non-empty line by one Go tab. */
export const goBody = (s: string) =>
  s
    .split('\n')
    .map((l) => (l ? '\t' + l : l))
    .join('\n');
