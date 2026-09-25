'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { PRODUCTS_TAG } from '@/lib/api';

/** Chamado pelo painel depois de salvar/excluir: o site público passa a mostrar a mudança na hora. */
export async function revalidateCatalog() {
  revalidateTag(PRODUCTS_TAG);
  revalidatePath('/', 'layout');
}
