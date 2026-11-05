import { ArtDefs, NodeArt, type ArtIcon } from '@howitflows/art';

/** Static (no JS) animated scene for the hub hero: SMIL keeps it moving without hydration. */
const W = 560;
const H = 380;
const NODES: { id: string; label: string; icon: ArtIcon; x: number; y: number }[] = [
  { id: 'app', label: 'Your app', icon: 'client', x: 90, y: 200 },
  { id: 'broker', label: 'Broker', icon: 'server', x: 290, y: 90 },
  { id: 'store', label: 'Storage', icon: 'disk', x: 290, y: 300 },
  { id: 'cluster', label: 'Replicas', icon: 'cluster', x: 480, y: 200 },
];
const at = (id: string) => NODES.find((n) => n.id === id)!;
const curve = (a: string, b: string) => {
  const A = at(a), B = at(b);
  const ay = A.y - 10, by = B.y - 10;
  const mx = (A.x + B.x) / 2;
  return `M ${A.x} ${ay} C ${mx} ${ay}, ${mx} ${by}, ${B.x} ${by}`;
};
const EDGES: [string, string][] = [
  ['app', 'broker'],
  ['broker', 'store'],
  ['broker', 'cluster'],
  ['store', 'cluster'],
];
const PACKETS: { path: string; color: string; dur: number; begin: number }[] = [
  { path: curve('app', 'broker'), color: 'var(--hue-blue)', dur: 2.4, begin: 0 },
  { path: curve('broker', 'store'), color: 'var(--hue-amber)', dur: 2.4, begin: 0.8 },
  { path: curve('broker', 'cluster'), color: 'var(--hue-coral)', dur: 2.4, begin: 1.6 },
  { path: curve('broker', 'app'), color: 'var(--hue-violet)', dur: 2.4, begin: 1.2 },
];

export default function HeroScene() {
  return (
    <svg className="hero-scene" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Animated diagram of messages flowing between an app, a broker, storage and replicas">
      <ArtDefs />
      <rect width={W} height={H} fill="url(#dotgrid)" rx={28} />
      {EDGES.map(([a, b]) => (
        <path key={a + b} d={curve(a, b)} className="topo-edge" />
      ))}
      {PACKETS.map((p, i) => (
        <g key={i}>
          {[3, 2, 1, 0].map((k) => (
            <circle key={k} r={k === 0 ? 6 : 5 - k} fill={p.color} opacity={k === 0 ? 1 : 0.5 - k * 0.1}>
              <animateMotion dur={`${p.dur}s`} begin={`${p.begin - p.dur + k * 0.06}s`} repeatCount="indefinite" path={p.path} keyPoints="0;1;1" keyTimes="0;0.6;1" calcMode="linear" />
            </circle>
          ))}
        </g>
      ))}
      {NODES.map((n, i) => (
        <g key={n.id} transform={`translate(${n.x},${n.y})`}>
          <g className="node-in" style={{ animationDelay: `${i * 90}ms` }}>
            <g transform="translate(0,-10)">
              <NodeArt icon={n.icon} active={n.id === 'broker'} motion />
            </g>
            <rect x={-46} y={40} width={92} height={28} rx={14} className="topo-pill" />
            <text y={58} textAnchor="middle" className="topo-label">
              {n.label}
            </text>
          </g>
        </g>
      ))}
    </svg>
  );
}
