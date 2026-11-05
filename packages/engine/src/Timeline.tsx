import type { FlowRow } from './types';
import { KIND_VAR } from './theme';
import { Icon } from './Icons';

interface Props {
  rows: FlowRow[];
  revealed: number;
  current: number;
  playing: boolean;
  speed: number;
  onJump: (i: number) => void;
  onPlay: () => void;
  onStep: (d: 1 | -1) => void;
  onReset: () => void;
  onSpeed: () => void;
}

export function Timeline({ rows, revealed, current, playing, speed, onJump, onPlay, onStep, onReset, onSpeed }: Props) {
  const n = rows.length;
  const pct = (i: number) => (n <= 1 ? 50 : (i / (n - 1)) * 100);
  return (
    <div className="timeline">
      <div className="tl-ctrl">
        <button className="round" onClick={() => onStep(-1)} disabled={revealed <= 1} aria-label="Previous message">
          <Icon name="prev" size={16} />
        </button>
        <button className="round ink big" onClick={onPlay} aria-label={playing ? 'Pause' : 'Play'}>
          <Icon name={playing ? 'pause' : 'play'} size={15} />
        </button>
        <button className="round" onClick={() => onStep(1)} aria-label="Next message">
          <Icon name="next" size={16} />
        </button>
      </div>

      <div className="tl-track" role="slider" aria-valuemin={0} aria-valuemax={n} aria-valuenow={revealed} aria-label="Message timeline">
        <div className="tl-rail" />
        <div className="tl-fill" style={{ width: `${revealed <= 0 ? 0 : pct(revealed - 1)}%` }} />
        {rows.map((r, i) => (
          <button
            key={i}
            className={`tl-tick ${i < revealed ? 'on' : ''} ${i === current ? 'cur' : ''}`}
            style={{ left: `${pct(i)}%`, ['--k' as string]: KIND_VAR[r.kind] }}
            onClick={() => onJump(i)}
            title={`${i + 1}. ${r.proto} — ${r.info}`}
          >
            {i === current && <span className="tl-bubble">{r.t}</span>}
          </button>
        ))}
      </div>

      <div className="tl-ctrl">
        <button className="pill sm" onClick={onSpeed} title="Playback speed">
          {speed}×
        </button>
        <button className="round" onClick={onReset} aria-label="Reset">
          <Icon name="reset" size={15} />
        </button>
      </div>
    </div>
  );
}
