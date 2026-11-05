import { useRef, useState } from 'react';
import { useIsoLayoutEffect, useReducedMotion } from './store';
import type { FlowRow, Subject, TopoNode } from './types';
import { KIND_LABEL, KIND_VAR } from './theme';
import { ArtDefs, ICON_HUE, NodeArt } from '@howitflows/art';
import { Icon } from './Icons';

const W = 680;
const H = 420;
const ART_DY = -10; // art centre sits slightly above the node anchor
const LABEL_DY = 54; // label pill centre below the anchor
/** fraction of each cycle the packet spends travelling (rest = dwell + arrival ripple) */
const TRAVEL = 0.68;

const curve = (ax: number, ay: number, bx: number, by: number) => {
  const mx = (ax + bx) / 2;
  return `M ${ax} ${ay} C ${mx} ${ay}, ${mx} ${by}, ${bx} ${by}`;
};
const at = (n: TopoNode) => [n.x, n.y + ART_DY] as const;
const pathFor = (a: TopoNode, b: TopoNode) => curve(...at(a), ...at(b));
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

interface Props {
  db: Subject;
  row: FlowRow | null;
  rowIndex: number;
  focus: string | null;
  speed: number;
  playing: boolean;
  onPlay: () => void;
}

export function Topology({ db, row, rowIndex, focus, speed, playing, onPlay }: Props) {
  const motion = !useReducedMotion();
  const wrap = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const [compact, setCompact] = useState(false);

  useIsoLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setCompact(e.contentRect.width < 520));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // restart the packet animation in sync with each new message
  useIsoLayoutEffect(() => {
    svg.current?.querySelectorAll('.sync animate, .sync animateMotion').forEach((a) => {
      try {
        (a as SVGAnimationElement).beginElement();
      } catch {
        /* SMIL unsupported */
      }
    });
  }, [rowIndex, db.id, speed]);

  const pos = Object.fromEntries(db.nodes.map((n) => [n.id, n])) as Record<string, TopoNode>;
  const from = row ? pos[row.from] : null;
  const to = row ? pos[row.to] : null;
  const self = !!row && row.from === row.to;
  const color = row ? KIND_VAR[row.kind] : 'var(--accent)';
  const cycle = `${1.5 / speed}s`;
  const isHot = (a: string, b: string) => !!row && ((row.from === a && row.to === b) || (row.from === b && row.to === a));
  const glowAt = focus ? pos[focus] : null;

  const bubble = row && from && to ? placeBubble(from, to, compact) : null;
  const bubbleStyle = bubble ? { left: `${(bubble.x / W) * 100}%`, top: `${(bubble.y / H) * 100}%`, ['--k' as string]: color, ['--ax' as string]: `${bubble.ax}%` } : undefined;

  return (
    <div className={`topo-wrap ${compact ? 'compact' : ''}`} ref={wrap}>
      <svg ref={svg} className="topo" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${db.name} topology`}>
        <ArtDefs />
        <rect width={W} height={H} fill="url(#dotgrid)" />

        {glowAt && (
          <circle key={glowAt.id} className={motion ? 'topo-glow breathe' : 'topo-glow'} cx={glowAt.x} cy={glowAt.y + ART_DY} r={110} fill={`url(#glow-${ICON_HUE[glowAt.icon]})`} />
        )}

        {/* edges */}
        {db.edges.map(([a, b], i) => {
          const A = pos[a], B = pos[b];
          const hot = isHot(a, b);
          const d = pathFor(A, B);
          return (
            <g key={a + b}>
              {hot && <path d={d} className="topo-edge-glow" style={{ stroke: color }} />}
              <path d={d} className={`topo-edge ${hot ? 'hot' : ''}`} style={hot ? { stroke: color } : undefined} />
              {motion && !hot && (
                <circle r={2.6} className="topo-ambient">
                  <animateMotion dur={`${4 + (i % 3)}s`} begin={`${-i * 1.3}s`} repeatCount="indefinite" path={i % 2 ? pathFor(B, A) : d} />
                </circle>
              )}
            </g>
          );
        })}

        {/* packet (drawn under the nodes, so it emerges from the sender and disappears into the receiver) */}
        {row && from && to && !self && (
          <g className="sync" key={`p-${db.id}-${rowIndex}`}>
            {(motion ? [4, 3, 2, 1, 0] : [0]).map((k) => {
              const lag = k * 0.035;
              return (
                <circle key={k} r={k === 0 ? 7 : 6 - k} fill={color} opacity={k === 0 ? 1 : 0.55 - k * 0.1}>
                  <animateMotion
                    begin="indefinite"
                    dur={cycle}
                    repeatCount="indefinite"
                    path={pathFor(from, to)}
                    keyPoints={k === 0 ? '0;1;1' : '0;0;1;1'}
                    keyTimes={k === 0 ? `0;${TRAVEL};1` : `0;${lag};${TRAVEL + lag};1`}
                    calcMode="spline"
                    keySplines={k === 0 ? '0.45 0 0.25 1; 0 0 1 1' : '0 0 1 1; 0.45 0 0.25 1; 0 0 1 1'}
                  />
                </circle>
              );
            })}
            <circle r={13} fill={color} opacity={0.18}>
              <animateMotion begin="indefinite" dur={cycle} repeatCount="indefinite" path={pathFor(from, to)} keyPoints="0;1;1" keyTimes={`0;${TRAVEL};1`} calcMode="spline" keySplines="0.45 0 0.25 1; 0 0 1 1" />
            </circle>
          </g>
        )}

        {/* nodes */}
        <g key={db.id}>
          {db.nodes.map((n, i) => {
            const sending = row?.from === n.id;
            const receiving = row?.to === n.id;
            const active = sending || receiving;
            const dim = !!row && !active;
            const lw = compact ? Math.max(n.label.length * 9.6 + 30, 90) : Math.max(n.label.length * 7.3, n.sub.length * 6.2) + 32;
            const lh = compact ? 32 : 40;
            return (
              <g key={n.id} transform={`translate(${n.x},${n.y})`} className={`topo-node ${dim ? 'dim' : ''}`}>
                <g className="node-in" style={{ animationDelay: `${i * 70}ms` }}>
                  <g transform={`translate(0,${ART_DY})`}>
                    <g className={motion && active ? 'bob' : ''}>
                      <NodeArt icon={n.icon} active={active} motion={motion} />
                    </g>
                  </g>
                  <g transform={`translate(0,${LABEL_DY})`}>
                    <rect
                      x={-lw / 2}
                      y={-lh / 2}
                      width={lw}
                      height={lh}
                      rx={lh / 2}
                      className="topo-pill"
                      style={active ? { stroke: color, strokeWidth: 2 } : undefined}
                    />
                    <text className="topo-label" textAnchor="middle" y={compact ? 6 : -1}>
                      {clip(n.label, compact ? 16 : 24)}
                    </text>
                    {!compact && (
                      <text className="topo-sub" textAnchor="middle" y={13}>
                        {clip(n.sub, 26)}
                      </text>
                    )}
                  </g>
                </g>
              </g>
            );
          })}
        </g>

        {/* arrival ripple / self-work pulse (above the nodes) */}
        {row && to && (
          <g className="sync" key={`r-${db.id}-${rowIndex}`} transform={`translate(${to.x},${to.y + ART_DY})`} pointerEvents="none">
            {(self ? [0, 0.33, 0.66] : [0]).map((off) => (
              <circle key={off} r={30} fill="none" stroke={color} strokeWidth={2.5} opacity={0}>
                <animate
                  attributeName="r"
                  begin="indefinite"
                  dur={cycle}
                  repeatCount="indefinite"
                  values={self ? '34;34;74' : '34;34;34;76'}
                  keyTimes={self ? `0;${off};1` : `0;${TRAVEL - 0.02};${TRAVEL};1`}
                />
                <animate
                  attributeName="opacity"
                  begin="indefinite"
                  dur={cycle}
                  repeatCount="indefinite"
                  values={self ? '0;0.85;0' : '0;0;0.85;0'}
                  keyTimes={self ? `0;${off};1` : `0;${TRAVEL - 0.02};${TRAVEL};1`}
                />
              </circle>
            ))}
          </g>
        )}
      </svg>

      {row && to && from && (
        <div key={`b-${db.id}-${rowIndex}`} className={`topo-bubble ${bubble?.side}`} style={bubbleStyle} role="status">
          <div className="tb-head">
            <span className="tb-kind">{KIND_LABEL[row.kind]}</span>
            <b>{row.proto}</b>
            <span className="tb-size">{row.size}</span>
          </div>
          <div className="tb-info">{row.info}</div>
          <div className="tb-route">
            {from.label} <Icon name="arrow" size={11} stroke={2.4} /> {self ? 'itself' : to.label}
            <span className="tb-t">{row.t}</span>
          </div>
        </div>
      )}

      {!row && !playing && (
        <button className="topo-hint" onClick={onPlay}>
          <span className="tp-ico">
            <Icon name="play" size={16} stroke={2.4} />
          </span>
          Play the conversation
        </button>
      )}
    </div>
  );
}

/** Put the speech bubble beside the receiver, on the side away from the sender; fall back to above/below. */
const BUBBLE_W = 290; // ≈ max bubble width in viewBox units
function placeBubble(from: TopoNode, to: TopoNode, compact: boolean) {
  const artY = to.y + ART_DY;
  if (!compact) {
    const pref = from.x < to.x - 20 ? 'right' : from.x > to.x + 20 ? 'left' : to.x < W / 2 ? 'right' : 'left';
    if (pref === 'right' && to.x + 58 + BUBBLE_W <= W + 10) return { side: 'right', x: to.x + 58, y: artY, ax: 0 };
    if (pref === 'left' && to.x - 58 - BUBBLE_W >= -10) return { side: 'left', x: to.x - 58, y: artY, ax: 100 };
  }
  const ax = to.x < 150 ? 15 : to.x > W - 150 ? 85 : 50;
  return to.y < 170 ? { side: 'below', x: to.x, y: to.y + LABEL_DY + 26, ax } : { side: 'above', x: to.x, y: artY - 50, ax };
}
