import { useEffect, useState } from 'react';

export function useRoute(): string[] {
  const read = () => (location.hash.replace(/^#\/?/, '') || 'dashboard').split('?')[0].split('/').filter(Boolean);
  const [r, setR] = useState(read);
  useEffect(() => {
    const on = () => { setR(read()); window.scrollTo({ top: 0 }); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return r;
}
export const go = (path: string) => { location.hash = '#/' + path.replace(/^\//, ''); };

/** Passage de données entre pages (ex. calculateur → nouveau devis) */
let pending: unknown = null;
export const handoff = { set(v: unknown) { pending = v; }, take<T>(): T | null { const v = pending as T | null; pending = null; return v; } };
