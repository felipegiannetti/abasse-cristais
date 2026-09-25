import type { Metadata } from 'next';
import { SaleDetail } from '@/components/admin/SaleDetail';

export const metadata: Metadata = { title: 'Venda' };

export default async function SalePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SaleDetail id={id} />;
}
