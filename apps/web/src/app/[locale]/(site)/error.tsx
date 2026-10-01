'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useI18n } from '@/i18n/provider';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { m, href } = useI18n();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto grid min-h-[70vh] max-w-xl place-items-center px-5 pt-32 text-center">
      <div>
        <p className="eyebrow">{m.error.code}</p>
        <h1 className="mt-4 font-display text-6xl text-pearl">{m.error.title}</h1>
        <p className="mt-4 text-pearl/60">{m.error.text}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => reset()} className="btn btn-primary">
            {m.error.retry}
          </button>
          <Link href={href('/')} className="btn btn-ghost">
            {m.error.home}
          </Link>
        </div>
      </div>
    </div>
  );
}
