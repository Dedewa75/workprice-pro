// ============================================================
// WORKPRICE PRO — Modèle de données
// Toutes les entités portent un id + timestamps pour pouvoir
// migrer plus tard vers une base multi-utilisateurs (Supabase…).
// ============================================================

export type ID = string;

export type BillingMethod = 'hourly' | 'flat' | 'unit' | 'quantity' | 'subscription' | 'custom';
export type MarginMode = 'markup' | 'margin'; // marge sur coût | marge sur prix de vente
export type MarginScope = 'all' | 'expenses'; // marge appliquée à tout le coût ou seulement aux frais
export type Periodicity = 'once' | 'monthly' | 'quarterly' | 'yearly';

export interface Tier { id: ID; minQty: number; unitPrice: number }
export interface CustomLine { id: ID; label: string; qty: number; amount: number; kind: 'cost' | 'sale' }

export interface CalcInput {
  method: BillingMethod;
  name: string;
  tradeId: ID | null;
  description: string;
  unitLabel: string;          // "vidéo", "m²", "page"...
  quantity: number;
  hours: number;              // heures par unité
  hourlyRate: number;
  difficulty: number;         // coefficient multiplicateur (1 = normal)
  // frais (montants totaux, en devise, HT)
  extraFees: number;
  materials: number;
  softwareCosts: number;
  travelKm: number;
  travelRatePerKm: number;
  travelFlat: number;
  // modifications
  revisions: number;          // nombre total prévu
  revisionsIncluded: number;  // dont incluses
  hoursPerRevision: number;
  // méthodes "prix"
  flatPrice: number;
  unitPrice: number;
  tiers: Tier[];
  subscriptionPrice: number;  // par période
  subscriptionPeriod: Periodicity;
  subscriptionDuration: number; // nombre de périodes
  customLines: CustomLine[];
  rebillExpenses: boolean;    // pour les méthodes "prix" : frais refacturés en plus
  // ajustements
  urgencyPct: number;
  marginPct: number;
  marginMode: MarginMode;
  marginScope: MarginScope;
  discountType: 'pct' | 'amount';
  discountValue: number;
  vatRate: number;            // en % ; 0 si non applicable
  chargesPct: number;         // charges sociales/fiscales estimées en % du revenu
}

export interface CalcResult {
  priceDriven: boolean;
  hoursTotal: number;
  labourCost: number;        // main d'œuvre valorisée
  expenses: number;          // frais directs (décaissés)
  costPrice: number;         // coût de revient = MO + frais
  basePrice: number;         // prix avant urgence/remise
  urgencyAmount: number;
  priceBeforeDiscount: number;
  discountAmount: number;
  priceHT: number;
  vatAmount: number;
  priceTTC: number;
  marginAmount: number;      // PV HT − coût de revient
  marginOnPricePct: number;  // taux de marque
  markupOnCostPct: number;   // taux de marge sur coût
  charges: number;           // charges estimées
  netProfit: number;         // PV HT − frais − charges
  unitPriceHT: number;       // prix HT par unité
  effectiveHourly: number;   // revenu net / heure
  recommendedPriceHT: number;// prix conseillé pour atteindre la marge cible (avant urgence/remise)
  warnings: string[];
}

export interface TradeOption { id: ID; name: string; price: number; unit: string }
export interface TradeCost { id: ID; name: string; amount: number; periodicity: Periodicity }
export interface Pack {
  id: ID;
  name: string;
  description: string;
  quantity: number;          // nombre de prestations incluses
  totalPrice: number;        // prix total HT du pack
  referenceUnitPrice: number;// prix unitaire hors pack (pour calcul de l'économie)
  includes: string[];
  optionIds: ID[];
  periodicity: Periodicity;
}
export interface Service {
  id: ID;
  name: string;
  description: string;
  input: CalcInput;          // configuration complète du calcul
}
export interface Trade {
  id: ID;
  name: string;
  description: string;
  color: string;
  defaultHourlyRate: number;
  services: Service[];
  options: TradeOption[];
  packs: Pack[];
  costs: TradeCost[];
  createdAt: string;
  updatedAt: string;
}

export interface Client {
  id: ID;
  type: 'pro' | 'particulier';
  name: string;
  company: string;
  address: string;
  zip: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  vatNumber: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocLine {
  id: ID;
  description: string;
  detail: string;
  qty: number;
  unit: string;
  unitPrice: number;   // HT
  unitCost: number;    // coût de revient unitaire (interne, jamais imprimé)
  discountPct: number;
  vatRate: number;     // %
}

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'refused' | 'invoiced';
export type InvoiceStatus = 'draft' | 'issued' | 'partial' | 'paid' | 'cancelled';

export interface Payment { id: ID; date: string; amount: number; method: string; note: string }

export interface BaseDoc {
  id: ID;
  number: string;           // vide tant qu'une facture est en brouillon
  clientId: ID | null;
  title: string;
  issueDate: string;        // YYYY-MM-DD
  lines: DocLine[];
  globalDiscountPct: number;
  notes: string;
  conditions: string;
  template: PdfTemplate;
  createdAt: string;
  updatedAt: string;
}
export interface Quote extends BaseDoc {
  kind: 'quote';
  validUntil: string;
  status: QuoteStatus;
  invoiceId: ID | null;
}
export interface Invoice extends BaseDoc {
  kind: 'invoice';
  dueDate: string;
  status: InvoiceStatus;
  quoteId: ID | null;
  payments: Payment[];
}
export type Doc = Quote | Invoice;

export type PdfTemplate = 'modern' | 'classic' | 'minimal';

export interface CalcRecord {
  id: ID;
  name: string;
  input: CalcInput;
  priceHT: number;
  createdAt: string;
}

export interface Settings {
  company: {
    name: string; legalForm: string; owner: string;
    address: string; zip: string; city: string; country: string;
    phone: string; email: string; website: string;
    vatNumber: string; companyNumber: string; iban: string; bic: string;
    logo: string; // data URL PNG
  };
  country: string;
  currency: string;
  locale: string;
  vat: { enabled: boolean; rates: number[]; defaultRate: number | null; exemptionMention: string };
  defaultHourlyRate: number;
  defaultMarginPct: number;
  defaultMarginMode: MarginMode;
  chargesPct: number;
  numbering: {
    quotePrefix: string; invoicePrefix: string;
    includeYear: boolean; padding: number;
    nextQuote: number; nextInvoice: number;
    resetYearly: boolean; lastYear: number;
  };
  quoteValidityDays: number;
  paymentTermsDays: number;
  defaultQuoteConditions: string;
  defaultInvoiceNotes: string;
  legalFooter: string;
  pdfTemplate: PdfTemplate;
  accentColor: string;
  theme: 'dark' | 'light';
  onboarded: boolean;
}

export interface AppData {
  schemaVersion: number;
  settings: Settings;
  trades: Trade[];
  clients: Client[];
  quotes: Quote[];
  invoices: Invoice[];
  calculations: CalcRecord[];
}
