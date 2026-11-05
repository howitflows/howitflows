import { useEffect, useMemo, useState } from 'react';
import { highlight, Icon, usePersistent } from '@howitflows/engine';
import type { ConnConfig, DatabaseInfo, Lang, OpId } from './types';
import { generate, isSupported, LANGS, OPS } from './snippets';

type FieldKey = keyof ConnConfig;
const FIELD_LABELS: Record<string, Partial<Record<FieldKey, string | null>>> = {
  sqlite: { host: null, port: null, user: null, password: null, database: 'Database file' },
  redis: { database: 'DB index' },
  cassandra: { database: 'Keyspace' },
  elasticsearch: { database: null },
  dynamodb: { user: 'Access key', password: 'Secret key', database: 'Region' },
};
const DEFAULT_LABELS: Record<FieldKey, string> = { host: 'Host', port: 'Port', user: 'User', password: 'Password', database: 'Database' };

function connString(db: string, c: ConnConfig): { scheme: string; rest: string } {
  const auth = c.user ? `${c.user}:${'•'.repeat(Math.min(c.password.length, 8))}@` : c.password ? `:••••@` : '';
  switch (db) {
    case 'postgres': return { scheme: 'postgresql://', rest: `${auth}${c.host}:${c.port}/${c.database}` };
    case 'mysql': return { scheme: 'mysql://', rest: `${auth}${c.host}:${c.port}/${c.database}` };
    case 'sqlite': return { scheme: 'file:', rest: c.database };
    case 'mssql': return { scheme: 'sqlserver://', rest: `${auth}${c.host}:${c.port};database=${c.database}` };
    case 'mongodb': return { scheme: 'mongodb://', rest: `${auth}${c.host}:${c.port}/${c.database}?authSource=admin` };
    case 'redis': return { scheme: 'redis://', rest: `${auth}${c.host}:${c.port}/${c.database}` };
    case 'cassandra': return { scheme: 'cql://', rest: `${auth}${c.host}:${c.port}/${c.database}` };
    case 'neo4j': return { scheme: 'neo4j://', rest: `${auth}${c.host}:${c.port}  db=${c.database}` };
    case 'elasticsearch': return { scheme: 'http://', rest: `${auth}${c.host}:${c.port}/users` };
    case 'dynamodb': return { scheme: 'http://', rest: `${c.host}:${c.port}  region=${c.database}  table=Users` };
    default: return { scheme: '', rest: '' };
  }
}

const load = <T,>(k: string, fallback: T): T => {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
};
const save = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* storage unavailable */
  }
};

export function SnippetStudio({ db, onToast }: { db: DatabaseInfo; onToast: (m: string) => void }) {
  const [op, setOp] = usePersistent<OpId>('hif.databases.op', 'connect');
  const [lang, setLang] = usePersistent<Lang>('hif.databases.lang', 'python');
  const [cfg, setCfg] = useState<ConnConfig>(db.defaults);

  // loaded after mount so the pre-rendered HTML matches the first client render
  useEffect(() => setCfg(load(`hif.databases.cfg.${db.id}`, db.defaults)), [db.id, db.defaults]);

  const update = (k: FieldKey, v: string) => {
    const next = { ...cfg, [k]: v };
    setCfg(next);
    save(`hif.databases.cfg.${db.id}`, next);
  };

  const result = useMemo(() => generate(db.id, lang, op, cfg), [db.id, lang, op, cfg]);
  const html = useMemo(() => ('code' in result ? highlight(result.code, result.hl) : ''), [result]);
  const lines = 'code' in result ? result.code.replace(/\n$/, '').split('\n').length : 0;
  const opMeta = OPS.find((o) => o.id === op)!;
  const cs = connString(db.id, cfg);
  const labels = { ...DEFAULT_LABELS, ...(FIELD_LABELS[db.id] ?? {}) };

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      onToast(`${what} copied`);
    } catch {
      onToast('Clipboard unavailable');
    }
  };
  const download = () => {
    if (!('code' in result)) return;
    const blob = new Blob([result.code], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = result.filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <section className="card studio" id="studio">
      <div className="studio-h">
        <div>
          <span className="eyebrow">Snippet Studio</span>
          <h2>
            {db.name} <span className="muted">· users</span>
          </h2>
        </div>
        <div className="studio-tabs" role="tablist" aria-label="Language">
          {op !== 'docker' &&
            LANGS.map((l) => {
              const ok = isSupported(db.id, l.id);
              return (
                <button
                  key={l.id}
                  role="tab"
                  aria-selected={l.id === lang}
                  className={`pill ${l.id === lang ? 'ink' : ''} ${ok ? '' : 'off'}`}
                  onClick={() => setLang(l.id)}
                  title={ok ? l.label : `${l.label}: no maintained driver`}
                >
                  {l.label}
                </button>
              );
            })}
        </div>
      </div>

      <div className="studio-body">
        <nav className="ops" aria-label="Operations">
          {OPS.map((o) => (
            <button key={o.id} className={`op ${o.id === op ? 'on' : ''}`} onClick={() => setOp(o.id)}>
              <span className={`verb v-${o.verb}`}>{o.verb}</span>
              <span className="op-text">
                <b>{o.label}</b>
                <small>{o.desc}</small>
              </span>
            </button>
          ))}
        </nav>

        <div className="req">
          <div className="urlbar">
            <span className={`verb v-${opMeta.verb}`}>{opMeta.verb}</span>
            <code>
              <span className="scheme">{cs.scheme}</span>
              {cs.rest}
            </code>
          </div>

          <div className="conn">
            {(Object.keys(DEFAULT_LABELS) as FieldKey[]).map((k) => {
              const label = labels[k];
              return (
                <label className="field" key={k}>
                  <span>{label ?? DEFAULT_LABELS[k]}</span>
                  <input
                    value={label === null ? '' : cfg[k]}
                    disabled={label === null}
                    placeholder={label === null ? 'n/a' : ''}
                    type={k === 'password' ? 'password' : 'text'}
                    onChange={(e) => update(k, e.target.value)}
                    spellCheck={false}
                  />
                </label>
              );
            })}
          </div>

          {'unsupported' in result ? (
            <div className="codecard unsupported">
              <p>{result.unsupported}</p>
              <p className="muted">Pick another language, or use the Native / CLI snippet.</p>
            </div>
          ) : (
            <>
              <div className="meta">
                <span className="muted">
                  Driver <b>{result.driver}</b>
                </span>
                <button
                  className="pill sm"
                  onClick={() => {
                    setCfg(db.defaults);
                    save(`hif.databases.cfg.${db.id}`, db.defaults);
                  }}
                >
                  <Icon name="reset" size={13} /> Reset fields
                </button>
              </div>
              {result.install && (
                <div className="install">
                  <span className="prompt">$</span>
                  <code>{result.install}</code>
                  <button className="round sm" onClick={() => copy(result.install!, 'Install command')} aria-label="Copy install command">
                    <Icon name="copy" size={14} />
                  </button>
                </div>
              )}
              {result.notes && <div className="note">{result.notes}</div>}
              <div className="codecard">
                <div className="codecard-h">
                  <span className="dots" aria-hidden>
                    <i /> <i /> <i />
                  </span>
                  <span className="fname">{result.filename}</span>
                  <span className="code-actions">
                    <button className="cbtn" onClick={download}>
                      <Icon name="download" size={14} /> Download
                    </button>
                    <button className="cbtn accent" onClick={() => copy(result.code, 'Snippet')}>
                      <Icon name="copy" size={14} /> Copy
                    </button>
                  </span>
                </div>
                <div className="code">
                  <div className="gutter" aria-hidden>
                    {Array.from({ length: lines }, (_, i) => i + 1).join('\n')}
                  </div>
                  <pre>
                    <code className="hljs" dangerouslySetInnerHTML={{ __html: html }} />
                  </pre>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
