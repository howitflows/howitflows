import type { ArtIcon } from '@howitflows/art';

export type { ArtIcon };

/** Kind of message on the wire. Each kind owns a palette hue (see theme.ts). */
export type FlowKind = 'connect' | 'auth' | 'query' | 'result' | 'replication';

/** A participant in the topology. x/y are in a 680×420 canvas. */
export interface TopoNode {
  id: string;
  label: string;
  sub: string;
  icon: ArtIcon;
  x: number;
  y: number;
}

/** One message in the flow. */
export interface FlowRow {
  t: string; // time e.g. 0.000s
  from: string; // node id
  to: string; // node id
  kind: FlowKind;
  proto: string;
  info: string;
  size: string;
  step: number; // index into steps
}

export interface LifecycleStep {
  title: string;
  short: string;
  detail: string;
  facts: [string, string][];
  focus: string; // node id to highlight
}

/** One thing an explorer explains: a database, a broker, a cloud request… */
export interface Subject {
  id: string;
  name: string;
  full: string;
  /** Group used for filtering and the accent colour (e.g. "Relational"). Must match a GroupDef name. */
  group: string;
  tagline: string;
  description: string;
  /** Avatar background colour. */
  color: string;
  /** Two-letter avatar text. Defaults to the first two letters of the name. */
  glyph?: string;
  facts: [string, string][];
  nodes: TopoNode[];
  edges: [string, string][];
  steps: LifecycleStep[];
  flow: FlowRow[];
}

export interface GroupDef {
  name: string;
  /** CSS colour, usually a palette variable like var(--hue-green). */
  hue: string;
}

/** Everything the engine needs to render one explorer. */
export interface ExplorerConfig<S extends Subject = Subject> {
  /** Route segment and storage namespace, e.g. "databases". */
  id: string;
  /** Section title, e.g. "Databases". */
  title: string;
  /** e.g. "/databases"; each subject lives at `${basePath}/${subject.id}`. */
  basePath: string;
  /** Plural noun for the search box, e.g. "databases". */
  noun: string;
  groups: GroupDef[];
  subjects: S[];
}

export type Progress = Record<string, 'started' | 'done'>;
