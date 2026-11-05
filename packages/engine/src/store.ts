import { useEffect, useLayoutEffect, useState } from 'react';

/**
 * Pages are pre-rendered on the server, so nothing here may touch browser APIs during render.
 * Stored values are loaded after mount; every access is wrapped because storage can be blocked.
 */
export const store = {
  get<T>(k: string, d: T): T {
    try {
      const v = localStorage.getItem(k);
      return v ? (JSON.parse(v) as T) : d;
    } catch {
      return d;
    }
  },
  set(k: string, v: unknown) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {
      /* storage unavailable */
    }
  },
};

export const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/** useState that is restored from localStorage after mount and saved on change. */
export function usePersistent<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setValue(store.get(key, initial));
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => {
    if (ready) store.set(key, value);
  }, [key, value, ready]);
  return [value, setValue] as const;
}

export type Theme = 'light' | 'dark';
export const THEME_KEY = 'hif.theme';

/** The <head> script sets data-theme before paint; this hook mirrors it and toggles it. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>('light');
  useEffect(() => setTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'), []);
  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.dataset.theme = next;
    store.set(THEME_KEY, next);
  };
  return [theme, toggle] as const;
}

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => setReduced(matchMedia('(prefers-reduced-motion: reduce)').matches), []);
  return reduced;
}
