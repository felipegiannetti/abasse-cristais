'use client';

import { useRef, type HTMLAttributes, type PointerEvent } from 'react';

/**
 * Card that tilts in 3D toward the pointer and shows a golden glow that follows it.
 * Purely visual (CSS variables + transform); disabled for touch pointers and reduced motion.
 */
export function TiltCard({
  children,
  className = '',
  max = 5,
  ...rest
}: { max?: number } & HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement>(null);

  function onMove(e: PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el || e.pointerType === 'touch') return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.setProperty('--mx', `${px * 100}%`);
    el.style.setProperty('--my', `${py * 100}%`);
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.style.transform = `perspective(900px) rotateX(${(0.5 - py) * max}deg) rotateY(${(px - 0.5) * max}deg) translateZ(0)`;
    }
  }
  function onLeave() {
    if (ref.current) ref.current.style.transform = '';
  }

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className={`adm-card relative transition-transform duration-200 ease-out will-change-transform ${className}`}
      {...rest}
    >
      <span className="adm-glow" />
      {children}
    </div>
  );
}
