import type { Metadata } from 'next';
import { NewsletterPage } from '@/components/admin/NewsletterPage';
import { getMessages, isLocale } from '@/i18n';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: isLocale(locale) ? getMessages(locale).admin.newsletter.title : 'Newsletter' };
}

export default function AdminNewsletterPage() {
  return <NewsletterPage />;
}
