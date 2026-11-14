'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { hueOf, initials } from '@/lib/names';

/* ---------- toast ---------- */
const ToastCtx = createContext<(msg: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const show = useCallback((m: string) => {
    setMsg(m);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 3800);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div id="toast" role="status" aria-live="polite" hidden={!msg}>{msg}</div>
    </ToastCtx.Provider>
  );
}

/**
 * Run a server action with a pending flag and a toast for the result.
 * Actions return `{ ok?: string; error?: string }`, or throw.
 */
export type ActionResult = { ok?: string; error?: string } | void | undefined;
export function useAction() {
  const toast = useToast();
  const [pending, start] = useTransition();
  const run = useCallback(
    (fn: () => Promise<ActionResult>, after?: (r: ActionResult) => void) =>
      start(async () => {
        try {
          const r = await fn();
          if (r && r.error) toast(r.error);
          else if (r && r.ok) toast(r.ok);
          if (!(r && r.error)) after?.(r);
        } catch (e) {
          const m = e instanceof Error ? e.message : '';
          toast(m && !/NEXT_REDIRECT/.test(m) ? m : 'Couldn’t save. Check your connection and try again.');
          if (/NEXT_REDIRECT/.test(m)) throw e;
        }
      }),
    [toast],
  );
  return { run, pending, toast };
}

/* ---------- modal ---------- */
export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [onClose]);
  useEffect(() => {
    if (!mounted) return;
    const f = ref.current?.querySelector<HTMLElement>('textarea,input:not([readonly]),select');
    setTimeout(() => f?.focus(), 30);
  }, [mounted]);
  if (!mounted) return null;
  return createPortal(
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="m-title" ref={ref} style={wide ? { maxWidth: 860 } : undefined}>
        <div className="sec-h"><h2 id="m-title">{title}</h2><button className="x" onClick={onClose} aria-label="Close">×</button></div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

/* ---------- small pieces ---------- */
export const Chip = ({ c, children, title }: { c?: string; children: React.ReactNode; title?: string }) => (
  <span className={'chip ' + (c || '')} title={title}>{children}</span>
);

export function Bar({ v, max, cls }: { v: number; max: number; cls?: string }) {
  const pct = Math.max(0, Math.min(100, max ? (100 * v) / max : 0));
  return <div className={'bar ' + (cls || '')}><i style={{ width: pct + '%' }} /></div>;
}

export function Avatar({ name, photo, size }: { name: string; photo?: string | null; size?: string }) {
  if (photo) return <span className={'av ph ' + (size || '')} aria-hidden="true"><img src={photo} alt="" /></span>;
  return <span className={'av ' + (size || '')} style={{ ['--h' as string]: hueOf(name) }} aria-hidden="true">{initials(name)}</span>;
}

export function PBar({ pct, cls, title }: { pct: number; cls?: string; title?: string }) {
  const c = pct >= 100 ? 'full' : pct < 50 ? 'low' : '';
  return (
    <span className={`pbar ${cls || ''} ${c}`} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} title={title ?? `Profile ${pct}% complete`}>
      <i style={{ width: pct + '%' }} />
    </span>
  );
}
