import type { Metadata } from 'next';
import { SaleForm } from '@/components/admin/SaleForm';

export const metadata: Metadata = { title: 'Registrar venda' };

export default function Page() {
  return <SaleForm />;
}
