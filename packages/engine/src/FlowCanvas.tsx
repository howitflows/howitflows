import { useEffect, useRef, useState } from 'react';
import { useIsoLayoutEffect } from './store';
import type { Subject } from './types';
import { ICON_VAR, KIND_VAR } from './theme';
import { Icon } from './Icons';

const HEAD = 72;
const GAP = 78;
const CARD_H = 58;
const PAD = 14;

interface Props {
  db: Subject;
  revealed: number;
  current: number; // -1 = overview (nothing selected)
  onSelect: (i: number) => void;
}

/** The wire flow drawn as connected cards: one lane per participant, one card per message. */
export function FlowCanvas({ db, revealed, current, onSelect }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(640);

  useIsoLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (current < 0) return;
    wrap.current?.querySelector(`[data-i="${current}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [current]);

  const lanes = db.nodes;
  const laneW = (w - PAD * 2) / lanes.length;
  // cards may extend past their lane: consecutive cards sit on different rows, so they never collide
  const cardW = Math.min(300, Math.max(220, laneW * 1.6));
  const laneX = (id: string) => PAD + (lanes.findIndex((n) => n.id === id) + 0.5) * laneW;
  const cx = (id: string) => Math.min(Math.max(laneX(id), PAD + cardW / 2), w - PAD - cardW / 2);
  const top = (i: number) => HEAD + i * GAP;
  const height = HEAD + db.flow.length * GAP + 8;

  return (
    <div className="canvas-scroll">
      <div className="canvas" ref={wrap} style={{ height }}>
        <svg className="canvas-svg" width={w} height={height}>
          {lanes.map((n) => (
            <line key={n.id} className="lane-line" x1={laneX(n.id)} x2={laneX(n.id)} y1={HEAD - 10} y2={height} />
          ))}
          {db.flow.slice(0, -1).map((r, i) => {
            const next = db.flow[i + 1];
            const x1 = cx(r.from), y1 = top(i) + CARD_H;
            const x2 = cx(next.from), y2 = top(i + 1);
            const my = (y1 + y2) / 2;
            const lit = i + 1 < revealed;
            return (
              <path
                key={i}
                className={`link ${lit ? 'lit' : ''}`}
                d={`M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`}
                style={lit ? { stroke: KIND_VAR[next.kind] } : undefined}
              />
            );
          })}
        </svg>

        <div className="lane-heads">
          {lanes.map((n) => (
            <div key={n.id} className="lane-head" style={{ left: laneX(n.id), maxWidth: laneW - 6 }}>
              <span className="lane-ico" style={{ color: ICON_VAR[n.icon], background: `color-mix(in srgb, ${ICON_VAR[n.icon]} 14%, transparent)` }}>
                <Icon name={n.icon} size={15} />
              </span>
              <span className="lane-name">{n.label}</span>
            </div>
          ))}
        </div>

        {db.flow.map((r, i) => {
          const state = i === current ? 'current' : i < revealed ? 'past' : 'future';
          const to = lanes.find((n) => n.id === r.to)!;
          return (
            <button
              key={`${db.id}-${i}`}
              data-i={i}
              className={`msg ${state}`}
              style={{ left: cx(r.from) - cardW / 2, top: top(i), width: cardW, ['--k' as string]: KIND_VAR[r.kind] }}
              onClick={() => onSelect(i)}
              title={`${r.proto} — ${r.info}`}
            >
              <span className="msg-no">{i + 1}</span>
              <span className="msg-body">
                <span className="msg-title">
                  {r.proto}
                  <span className="msg-to">
                    <Icon name="arrow" size={11} stroke={2.2} /> {r.from === r.to ? 'self' : to.label}
                  </span>
                </span>
                <span className="msg-info">{r.info}</span>
              </span>
              <span className="msg-t">{r.t.replace('s', '')}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
