'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useEffect, type ReactNode } from 'react';
import { useI18n } from '@/i18n/provider';
import { IconClose } from './AdminIcons';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Blocks closing (Esc / backdrop) while something is in flight. */
  busy?: boolean;
  wide?: boolean;
}

export function Modal({ open, onClose, title, children, busy, wide }: Props) {
  const { m } = useI18n();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-navy-950/80 px-4 py-8"
          onClick={() => !busy && onClose()}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, scale: 0.94, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className={`glass-strong gold-border relative w-full rounded-3xl p-7 sm:p-8 ${wide ? 'max-w-xl' : 'max-w-md'}`}
          >
            <button
              type="button"
              aria-label={m.admin.shell.close}
              onClick={() => !busy && onClose()}
              className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-lg text-pearl/50 transition-colors hover:bg-white/10 hover:text-pearl"
            >
              <IconClose className="h-4 w-4" />
            </button>
            <h2 className="pr-8 font-display text-xl font-semibold text-pearl">{title}</h2>
            <div className="mt-4">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
