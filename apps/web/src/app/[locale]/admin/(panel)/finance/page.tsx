import type { Metadata } from 'next';
import { FinancePage } from '@/components/admin/FinancePage';

export const metadata: Metadata = { title: 'Financeiro' };

export default function Page() {
  return <FinancePage />;
}
