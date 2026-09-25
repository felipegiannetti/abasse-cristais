import type { Metadata } from 'next';
import { TeamPage } from '@/components/admin/TeamPage';
import { getMessages, isLocale } from '@/i18n';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: isLocale(locale) ? getMessages(locale).admin.team.title : 'Team' };
}

export default function AdminTeamPage() {
  return <TeamPage />;
}
