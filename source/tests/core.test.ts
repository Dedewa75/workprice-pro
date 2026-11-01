import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyMargin, computeCalc, convertMargin, defaultCalcInput, round2, tierUnitPrice } from '../src/core/calc';
import { computeTotals, formatNumber, invoiceFromQuote, invoiceStatusFromPayments, nextNumber, newLine, dashboardStats, monthlySeries } from '../src/core/docs';
import { defaultSettings, emptyData } from '../src/core/defaults';
import type { Invoice, Quote } from '../src/core/types';

const near = (a: number, b: number, eps = 0.005) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);

test('exemple du cahier des charges : 50 € coût, 40 % sur PV → 83,33 €', () => {
  near(round2(applyMargin(50, 40, 'margin')), 83.33);
  const r = computeCalc(defaultCalcInput({ method: 'custom', hours: 0, hourlyRate: 0, customLines: [{ id: 'a', label: 'coût', qty: 1, amount: 50, kind: 'cost' }], marginPct: 40, marginMode: 'margin' }));
  assert.equal(r.priceHT, 83.33);
  assert.equal(r.costPrice, 50);
  near(r.marginOnPricePct, 40, 0.01);
});

test('marge sur coût : 50 € + 40 % = 70 €', () => {
  assert.equal(round2(applyMargin(50, 40, 'markup')), 70);
  near(convertMargin(40, 'margin'), 66.6667, 0.001);
  near(convertMargin(66.6667, 'markup'), 40, 0.001);
});

test('marge 100 % sur PV impossible → avertissement, pas d\'infini', () => {
  const r = computeCalc(defaultCalcInput({ hours: 1, hourlyRate: 50, marginPct: 100, marginMode: 'margin' }));
  assert.ok(isFinite(r.priceHT));
  assert.ok(r.warnings.some(w => w.includes('100')));
});

test('facturation horaire complète : temps, difficulté, frais, modifs, urgence, remise, TVA', () => {
  const r = computeCalc(defaultCalcInput({
    method: 'hourly', quantity: 2, hours: 3, hourlyRate: 40, difficulty: 1.25,
    materials: 20, softwareCosts: 10, travelKm: 50, travelRatePerKm: 0.4, travelFlat: 0, extraFees: 0,
    revisions: 3, revisionsIncluded: 1, hoursPerRevision: 0.5,
    marginPct: 20, marginMode: 'markup', urgencyPct: 10, discountType: 'pct', discountValue: 5, vatRate: 21, chargesPct: 20,
  }));
  // heures = 3×2 + 2×0,5 = 7 ; MO = 7×40×1,25 = 350 ; frais = 20+10+20 = 50 ; coût = 400
  assert.equal(r.hoursTotal, 7);
  assert.equal(r.labourCost, 350);
  assert.equal(r.expenses, 50);
  assert.equal(r.costPrice, 400);
  // 400×1,2 = 480 ; +10 % = 528 ; −5 % = 501,60
  assert.equal(r.basePrice, 480);
  assert.equal(r.priceBeforeDiscount, 528);
  assert.equal(r.priceHT, 501.6);
  assert.equal(r.vatAmount, 105.34);
  assert.equal(r.priceTTC, 606.94);
  // charges = (501,6 − 50)×20 % = 90,32 ; bénéfice = 501,6 − 50 − 90,32 = 361,28
  assert.equal(r.charges, 90.32);
  assert.equal(r.netProfit, 361.28);
  assert.equal(r.unitPriceHT, 250.8);
});

test('marge uniquement sur les frais (tarif horaire = prix de vente)', () => {
  const r = computeCalc(defaultCalcInput({ hours: 2, hourlyRate: 50, materials: 100, marginPct: 25, marginMode: 'markup', marginScope: 'expenses' }));
  assert.equal(r.priceHT, 100 + 125);
});

test('forfait : prix imposé, marge réelle calculée, frais refacturés', () => {
  const r = computeCalc(defaultCalcInput({ method: 'flat', flatPrice: 500, hours: 5, hourlyRate: 40, materials: 100, rebillExpenses: true }));
  assert.equal(r.priceHT, 600);
  assert.equal(r.costPrice, 300);
  assert.equal(r.marginAmount, 300);
  assert.equal(r.marginOnPricePct, 50);
});

test('à l\'unité et par quantité (paliers)', () => {
  assert.equal(computeCalc(defaultCalcInput({ method: 'unit', unitPrice: 70, quantity: 3, hours: 0 })).priceHT, 210);
  const tiers = [{ id: '1', minQty: 1, unitPrice: 70 }, { id: '2', minQty: 2, unitPrice: 60 }, { id: '3', minQty: 5, unitPrice: 50 }];
  assert.equal(tierUnitPrice(tiers, 1), 70);
  assert.equal(tierUnitPrice(tiers, 4), 60);
  assert.equal(tierUnitPrice(tiers, 5), 50);
  assert.equal(computeCalc(defaultCalcInput({ method: 'quantity', tiers, quantity: 5, hours: 0 })).priceHT, 250);
});

test('abonnement : prix × nombre de périodes', () => {
  const r = computeCalc(defaultCalcInput({ method: 'subscription', subscriptionPrice: 49.9, subscriptionDuration: 12, hours: 1, hourlyRate: 30 }));
  assert.equal(r.priceHT, 598.8);
  assert.equal(r.hoursTotal, 12);
  assert.equal(r.unitPriceHT, 49.9);
});

test('remise en montant plafonnée', () => {
  const r = computeCalc(defaultCalcInput({ method: 'flat', flatPrice: 100, hours: 0, discountType: 'amount', discountValue: 150 }));
  assert.equal(r.priceHT, 0);
  assert.ok(r.warnings.length > 0);
});

test('alerte vente à perte', () => {
  const r = computeCalc(defaultCalcInput({ method: 'flat', flatPrice: 50, hours: 2, hourlyRate: 40 }));
  assert.ok(r.warnings.some(w => w.includes('perte')));
});

test('totaux de document : remises, TVA multi-taux, paiements', () => {
  const lines = [
    newLine({ qty: 2, unitPrice: 100, discountPct: 10, vatRate: 21, unitCost: 20 }), // 180
    newLine({ qty: 1, unitPrice: 50, vatRate: 6 }),                                  // 50
  ];
  const t = computeTotals({ lines, globalDiscountPct: 10, payments: [{ amount: 100 }] });
  assert.equal(t.subtotal, 230);
  assert.equal(t.totalHT, 207);           // 162 + 45
  assert.deepEqual(t.vat.map(v => [v.rate, v.base, v.vat]), [[6, 45, 2.7], [21, 162, 34.02]]);
  assert.equal(t.totalTTC, 243.72);
  assert.equal(t.balance, 143.72);
  assert.equal(t.totalCost, 40);
});

test('numérotation : format, unicité, remise à zéro annuelle', () => {
  assert.equal(formatNumber('FAC-', 2026, 7, true, 4), 'FAC-2026-0007');
  const s = defaultSettings();
  const a = nextNumber(s, 'invoice', [], new Date(2026, 3, 1));
  assert.equal(a.number, 'FAC-2026-0001');
  const b = nextNumber(a.settings, 'invoice', ['FAC-2026-0002'], new Date(2026, 3, 2));
  assert.equal(b.number, 'FAC-2026-0003');
  const c = nextNumber(b.settings, 'invoice', [], new Date(2027, 0, 2));
  assert.equal(c.number, 'FAC-2027-0001');
});

test('devis → facture et statut de paiement', () => {
  const s = defaultSettings();
  const q: Quote = { kind: 'quote', id: 'q', number: 'DEV-1', clientId: 'c', title: 'T', issueDate: '2026-01-01', validUntil: '2026-02-01', status: 'accepted', invoiceId: null, lines: [newLine({ qty: 1, unitPrice: 100, vatRate: 21 })], globalDiscountPct: 0, notes: '', conditions: '', template: 'modern', createdAt: '', updatedAt: '' };
  const inv: Invoice = invoiceFromQuote(q, s);
  assert.equal(inv.status, 'draft');
  assert.equal(inv.number, '');
  assert.equal(inv.quoteId, 'q');
  inv.status = 'issued';
  assert.equal(invoiceStatusFromPayments(inv), 'issued');
  inv.payments.push({ id: 'p', date: '2026-01-10', amount: 50, method: 'Virement', note: '' });
  assert.equal(invoiceStatusFromPayments(inv), 'partial');
  inv.payments.push({ id: 'p2', date: '2026-01-11', amount: 71, method: 'Virement', note: '' });
  assert.equal(invoiceStatusFromPayments(inv), 'paid');
});

test('statistiques du tableau de bord', () => {
  const d = emptyData();
  d.settings.chargesPct = 10;
  const mk = (id: string, date: string, status: Invoice['status'], price: number, paid: number): Invoice => ({
    kind: 'invoice', id, number: id, clientId: 'c1', title: '', issueDate: date, dueDate: date, status, quoteId: null,
    payments: paid ? [{ id: 'p' + id, date, amount: paid, method: '', note: '' }] : [],
    lines: [newLine({ qty: 1, unitPrice: price, unitCost: 10 })], globalDiscountPct: 0, notes: '', conditions: '', template: 'modern', createdAt: '', updatedAt: '',
  });
  d.invoices = [mk('a', '2026-03-05', 'paid', 100, 100), mk('b', '2026-03-20', 'issued', 200, 0), mk('c', '2026-03-21', 'draft', 999, 0), mk('d', '2026-01-02', 'cancelled', 999, 0)];
  const st = dashboardStats(d, { from: '2026-03-01', to: '2026-03-31' });
  assert.equal(st.revenue, 300);
  assert.equal(st.cost, 20);
  assert.equal(st.charges, 28);
  assert.equal(st.profit, 252);
  assert.equal(st.invoicesPaid, 1);
  assert.equal(st.invoicesUnpaid, 1);
  assert.equal(st.unpaidAmount, 200);
  assert.equal(st.collected, 100);
  const ms = monthlySeries(d, 3, new Date(2026, 2, 15));
  assert.equal(ms.length, 3);
  assert.equal(ms[2].revenue, 300);
  assert.equal(ms[0].revenue, 0);
});
