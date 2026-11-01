// ============================================================
// Devis & factures : totaux, numérotation, statuts
// ============================================================
import { round2, uid } from './calc';
import type { AppData, Doc, DocLine, Invoice, InvoiceStatus, Quote, Settings } from './types';

export interface VatBucket { rate: number; base: number; vat: number }
export interface DocTotals {
  subtotal: number;        // somme des lignes après remise de ligne
  globalDiscount: number;
  totalHT: number;
  vat: VatBucket[];
  totalVAT: number;
  totalTTC: number;
  totalCost: number;
  paid: number;
  balance: number;
}

export const lineTotal = (l: DocLine): number =>
  round2((Number(l.qty) || 0) * (Number(l.unitPrice) || 0) * (1 - Math.min(100, Math.max(0, Number(l.discountPct) || 0)) / 100));

export function computeTotals(doc: Pick<Doc, 'lines' | 'globalDiscountPct'> & { payments?: { amount: number }[] }): DocTotals {
  const gd = Math.min(100, Math.max(0, Number(doc.globalDiscountPct) || 0)) / 100;
  let subtotal = 0;
  let totalCost = 0;
  const byRate = new Map<number, number>();
  for (const l of doc.lines) {
    const t = lineTotal(l);
    subtotal += t;
    totalCost += (Number(l.unitCost) || 0) * (Number(l.qty) || 0);
    const r = Number(l.vatRate) || 0;
    byRate.set(r, (byRate.get(r) || 0) + t);
  }
  subtotal = round2(subtotal);
  const vat: VatBucket[] = [];
  let totalHT = 0;
  let totalVAT = 0;
  for (const [rate, sum] of [...byRate.entries()].sort((a, b) => a[0] - b[0])) {
    const base = round2(sum * (1 - gd));
    const v = round2(base * rate / 100);
    totalHT += base;
    totalVAT += v;
    vat.push({ rate, base, vat: v });
  }
  totalHT = round2(totalHT);
  totalVAT = round2(totalVAT);
  const totalTTC = round2(totalHT + totalVAT);
  const paid = round2((doc.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0));
  return {
    subtotal,
    globalDiscount: round2(subtotal - totalHT),
    totalHT, vat, totalVAT, totalTTC,
    totalCost: round2(totalCost),
    paid,
    balance: round2(totalTTC - paid),
  };
}

/** Formate un numéro : PREFIX + (ANNÉE-) + compteur sur N chiffres. */
export function formatNumber(prefix: string, year: number, n: number, includeYear: boolean, padding: number): string {
  const c = String(n).padStart(Math.max(1, padding), '0');
  return `${prefix}${includeYear ? `${year}-` : ''}${c}`;
}

/**
 * Réserve le prochain numéro (devis ou facture) et renvoie les settings mis à jour.
 * Gère la remise à zéro annuelle et évite les doublons avec les documents existants.
 */
export function nextNumber(settings: Settings, kind: 'quote' | 'invoice', existing: string[], date = new Date()): { number: string; settings: Settings } {
  const num = { ...settings.numbering };
  const year = date.getFullYear();
  if (num.resetYearly && num.lastYear !== year) {
    num.nextQuote = 1; num.nextInvoice = 1; num.lastYear = year;
  }
  const prefix = kind === 'quote' ? num.quotePrefix : num.invoicePrefix;
  let n = kind === 'quote' ? num.nextQuote : num.nextInvoice;
  const taken = new Set(existing);
  let number = formatNumber(prefix, year, n, num.includeYear, num.padding);
  while (taken.has(number)) { n++; number = formatNumber(prefix, year, n, num.includeYear, num.padding); }
  if (kind === 'quote') num.nextQuote = n + 1; else num.nextInvoice = n + 1;
  if (!num.lastYear) num.lastYear = year;
  return { number, settings: { ...settings, numbering: num } };
}

export const todayISO = (d = new Date()): string => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
};
export const addDays = (iso: string, days: number): string => {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return todayISO(d);
};

export function newLine(over: Partial<DocLine> = {}): DocLine {
  return { id: uid(), description: '', detail: '', qty: 1, unit: 'unité', unitPrice: 0, unitCost: 0, discountPct: 0, vatRate: 0, ...over };
}

export function invoiceStatusFromPayments(inv: Invoice): InvoiceStatus {
  if (inv.status === 'draft' || inv.status === 'cancelled') return inv.status;
  const t = computeTotals(inv);
  if (t.paid <= 0) return 'issued';
  if (t.balance <= 0.004) return 'paid';
  return 'partial';
}

export const isOverdue = (inv: Invoice, today = todayISO()): boolean =>
  (inv.status === 'issued' || inv.status === 'partial') && !!inv.dueDate && inv.dueDate < today;

export const isQuoteExpired = (q: Quote, today = todayISO()): boolean =>
  (q.status === 'sent' || q.status === 'draft') && !!q.validUntil && q.validUntil < today;

/** Crée une facture brouillon à partir d'un devis (le numéro est attribué à l'émission). */
export function invoiceFromQuote(q: Quote, s: Settings): Invoice {
  const now = new Date().toISOString();
  const issue = todayISO();
  return {
    kind: 'invoice', id: uid(), number: '', clientId: q.clientId,
    title: q.title, issueDate: issue, dueDate: addDays(issue, s.paymentTermsDays),
    lines: q.lines.map(l => ({ ...l, id: uid() })),
    globalDiscountPct: q.globalDiscountPct,
    notes: s.defaultInvoiceNotes, conditions: '',
    template: q.template, status: 'draft', quoteId: q.id, payments: [],
    createdAt: now, updatedAt: now,
  };
}

// ---------- Statistiques ----------
export interface Period { from: string; to: string }

export function inPeriod(iso: string, p: Period | null): boolean {
  if (!p) return true;
  return iso >= p.from && iso <= p.to;
}

export interface MonthStat { key: string; label: string; revenue: number; collected: number; profit: number; quotes: number }

export function dashboardStats(data: AppData, p: Period | null) {
  const s = data.settings;
  const liveInv = data.invoices.filter(i => i.status !== 'draft' && i.status !== 'cancelled');
  const invP = liveInv.filter(i => inPeriod(i.issueDate, p));
  const quotesP = data.quotes.filter(q => inPeriod(q.issueDate, p));
  let revenue = 0, cost = 0, paidAmt = 0, unpaidAmt = 0, lines = 0;
  for (const i of invP) {
    const t = computeTotals(i);
    revenue += t.totalHT; cost += t.totalCost; lines += i.lines.length;
    if (i.status === 'paid') paidAmt += t.totalTTC; else unpaidAmt += t.balance;
  }
  let collected = 0;
  for (const i of liveInv) for (const pay of i.payments) if (inPeriod(pay.date, p)) collected += pay.amount;
  const charges = Math.max(0, revenue - cost) * (s.chargesPct / 100);
  const profit = revenue - cost - charges;
  const clientIds = new Set<string>();
  for (const d of [...invP, ...quotesP]) if (d.clientId) clientIds.add(d.clientId);
  return {
    revenue: round2(revenue),
    cost: round2(cost),
    charges: round2(charges),
    profit: round2(profit),
    collected: round2(collected),
    clientsTotal: data.clients.length,
    clientsActive: clientIds.size,
    quotesCount: quotesP.length,
    quotesPending: quotesP.filter(q => q.status === 'sent').length,
    quotesAccepted: quotesP.filter(q => q.status === 'accepted' || q.status === 'invoiced').length,
    quotesRefused: quotesP.filter(q => q.status === 'refused').length,
    quotesDraft: quotesP.filter(q => q.status === 'draft').length,
    servicesDone: lines,
    invoicesPaid: invP.filter(i => i.status === 'paid').length,
    invoicesUnpaid: invP.filter(i => i.status === 'issued' || i.status === 'partial').length,
    paidAmount: round2(paidAmt),
    unpaidAmount: round2(unpaidAmt),
    overdue: liveInv.filter(i => isOverdue(i)).length,
  };
}

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

export function monthlySeries(data: AppData, months: number, end = new Date()): MonthStat[] {
  const out: MonthStat[] = [];
  const map = new Map<string, MonthStat>();
  for (let k = months - 1; k >= 0; k--) {
    const d = new Date(end.getFullYear(), end.getMonth() - k, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const m: MonthStat = { key, label: `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`, revenue: 0, collected: 0, profit: 0, quotes: 0 };
    out.push(m); map.set(key, m);
  }
  const chargesPct = data.settings.chargesPct / 100;
  for (const i of data.invoices) {
    if (i.status === 'draft' || i.status === 'cancelled') continue;
    const m = map.get(i.issueDate.slice(0, 7));
    const t = computeTotals(i);
    if (m) {
      m.revenue += t.totalHT;
      const gross = t.totalHT - t.totalCost;
      m.profit += gross - Math.max(0, gross) * chargesPct;
    }
    for (const p of i.payments) { const mp = map.get(p.date.slice(0, 7)); if (mp) mp.collected += p.amount; }
  }
  for (const q of data.quotes) { const m = map.get(q.issueDate.slice(0, 7)); if (m) m.quotes++; }
  for (const m of out) { m.revenue = round2(m.revenue); m.collected = round2(m.collected); m.profit = round2(m.profit); }
  return out;
}
