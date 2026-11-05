import type { Subject } from './types';
import { KIND_VAR } from './theme';

export function FlowTable({ db, revealed, current, onSelect }: { db: Subject; revealed: number; current: number; onSelect: (i: number) => void }) {
  const label = (id: string) => db.nodes.find((n) => n.id === id)?.label ?? id;
  return (
    <div className="ftable-wrap">
      <table className="ftable">
        <thead>
          <tr>
            <th>#</th>
            <th>Time</th>
            <th>Source</th>
            <th>Destination</th>
            <th>Protocol</th>
            <th>Info</th>
            <th>Size</th>
          </tr>
        </thead>
        <tbody>
          {db.flow.map((r, i) => (
            <tr key={i} className={`${i === current ? 'cur' : ''} ${i >= revealed ? 'future' : ''}`} onClick={() => onSelect(i)}>
              <td>
                <span className="dotnum" style={{ background: KIND_VAR[r.kind] }}>
                  {i + 1}
                </span>
              </td>
              <td className="mono">{r.t}</td>
              <td>{label(r.from)}</td>
              <td>{label(r.to)}</td>
              <td>
                <span className="kind-pill" style={{ ['--k' as string]: KIND_VAR[r.kind] }}>
                  {r.proto}
                </span>
              </td>
              <td className="info mono">{r.info}</td>
              <td className="mono">{r.size}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
