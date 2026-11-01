// Données de démonstration (facultatives, supprimables depuis les paramètres)
import { uid } from './calc';
import { addDays, newLine, todayISO, invoiceStatusFromPayments, formatNumber } from './docs';
import { tradeFromTemplate } from './defaults';
import type { AppData, Client, Invoice, Quote } from './types';

export function withDemoData(d: AppData): AppData {
  const s = { ...d.settings };
  const now = new Date().toISOString();
  const trades = [...d.trades];
  for (const k of ['video', 'web']) if (!trades.some(t => t.name === tradeFromTemplate(k, s)?.name)) { const t = tradeFromTemplate(k, s); if (t) trades.push(t); }
  const names: [string, string, string][] = [
    ['Marie Dupont', 'Boulangerie Dupont', 'Liège'], ['Karim Benali', 'KB Rénovation', 'Namur'], ['Sophie Laurent', '', 'Bruxelles'],
    ['Lucas Martin', 'Studio Pixel', 'Charleroi'], ['Emma Lefèvre', 'Fleurs d\'Emma', 'Mons'], ['Thomas Peeters', 'TP Consulting', 'Wavre'],
  ];
  const clients: Client[] = names.map(([name, company, city], i) => ({
    id: uid(), type: company ? 'pro' : 'particulier', name, company, address: `Rue de la Démo ${i + 1}`, zip: String(4000 + i * 100), city, country: s.country,
    phone: '', email: `${name.split(' ')[0].toLowerCase()}@exemple.be`, vatNumber: '', notes: 'Client de démonstration', createdAt: now, updatedAt: now,
  }));
  const vat = s.vat.enabled ? s.vat.defaultRate ?? 0 : 0;
  const quotes: Quote[] = [];
  const invoices: Invoice[] = [];
  const today = new Date();
  let qn = s.numbering.nextQuote, inN = s.numbering.nextInvoice;
  const year = today.getFullYear();
  const catalogue: [string, string, number, number, number][] = [
    ['Montage vidéo courte', 'vidéo', 70, 3, 5], ['Pack 5 vidéos', 'pack', 250, 1, 15], ['Site vitrine', 'forfait', 900, 1, 60],
    ['Maintenance site', 'mois', 49, 3, 8], ['Création de logo', 'forfait', 350, 1, 10], ['Modifications site', 'heure', 45, 4, 0],
  ];
  for (let m = 7; m >= 0; m--) {
    const count = 2 + ((m * 7) % 3);
    for (let k = 0; k < count; k++) {
      const d0 = new Date(today.getFullYear(), today.getMonth() - m, 3 + k * 8);
      if (d0 > today) continue;
      const issue = todayISO(d0);
      const c = clients[(m + k) % clients.length];
      const [desc, unit, price, qty, cost] = catalogue[(m * 3 + k) % catalogue.length];
      const lines = [newLine({ description: desc, unit, unitPrice: price, qty, unitCost: cost, vatRate: vat })];
      if (k % 2 === 0) lines.push(newLine({ description: 'Sous-titres animés', unit: 'vidéo', unitPrice: 15, qty: 2, vatRate: vat }));
      const q: Quote = {
        kind: 'quote', id: uid(), number: formatNumber(s.numbering.quotePrefix, year, qn++, s.numbering.includeYear, s.numbering.padding),
        clientId: c.id, title: desc, issueDate: issue, validUntil: addDays(issue, s.quoteValidityDays), status: 'sent', invoiceId: null,
        lines, globalDiscountPct: 0, notes: '', conditions: s.defaultQuoteConditions, template: s.pdfTemplate, createdAt: now, updatedAt: now,
      };
      const accepted = (m + k) % 4 !== 3;
      if (m === 0 && k === count - 1) q.status = 'sent';
      else if (!accepted) q.status = 'refused';
      else {
        const invIssue = addDays(issue, 4);
        if (invIssue > todayISO()) { q.status = 'accepted'; quotes.push(q); continue; }
        const inv: Invoice = {
          kind: 'invoice', id: uid(), number: formatNumber(s.numbering.invoicePrefix, year, inN++, s.numbering.includeYear, s.numbering.padding),
          clientId: c.id, title: desc, issueDate: invIssue, dueDate: addDays(invIssue, s.paymentTermsDays), status: 'issued', quoteId: q.id, payments: [],
          lines: lines.map(l => ({ ...l, id: uid() })), globalDiscountPct: 0, notes: s.defaultInvoiceNotes, conditions: '', template: s.pdfTemplate, createdAt: now, updatedAt: now,
        };
        const total = inv.lines.reduce((a, l) => a + l.qty * l.unitPrice * (1 + l.vatRate / 100), 0);
        if (m >= 2 || k === 0) inv.payments.push({ id: uid(), date: addDays(invIssue, 12) > todayISO() ? todayISO() : addDays(invIssue, 12), amount: Math.round(total * 100) / 100, method: 'Virement', note: '' });
        else if (k === 1) inv.payments.push({ id: uid(), date: todayISO(), amount: Math.round(total * 30) / 100, method: 'Virement', note: 'Acompte' });
        inv.status = invoiceStatusFromPayments(inv);
        q.status = 'invoiced'; q.invoiceId = inv.id;
        invoices.push(inv);
      }
      quotes.push(q);
    }
  }
  return {
    ...d,
    settings: { ...s, numbering: { ...s.numbering, nextQuote: qn, nextInvoice: inN, lastYear: year } },
    trades,
    clients: [...clients, ...d.clients],
    quotes: [...quotes.reverse(), ...d.quotes],
    invoices: [...invoices.reverse(), ...d.invoices],
  };
}

export const isDemoClient = (c: Client) => c.notes === 'Client de démonstration';
