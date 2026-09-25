'use client';

import { useEffect, useRef } from 'react';

interface Shard {
  x: number;
  y: number;
  size: number;
  rot: number;
  vr: number;
  vx: number;
  vy: number;
  depth: number; // 0..1: parallax strength and opacity
  gold: boolean;
}

/**
 * Quiet animated backdrop for the admin: slow drifting crystal shards with pointer parallax.
 * Plain 2D canvas (no WebGL) so it costs almost nothing; pauses when the tab is hidden and
 * respects prefers-reduced-motion.
 */
export function CrystalField({ count = 18 }: { count?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let w = 0;
    let h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    const shards: Shard[] = Array.from({ length: count }, () => ({
      x: rnd(0, 1),
      y: rnd(0, 1),
      size: rnd(26, 110),
      rot: rnd(0, Math.PI * 2),
      vr: rnd(-0.06, 0.06),
      vx: rnd(-0.004, 0.004),
      vy: rnd(-0.006, 0.002),
      depth: rnd(0.15, 1),
      gold: Math.random() > 0.35,
    }));

    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    const onMove = (e: PointerEvent) => {
      pointer.tx = e.clientX / window.innerWidth - 0.5;
      pointer.ty = e.clientY / window.innerHeight - 0.5;
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('resize', resize);

    // hexagonal crystal outline: pointed top and bottom
    const outline = (s: number) => {
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.lineTo(s * 0.5, -s * 0.42);
      ctx.lineTo(s * 0.5, s * 0.42);
      ctx.lineTo(0, s);
      ctx.lineTo(-s * 0.5, s * 0.42);
      ctx.lineTo(-s * 0.5, -s * 0.42);
      ctx.closePath();
    };

    let raf = 0;
    let last = performance.now();
    const draw = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      pointer.x += (pointer.tx - pointer.x) * 0.05;
      pointer.y += (pointer.ty - pointer.y) * 0.05;
      ctx.clearRect(0, 0, w, h);

      for (const s of shards) {
        if (!reduce) {
          s.x += s.vx * dt * 6;
          s.y += s.vy * dt * 6;
          s.rot += s.vr * dt;
          if (s.x < -0.15) s.x = 1.15;
          if (s.x > 1.15) s.x = -0.15;
          if (s.y < -0.2) s.y = 1.2;
          if (s.y > 1.2) s.y = -0.2;
        }
        const px = s.x * w + pointer.x * 60 * s.depth;
        const py = s.y * h + pointer.y * 60 * s.depth;
        const size = s.size * (0.6 + s.depth * 0.6);
        const a = 0.025 + s.depth * 0.07;

        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(s.rot);
        outline(size);
        const g = ctx.createLinearGradient(-size, -size, size, size);
        if (s.gold) {
          g.addColorStop(0, `rgba(239,217,168,${a})`);
          g.addColorStop(1, `rgba(201,163,92,${a * 0.2})`);
        } else {
          g.addColorStop(0, `rgba(143,182,232,${a})`);
          g.addColorStop(1, `rgba(60,110,200,${a * 0.2})`);
        }
        ctx.fillStyle = g;
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = s.gold ? `rgba(239,217,168,${a * 1.8})` : `rgba(143,182,232,${a * 1.8})`;
        ctx.stroke();
        // center facet lines
        ctx.beginPath();
        ctx.moveTo(0, -size);
        ctx.lineTo(0, size);
        ctx.moveTo(-size * 0.5, -size * 0.42);
        ctx.lineTo(size * 0.5, size * 0.42);
        ctx.strokeStyle = `rgba(245,240,230,${a * 0.6})`;
        ctx.stroke();
        ctx.restore();
      }
      raf = requestAnimationFrame(draw);
    };
    const onVisibility = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) {
        last = performance.now();
        raf = requestAnimationFrame(draw);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [count]);

  return <canvas ref={ref} aria-hidden="true" className="pointer-events-none fixed inset-0 -z-[5] h-full w-full" />;
}
