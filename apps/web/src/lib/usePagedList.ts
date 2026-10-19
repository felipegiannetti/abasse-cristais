'use client';

import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '@/i18n/provider';
import { api, errorText } from './client-api';

/**
 * The paging boilerplate the admin lists (products, sales, customers) each repeated: the current page of a
 * filtered list, a loading/error state, `load(page)` for the pagination bar, and a reload of page 1 whenever
 * the filters change. `params` are the filters only (status, search, period…); `page` and `pageSize` are added here.
 *
 * `setItems` is exposed for optimistic updates (e.g. toggling a product's status before the server answers).
 */
export function usePagedList<T>({ path, pageSize, params, failedMessage }: { path: string; pageSize: number; params: URLSearchParams; failedMessage: string }) {
  const { m, href } = useI18n();
  const filters = params.toString(); // the filters' identity: a new string = a new list

  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(
    async (pageToLoad: number) => {
      setLoading(true);
      setError('');
      try {
        const qs = new URLSearchParams(filters);
        qs.set('page', String(pageToLoad));
        qs.set('pageSize', String(pageSize));
        const data = await api<{ items: T[]; total: number }>(`${path}?${qs}`, { homePath: href('/'), changePasswordPath: href('/admin/change-password') });
        setItems(data.items);
        setTotal(data.total);
        setPage(pageToLoad);
      } catch (e) {
        setError(errorText(e, m, failedMessage));
      } finally {
        setLoading(false);
      }
    },
    // href/failedMessage are stable for a given language; the filters, path and size decide when to reload
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [path, pageSize, filters, m],
  );

  useEffect(() => {
    void load(1);
  }, [load]);

  return { items, setItems, total, page, loading, error, load };
}
