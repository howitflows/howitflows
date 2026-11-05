import type { FlowRow, Subject } from './types';
import { KIND_LABEL, KIND_VAR } from './theme';
import { Icon } from './Icons';

interface Props {
  db: Subject;
  row: FlowRow | null;
  stepNo: number;
  onOverview: () => void;
  onStep: (i: number) => void;
}

export function Inspector({ db, row, stepNo, onOverview, onStep }: Props) {
  const step = row ? db.steps[row.step] : null;
  const label = (id: string) => db.nodes.find((n) => n.id === id)?.label ?? id;

  return (
    <aside className="inspector">
      <section className="card">
        {step && row ? (
          <>
            <div className="card-h">
              <span className="eyebrow">
                Step {stepNo + 1} of {db.steps.length}
              </span>
              <button className="pill sm" onClick={onOverview}>
                Overview
              </button>
            </div>
            <h3 className="title">{step.title}</h3>
            <div className="subtitle">{step.short}</div>
            <p className="prose">{step.detail}</p>
            <div className="msgbox" style={{ ['--k' as string]: KIND_VAR[row.kind] }}>
              <span className="kind-pill">{KIND_LABEL[row.kind]}</span>
              <div className="mono">
                <b>{row.proto}</b> {row.info}
              </div>
              <div className="dir">
                {label(row.from)} <Icon name="arrow" size={12} /> {row.from === row.to ? 'itself' : label(row.to)}
                <span className="mono muted"> · {row.size}</span>
              </div>
            </div>
            <dl className="facts">
              {step.facts.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </>
        ) : (
          <>
            <div className="card-h">
              <span className="eyebrow">Overview</span>
            </div>
            <h3 className="title">{db.full}</h3>
            <p className="prose">{db.description}</p>
            <dl className="facts">
              {db.facts.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </section>

      <section className="card">
        <div className="card-h">
          <span className="eyebrow">Lifecycle</span>
        </div>
        <ol className="stepper">
          {db.steps.map((s, i) => (
            <li key={i}>
              <button className={`${i === stepNo ? 'on' : ''} ${stepNo > i ? 'done' : ''}`} onClick={() => onStep(i)}>
                <span className="sn">{stepNo > i ? <Icon name="check" size={12} stroke={2.6} /> : i + 1}</span>
                <span>
                  <b>{s.title}</b>
                  <small>{s.short}</small>
                </span>
              </button>
            </li>
          ))}
        </ol>
      </section>
    </aside>
  );
}
