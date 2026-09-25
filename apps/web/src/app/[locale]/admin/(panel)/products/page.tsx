import type { Metadata } from 'next';
import { ProductsAdmin } from '@/components/admin/ProductsAdmin';
import { getMessages, isLocale } from '@/i18n';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: isLocale(locale) ? getMessages(locale).admin.list.title : 'Products' };
}

export default function AdminProductsPage() {
  return <ProductsAdmin />;
}
