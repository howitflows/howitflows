import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ExplorerConfig, Progress, Subject } from './types';
import { usePersistent, useTheme } from './store';
import { Icon } from './Icons';
import { Logo } from './Logo';
import { Sidebar } from './Sidebar';
import { Inspector } from './Inspector';
import { FlowCanvas } from './FlowCanvas';
import { Topology } from './Topology';
import { FlowTable } from './FlowTable';
import { Timeline } from './Timeline';

type View = 'flow' | 'topology' | 'table';

interface Props<S extends Subject> {
  config: ExplorerConfig<S>;
  /** Subject shown first (the page's own subject, so the pre-rendered HTML matches). */
  initialId: string;
  /** Optional panel under the explorer, e.g. a snippet studio. */
  studio?: (subject: S, toast: (message: string) => void) => ReactNode;
  studioLabel?: string;
}

/**
 * The full explorer app: top bar, subject list, topology / flow / table views with a timeline,
 * inspector and an optional studio. Switching subjects updates the URL without a reload.
 */
export function Explorer<S extends Subject>({ config, initialId, studio, studioLabel = 'Snippets' }: Props<S>) {
  const { subjects, groups, basePath } = config;
  const ns = `hif.${config.id}`;
  const [id, setId] = useState(initialId);
  const db = subjects.find((d) => d.id === id) ?? subjects[0];
  const total = db.flow.length;
  const hueOf = useCallback((g: string) => groups.find((x) => x.name === g)?.hue ?? 'var(--hue-blue)', [groups]);

  const [theme, toggleTheme] = useTheme();
  const [view, setView] = usePersistent<View>('hif.view', 'topology');
  const [progress, setProgress] = usePersistent<Progress>(`${ns}.progress`, {});
  const [group, setGroup] = useState<string>('All');
  const [query, setQuery] = useState('');
  const [revealed, setRevealed] = useState(total);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [mode, setMode] = useState<'overview' | 'step'>('overview');
  const [toast, setToast] = useState<string | null>(null);

  const subjectFromPath = useCallback(() => {
    const seg = location.pathname.replace(/\/+$/, '').split('/').pop() ?? '';
    const hash = location.hash.replace('#', ''); // legacy #postgres links
    return subjects.find((d) => d.id === hash)?.id ?? subjects.find((d) => d.id === seg)?.id;
  }, [subjects]);

  // back/forward and legacy hash links
  useEffect(() => {
    const sync = () => {
      const found = subjectFromPath();
      if (found) setId(found);
    };
    sync();
    window.addEventListener('popstate', sync);
    window.addEventListener('hashchange', sync);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener('hashchange', sync);
    };
  }, [subjectFromPath]);

  // per-group accent, URL and title follow the subject
  useEffect(() => {
    document.documentElement.style.setProperty('--accent', hueOf(db.group));
  }, [db.group, hueOf]);
  useEffect(() => {
    setRevealed(db.flow.length);
    setPlaying(false);
    setMode('overview');
    const path = `${basePath}/${db.id}`;
    if (location.pathname.replace(/\/+$/, '') !== path || location.hash) history.replaceState(null, '', path);
    document.title = `How ${db.name} works · ${config.title} · HowItFlows`;
  }, [db.id, db.name, db.flow.length, basePath, config.title]);

  const mark = useCallback(
    (sid: string, s: 'started' | 'done') =>
      setProgress((p) => (p[sid] === 'done' || p[sid] === s ? p : { ...p, [sid]: s })),
    [setProgress],
  );

  // playback
  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => {
      setRevealed((r) => {
        const n = Math.min(r + 1, total);
        if (n >= total) {
          setPlaying(false);
          mark(db.id, 'done');
        }
        return n;
      });
    }, 1500 / speed);
    return () => clearTimeout(t);
  }, [playing, revealed, speed, total, db.id, mark]);

  const play = () => {
    if (playing) return setPlaying(false);
    mark(db.id, 'started');
    setMode('step');
    if (revealed >= total) setRevealed(1);
    setPlaying(true);
  };
  const jump = (i: number) => {
    setPlaying(false);
    setMode('step');
    mark(db.id, 'started');
    setRevealed(i + 1);
    if (i + 1 === total) mark(db.id, 'done');
  };
  const step = (dir: 1 | -1) => {
    const cur = mode === 'step' ? revealed : 0;
    const n = dir === 1 ? (cur >= total ? 1 : cur + 1) : Math.max(1, cur - 1);
    jump(n - 1);
  };
  const reset = () => {
    setPlaying(false);
    setRevealed(0);
    setMode('step');
  };
  const gotoStep = (s: number) => {
    const idx = db.flow.findIndex((r) => r.step === s);
    if (idx >= 0) jump(idx);
  };
  const showToast = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 1600);
  };
  const pick = (sid: string) => {
    if (sid === db.id) return;
    history.pushState(null, '', `${basePath}/${sid}`);
    setId(sid);
  };

  const curIdx = mode === 'step' && revealed > 0 ? revealed - 1 : -1;
  const curRow = curIdx >= 0 ? db.flow[curIdx] : null;
  const stepNo = curRow ? curRow.step : -1;
  const done = subjects.filter((d) => progress[d.id] === 'done').length;
  const pct = Math.round((done / subjects.length) * 100);

  const list = useMemo(
    () =>
      subjects.filter(
        (d) => (group === 'All' || d.group === group) && (d.name + d.group + d.tagline).toLowerCase().includes(query.toLowerCase()),
      ),
    [subjects, group, query],
  );

  return (
    <div className="app">
      <header className="topbar">
        <Logo section={config.title} />

        <nav className="cats" aria-label="Filter">
          {['All', ...groups.map((g) => g.name)].map((c) => (
            <button
              key={c}
              className={`pill ${group === c ? 'ink' : ''}`}
              onClick={() => {
                setGroup(c);
                if (c !== 'All' && db.group !== c) {
                  const first = subjects.find((d) => d.group === c);
                  if (first) pick(first.id);
                }
              }}
            >
              {c !== 'All' && <i className="cdot" style={{ background: hueOf(c) }} />}
              {c}
            </button>
          ))}
        </nav>

        <div className="top-right">
          <div className="ring" title={`${done} of ${subjects.length} ${config.noun} completed`} style={{ ['--p' as string]: pct }}>
            <span>{pct}%</span>
          </div>
          {studio && (
            <a
              className="pill"
              href="#studio"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById('studio')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              <Icon name="code" size={15} /> {studioLabel}
            </a>
          )}
          <button className="switch" role="switch" aria-checked={theme === 'dark'} aria-label="Dark mode" onClick={toggleTheme}>
            <span className="knob">
              <Icon name={theme === 'dark' ? 'moon' : 'sun'} size={13} stroke={2.2} />
            </span>
          </button>
        </div>
      </header>

      <main className="layout">
        <Sidebar db={db} list={list} noun={config.noun} hueOf={hueOf} progress={progress} query={query} onQuery={setQuery} onPick={pick} onPlay={play} />

        <section className="center card flat">
          <div className="center-h">
            <div className="seg" role="tablist" aria-label="View">
              {(
                [
                  ['topology', 'topo', 'Topology'],
                  ['flow', 'flow', 'Flow'],
                  ['table', 'table', 'Table'],
                ] as const
              ).map(([v, ico, label]) => (
                <button key={v} role="tab" aria-selected={view === v} className={view === v ? 'on' : ''} onClick={() => setView(v)}>
                  <Icon name={ico} size={15} /> {label}
                </button>
              ))}
            </div>
            <div className="legend">
              {(
                [
                  ['connect', 'Connect'],
                  ['auth', 'Auth'],
                  ['query', 'Query'],
                  ['result', 'Result'],
                  ['replication', 'Replication'],
                ] as const
              ).map(([k, l]) => (
                <span key={k}>
                  <i style={{ background: `var(--k-${k})` }} />
                  {l}
                </span>
              ))}
            </div>
          </div>

          <Timeline
            rows={db.flow}
            revealed={revealed}
            current={curIdx}
            playing={playing}
            speed={speed}
            onJump={jump}
            onPlay={play}
            onStep={step}
            onReset={reset}
            onSpeed={() => setSpeed((s) => (s === 1 ? 2 : s === 2 ? 0.5 : 1))}
          />

          <div className="view">
            {view === 'flow' && <FlowCanvas db={db} revealed={revealed} current={curIdx} onSelect={jump} />}
            {view === 'topology' && (
              <Topology db={db} row={curRow} rowIndex={curIdx} focus={curRow ? db.steps[curRow.step].focus : null} speed={speed} playing={playing} onPlay={play} />
            )}
            {view === 'table' && <FlowTable db={db} revealed={revealed} current={curIdx} onSelect={jump} />}
          </div>
        </section>

        <Inspector db={db} row={curRow} stepNo={stepNo} onOverview={() => setMode('overview')} onStep={gotoStep} />
      </main>

      {studio?.(db, showToast)}

      <footer className="footer">
        <a href="/">HowItFlows</a> · the place for visual learners. Message flows are illustrative: sizes and timings are approximate. Review generated code before production use.
      </footer>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
