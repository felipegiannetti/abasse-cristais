'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { fmt } from '@/i18n/config';
import { useI18n } from '@/i18n/provider';
import type { ProductImage as Img } from '@/lib/types';
import { ProductImage } from './ProductImage';

export function ProductGallery({ images, name, soldOut }: { images: Img[]; name: string; soldOut: boolean }) {
  const { m } = useI18n();
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const current = images[index];

  return (
    <div className="grid gap-4">
      <div
        className="glass relative aspect-[4/5] cursor-zoom-in overflow-hidden rounded-3xl sm:aspect-square lg:aspect-[4/5]"
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
        }}
        onMouseLeave={() => setZoom(null)}
      >
        <AnimatePresence mode="popLayout">
          <motion.div
            key={current?.id ?? 'empty'}
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45 }}
            className="absolute inset-0"
            style={zoom ? { transform: 'scale(1.7)', transformOrigin: `${zoom.x}% ${zoom.y}%`, transition: 'transform-origin 0.05s linear, transform 0.3s ease' } : undefined}
          >
            <ProductImage
              src={current?.url}
              alt={name}
              priority
              sizes="(min-width:1024px) 50vw, 100vw"
              className={soldOut ? 'grayscale-[0.5]' : ''}
            />
          </motion.div>
        </AnimatePresence>
        {soldOut && (
          <span className="absolute right-4 top-4 rounded-full bg-pearl px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-navy-950">
            {m.product.soldOut}
          </span>
        )}
      </div>

      {images.length > 1 && (
        <div className="grid grid-cols-5 gap-3" role="tablist" aria-label={m.product.photos}>
          {images.map((img, i) => (
            <button
              key={img.id}
              role="tab"
              aria-selected={i === index}
              aria-label={fmt(m.product.photoN, { n: i + 1 })}
              onClick={() => setIndex(i)}
              className={`relative aspect-square overflow-hidden rounded-2xl border transition-all ${
                i === index ? 'border-gold-400 ring-2 ring-gold-400/40' : 'border-white/10 opacity-60 hover:opacity-100'
              }`}
            >
              <ProductImage src={img.url} alt="" sizes="120px" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
