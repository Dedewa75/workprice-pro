// ============================================================
// Moteur de calcul de WORKPRICE PRO
// Fonctions pures, testées dans tests/calc.test.ts
// ============================================================
import type { CalcInput, CalcResult, MarginMode, Tier } from './types';

export const round2 = (n: number): number => {
  if (!isFinite(n)) return 0;
  // arrondi commercial (évite 1.005 -> 1.00)
  return Math.round((n + Number.EPSILON) * 100) / 100;
};

const num = (v: unknown, fallback = 0): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.'));
  return isFinite(n) ? n : fallback;
};
const pos = (v: unknown): number => Math.max(0, num(v));

/**
 * Applique une marge à un coût.
 * - markup  (marge sur coût)          : PV = coût × (1 + m)
 * - margin  (marge sur prix de vente) : PV = coût / (1 − m)
 * m est exprimé en % (40 = 40 %).
 */
export function applyMargin(cost: number, pct: number, mode: MarginMode): number {
  const m = num(pct) / 100;
  if (mode === 'markup') return cost * (1 + m);
  if (m >= 1) return Infinity; // impossible : une marge de 100 % sur le PV
  return cost / (1 - m);
}

/** Convertit un taux de marge sur PV en taux sur coût et inversement. */
export function convertMargin(pct: number, from: MarginMode): number {
  const m = num(pct) / 100;
  if (from === 'margin') return m >= 1 ? Infinity : (m / (1 - m)) * 100;
  return (m / (1 + m)) * 100;
}

/** Prix unitaire applicable selon des paliers de quantité (tarif dégressif). */
export function tierUnitPrice(tiers: Tier[], qty: number): number {
  const sorted = [...tiers].filter(t => isFinite(t.minQty)).sort((a, b) => a.minQty - b.minQty);
  let price = sorted.length ? sorted[0].unitPrice : 0;
  for (const t of sorted) if (qty >= t.minQty) price = t.unitPrice;
  return num(price);
}

export function computeCalc(input: CalcInput): CalcResult {
  const warnings: string[] = [];
  const qty = pos(input.quantity) || 0;
  const difficulty = num(input.difficulty, 1) > 0 ? num(input.difficulty, 1) : 1;
  const rate = pos(input.hourlyRate);

  // --- Temps de travail ---
  const extraRevisions = Math.max(0, pos(input.revisions) - pos(input.revisionsIncluded));
  const hoursMain = input.method === 'subscription'
    ? pos(input.hours) * Math.max(1, pos(input.subscriptionDuration))
    : pos(input.hours) * (input.method === 'flat' || input.method === 'custom' ? 1 : qty);
  const hoursTotal = hoursMain + extraRevisions * pos(input.hoursPerRevision);
  const labourCost = hoursTotal * rate * difficulty;

  // --- Frais directs ---
  const travel = pos(input.travelKm) * pos(input.travelRatePerKm) + pos(input.travelFlat);
  let expenses = pos(input.extraFees) + pos(input.materials) + pos(input.softwareCosts) + travel;

  let customSale = 0;
  if (input.method === 'custom') {
    for (const l of input.customLines || []) {
      const amt = pos(l.qty) * num(l.amount);
      if (l.kind === 'cost') expenses += amt; else customSale += amt;
    }
  }
  const costPrice = labourCost + expenses;

  // --- Prix conseillé (coût + marge cible) ---
  const marginPct = num(input.marginPct);
  if (input.marginMode === 'margin' && marginPct >= 100) warnings.push('Une marge sur prix de vente doit être inférieure à 100 %.');
  const safeMargin = input.marginMode === 'margin' ? Math.min(marginPct, 99.99) : marginPct;
  const costPlus = input.marginScope === 'expenses'
    ? labourCost + applyMargin(expenses, safeMargin, input.marginMode)
    : applyMargin(costPrice, safeMargin, input.marginMode);

  // --- Prix de base selon la méthode ---
  let priceDriven = true;
  let methodPrice = 0;
  switch (input.method) {
    case 'hourly':
      priceDriven = false;
      break;
    case 'flat':
      methodPrice = pos(input.flatPrice);
      break;
    case 'unit':
      methodPrice = pos(input.unitPrice) * qty;
      break;
    case 'quantity':
      methodPrice = tierUnitPrice(input.tiers || [], qty) * qty;
      break;
    case 'subscription':
      methodPrice = pos(input.subscriptionPrice) * Math.max(1, pos(input.subscriptionDuration));
      break;
    case 'custom':
      if (customSale > 0) methodPrice = customSale; else priceDriven = false;
      break;
  }
  let basePrice: number;
  if (priceDriven) {
    basePrice = methodPrice + (input.rebillExpenses ? expenses : 0);
  } else {
    basePrice = costPlus;
  }

  // --- Urgence, remise ---
  const urgencyAmount = basePrice * (pos(input.urgencyPct) / 100);
  const priceBeforeDiscount = basePrice + urgencyAmount;
  let discountAmount = input.discountType === 'pct'
    ? priceBeforeDiscount * (Math.min(100, pos(input.discountValue)) / 100)
    : pos(input.discountValue);
  if (discountAmount > priceBeforeDiscount) {
    warnings.push('La remise dépasse le prix : elle a été plafonnée.');
    discountAmount = priceBeforeDiscount;
  }
  const priceHT = round2(priceBeforeDiscount - discountAmount);
  const vatRate = pos(input.vatRate);
  const vatAmount = round2(priceHT * vatRate / 100);
  const priceTTC = round2(priceHT + vatAmount);

  // --- Indicateurs ---
  const marginAmount = priceHT - costPrice;
  const marginOnPricePct = priceHT > 0 ? (marginAmount / priceHT) * 100 : 0;
  const markupOnCostPct = costPrice > 0 ? (marginAmount / costPrice) * 100 : 0;
  const charges = Math.max(0, priceHT - expenses) * (pos(input.chargesPct) / 100);
  const netProfit = priceHT - expenses - charges;
  const unitsForPrice = input.method === 'subscription' ? Math.max(1, pos(input.subscriptionDuration)) : (input.method === 'flat' || input.method === 'custom' ? 1 : qty);
  const unitPriceHT = unitsForPrice > 0 ? priceHT / unitsForPrice : priceHT;
  const effectiveHourly = hoursTotal > 0 ? netProfit / hoursTotal : 0;

  if (priceHT > 0 && priceHT < costPrice) warnings.push('Le prix de vente est inférieur au coût de revient : tu travailles à perte.');
  if (priceHT > 0 && priceHT < expenses) warnings.push('Le prix ne couvre même pas les frais directs.');
  if (priceDriven && costPlus > 0 && round2(basePrice) < round2(costPlus)) warnings.push(`Prix inférieur au prix conseillé pour ta marge cible.`);
  if (['unit', 'quantity'].includes(input.method) && qty <= 0) warnings.push('Indique une quantité supérieure à 0.');

  return {
    priceDriven,
    hoursTotal: round2(hoursTotal),
    labourCost: round2(labourCost),
    expenses: round2(expenses),
    costPrice: round2(costPrice),
    basePrice: round2(basePrice),
    urgencyAmount: round2(urgencyAmount),
    priceBeforeDiscount: round2(priceBeforeDiscount),
    discountAmount: round2(discountAmount),
    priceHT,
    vatAmount,
    priceTTC,
    marginAmount: round2(marginAmount),
    marginOnPricePct: round2(marginOnPricePct),
    markupOnCostPct: round2(markupOnCostPct),
    charges: round2(charges),
    netProfit: round2(netProfit),
    unitPriceHT: round2(unitPriceHT),
    effectiveHourly: round2(effectiveHourly),
    recommendedPriceHT: round2(isFinite(costPlus) ? costPlus : 0),
    warnings,
  };
}

let counter = 0;
export const uid = (): string =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8) + (counter++).toString(36);

export function defaultCalcInput(over: Partial<CalcInput> = {}): CalcInput {
  return {
    method: 'hourly', name: '', tradeId: null, description: '', unitLabel: 'unité',
    quantity: 1, hours: 1, hourlyRate: 35, difficulty: 1,
    extraFees: 0, materials: 0, softwareCosts: 0, travelKm: 0, travelRatePerKm: 0, travelFlat: 0,
    revisions: 0, revisionsIncluded: 0, hoursPerRevision: 0.5,
    flatPrice: 0, unitPrice: 0,
    tiers: [{ id: uid(), minQty: 1, unitPrice: 0 }],
    subscriptionPrice: 0, subscriptionPeriod: 'monthly', subscriptionDuration: 1,
    customLines: [], rebillExpenses: false,
    urgencyPct: 0, marginPct: 30, marginMode: 'margin', marginScope: 'all',
    discountType: 'pct', discountValue: 0, vatRate: 0, chargesPct: 0,
    ...over,
  };
}
