import type { ArtIcon, FlowKind } from './types';

/**
 * Palette: one ink colour for structure + six hues used with meaning.
 * Each explorer group owns a hue (it becomes the page accent when one of its subjects is selected);
 * each wire-message kind owns a hue. Values live in CSS variables (@howitflows/brand) so light/dark can tune them.
 */
export const KIND_VAR: Record<FlowKind, string> = {
  connect: 'var(--hue-blue)',
  auth: 'var(--hue-green)',
  query: 'var(--hue-amber)',
  result: 'var(--hue-violet)',
  replication: 'var(--hue-coral)',
};

export const KIND_LABEL: Record<FlowKind, string> = {
  connect: 'Connect',
  auth: 'Auth',
  query: 'Query',
  result: 'Result',
  replication: 'Replication',
};

export const ICON_VAR: Record<ArtIcon, string> = {
  client: 'var(--hue-blue)',
  server: 'var(--accent)',
  pool: 'var(--hue-teal)',
  memory: 'var(--hue-coral)',
  disk: 'var(--hue-amber)',
  replica: 'var(--hue-violet)',
  cluster: 'var(--hue-violet)',
  cloud: 'var(--hue-teal)',
};
