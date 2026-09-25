'use client';

import { useRef, useState, type DragEvent } from 'react';
import { fmt } from '@/i18n/config';
import { useI18n } from '@/i18n/provider';
import { prepareImage } from '@/lib/image-prepare';

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

  function move(index: number, dir: -1 | 1) {
    const to = index + dir;
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    [next[index], next[to]] = [next[to], next[index]];
    onChange(next);
  }

  function makeCover(index: number) {
    const next = [...items];
    const [it] = next.splice(index, 1);
    onChange([it, ...next]);
  }

  function remove(index: number) {
    const it = items[index];
    if (it.file) URL.revokeObjectURL(it.url);
    onChange(items.filter((_, i) => i !== index));
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setOver(false);
    if (!locked) void addFiles(e.dataTransfer.files);
  }

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="label !mb-0">{t.title}</span>
        <span className="text-xs text-ice/45">{fmt(t.counter, { n: items.length, max })}</span>
      </div>

      <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {items.map((it, i) => (
          <li key={it.key} className="group relative aspect-square overflow-hidden rounded-2xl border border-white/10 bg-ink-900">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={it.url} alt={fmt(t.photoN, { n: i + 1 })} className="h-full w-full object-cover" />
            {i === 0 && (
              <span className="absolute left-2 top-2 rounded-full bg-jade-400 px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-ink-950">
                {t.cover}
              </span>
            )}
            {it.file && (
              <span className="absolute right-2 top-2 rounded-full bg-ink-950/80 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider text-aqua">
                {t.isNew}
              </span>
            )}
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-ink-950/95 to-transparent p-2 pt-8">
              <div className="flex gap-1">
                <IconBtn label={t.moveLeft} onClick={() => move(i, -1)} disabled={locked || i === 0}>
                  ←
                </IconBtn>
                <IconBtn label={t.moveRight} onClick={() => move(i, 1)} disabled={locked || i === items.length - 1}>
                  →
                </IconBtn>
                {i !== 0 && (
                  <IconBtn label={t.makeCover} onClick={() => makeCover(i)} disabled={locked}>
                    ★
                  </IconBtn>
                )}
              </div>
              <IconBtn label={t.remove} onClick={() => remove(i)} disabled={locked} danger>
                ✕
              </IconBtn>
            </div>
          </li>
        ))}

        {items.length < max && (
          <li>
            <button
              type="button"
              disabled={locked}
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(true);
              }}
              onDragLeave={() => setOver(false)}
              onDrop={onDrop}
              className={`grid aspect-square w-full place-items-center rounded-2xl border-2 border-dashed p-3 text-center text-sm transition-colors ${
                over ? 'border-jade-400 bg-jade-400/10 text-jade-300' : 'border-white/15 text-ice/55 hover:border-jade-400/60 hover:text-jade-300'
              }`}
            >
              <span>
                <span className="block text-3xl leading-none">{busy ? '…' : '+'}</span>
                <span className="mt-2 block">{busy ? t.processing : t.add}</span>
                <span className="mt-1 block text-xs text-ice/35">{t.clickOrDrag}</span>
              </span>
            </button>
          </li>
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
      <p className="mt-3 text-xs text-ice/40">{t.help}</p>
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
        danger ? 'bg-red-500/25 text-red-200 hover:bg-red-500/50' : 'bg-white/10 text-ice hover:bg-jade-400 hover:text-ink-950'
      }`}
    >
      {children}
    </button>
  );
}
