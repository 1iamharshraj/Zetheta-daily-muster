'use client';
import { useToast } from './ui';

export function CopyButton({ text, label, done, cls = 'btn primary sm' }: { text: string; label: string; done: string; cls?: string }) {
  const toast = useToast();
  return (
    <button className={cls} onClick={async () => {
      try { await navigator.clipboard.writeText(text); toast(done); } catch { toast('Couldn’t copy. Your browser blocked the clipboard.'); }
    }}>{label}</button>
  );
}
