'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useRef, useState, type DragEvent } from 'react';
import { fmt } from '@/i18n/config';
import { useI18n } from '@/i18n/provider';
import { prepareImage } from '@/lib/image-prepare';
import { IconImage, IconPlus, IconStar, IconTrash } from './AdminIcons';

export interface ImageItem {
  key: string;
  /** set when the image is already saved on the server */
  id?: string;
  url: string;
  /** set when the image is still going to be uploaded */
  file?: File;
}

interface Props {
  items: ImageItem[];
  onChange: (items: ImageItem[]) => void;
  onError: (message: string) => void;
  max?: number;
  disabled?: boolean;
}

export function ImageManager({ items, onChange, onError, max = 10, disabled }: Props) {
  const { m } = useI18n();
  const t = m.admin.images;
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const locked = disabled || busy;

  async function addFiles(list: FileList | File[]) {
    const files = Array.from(list);
    if (!files.length) return;
    const room = max - items.length;
    if (room <= 0) return onError(fmt(t.limit, { max }));
    if (files.length > room) onError(fmt(t.onlyRoom, { room }));

    setBusy(true);
    const added: ImageItem[] = [];
    for (const file of files.slice(0, room)) {
      try {
        const prepared = await prepareImage(file, t);
        added.push({ key: crypto.randomUUID(), url: URL.createObjectURL(prepared), file: prepared });
      } catch (e) {
        onError((e as Error).message);
      }
    }
    onChange([...items, ...added]);
    setBusy(false);
    if (inputRef.current) inputRef.current.value = '';
  }

  function move(from: number, to: number) {
    if (from === to || to < 0 || to >= items.length) return;
    const next = [...items];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    onChange(next);
  }

  function remove(index: number) {
    const it = items[index];
    if (it.file) URL.revokeObjectURL(it.url);
    onChange(items.filter((_, i) => i !== index));
  }

  // Dropping files onto the zone adds them; dropping a photo tile onto another reorders (see tiles)
  function onZoneDrop(e: DragEvent) {
    e.preventDefault();
    setOver(false);
    if (!locked && e.dataTransfer.files.length) void addFiles(e.dataTransfer.files);
  }

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs text-pearl/45">{fmt(t.counter, { n: items.length, max })}</span>
        {items.length > 1 && <span className="hidden text-xs text-gold-300/80 sm:inline">{m.admin.form.dragHint}</span>}
      </div>

      <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        <AnimatePresence initial={false}>
          {items.map((it, i) => (
            <motion.li
              key={it.key}
              layout
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              className="relative"
            >
              <div
                draggable={!locked}
                onDragStart={(e) => {
                  setDragIndex(i);
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', String(i));
                }}
                onDragOver={(e) => {
                  if (dragIndex !== null) {
                    e.preventDefault();
                    setDropIndex(i);
                  }
                }}
                onDrop={(e) => {
                  if (dragIndex !== null) {
                    e.preventDefault();
                    e.stopPropagation();
                    move(dragIndex, i);
                  }
                  setDragIndex(null);
                  setDropIndex(null);
                }}
                onDragEnd={() => {
                  setDragIndex(null);
                  setDropIndex(null);
                }}
                className={`group relative aspect-square cursor-grab overflow-hidden rounded-2xl border bg-navy-900 transition-all active:cursor-grabbing ${
                  dropIndex === i && dragIndex !== null && dragIndex !== i
                    ? 'scale-95 border-gold-300 ring-2 ring-gold-400/50'
                    : 'border-white/10 hover:border-gold-400/40'
                } ${dragIndex === i ? 'opacity-40' : ''}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.url} alt={fmt(t.photoN, { n: i + 1 })} draggable={false} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                {i === 0 && (
                  <span className="absolute left-2 top-2 rounded-full bg-gradient-to-r from-gold-300 to-gold-500 px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-navy-950 shadow">
                    {t.cover}
                  </span>
                )}
                {it.file && (
                  <span className="absolute right-2 top-2 rounded-full bg-navy-950/80 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider text-sky">
                    {t.isNew}
                  </span>
                )}
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-navy-950/95 to-transparent p-2 pt-8 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  <div className="flex gap-1">
                    <IconBtn label={t.moveLeft} onClick={() => move(i, i - 1)} disabled={locked || i === 0}>
                      ←
                    </IconBtn>
                    <IconBtn label={t.moveRight} onClick={() => move(i, i + 1)} disabled={locked || i === items.length - 1}>
                      →
                    </IconBtn>
                    {i !== 0 && (
                      <IconBtn label={t.makeCover} onClick={() => move(i, 0)} disabled={locked}>
                        <IconStar className="h-3.5 w-3.5" />
                      </IconBtn>
                    )}
                  </div>
                  <IconBtn label={t.remove} onClick={() => remove(i)} disabled={locked} danger>
                    <IconTrash className="h-3.5 w-3.5" />
                  </IconBtn>
                </div>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>

        {items.length < max && (
          <motion.li layout>
            <button
              type="button"
              disabled={locked}
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                if (e.dataTransfer.types.includes('Files')) {
                  e.preventDefault();
                  setOver(true);
                }
              }}
              onDragLeave={() => setOver(false)}
              onDrop={onZoneDrop}
              className={`relative grid aspect-square w-full place-items-center overflow-hidden rounded-2xl border-2 border-dashed p-3 text-center text-sm transition-all ${
                over ? 'scale-[1.03] border-gold-300 bg-gold-400/10 text-gold-300' : 'border-white/15 text-pearl/55 hover:border-gold-400/60 hover:text-gold-300'
              }`}
            >
              <span>
                <span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-gold-400/15 text-gold-300">
                  {busy ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-gold-400/30 border-t-gold-400" /> : items.length === 0 ? <IconImage /> : <IconPlus />}
                </span>
                <span className="mt-3 block font-medium">{busy ? t.processing : t.add}</span>
                <span className="mt-1 block text-xs text-pearl/35">{t.clickOrDrag}</span>
              </span>
            </button>
          </motion.li>
        )}
      </ul>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        hidden
        onChange={(e) => e.target.files && void addFiles(e.target.files)}
      />
      <p className="mt-3 text-xs text-pearl/40">{t.help}</p>
    </div>
  );
}

function IconBtn({
  children,
  label,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`grid h-7 w-7 place-items-center rounded-full text-xs backdrop-blur transition-colors disabled:opacity-30 ${
        danger ? 'bg-red-500/25 text-red-200 hover:bg-red-500/50' : 'bg-white/10 text-pearl hover:bg-gold-400 hover:text-navy-950'
      }`}
    >
      {children}
    </button>
  );
}
