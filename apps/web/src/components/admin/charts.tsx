'use client';

import { motion } from 'motion/react';
import { useId, useMemo, useState } from 'react';

const ease = [0.22, 1, 0.36, 1] as const;

export interface Point {
  label: string;
  value: number;
  sub?: string;
}

/** Revenue over time: straight-segment line + faint area, hover tooltip (no smoothing: every point is real data). */
export function AreaChart({ points, format, height = 240 }: { points: Point[]; format: (n: number) => string; height?: number }) {
  const gid = useId().replace(/:/g, '');
  const [hover, setHover] = useState<number | null>(null);
  const W = 720;
  const H = height;

  // Pure geometry from points/height only (not hover): recomputed only when the data actually changes,
  // not on every hover move over the chart.
  const { pad, step, x, y, path, area, ticks, labelIdx } = useMemo(() => {
    const pad = { l: 8, r: 8, t: 16, b: 28 };
    const max = Math.max(1, ...points.map((p) => p.value));
    const step = points.length > 1 ? (W - pad.l - pad.r) / (points.length - 1) : 0;
    const x = (i: number) => pad.l + (points.length > 1 ? i * step : (W - pad.l - pad.r) / 2);
    const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / max);

    const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(p.value)}`).join(' ');
    const area = points.length ? `${path} L ${x(points.length - 1)} ${H - pad.b} L ${x(0)} ${H - pad.b} Z` : '';
    const ticks = [0, 0.5, 1].map((t) => ({ v: max * t, y: y(max * t) }));
    const labelIdx = points.length > 2 ? [0, Math.floor((points.length - 1) / 2), points.length - 1] : points.map((_, i) => i);
    return { pad, step, x, y, path, area, ticks, labelIdx };
  }, [points, H]);

  const active = hover !== null ? points[hover] : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id={`a${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#e0bd7a" stopOpacity="0.16" />
            <stop offset="1" stopColor="#e0bd7a" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`l${gid}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#e0bd7a" />
            <stop offset="1" stopColor="#e0bd7a" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t.v}>
            <line x1={pad.l} x2={W - pad.r} y1={t.y} y2={t.y} stroke="rgba(255,255,255,0.07)" strokeDasharray="4 6" />
          </g>
        ))}
        {points.length > 0 && (
          <>
            <motion.path d={area} fill={`url(#a${gid})`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 0.4 }} />
            <path d={path} fill="none" stroke={`url(#l${gid})`} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
          </>
        )}
        {labelIdx.map((i) => (
          <text key={i} x={x(i)} y={H - 8} textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'} fontSize="11" fill="rgba(245,240,230,0.45)">
            {points[i]?.label}
          </text>
        ))}
        {/* hover columns */}
        {points.map((p, i) => (
          <rect key={i} x={x(i) - Math.max(step, 12) / 2} y={0} width={Math.max(step, 12)} height={H} fill="transparent" onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} />
        ))}
        {hover !== null && (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} stroke="rgba(239,217,168,0.35)" />
            <circle cx={x(hover)} cy={y(points[hover].value)} r="5" fill="#f3dfae" stroke="#0e2648" strokeWidth="2" />
          </g>
        )}
      </svg>
      {active && hover !== null && (
        <div
          className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-xl border border-gold-400/30 bg-navy-950/90 px-3 py-2 text-xs shadow-xl backdrop-blur"
          style={{ left: `${Math.min(88, Math.max(12, (x(hover) / W) * 100))}%` }}
        >
          <p className="text-pearl/50">{active.label}</p>
          <p className="font-semibold text-gold-300">{format(active.value)}</p>
          {active.sub && <p className="text-pearl/50">{active.sub}</p>}
        </div>
      )}
    </div>
  );
}

export interface Slice {
  label: string;
  value: number;
  color: string;
}

export function DonutChart({ slices, center }: { slices: Slice[]; center?: React.ReactNode }) {
  const R = 54;
  const C = 2 * Math.PI * R;
  const total = slices.reduce((n, s) => n + s.value, 0);
  let offset = 0;
  return (
    <div className="relative mx-auto h-44 w-44">
      <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
        <circle cx="70" cy="70" r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="14" />
        {total > 0 &&
          slices.map((s, i) => {
            const len = (s.value / total) * C;
            const el = (
              <motion.circle
                key={s.label}
                cx="70"
                cy="70"
                r={R}
                fill="none"
                stroke={s.color}
                strokeWidth="14"
                strokeDasharray={`${Math.max(len - 2, 0)} ${C}`}
                initial={{ strokeDashoffset: -offset + C }}
                animate={{ strokeDashoffset: -offset }}
                transition={{ duration: 1.1, delay: 0.15 + i * 0.12, ease }}
              />
            );
            offset += len;
            return el;
          })}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{center}</div>
    </div>
  );
}

export function HBars({ rows, format }: { rows: { label: string; value: number; note?: string }[]; format: (n: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-4">
      {rows.map((r, i) => (
        <li key={r.label}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-pearl/80">{r.label}</span>
            <span className="shrink-0 tabular-nums text-pearl/60">
              {format(r.value)}
              {r.note && <span className="ml-2 text-xs text-pearl/35">{r.note}</span>}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
            <motion.div
              className="h-full rounded-full bg-gold-400"
              initial={{ width: 0 }}
              animate={{ width: `${(r.value / max) * 100}%` }}
              transition={{ duration: 0.9, delay: 0.2 + i * 0.07, ease }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Horizontal funnel: each step as a bar relative to the first, with the step-to-step conversion. */
export function Funnel({ steps }: { steps: { label: string; value: number; hint?: string }[] }) {
  const top = Math.max(1, steps[0]?.value ?? 1);
  return (
    <ol className="space-y-3">
      {steps.map((s, i) => {
        const prev = i > 0 ? steps[i - 1].value : null;
        const conv = prev && prev > 0 ? Math.round((s.value / prev) * 100) : null;
        return (
          <li key={s.label}>
            <div className="mb-1 flex items-baseline justify-between text-sm">
              <span className="text-pearl/80">{s.label}</span>
              <span className="tabular-nums text-pearl">
                <strong className="text-lg font-semibold">{s.value.toLocaleString('pt-BR')}</strong>
                {conv !== null && <span className="ml-2 text-xs text-gold-300">{conv}% do passo anterior</span>}
              </span>
            </div>
            <div className="h-9 overflow-hidden rounded-xl bg-white/[0.05]">
              <motion.div
                className="h-full rounded-xl bg-gradient-to-r from-gold-600/80 via-gold-400 to-gold-300"
                style={{ opacity: 1 - i * 0.12 }}
                initial={{ width: 0 }}
                animate={{ width: `${Math.max((s.value / top) * 100, s.value > 0 ? 3 : 0)}%` }}
                transition={{ duration: 1, delay: 0.15 + i * 0.15, ease }}
              />
            </div>
            {s.hint && <p className="mt-1 text-xs text-pearl/40">{s.hint}</p>}
          </li>
        );
      })}
    </ol>
  );
}
