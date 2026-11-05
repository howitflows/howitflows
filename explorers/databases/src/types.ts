import type { Subject } from '@howitflows/engine';

export type Lang = 'native' | 'python' | 'node' | 'go' | 'java' | 'csharp' | 'php';

export type OpId = 'docker' | 'connect' | 'schema' | 'seed' | 'create' | 'read' | 'update' | 'delete';

export type Category = 'Relational' | 'Document' | 'Key-Value' | 'Wide-Column' | 'Graph' | 'Search';

export interface ConnConfig {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
}

export interface DatabaseInfo extends Subject {
  group: Category;
  defaults: ConnConfig;
}

export interface Snippet {
  code: string;
  hl: string; // highlight.js language
  install?: string; // install command
  driver?: string; // driver / client library name
  filename: string;
  notes?: string;
}

export type SnippetResult = Snippet | { unsupported: string };
