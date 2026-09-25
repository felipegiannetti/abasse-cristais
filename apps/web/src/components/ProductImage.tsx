import Image from 'next/image';
import { GemIcon } from './icons';

interface Props {
  src?: string;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
}

/** Imagem de produto; sem foto mostra um placeholder de cristal. */
export function ProductImage({ src, alt, sizes, priority, className = '' }: Props) {
  if (!src) {
    return (
      <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-ink-800 to-ink-900 text-jade-400/40">
        <GemIcon className="h-14 w-14" />
      </div>
    );
  }
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      // Em desenvolvimento a API serve /uploads direto do disco: não passa pelo otimizador.
      unoptimized={src.startsWith('/uploads/')}
      className={`object-cover ${className}`}
    />
  );
}
