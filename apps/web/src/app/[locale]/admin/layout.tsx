import type { Metadata } from 'next';
import { getMessages } from '@/i18n';
import { I18nProvider } from '@/i18n/provider';

const m = getMessages('pt');

export const metadata: Metadata = {
  title: { default: m.meta.panel, template: `%s · ${m.meta.panel}` },
  robots: { index: false, follow: false, nocache: true },
};

// The admin area is Portuguese only (the administrator is Brazilian): whatever language prefix the URL has,
// everything below is rendered with the full Portuguese dictionary and Portuguese links (/pt/admin/...).
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider locale="pt" messages={m}>
      <div className="aurora" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />
      {children}
    </I18nProvider>
  );
}
