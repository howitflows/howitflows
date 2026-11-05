import type { ArtIcon } from '@howitflows/art';

/** 24×24 line icons drawn with currentColor. Usable inside HTML (wrap in <svg>) or nested in SVG via <Glyph>. */
const PATHS: Record<string, string> = {
  client: 'M4 6h16v10H4z M2 19h20 M9 19l1-3h4l1 3',
  server: 'M4 4h16v6H4z M4 14h16v6H4z M8 7h.01 M8 17h.01 M12 7h4 M12 17h4',
  disk: 'M12 3c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3z M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6 M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
  replica: 'M8 8h12v12H8z M4 16V4h12',
  memory: 'M6 6h12v12H6z M9 9h6v6H9z M9 2v4 M15 2v4 M9 18v4 M15 18v4 M2 9h4 M2 15h4 M18 9h4 M18 15h4',
  cloud: 'M7 18h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.1 9.1 4.5 4.5 0 0 0 7 18z',
  cluster: 'M12 3l3 3-3 3-3-3z M5 14l3 3-3 3-3-3z M19 14l3 3-3 3-3-3z M12 9v3 M12 12l-5 3 M12 12l5 3',
  pool: 'M4 7h16 M4 12h16 M4 17h16',
  play: 'M7 4l13 8-13 8z',
  pause: 'M7 4h3v16H7z M14 4h3v16h-3z',
  prev: 'M15 5l-7 7 7 7',
  next: 'M9 5l7 7-7 7',
  reset: 'M4 12a8 8 0 1 0 2.3-5.6 M4 4v5h5',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M12 2v2 M12 20v2 M4.9 4.9l1.4 1.4 M17.7 17.7l1.4 1.4 M2 12h2 M20 12h2 M4.9 19.1l1.4-1.4 M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z M20 20l-4-4',
  copy: 'M9 9h11v11H9z M5 15H4V4h11v1',
  download: 'M12 4v11 M7 10l5 5 5-5 M4 20h16',
  check: 'M5 12l5 5 9-10',
  arrow: 'M5 12h14 M13 6l6 6-6 6',
  flow: 'M5 5h5v5H5z M14 14h5v5h-5z M10 7.5h3a2 2 0 0 1 2 2V14',
  topo: 'M6 6m-2 0a2 2 0 1 0 4 0 2 2 0 1 0-4 0 M18 6m-2 0a2 2 0 1 0 4 0 2 2 0 1 0-4 0 M12 18m-2 0a2 2 0 1 0 4 0 2 2 0 1 0-4 0 M8 6h8 M7 8l4 8 M17 8l-4 8',
  table: 'M4 5h16v14H4z M4 10h16 M4 15h16 M10 5v14',
  code: 'M8 7l-5 5 5 5 M16 7l5 5-5 5',
  book: 'M4 5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2z M4 19V5',
};

export type IconName = keyof typeof PATHS | ArtIcon;

export function Icon({ name, size = 18, stroke = 1.8 }: { name: IconName; size?: number; stroke?: number }) {
  const fill = name === 'play' || name === 'pause';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={PATHS[name]} />
    </svg>
  );
}

/** Same icon, positioned inside an existing SVG. (x, y) is the centre. */
export function Glyph({ name, x, y, size = 18, color = 'currentColor' }: { name: IconName; x: number; y: number; size?: number; color?: string }) {
  const s = size / 24;
  return (
    <g transform={`translate(${x - size / 2},${y - size / 2}) scale(${s})`} fill="none" stroke={color} strokeWidth={1.8 / Math.max(s, 0.6)} strokeLinecap="round" strokeLinejoin="round">
      <path d={PATHS[name]} />
    </g>
  );
}
