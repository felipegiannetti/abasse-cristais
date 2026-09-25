import type { Metadata } from 'next';
import { getMessages, isLocale } from '@/i18n';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const panel = isLocale(locale) ? getMessages(locale).meta.panel : 'Admin panel';
  return {
    title: { default: panel, template: `%s · ${panel}` },
    robots: { index: false, follow: false, nocache: true },
  };
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="aurora" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />
      {children}
    </>
  );
}
