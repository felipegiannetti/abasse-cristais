'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useEffect } from 'react';
import { useI18n } from '@/i18n/provider';

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  loadingLabel: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ open, title, message, confirmLabel, loadingLabel, loading, onConfirm, onCancel }: Props) {
  const { m } = useI18n();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !loading && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, loading, onCancel]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90] grid place-items-center bg-navy-950/80 px-5 backdrop-blur-sm"
          onClick={() => !loading && onCancel()}
        >
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            onClick={(e) => e.stopPropagation()}
            className="glass w-full max-w-md rounded-3xl p-8"
          >
            <h2 id="confirm-title" className="font-display text-3xl text-pearl">
              {title}
            </h2>
            <p className="mt-3 text-pearl/65">{message}</p>
            <div className="mt-8 flex justify-end gap-3">
              <button className="btn btn-ghost btn-sm" onClick={onCancel} disabled={loading} autoFocus>
                {m.common.cancel}
              </button>
              <button className="btn btn-danger btn-sm" onClick={onConfirm} disabled={loading}>
                {loading ? loadingLabel : confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
