// ============================================================
// Store global + persistance.
// La couche "StorageAdapter" isole le stockage : aujourd'hui
// localStorage, demain une API (Supabase, Postgres…) sans toucher l'UI.
// ============================================================
import { useSyncExternalStore } from 'react';
import { migrate, emptyData } from './defaults';
import type { AppData } from './types';

export interface StorageAdapter {
  load(): AppData | null;
  save(data: AppData): void;
}

const KEY = 'workprice-pro:v1:default'; // ":default" = espace de travail (futur multi-comptes)

export const localAdapter: StorageAdapter = {
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? migrate(JSON.parse(raw)) : null;
    } catch {
      return null;
    }
  },
  save(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
  },
};

type Listener = () => void;
let adapter: StorageAdapter = localAdapter;
let state: AppData = adapter.load() ?? emptyData();
const listeners = new Set<Listener>();
let saveError: string | null = null;
let lastSaved = Date.now();

function persist() {
  try {
    adapter.save(state);
    saveError = null;
    lastSaved = Date.now();
  } catch (e) {
    saveError = (e as Error)?.name === 'QuotaExceededError'
      ? 'Stockage du navigateur plein : exporte une sauvegarde et allège le logo.'
      : 'Impossible d\'enregistrer les données dans ce navigateur.';
  }
}

export const store = {
  get: (): AppData => state,
  set(updater: (d: AppData) => AppData) {
    state = updater(state);
    persist();
    listeners.forEach(l => l());
  },
  replace(data: AppData) {
    state = migrate(data);
    persist();
    listeners.forEach(l => l());
  },
  subscribe(l: Listener) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  saveError: () => saveError,
  lastSaved: () => lastSaved,
  useAdapter(a: StorageAdapter) { adapter = a; state = a.load() ?? emptyData(); listeners.forEach(l => l()); },
};

export function useData(): AppData {
  return useSyncExternalStore(store.subscribe, store.get);
}

// Synchronisation entre onglets ouverts
if (typeof window !== 'undefined') {
  window.addEventListener('storage', e => {
    if (e.key === KEY && e.newValue) {
      try { state = migrate(JSON.parse(e.newValue)); listeners.forEach(l => l()); } catch { /* ignore */ }
    }
  });
}
