'use client';

import { animate } from 'motion/react';
import { useEffect, useState } from 'react';

/** Number that counts up from 0 when it first appears (and eases to new values). */
export function CountUp({
  value,
  format = (n: number) => Math.round(n).toLocaleString(),
  duration = 1.2,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
}) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(value);
      return;
    }
    const controls = animate(shown, value, { duration, ease: [0.22, 1, 0.36, 1], onUpdate: setShown });
    return () => controls.stop();
    // animate from the value currently on screen towards the new one
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  return <span className="tabular-nums">{format(shown)}</span>;
}
