'use client';

import { useEffect, useState } from 'react';
import type { FxInfo } from './types';

/**
 * The USD→BRL rate for the admin panel (money is stored and shown in dollars; the rate is only needed to
 * show a reais equivalent). null while loading or when no rate is available.
 */
export function useFx(): FxInfo | null {
  const [fx, setFx] = useState<FxInfo | null>(null);
  useEffect(() => {
    let alive = true;
    fetch('/api/fx/usd-brl')
      .then((r) => (r.ok ? (r.json() as Promise<FxInfo>) : null))
      .then((d) => {
        if (alive && d && typeof d.rate === 'number') setFx(d);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return fx;
}
