import type { Progress, Subject } from './types';
import { Icon } from './Icons';

export type { Progress };

interface Props {
  db: Subject;
  list: Subject[];
  noun: string;
  hueOf: (group: string) => string;
  progress: Progress;
  query: string;
  onQuery: (q: string) => void;
  onPick: (id: string) => void;
  onPlay: () => void;
}

export function Sidebar({ db, list, noun, hueOf, progress, query, onQuery, onPick, onPlay }: Props) {
  return (
    <aside className="sidebar">
      <div className="hero">
        <span className="hero-chip">
          <i style={{ background: hueOf(db.group) }} />
          {db.group}
        </span>
        <h2>{db.name}</h2>
        <p>{db.tagline}</p>
        <div className="hero-foot">
          <span>
            {db.steps.length} steps · {db.flow.length} messages
          </span>
          <button className="round light" onClick={onPlay} aria-label={`Play the ${db.name} flow`}>
            <Icon name="play" size={14} />
          </button>
        </div>
      </div>

      <label className="search">
        <Icon name="search" size={16} />
        <input placeholder={`Search ${noun}`} value={query} onChange={(e) => onQuery(e.target.value)} />
      </label>

      <div className="dblist" role="list">
        {list.map((d) => {
          const s = progress[d.id];
          return (
            <button key={d.id} role="listitem" className={`dbrow ${d.id === db.id ? 'on' : ''}`} onClick={() => onPick(d.id)}>
              <span className="avatar" style={{ background: d.color }}>
                {d.glyph ?? d.name.slice(0, 2)}
              </span>
              <span className="dbrow-text">
                <b>{d.name}</b>
                <small>
                  <i style={{ background: hueOf(d.group) }} /> {d.group}
                </small>
              </span>
              <span className={`bubble ${s ?? ''}`} title={s === 'done' ? 'Completed' : s === 'started' ? 'In progress' : `${d.flow.length} messages`}>
                {s === 'done' ? <Icon name="check" size={13} stroke={2.6} /> : d.flow.length}
              </span>
            </button>
          );
        })}
        {list.length === 0 && <div className="muted pad">No match.</div>}
      </div>
    </aside>
  );
}
