import { ArtDefs, NodeArt } from '@howitflows/art';

/** 404 art: a request leaves your app, the link breaks halfway, and the packet drops into the gap. SMIL, no JS. */
const W = 560;
const H = 300;
const APP = { x: 100, y: 140 };
const SRV = { x: 460, y: 140 };
const GAP_L = 240;
const GAP_R = 320;
const Y = 130;
// the packet rides the wire to the gap, then falls
const PATH = `M ${APP.x + 40} ${Y} L ${GAP_L} ${Y} Q ${GAP_L + 22} ${Y} ${GAP_L + 30} ${Y + 40} L ${GAP_L + 38} ${H - 30}`;

export default function LostScene() {
  return (
    <svg className="lost-scene" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="A request packet leaves your app and falls through a broken link before it reaches the server">
      <ArtDefs />
      <rect width={W} height={H} fill="url(#dotgrid)" rx={28} />
      <path d={`M ${APP.x + 40} ${Y} L ${GAP_L} ${Y}`} className="topo-edge hot" style={{ stroke: 'var(--hue-blue)' }} />
      <path d={`M ${GAP_R} ${Y} L ${SRV.x - 40} ${Y}`} className="topo-edge" />
      {/* the frayed ends of the link */}
      <path d={`M ${GAP_L} ${Y} l 8 -10 M ${GAP_L} ${Y} l 8 10 M ${GAP_R} ${Y} l -8 -10 M ${GAP_R} ${Y} l -8 10`} className="lost-fray" />
      <text x={(GAP_L + GAP_R) / 2} y={Y - 26} textAnchor="middle" className="lost-code">
        404
      </text>
      {[3, 2, 1, 0].map((k) => (
        <circle key={k} r={k === 0 ? 7 : 6 - k} fill="var(--hue-coral)" opacity={k === 0 ? 1 : 0.5 - k * 0.1}>
          <animateMotion dur="3s" begin={`${k * 0.06}s`} repeatCount="indefinite" path={PATH} keyPoints="0;1;1" keyTimes="0;0.7;1" calcMode="spline" keySplines="0.4 0 0.9 0.6;0 0 1 1" />
          <animate attributeName="opacity" values={`${k === 0 ? 1 : 0.5 - k * 0.1};${k === 0 ? 1 : 0.5 - k * 0.1};0;0`} keyTimes="0;0.55;0.7;1" dur="3s" begin={`${k * 0.06}s`} repeatCount="indefinite" />
        </circle>
      ))}
      {[
        { ...APP, icon: 'client' as const, label: 'Your browser', active: true },
        { ...SRV, icon: 'server' as const, label: 'This page', active: false },
      ].map((n) => (
        <g key={n.label} transform={`translate(${n.x},${n.y})`}>
          <g transform="translate(0,-10)">
            <NodeArt icon={n.icon} active={n.active} motion />
          </g>
          <rect x={-52} y={40} width={104} height={28} rx={14} className="topo-pill" />
          <text y={58} textAnchor="middle" className="topo-label">
            {n.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
