'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useI18n } from '@/i18n/provider';

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { m, href } = useI18n();
  const t = m.admin.error;

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto grid min-h-[60vh] max-w-lg place-items-center px-5 text-center">
      <div className="glass-strong gold-border rounded-3xl p-8">
        <h1 className="font-display text-xl font-semibold text-pearl">{t.title}</h1>
        <p className="mt-3 text-pearl/60">{t.text}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => reset()} className="btn btn-primary">
            {t.retry}
          </button>
          <Link href={href('/admin')} className="btn btn-ghost">
            {t.home}
          </Link>
        </div>
      </div>
    </div>
  );
}
