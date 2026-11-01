import React, { useEffect, useRef, useState } from 'react';
import { cx } from './kit';

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(600);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(e => setW(Math.max(260, e[0].contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

const niceMax = (v: number) => {
  if (v <= 0) return 100;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
};
const short = (v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toLocaleString('fr-BE', { maximumFractionDigits: 1 })}k` : Math.round(v).toLocaleString('fr-BE'));

export interface Series { key: string; label: string; color: string; type: 'bar' | 'line' }

export function ComboChart({ labels, series, data, format, height = 260 }: { labels: string[]; series: Series[]; data: Record<string, number[]>; format: (n: number) => string; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 44, r: 12, t: 12, b: 28 };
  const iw = width - pad.l - pad.r;
  const ih = height - pad.t - pad.b;
  const all = series.flatMap(s => data[s.key] || []);
  const maxV = niceMax(Math.max(0, ...all));
  const minV = Math.min(0, ...all);
  const range = maxV - minV || 1;
  const y = (v: number) => pad.t + ih - ((v - minV) / range) * ih;
  const n = labels.length;
  const band = iw / Math.max(1, n);
  const bars = series.filter(s => s.type === 'bar');
  const bw = Math.min(18, (band * 0.7) / Math.max(1, bars.length));
  const ticks = 4;
  const step = Math.max(1, Math.ceil(n / Math.floor(iw / 52)));

  return (
    <div ref={ref} className="relative w-full select-none">
      <svg width={width} height={height} role="img" aria-label="Graphique des revenus" onMouseLeave={() => setHover(null)}>
        {Array.from({ length: ticks + 1 }, (_, i) => {
          const v = minV + (range * i) / ticks;
          return (
            <g key={i}>
              <line x1={pad.l} x2={width - pad.r} y1={y(v)} y2={y(v)} stroke="var(--wp-line)" strokeDasharray={i === 0 ? undefined : '3 4'} />
              <text x={pad.l - 8} y={y(v) + 4} textAnchor="end" fontSize="10" fill="var(--wp-faint)">{short(v)}</text>
            </g>
          );
        })}
        {labels.map((lab, i) => {
          const cxp = pad.l + band * i + band / 2;
          return (
            <g key={lab + i}>
              {hover === i && <rect x={pad.l + band * i} y={pad.t} width={band} height={ih} fill="var(--wp-surface-3)" opacity=".6" rx="6" />}
              {bars.map((s, k) => {
                const v = data[s.key]?.[i] ?? 0;
                const x = cxp - (bars.length * bw) / 2 + k * bw + 1;
                const top = y(Math.max(0, v));
                const h = Math.abs(y(v) - y(0));
                return <rect key={s.key} x={x} y={top} width={bw - 2} height={Math.max(h, v ? 1.5 : 0)} rx="3" fill={s.color} opacity={hover === null || hover === i ? 1 : 0.55} style={{ transition: 'opacity .15s' }} />;
              })}
              {i % step === 0 && <text x={cxp} y={height - 8} textAnchor="middle" fontSize="10" fill="var(--wp-faint)">{lab}</text>}
              <rect x={pad.l + band * i} y={pad.t} width={band} height={ih} fill="transparent" onMouseEnter={() => setHover(i)} onClick={() => setHover(i)} />
            </g>
          );
        })}
        {series.filter(s => s.type === 'line').map(s => {
          const pts = (data[s.key] || []).map((v, i) => [pad.l + band * i + band / 2, y(v)] as const);
          const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join(' ');
          return (
            <g key={s.key} pointerEvents="none">
              <path d={d} fill="none" stroke={s.color} strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" />
              {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={hover === i ? 4.5 : 2.5} fill="var(--wp-surface)" stroke={s.color} strokeWidth="2" />)}
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div className="anim-fade pointer-events-none absolute top-2 z-10 min-w-[160px] rounded-xl border border-line bg-surface-3 px-3 py-2 text-xs shadow-xl"
          style={{ left: Math.min(Math.max(pad.l + band * hover + band / 2 - 80, 0), width - 170) }}>
          <p className="mb-1 font-semibold text-ink">{labels[hover]}</p>
          {series.map(s => (
            <p key={s.key} className="flex items-center justify-between gap-3 text-muted">
              <span className="flex items-center gap-1.5"><i className="inline-block h-2 w-2 rounded-full" style={{ background: s.color }} />{s.label}</span>
              <span className="tnum font-medium text-ink">{format(data[s.key]?.[hover] ?? 0)}</span>
            </p>
          ))}
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-4 pl-11 text-xs text-muted">
        {series.map(s => <span key={s.key} className="flex items-center gap-1.5"><i className={cx('inline-block', s.type === 'line' ? 'h-0.5 w-3' : 'h-2.5 w-2.5 rounded-sm')} style={{ background: s.color }} />{s.label}</span>)}
      </div>
    </div>
  );
}

export function Donut({ items, center, sub }: { items: { label: string; value: number; color: string }[]; center: React.ReactNode; sub?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const total = items.reduce((s, i) => s + i.value, 0);
  const r = 52, c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <div className="relative h-[150px] w-[150px] shrink-0">
        <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
          <circle cx="70" cy="70" r={r} fill="none" stroke="var(--wp-surface-3)" strokeWidth="14" />
          {total > 0 && items.map((it, i) => {
            const len = (it.value / total) * c;
            const el = <circle key={i} cx="70" cy="70" r={r} fill="none" stroke={it.color} strokeWidth={hover === i ? 17 : 14}
              strokeDasharray={`${Math.max(0, len - 2)} ${c}`} strokeDashoffset={-acc} style={{ transition: 'stroke-width .15s' }}
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />;
            acc += len;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="tnum text-xl font-semibold text-ink">{hover !== null ? items[hover].value : center}</span>
          <span className="text-[11px] text-muted">{hover !== null ? items[hover].label : sub}</span>
        </div>
      </div>
      <ul className="w-full space-y-1.5 text-sm">
        {items.map((it, i) => (
          <li key={it.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} className={cx('flex items-center justify-between rounded-lg px-2 py-1 transition', hover === i && 'bg-surface-2')}>
            <span className="flex items-center gap-2 text-muted"><i className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: it.color }} />{it.label}</span>
            <span className="tnum font-medium text-ink">{it.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Bar({ value, max, color = 'var(--wp-accent)' }: { value: number; max: number; color?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${max > 0 ? Math.min(100, (value / max) * 100) : 0}%`, background: color }} />
    </div>
  );
}
