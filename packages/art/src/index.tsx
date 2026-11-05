/**
 * Flat, softly-shaded artwork for topology nodes. Every piece is drawn around (0,0)
 * in a ~100×84 box and uses the palette gradients defined in <ArtDefs/>.
 * `active` = this node is sending/receiving right now; `motion` = decorative animation allowed.
 */
/** Every node type an explorer can draw. Add a new one here, then draw it below and map it in NodeArt. */
export type ArtIcon = 'client' | 'pool' | 'server' | 'disk' | 'replica' | 'cloud' | 'cluster' | 'memory';

export type Hue = 'blue' | 'green' | 'coral' | 'amber' | 'violet' | 'teal' | 'accent';

export const ICON_HUE: Record<ArtIcon, Hue> = {
  client: 'blue',
  server: 'accent',
  pool: 'teal',
  memory: 'coral',
  disk: 'amber',
  replica: 'violet',
  cluster: 'violet',
  cloud: 'teal',
};

const HUES: Hue[] = ['blue', 'green', 'coral', 'amber', 'violet', 'teal', 'accent'];
const hueVar = (h: Hue) => (h === 'accent' ? 'var(--accent)' : `var(--hue-${h})`);

export function ArtDefs() {
  return (
    <defs>
      {HUES.map((h) => (
        <linearGradient key={h} id={`g-${h}`} x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0" style={{ stopColor: `color-mix(in srgb, ${hueVar(h)} 62%, white)` }} />
          <stop offset="1" style={{ stopColor: hueVar(h) }} />
        </linearGradient>
      ))}
      {HUES.map((h) => (
        <radialGradient key={h} id={`glow-${h}`}>
          <stop offset="0" style={{ stopColor: hueVar(h), stopOpacity: 0.45 }} />
          <stop offset="1" style={{ stopColor: hueVar(h), stopOpacity: 0 }} />
        </radialGradient>
      ))}
      <pattern id="dotgrid" width="22" height="22" patternUnits="userSpaceOnUse">
        <circle cx="1.5" cy="1.5" r="1.3" className="dotgrid-dot" />
      </pattern>
      <filter id="soft" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="6" stdDeviation="6" floodOpacity="0.16" />
      </filter>
    </defs>
  );
}

interface ArtProps {
  hue: Hue;
  active: boolean;
  motion: boolean;
}

const Shadow = ({ y = 40, rx = 40 }: { y?: number; rx?: number }) => <ellipse cx={0} cy={y} rx={rx} ry={6} className="art-shadow" />;

/** Blinking status LED */
function Led({ x, y, delay, active, motion }: { x: number; y: number; delay: number; active: boolean; motion: boolean }) {
  return (
    <circle cx={x} cy={y} r={2.6} fill="#fff">
      {motion && <animate attributeName="opacity" values="1;0.2;1" dur={active ? '0.45s' : '2.4s'} begin={`${delay}s`} repeatCount="indefinite" />}
    </circle>
  );
}

function Server({ hue, active, motion }: ArtProps) {
  return (
    <g>
      <Shadow y={42} rx={42} />
      {[0, 1, 2].map((i) => {
        const y = -38 + i * 26;
        return (
          <g key={i}>
            <rect x={-42} y={y} width={84} height={22} rx={8} fill={`url(#g-${hue})`} />
            <rect x={-42} y={y} width={84} height={22} rx={8} fill="none" stroke="#fff" strokeOpacity={0.22} />
            <Led x={-30} y={y + 11} delay={i * 0.35} active={active} motion={motion} />
            <Led x={-22} y={y + 11} delay={i * 0.35 + 0.2} active={active} motion={motion} />
            {[0, 1, 2, 3].map((k) => (
              <rect key={k} x={6 + k * 8} y={y + 6} width={4} height={10} rx={2} fill="#fff" opacity={0.35} />
            ))}
          </g>
        );
      })}
    </g>
  );
}

function Disk({ hue, active, motion }: ArtProps) {
  return (
    <g>
      <Shadow y={40} rx={40} />
      <path d="M -38 -24 V 26 A 38 12 0 0 0 38 26 V -24" fill={`url(#g-${hue})`} />
      <path d="M -38 -7 A 38 12 0 0 0 38 -7" fill="none" stroke="#fff" strokeOpacity={0.35} strokeWidth={2} />
      <path d="M -38 10 A 38 12 0 0 0 38 10" fill="none" stroke="#fff" strokeOpacity={0.35} strokeWidth={2} />
      <ellipse cx={0} cy={-24} rx={38} ry={12} fill={hueVar(hue)} />
      <ellipse cx={0} cy={-24} rx={38} ry={12} fill="#fff" opacity={0.4} />
      <ellipse cx={0} cy={-24} rx={22} ry={6} fill="#fff" opacity={0.35} />
      {active && motion && (
        <ellipse cx={0} rx={38} ry={12} fill="#fff">
          <animate attributeName="cy" values="26;-24" dur="0.9s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.65;0" dur="0.9s" repeatCount="indefinite" />
        </ellipse>
      )}
      <circle cx={26} cy={2} r={2.6} fill="#fff">
        {motion && <animate attributeName="opacity" values="1;0.2;1" dur={active ? '0.3s' : '2s'} repeatCount="indefinite" />}
      </circle>
    </g>
  );
}

function Laptop({ hue, active, motion }: ArtProps) {
  const lines = [
    { w: 40, c: 'var(--hue-blue)' },
    { w: 28, c: 'var(--hue-green)' },
    { w: 46, c: 'var(--hue-amber)' },
    { w: 22, c: 'var(--hue-violet)' },
  ];
  return (
    <g>
      <Shadow y={34} rx={50} />
      <rect x={-42} y={-42} width={84} height={56} rx={8} fill={`url(#g-${hue})`} />
      <rect x={-37} y={-37} width={74} height={46} rx={5} className="art-screen" />
      {lines.map((l, k) => (
        <rect key={k} x={-31} y={-31 + k * 10} height={5} rx={2.5} fill={l.c} width={l.w}>
          {motion && (
            <animate
              attributeName="width"
              values={`0;${l.w};${l.w};0`}
              keyTimes="0;0.35;0.85;1"
              dur={active ? '1.4s' : '4s'}
              begin={`${k * 0.25}s`}
              repeatCount="indefinite"
            />
          )}
        </rect>
      ))}
      <path d="M -52 16 H 52 L 46 26 H -46 Z" fill={`url(#g-${hue})`} />
      <rect x={-10} y={16} width={20} height={3} rx={1.5} fill="#fff" opacity={0.5} />
    </g>
  );
}

function Chip({ hue, active, motion }: ArtProps) {
  const pins = [-16, -6, 4, 14];
  return (
    <g>
      <Shadow y={42} rx={36} />
      {pins.map((p) => (
        <g key={p} stroke={hueVar(hue)} strokeWidth={3} strokeLinecap="round" opacity={0.7}>
          <line x1={p + 1} y1={-38} x2={p + 1} y2={-30} />
          <line x1={p + 1} y1={30} x2={p + 1} y2={38} />
          <line x1={-38} y1={p + 1} x2={-30} y2={p + 1} />
          <line x1={30} y1={p + 1} x2={38} y2={p + 1} />
        </g>
      ))}
      <rect x={-30} y={-30} width={60} height={60} rx={12} fill={`url(#g-${hue})`} />
      <rect x={-14} y={-14} width={28} height={28} rx={6} fill="#fff" opacity={0.3}>
        {motion && <animate attributeName="opacity" values="0.15;0.55;0.15" dur={active ? '0.5s' : '2.2s'} repeatCount="indefinite" />}
      </rect>
      <text x={0} y={5} textAnchor="middle" className="art-chip-text">
        RAM
      </text>
    </g>
  );
}

function Replica(p: ArtProps) {
  return (
    <g>
      <g transform="translate(12,-10) scale(0.82)" opacity={0.35}>
        <Server {...p} motion={false} />
      </g>
      <g transform="translate(-6,6) scale(0.82)">
        <Server {...p} />
      </g>
    </g>
  );
}

function Cluster({ hue, active, motion }: ArtProps) {
  const pts: [number, number][] = [
    [0, -24],
    [-32, 18],
    [32, 18],
  ];
  const ring = `M ${pts[0][0]} ${pts[0][1]} L ${pts[1][0]} ${pts[1][1]} L ${pts[2][0]} ${pts[2][1]} Z`;
  return (
    <g>
      <Shadow y={42} rx={48} />
      <path d={ring} fill="none" stroke={hueVar(hue)} strokeOpacity={0.45} strokeWidth={2} strokeDasharray="3 4" />
      {motion && (
        <circle r={3.5} fill={hueVar(hue)}>
          <animateMotion dur={active ? '1s' : '3.2s'} repeatCount="indefinite" path={ring} />
        </circle>
      )}
      {pts.map(([x, y], i) => (
        <g key={i} transform={`translate(${x},${y}) scale(0.42)`}>
          <Disk hue={hue} active={active} motion={motion} />
        </g>
      ))}
    </g>
  );
}

function Cloud({ hue, active, motion }: ArtProps) {
  return (
    <g>
      <Shadow y={34} rx={44} />
      <path
        d="M -36 22 Q -54 22 -54 6 Q -54 -12 -34 -12 Q -30 -36 -4 -34 Q 18 -46 32 -24 Q 54 -24 54 0 Q 54 22 34 22 Z"
        fill={`url(#g-${hue})`}
      />
      {[-18, 0, 18].map((x, i) => (
        <circle key={x} cx={x} cy={4} r={4} fill="#fff" opacity={0.85}>
          {motion && <animate attributeName="cy" values="4;-2;4" dur={active ? '0.6s' : '1.8s'} begin={`${i * 0.2}s`} repeatCount="indefinite" />}
        </circle>
      ))}
    </g>
  );
}

export function NodeArt({ icon, active, motion }: { icon: ArtIcon; active: boolean; motion: boolean }) {
  const hue = ICON_HUE[icon];
  const p = { hue, active, motion };
  switch (icon) {
    case 'client':
      return <Laptop {...p} />;
    case 'server':
      return <Server {...p} />;
    case 'disk':
      return <Disk {...p} />;
    case 'memory':
      return <Chip {...p} />;
    case 'replica':
      return <Replica {...p} />;
    case 'cluster':
      return <Cluster {...p} />;
    case 'cloud':
      return <Cloud {...p} />;
    default:
      return <Server {...p} />;
  }
}
