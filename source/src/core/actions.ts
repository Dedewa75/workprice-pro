// ============================================================
// Actions métier : toutes les mutations passent par ici.
// ============================================================
import { store } from './store';
import { uid, defaultCalcInput, computeCalc, round2 } from './calc';
import { addDays, invoiceFromQuote, invoiceStatusFromPayments, nextNumber, todayISO, newLine } from './docs';
import type { CalcInput, CalcRecord, Client, Invoice, Payment, Quote, Settings, Trade, AppData, DocLine } from './types';

const now = () => new Date().toISOString();

export function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  const i = list.findIndex(x => x.id === item.id);
  if (i === -1) return [item, ...list];
  const c = [...list]; c[i] = item; return c;
}

// ---------- Paramètres ----------
export const updateSettings = (fn: (s: Settings) => Settings) => store.set(d => ({ ...d, settings: fn(d.settings) }));

// ---------- Clients ----------
export function blankClient(): Client {
  return { id: uid(), type: 'pro', name: '', company: '', address: '', zip: '', city: '', country: store.get().settings.country, phone: '', email: '', vatNumber: '', notes: '', createdAt: now(), updatedAt: now() };
}
export const saveClient = (c: Client) => store.set(d => ({ ...d, clients: upsert(d.clients, { ...c, updatedAt: now() }) }));
export function clientUsage(id: string, d: AppData = store.get()) {
  return { quotes: d.quotes.filter(q => q.clientId === id).length, invoices: d.invoices.filter(i => i.clientId === id).length };
}
export const deleteClient = (id: string) => store.set(d => ({ ...d, clients: d.clients.filter(c => c.id !== id) }));

// ---------- Métiers ----------
export const saveTrade = (t: Trade) => store.set(d => ({ ...d, trades: upsert(d.trades, { ...t, updatedAt: now() }) }));
export const deleteTrade = (id: string) => store.set(d => ({ ...d, trades: d.trades.filter(t => t.id !== id) }));
export function duplicateTrade(t: Trade): Trade {
  const copy: Trade = JSON.parse(JSON.stringify(t));
  copy.id = uid(); copy.name = `${t.name} (copie)`; copy.createdAt = now(); copy.updatedAt = now();
  copy.services.forEach(s => { s.id = uid(); s.input.tradeId = copy.id; });
  const optMap = new Map<string, string>();
  copy.options.forEach(o => { const n = uid(); optMap.set(o.id, n); o.id = n; });
  copy.packs.forEach(p => { p.id = uid(); p.optionIds = p.optionIds.map(x => optMap.get(x) || x); });
  copy.costs.forEach(c => { c.id = uid(); });
  saveTrade(copy);
  return copy;
}
export function saveServiceToTrade(tradeId: string, input: CalcInput, serviceId?: string) {
  store.set(d => ({
    ...d,
    trades: d.trades.map(t => {
      if (t.id !== tradeId) return t;
      const svc = { id: serviceId || uid(), name: input.name || 'Prestation', description: input.description, input: { ...input, tradeId } };
      const exists = t.services.some(s => s.id === svc.id);
      return { ...t, updatedAt: now(), services: exists ? t.services.map(s => (s.id === svc.id ? svc : s)) : [...t.services, svc] };
    }),
  }));
}

// ---------- Historique des calculs ----------
export function saveCalculation(input: CalcInput): CalcRecord {
  const r = computeCalc(input);
  const rec: CalcRecord = { id: uid(), name: input.name || 'Calcul sans nom', input: JSON.parse(JSON.stringify(input)), priceHT: r.priceHT, createdAt: now() };
  store.set(d => ({ ...d, calculations: [rec, ...d.calculations].slice(0, 300) }));
  return rec;
}
export const deleteCalculation = (id: string) => store.set(d => ({ ...d, calculations: d.calculations.filter(c => c.id !== id) }));

// ---------- Devis ----------
export function defaultVat(s: Settings) { return s.vat.enabled ? s.vat.defaultRate ?? 0 : 0; }

export function createQuote(over: Partial<Quote> = {}): Quote {
  const d = store.get();
  const { number, settings } = nextNumber(d.settings, 'quote', d.quotes.map(q => q.number));
  const issue = todayISO();
  const q: Quote = {
    kind: 'quote', id: uid(), number, clientId: null, title: '', issueDate: issue,
    validUntil: addDays(issue, settings.quoteValidityDays), status: 'draft', invoiceId: null,
    lines: [newLine({ vatRate: defaultVat(settings) })], globalDiscountPct: 0,
    notes: '', conditions: settings.defaultQuoteConditions, template: settings.pdfTemplate,
    createdAt: now(), updatedAt: now(), ...over,
  };
  store.set(x => ({ ...x, settings, quotes: [q, ...x.quotes] }));
  return q;
}
export const saveQuote = (q: Quote) => store.set(d => ({ ...d, quotes: upsert(d.quotes, { ...q, updatedAt: now() }) }));
export const deleteQuote = (id: string) => store.set(d => ({ ...d, quotes: d.quotes.filter(q => q.id !== id) }));
export function duplicateQuote(q: Quote): Quote {
  return createQuote({ clientId: q.clientId, title: q.title, lines: q.lines.map(l => ({ ...l, id: uid() })), globalDiscountPct: q.globalDiscountPct, notes: q.notes, conditions: q.conditions, template: q.template });
}

/** Ligne de devis à partir d'un calcul : prix unitaire = PV HT / quantité. */
export function lineFromCalc(input: CalcInput): DocLine {
  const r = computeCalc(input);
  const qty = input.method === 'flat' || input.method === 'custom' ? 1
    : input.method === 'subscription' ? Math.max(1, input.subscriptionDuration)
    : Math.max(1, input.quantity);
  const unit = input.method === 'subscription' ? (input.subscriptionPeriod === 'monthly' ? 'mois' : input.subscriptionPeriod === 'yearly' ? 'an' : input.subscriptionPeriod === 'quarterly' ? 'trimestre' : 'période')
    : input.method === 'flat' || input.method === 'custom' ? 'forfait' : input.unitLabel || 'unité';
  const detailParts: string[] = [];
  if (input.description) detailParts.push(input.description);
  if (r.urgencyAmount > 0) detailParts.push(`Majoration urgence ${input.urgencyPct} % incluse`);
  if (r.discountAmount > 0) detailParts.push(`Remise incluse`);
  return newLine({
    description: input.name || 'Prestation',
    detail: detailParts.join(' — '),
    qty,
    unit,
    unitPrice: round2(r.priceHT / qty),
    unitCost: round2(r.expenses / qty),
    vatRate: input.vatRate,
  });
}

// ---------- Factures ----------
export function createInvoice(over: Partial<Invoice> = {}): Invoice {
  const s = store.get().settings;
  const issue = todayISO();
  const inv: Invoice = {
    kind: 'invoice', id: uid(), number: '', clientId: null, title: '', issueDate: issue,
    dueDate: addDays(issue, s.paymentTermsDays), status: 'draft', quoteId: null, payments: [],
    lines: [newLine({ vatRate: defaultVat(s) })], globalDiscountPct: 0,
    notes: s.defaultInvoiceNotes, conditions: '', template: s.pdfTemplate,
    createdAt: now(), updatedAt: now(), ...over,
  };
  store.set(d => ({ ...d, invoices: [inv, ...d.invoices] }));
  return inv;
}
export const saveInvoice = (inv: Invoice) => store.set(d => ({ ...d, invoices: upsert(d.invoices, { ...inv, updatedAt: now() }) }));
export const deleteDraftInvoice = (id: string) => store.set(d => ({ ...d, invoices: d.invoices.filter(i => !(i.id === id && i.status === 'draft')) }));

export function convertQuoteToInvoice(quoteId: string): Invoice | null {
  const d = store.get();
  const q = d.quotes.find(x => x.id === quoteId);
  if (!q) return null;
  if (q.invoiceId) return d.invoices.find(i => i.id === q.invoiceId) || null;
  const inv = invoiceFromQuote(q, d.settings);
  store.set(x => ({
    ...x,
    invoices: [inv, ...x.invoices],
    quotes: x.quotes.map(y => (y.id === q.id ? { ...y, status: 'invoiced', invoiceId: inv.id, updatedAt: now() } : y)),
  }));
  return inv;
}

/** Émet la facture : attribue le numéro définitif (séquentiel, sans trou). */
export function issueInvoice(id: string): Invoice | null {
  const d = store.get();
  const inv = d.invoices.find(i => i.id === id);
  if (!inv || inv.status !== 'draft') return inv || null;
  const { number, settings } = nextNumber(d.settings, 'invoice', d.invoices.map(i => i.number).filter(Boolean), new Date(inv.issueDate + 'T12:00:00'));
  const issued: Invoice = { ...inv, number, status: 'issued', updatedAt: now() };
  issued.status = invoiceStatusFromPayments(issued);
  store.set(x => ({ ...x, settings, invoices: upsert(x.invoices, issued) }));
  return issued;
}

export function addPayment(invoiceId: string, p: Omit<Payment, 'id'>) {
  store.set(d => ({
    ...d,
    invoices: d.invoices.map(i => {
      if (i.id !== invoiceId) return i;
      const next = { ...i, payments: [...i.payments, { ...p, id: uid() }], updatedAt: now() };
      return { ...next, status: invoiceStatusFromPayments(next) };
    }),
  }));
}
export function removePayment(invoiceId: string, paymentId: string) {
  store.set(d => ({
    ...d,
    invoices: d.invoices.map(i => {
      if (i.id !== invoiceId) return i;
      const next = { ...i, payments: i.payments.filter(p => p.id !== paymentId), updatedAt: now() };
      return { ...next, status: invoiceStatusFromPayments(next) };
    }),
  }));
}
export function cancelInvoice(id: string) {
  store.set(d => ({ ...d, invoices: d.invoices.map(i => (i.id === id ? { ...i, status: 'cancelled', updatedAt: now() } : i)) }));
}

export function newCalcInput(): CalcInput {
  const s = store.get().settings;
  return defaultCalcInput({ hourlyRate: s.defaultHourlyRate, marginPct: s.defaultMarginPct, marginMode: s.defaultMarginMode, chargesPct: s.chargesPct, vatRate: defaultVat(s) });
}
