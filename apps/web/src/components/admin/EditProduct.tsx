'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useI18n } from '@/i18n/provider';
import { ApiError, api } from '@/lib/client-api';
import type { Product } from '@/lib/types';
import { ProductForm } from './ProductForm';

export function EditProduct({ id }: { id: string }) {
  const { m, href } = useI18n();
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<Product>(`/admin/products/${encodeURIComponent(id)}`, {
      homePath: href('/'),
      changePasswordPath: href('/admin/change-password'),
    })
      .then(setProduct)
      .catch((e) =>
        setError(e instanceof ApiError && e.status === 404 ? m.admin.edit.notFound : m.admin.edit.loadFailed),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (error) {
    return (
      <div className="glass rounded-3xl p-10 text-center">
        <p className="font-display text-3xl text-pearl">{error}</p>
        <Link href={href('/admin/products')} className="btn btn-ghost mt-6">
          {m.admin.form.back}
        </Link>
      </div>
    );
  }
  if (!product) {
    return (
      <div
        className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gold-400/30 border-t-gold-400"
        role="status"
        aria-label={m.common.loading}
      />
    );
  }
  return <ProductForm initial={product} />;
}
