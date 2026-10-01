'use client';

import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '@/i18n/provider';
import { api, errorText } from './client-api';

/**
 * The loading/error/fetch-on-mount boilerplate that a handful of admin pages each repeated by hand
 * for a single GET endpoint. Not a fit for list pages with pagination/filters or pages that distribute
 * the response across several separate form fields — those stay bespoke (see REVIEW.md, ARCH-6).
 */
export function useApiResource<T>(path: string, fallbackError?: string) {
  const { m, href } = useI18n();
  const nav = { homePath: href('/'), changePasswordPath: href('/admin/change-password') };

  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');

  const reload = useCallback(() => {
    api<T>(path, nav)
      .then((d) => {
        setData(d);
        setError('');
      })
      .catch((e) => setError(errorText(e, m, fallbackError)));
    // path is the only thing that should ever trigger a re-fetch here
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  useEffect(reload, [reload]);

  return { data, error, reload, setData };
}
