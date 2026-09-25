import type { Metadata } from 'next';
import { SalesPage } from '@/components/admin/SalesPage';

export const metadata: Metadata = { title: 'Vendas' };

export default function Page() {
  return <SalesPage />;
}
