'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { site } from '@/content/site';
import { useI18n } from '@/i18n/provider';
import { generalMessage, whatsappUrl } from '@/lib/whatsapp';
import { ArrowIcon, WhatsAppIcon } from './icons';

// three.js only loads in the browser, after first paint (large bundle).
const CrystalScene = dynamic(() => import('./CrystalScene'), { ssr: false });

/** SVG crystal: shown while the 3D scene loads, or if the device has no WebGL. */
function CrystalFallback() {
  return (
    <div className="absolute inset-0 grid place-items-center lg:pl-[40%]" aria-hidden="true">
      <div className="absolute h-[70%] w-[70%] rounded-full bg-jade-500/20 blur-[110px]" />
      <svg viewBox="0 0 200 260" className="relative h-[52%] max-h-[520px] animate-float drop-shadow-[0_0_60px_rgb(52_224_161/0.45)]">
        <defs>
          <linearGradient id="fa" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#e9fff6" />
            <stop offset="1" stopColor="#12c98b" />
          </linearGradient>
        </defs>
        <polygon points="100,8 160,56 160,178 100,250 40,178 40,56" fill="url(#fa)" opacity="0.28" stroke="#7ff0c6" strokeWidth="1.5" />
        <polygon points="100,8 132,56 100,250 68,56" fill="#7ff0c6" opacity="0.42" />
        <polygon points="40,56 68,56 100,250 40,178" fill="#12c98b" opacity="0.4" />
        <polygon points="160,56 132,56 100,250 160,178" fill="#7ee7ff" opacity="0.3" />
      </svg>
    </div>
  );
}

class SceneBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export function CrystalHero() {
  const { m, href } = useI18n();
  const h = m.home.hero;
  const sectionRef = useRef<HTMLElement>(null);
  const [supported, setSupported] = useState(true);
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);
  // null until the visitor taps the crystal; the name is localized at render time,
  // so switching language updates the label without touching the 3D scene.
  const [variant, setVariant] = useState<number | null>(null);

  useEffect(() => {
    setSupported(hasWebGL());
    setReduceMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  // Pause 3D rendering when the hero is off-screen (saves battery/GPU).
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setActive(entry.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const onVariant = useCallback((index: number) => setVariant(index), []);
  const onReady = useCallback(() => setReady(true), []);

  const fallback = <CrystalFallback />;

  return (
    <section
      ref={sectionRef}
      className="relative min-h-[100svh] select-none overflow-hidden"
      style={{ touchAction: 'pan-y' }}
    >
      {!ready && fallback}
      {supported && (
        <SceneBoundary fallback={fallback}>
          <div className={`absolute inset-0 transition-opacity duration-1000 ${ready ? 'opacity-100' : 'opacity-0'}`}>
            <CrystalScene
              eventSource={sectionRef}
              active={active}
              onVariant={onVariant}
              reduceMotion={reduceMotion}
              onReady={onReady}
            />
          </div>
        </SceneBoundary>
      )}

      {/* Text on top; only the buttons capture clicks so the crystal stays interactive */}
      <div className="pointer-events-none relative z-10 mx-auto flex min-h-[100svh] max-w-7xl flex-col justify-start px-5 pb-16 pt-[calc(46svh+4rem)] sm:px-8 lg:justify-center lg:pb-24 lg:pt-24">
        <div className="max-w-2xl">
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="eyebrow"
          >
            {m.common.tagline}
          </motion.p>

          <h1 className="mt-5 font-display text-[clamp(2.7rem,min(11.5vw,11svh),5.4rem)] font-medium leading-[0.98] tracking-tight text-ice">
            {[h.line1, h.line2].map((line, i) => (
              <span key={line} className="block overflow-hidden pb-[0.12em]">
                <motion.span
                  className="block"
                  initial={{ y: '110%' }}
                  animate={{ y: 0 }}
                  transition={{ duration: 1, delay: 0.25 + i * 0.12, ease: [0.22, 1, 0.36, 1] }}
                >
                  {line}
                </motion.span>
              </span>
            ))}
            <span className="block overflow-hidden pb-[0.14em]">
              <motion.span
                className="text-shimmer block italic"
                initial={{ y: '110%' }}
                animate={{ y: 0 }}
                transition={{ duration: 1, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
              >
                {h.line3}
              </motion.span>
            </span>
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.75 }}
            className="mt-5 max-w-lg text-base leading-relaxed text-ice/70 sm:text-lg"
          >
            {h.text}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.9 }}
            className="pointer-events-auto mt-7 flex flex-wrap gap-3"
          >
            <Link href={href('/products')} className="btn btn-primary">
              {h.explore} <ArrowIcon />
            </Link>
            <a href={whatsappUrl(generalMessage(m))} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
              <WhatsAppIcon className="h-4 w-4" /> {h.whatsapp}
            </a>
          </motion.div>
        </div>
      </div>

      {/* Interaction hint */}
      {supported && ready && (
        <div className="pointer-events-none absolute inset-x-0 top-[calc(46svh+0.35rem)] z-10 flex justify-center px-5 lg:bottom-7 lg:top-auto">
          <div className="glass flex items-center gap-3 rounded-full px-5 py-2.5 text-xs tracking-wide text-ice/80">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-jade-400 opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-jade-400" />
            </span>
            <AnimatePresence mode="wait">
              <motion.span
                key={variant === null ? 'hint' : variant}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
              >
                {variant === null ? (
                  h.hintDrag
                ) : (
                  <>
                    <span className="font-semibold text-jade-300">{h.variants[variant]}</span> · {h.hintChange}
                  </>
                )}
              </motion.span>
            </AnimatePresence>
          </div>
        </div>
      )}
      <span className="sr-only">{site.name}</span>
    </section>
  );
}
