import type { Metadata } from 'next';
import { EditProduct } from '@/components/admin/EditProduct';
import { getMessages, isLocale } from '@/i18n';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: isLocale(locale) ? getMessages(locale).admin.form.titleEdit : 'Edit product' };
}

export default async function EditProductPage({ params }: { params: Promise<{ id: string; locale: string }> }) {
  const { id } = await params;
  return <EditProduct id={id} />;
}
