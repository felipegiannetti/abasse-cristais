'use client';

import Link from 'next/link';
import { fmt } from '@/i18n/config';
import { formatPrice } from '@/i18n';
import { useI18n } from '@/i18n/provider';
import type { Product } from '@/lib/types';
import { productMessage } from '@/lib/whatsapp';
import { ProductImage } from './ProductImage';
import { WhatsAppIcon } from './icons';
import { WhatsAppLink } from '@/components/WhatsAppLink';

export function ProductCard({ product, priority = false }: { product: Product; priority?: boolean }) {
  const { locale, m, href } = useI18n();
  const soldOut = product.status === 'SOLD_OUT' || !product.inStock;
  const cover = product.images[0]?.url;
  const second = product.images[1]?.url;

  return (
    <article className="group glass relative flex flex-col overflow-hidden rounded-3xl transition-all duration-500 hover:-translate-y-1.5 hover:border-gold-400/40 hover:shadow-[0_30px_70px_-30px_rgb(201_163_92/0.55)]">
      <Link href={href(`/products/${product.slug}`)} className="flex flex-1 flex-col" aria-label={fmt(m.product.view, { name: product.name })}>
        <div className="relative aspect-[4/5] overflow-hidden bg-navy-900">
          <ProductImage
            src={cover}
            alt={product.name}
            sizes="(min-width:1024px) 30vw, (min-width:640px) 45vw, 92vw"
            priority={priority}
            className={`transition-all duration-700 group-hover:scale-[1.06] ${second ? 'group-hover:opacity-0' : ''} ${soldOut ? 'grayscale-[0.6]' : ''}`}
          />
          {second && (
            <ProductImage
              src={second}
              alt=""
              sizes="(min-width:1024px) 30vw, (min-width:640px) 45vw, 92vw"
              className="scale-[1.06] opacity-0 transition-all duration-700 group-hover:scale-100 group-hover:opacity-100"
            />
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-navy-950/80 via-transparent to-transparent" />
          <span className="absolute left-4 top-4 rounded-full border border-white/15 bg-navy-950/60 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-gold-300 backdrop-blur">
            {product.category}
          </span>
          {soldOut && (
            <span className="absolute right-4 top-4 rounded-full bg-pearl px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-navy-950">
              {m.product.soldOut}
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-1 p-5 pb-3">
          <h3 className="font-display text-2xl font-semibold leading-tight text-pearl">{product.name}</h3>
          <p className={`text-lg font-semibold ${product.priceCents == null ? 'text-pearl/60' : 'text-gold-300'}`}>
            {formatPrice(product.priceCents, locale, m, product.saleMode)}
          </p>
        </div>
      </Link>

      <div className="p-5 pt-2">
        <WhatsAppLink
          message={productMessage(product, locale, m)} source="PRODUCT_CARD" productSlug={product.slug}
          className={`btn w-full ${soldOut ? 'btn-ghost' : 'btn-primary'}`}
        >
          <WhatsAppIcon className="h-4 w-4" />
          {soldOut ? m.product.askSimilar : m.product.want}
        </WhatsAppLink>
      </div>
    </article>
  );
}
