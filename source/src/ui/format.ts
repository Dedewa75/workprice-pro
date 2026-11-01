import type { Settings, BillingMethod, Periodicity, QuoteStatus, InvoiceStatus } from '../core/types';

const cache = new Map<string, Intl.NumberFormat>();
export function money(n: number, s: Pick<Settings, 'currency' | 'locale'>): string {
  const key = s.locale + s.currency;
  let f = cache.get(key);
  if (!f) {
    try { f = new Intl.NumberFormat(s.locale || 'fr-BE', { style: 'currency', currency: s.currency || 'EUR' }); }
    catch { f = new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR' }); }
    cache.set(key, f);
  }
  return f.format(isFinite(n) ? n : 0);
}
export const numFmt = (n: number, d = 2) => new Intl.NumberFormat('fr-BE', { maximumFractionDigits: d }).format(isFinite(n) ? n : 0);
export const pct = (n: number) => `${numFmt(n, 1)} %`;
export const dateFmt = (iso: string) => {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
};

export const METHOD_LABELS: Record<BillingMethod, string> = {
  hourly: 'Horaire', flat: 'Forfait', unit: 'À l\'unité', quantity: 'Par quantité', subscription: 'Abonnement', custom: 'Personnalisée',
};
export const METHOD_HELP: Record<BillingMethod, string> = {
  hourly: 'Prix = (temps × tarif × difficulté + frais) + marge.',
  flat: 'Tu fixes un prix global ; l\'outil calcule ta marge réelle.',
  unit: 'Prix unitaire × quantité.',
  quantity: 'Tarif dégressif selon des paliers de quantité.',
  subscription: 'Prix par période × nombre de périodes.',
  custom: 'Tes propres lignes de coûts et de ventes.',
};
export const PERIOD_LABELS: Record<Periodicity, string> = { once: 'Unique', monthly: 'Mensuel', quarterly: 'Trimestriel', yearly: 'Annuel' };
export const PERIOD_SHORT: Record<Periodicity, string> = { once: '', monthly: '/mois', quarterly: '/trimestre', yearly: '/an' };

export const QUOTE_STATUS: Record<QuoteStatus, { label: string; tone: Tone }> = {
  draft: { label: 'Brouillon', tone: 'slate' },
  sent: { label: 'Envoyé', tone: 'blue' },
  accepted: { label: 'Accepté', tone: 'green' },
  refused: { label: 'Refusé', tone: 'red' },
  invoiced: { label: 'Facturé', tone: 'violet' },
};
export const INVOICE_STATUS: Record<InvoiceStatus, { label: string; tone: Tone }> = {
  draft: { label: 'Brouillon', tone: 'slate' },
  issued: { label: 'À payer', tone: 'amber' },
  partial: { label: 'Partiel', tone: 'blue' },
  paid: { label: 'Payée', tone: 'green' },
  cancelled: { label: 'Annulée', tone: 'red' },
};
export type Tone = 'slate' | 'blue' | 'green' | 'red' | 'violet' | 'amber';
