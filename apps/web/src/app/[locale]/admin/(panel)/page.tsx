import type { Metadata } from 'next';
import { Dashboard } from '@/components/admin/Dashboard';
import { getMessages, isLocale } from '@/i18n';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: isLocale(locale) ? getMessages(locale).admin.shell.dashboard : 'Dashboard' };
}

export default function AdminHomePage() {
  return <Dashboard />;
}
