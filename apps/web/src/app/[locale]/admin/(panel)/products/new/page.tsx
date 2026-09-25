import type { Metadata } from 'next';
import { ProductForm } from '@/components/admin/ProductForm';
import { getMessages, isLocale } from '@/i18n';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: isLocale(locale) ? getMessages(locale).admin.form.titleNew : 'New product' };
}

export default function NewProductPage() {
  return <ProductForm />;
}
