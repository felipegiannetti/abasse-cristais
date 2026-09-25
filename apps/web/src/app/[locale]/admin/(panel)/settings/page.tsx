import type { Metadata } from 'next';
import { SettingsPage } from '@/components/admin/SettingsPage';
import { getMessages, isLocale } from '@/i18n';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: isLocale(locale) ? getMessages(locale).admin.settingsPage.title : 'Settings' };
}

export default function AdminSettingsPage() {
  return <SettingsPage />;
}
