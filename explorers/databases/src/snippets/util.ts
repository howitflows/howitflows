import type { Lang } from '../types';

export type Val = string | number;

export const indent = (s: string, n: number) => {
  const pad = ' '.repeat(n);
  return s
    .split('\n')
    .map((l) => (l.trim() ? pad + l : l))
    .join('\n');
};

/** Literal for a scalar value in the given language. */
export const lit = (lang: Lang, v: Val): string => {
  if (typeof v === 'number') return String(v);
  if (lang === 'php' || lang === 'node' || lang === 'native') return `'${v.replace(/'/g, "\\'")}'`;
  return JSON.stringify(v);
};

/** Embeds a (possibly multi-line) query string into source code. `ind` is the indentation of the line it lands on. */
export const strBlock = (lang: Lang, text: string, ind: number): string => {
  const multi = text.includes('\n');
  const pad = ' '.repeat(ind);
  switch (lang) {
    case 'python':
      return multi ? `"""\n${indent(text, ind + 4)}\n${pad}"""` : JSON.stringify(text);
    case 'node':
      return multi || text.includes("'") ? `\`\n${indent(text, ind + 2)}\n${pad}\`` : `'${text}'`;
    case 'go':
      // `ind` is a tab depth for Go
      return multi
        ? '`\n' + text.split('\n').map((l) => '\t'.repeat(ind + 1) + l).join('\n') + '`'
        : '`' + text + '`';
    case 'java':
      return multi ? `"""\n${indent(text, ind + 8)}\n${' '.repeat(ind + 8)}"""` : JSON.stringify(text);
    case 'csharp':
      return multi ? `"""\n${indent(text, ind + 4)}\n${' '.repeat(ind + 4)}"""` : JSON.stringify(text);
    case 'php':
      return multi || text.includes("'") ? `<<<'Q'\n${indent(text, ind + 4)}\n${' '.repeat(ind + 4)}Q` : `'${text}'`;
    default:
      return text;
  }
};

export const SAMPLE_USERS = [
  { name: 'Ada Lovelace', email: 'ada@example.com', age: 36 },
  { name: 'Alan Turing', email: 'alan@example.com', age: 41 },
  { name: 'Grace Hopper', email: 'grace@example.com', age: 85 },
  { name: 'Linus Torvalds', email: 'linus@example.com', age: 54 },
];

export const NEW_USER = { name: 'Margaret Hamilton', email: 'margaret@example.com', age: 37 };
export const READ_MIN_AGE = 40;
export const UPDATE_USER = { email: 'ada@example.com', age: 37 };
export const DELETE_EMAIL = 'alan@example.com';

// ---------------------------------------------------------------- object literals per language

type Obj = string | number | boolean | Obj[] | { [k: string]: Obj };

const isIdent = (k: string) => /^[A-Za-z_$][\w$]*$/.test(k);

/** Render a plain JSON-ish value as a literal in the target language (multi-line, 2/4-space indents). */
export function objLit(lang: 'python' | 'node' | 'php' | 'go' | 'json', v: Obj, ind = 0): string {
  const step = lang === 'node' || lang === 'json' ? 2 : 4;
  const pad = (n: number) => (lang === 'go' ? '\t'.repeat(n / step) : ' '.repeat(n));
  const str = (s: string) => (lang === 'node' || lang === 'php' ? `'${s.replace(/'/g, "\\'")}'` : JSON.stringify(s));
  const rec = (x: Obj, d: number): string => {
    if (typeof x === 'string') return str(x);
    if (typeof x === 'number') return String(x);
    if (typeof x === 'boolean') return lang === 'python' ? (x ? 'True' : 'False') : String(x);
    const inner = d + step;
    if (Array.isArray(x)) {
      const simple = x.every((e) => typeof e !== 'object');
      const open = lang === 'go' ? 'bson.A{' : '[';
      const close = lang === 'go' ? '}' : ']';
      if (simple) return open + x.map((e) => rec(e, inner)).join(', ') + close;
      return `${open}\n${x.map((e) => pad(inner) + rec(e, inner)).join(',\n')}${lang === 'json' ? '' : ','}\n${pad(d)}${close}`;
    }
    const entries = Object.entries(x);
    const key = (k: string) =>
      lang === 'node' ? (isIdent(k) ? k : `'${k}'`) : lang === 'php' ? `'${k}' => ` : JSON.stringify(k);
    const sep = lang === 'php' ? '' : ': ';
    const open = lang === 'go' ? 'bson.M{' : lang === 'php' ? '[' : '{';
    const close = lang === 'php' ? ']' : '}';
    const oneLine = entries.every(([, e]) => typeof e !== 'object') && entries.length <= 4;
    if (oneLine) {
      const body = entries.map(([k, e]) => key(k) + sep + rec(e, inner)).join(', ');
      return lang === 'node' ? `{ ${body} }` : open + body + close;
    }
    return `${open}\n${entries.map(([k, e]) => pad(inner) + key(k) + sep + rec(e, inner)).join(',\n')}${lang === 'json' ? '' : ','}\n${pad(d)}${close}`;
  };
  return rec(v, ind);
}

/** Build a Go import block, keeping only packages whose identifier is used in `code`. */
export function goImports(code: string, std: string[], third: string[] = []): string {
  const used = (p: string) => {
    const m = p.match(/^(\w+) (.+)$/);
    const name = m ? m[1] : p.split('/').filter((s) => !/^v\d+$/.test(s)).pop()!;
    return new RegExp('\\b' + name + '\\.').test(code);
  };
  const fmtP = (p: string) => {
    const m = p.match(/^(\w+) (.+)$/);
    return m ? `\t${m[1]} "${m[2]}"` : `\t"${p}"`;
  };
  const s = std.filter(used).map(fmtP);
  const t = third.filter(used).map(fmtP);
  return `import (\n${s.join('\n')}${s.length && t.length ? '\n\n' : ''}${t.join('\n')}\n)`;
}
