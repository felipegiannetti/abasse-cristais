'use client';

import Link from 'next/link';
import { useI18n } from '@/i18n/provider';

export default function NotFound() {
  const { m, href } = useI18n();
  return (
    <div className="mx-auto grid min-h-[70vh] max-w-xl place-items-center px-5 pt-32 text-center">
      <div>
        <p className="eyebrow">{m.notFound.code}</p>
        <h1 className="mt-4 font-display text-6xl text-pearl">{m.notFound.title}</h1>
        <p className="mt-4 text-pearl/60">{m.notFound.text}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href={href('/')} className="btn btn-ghost">
            {m.notFound.home}
          </Link>
          <Link href={href('/products')} className="btn btn-primary">
            {m.notFound.collection}
          </Link>
        </div>
      </div>
    </div>
  );
}
