import type { Metadata } from 'next';
import { AdminShell } from '@/components/admin/AdminShell';
import { ChangePasswordForm } from '@/components/admin/ChangePasswordForm';
import { getMessages, isLocale } from '@/i18n';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: isLocale(locale) ? getMessages(locale).admin.password.title : 'Change password' };
}

export default function ChangePasswordPage() {
  return (
    <AdminShell allowPasswordChange>
      <ChangePasswordForm />
    </AdminShell>
  );
}
