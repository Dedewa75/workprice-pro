// ============================================================
// Valeurs par défaut, modèles de métiers, migration des données
// Aucun taux de TVA n'est imposé : l'utilisateur les saisit lui-même.
// ============================================================
import { defaultCalcInput, uid } from './calc';
import type { AppData, Pack, Service, Settings, Trade, TradeCost, TradeOption, BillingMethod, CalcInput } from './types';

export const SCHEMA_VERSION = 1;

export function defaultSettings(): Settings {
  return {
    company: {
      name: '', legalForm: '', owner: '', address: '', zip: '', city: '', country: 'Belgique',
      phone: '', email: '', website: '', vatNumber: '', companyNumber: '', iban: '', bic: '', logo: '',
    },
    country: 'Belgique',
    currency: 'EUR',
    locale: 'fr-BE',
    vat: { enabled: false, rates: [], defaultRate: null, exemptionMention: '' },
    defaultHourlyRate: 35,
    defaultMarginPct: 30,
    defaultMarginMode: 'margin',
    chargesPct: 0,
    numbering: { quotePrefix: 'DEV-', invoicePrefix: 'FAC-', includeYear: true, padding: 4, nextQuote: 1, nextInvoice: 1, resetYearly: true, lastYear: 0 },
    quoteValidityDays: 30,
    paymentTermsDays: 30,
    defaultQuoteConditions: 'Devis valable jusqu\'à la date indiquée. Pour accepter ce devis, merci de le renvoyer daté et signé avec la mention « Bon pour accord ».',
    defaultInvoiceNotes: 'Merci pour votre confiance. Paiement par virement en mentionnant le numéro de facture.',
    legalFooter: '',
    pdfTemplate: 'modern',
    accentColor: '#7c5cff',
    theme: 'dark',
    onboarded: false,
  };
}

export function emptyData(): AppData {
  return { schemaVersion: SCHEMA_VERSION, settings: defaultSettings(), trades: [], clients: [], quotes: [], invoices: [], calculations: [] };
}

/** Fusion tolérante : sert à charger d'anciennes sauvegardes ou des fichiers importés. */
export function migrate(raw: unknown): AppData {
  const base = emptyData();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<AppData>;
  const ds = base.settings;
  const s = (r.settings || {}) as Partial<Settings>;
  const settings: Settings = {
    ...ds, ...s,
    company: { ...ds.company, ...(s.company || {}) },
    vat: { ...ds.vat, ...(s.vat || {}) },
    numbering: { ...ds.numbering, ...(s.numbering || {}) },
  };
  const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  return {
    schemaVersion: SCHEMA_VERSION,
    settings,
    trades: arr<Trade>(r.trades).map(t => ({
      ...t,
      options: arr<TradeOption>(t.options),
      packs: arr<Pack>(t.packs).map(p => ({ ...p, includes: arr<string>(p.includes), optionIds: arr<string>(p.optionIds) })),
      costs: arr<TradeCost>(t.costs),
      services: arr<Service>(t.services).map(sv => ({ ...sv, input: defaultCalcInput(sv.input) })),
    })),
    clients: arr(r.clients),
    quotes: arr(r.quotes),
    invoices: arr<AppData['invoices'][number]>(r.invoices).map(i => ({ ...i, payments: arr(i.payments) })),
    calculations: arr<AppData['calculations'][number]>(r.calculations).map(c => ({ ...c, input: defaultCalcInput(c.input) })),
  };
}

export function isValidBackup(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false;
  const r = raw as Record<string, unknown>;
  return 'settings' in r && Array.isArray(r.trades) && Array.isArray(r.clients);
}

// ------------------------------------------------------------
// Modèles de métiers (prix d'exemple, entièrement modifiables)
// ------------------------------------------------------------
interface TplService { name: string; description?: string; method: BillingMethod; input: Partial<CalcInput> }
interface TradeTemplate {
  key: string; name: string; description: string; color: string; rate: number;
  services: TplService[];
  options: Omit<TradeOption, 'id'>[];
  packs: Omit<Pack, 'id' | 'optionIds'>[];
  costs: Omit<TradeCost, 'id'>[];
}

export const TRADE_TEMPLATES: TradeTemplate[] = [
  {
    key: 'video', name: 'Montage vidéo', description: 'Montage, motion design, sous-titres, formats courts et longs.', color: '#7c5cff', rate: 35,
    services: [
      { name: 'Vidéo courte (Reels/TikTok)', method: 'unit', input: { unitLabel: 'vidéo', unitPrice: 70, hours: 1.5, quantity: 1 } },
      { name: 'Vidéo YouTube 10 min', method: 'hourly', input: { unitLabel: 'vidéo', hours: 6, quantity: 1, revisions: 2, revisionsIncluded: 2, hoursPerRevision: 0.5 } },
      { name: 'Volume de vidéos courtes', method: 'quantity', input: { unitLabel: 'vidéo', hours: 1.5, quantity: 5, tiers: [{ id: 't1', minQty: 1, unitPrice: 70 }, { id: 't2', minQty: 2, unitPrice: 60 }, { id: 't3', minQty: 5, unitPrice: 50 }] } },
    ],
    options: [{ name: 'Sous-titres animés', price: 15, unit: 'vidéo' }, { name: 'Miniature', price: 20, unit: 'vidéo' }, { name: 'Livraison express 24 h', price: 30, unit: 'commande' }],
    packs: [
      { name: '1 vidéo', description: 'Montage d\'une vidéo courte', quantity: 1, totalPrice: 70, referenceUnitPrice: 70, includes: ['1 vidéo montée', '2 modifications'], periodicity: 'once' },
      { name: 'Pack 2 vidéos', description: '', quantity: 2, totalPrice: 120, referenceUnitPrice: 70, includes: ['2 vidéos montées', '2 modifications / vidéo'], periodicity: 'once' },
      { name: 'Pack 5 vidéos', description: '', quantity: 5, totalPrice: 250, referenceUnitPrice: 70, includes: ['5 vidéos montées', '2 modifications / vidéo', 'Musique libre de droits'], periodicity: 'once' },
    ],
    costs: [{ name: 'Logiciel de montage', amount: 25, periodicity: 'monthly' }, { name: 'Banque de musiques', amount: 15, periodicity: 'monthly' }],
  },
  {
    key: 'web', name: 'Création de sites Internet', description: 'Sites vitrines, e-commerce, maintenance et hébergement.', color: '#22c3ee', rate: 45,
    services: [
      { name: 'Site vitrine', method: 'flat', input: { flatPrice: 900, hours: 18, unitLabel: 'site' } },
      { name: 'Site professionnel', method: 'flat', input: { flatPrice: 1800, hours: 35, unitLabel: 'site' } },
      { name: 'Site e-commerce', method: 'flat', input: { flatPrice: 3500, hours: 70, unitLabel: 'site' } },
      { name: 'Maintenance mensuelle', method: 'subscription', input: { subscriptionPrice: 49, subscriptionDuration: 12, subscriptionPeriod: 'monthly', hours: 1, unitLabel: 'mois' } },
      { name: 'Modifications à l\'heure', method: 'hourly', input: { hours: 1, unitLabel: 'heure' } },
    ],
    options: [{ name: 'Hébergement + nom de domaine', price: 120, unit: 'an' }, { name: 'Page supplémentaire', price: 90, unit: 'page' }, { name: 'Rédaction SEO', price: 60, unit: 'page' }],
    packs: [
      { name: 'Site vitrine', description: 'Jusqu\'à 5 pages', quantity: 1, totalPrice: 900, referenceUnitPrice: 900, includes: ['5 pages', 'Responsive', 'Formulaire de contact'], periodicity: 'once' },
      { name: 'Site e-commerce', description: '', quantity: 1, totalPrice: 3500, referenceUnitPrice: 3500, includes: ['Catalogue produits', 'Paiement en ligne', 'Formation'], periodicity: 'once' },
      { name: 'Maintenance', description: 'Mises à jour, sauvegardes, petites modifications', quantity: 1, totalPrice: 49, referenceUnitPrice: 49, includes: ['Mises à jour', 'Sauvegardes', '30 min de modifications'], periodicity: 'monthly' },
    ],
    costs: [{ name: 'Hébergement', amount: 8, periodicity: 'monthly' }],
  },
  {
    key: 'design', name: 'Graphisme & logos', description: 'Identité visuelle, logos, supports print et réseaux.', color: '#f472b6', rate: 40,
    services: [
      { name: 'Création de logo', method: 'flat', input: { flatPrice: 350, hours: 8, revisions: 3, revisionsIncluded: 3, unitLabel: 'logo' } },
      { name: 'Visuel réseaux sociaux', method: 'unit', input: { unitPrice: 25, hours: 0.5, quantity: 10, unitLabel: 'visuel' } },
    ],
    options: [{ name: 'Charte graphique', price: 250, unit: 'forfait' }, { name: 'Modification supplémentaire', price: 30, unit: 'modif' }],
    packs: [{ name: 'Identité de base', description: '', quantity: 1, totalPrice: 550, referenceUnitPrice: 600, includes: ['Logo', 'Charte simplifiée', 'Cartes de visite'], periodicity: 'once' }],
    costs: [{ name: 'Suite graphique', amount: 30, periodicity: 'monthly' }],
  },
  {
    key: 'photo', name: 'Photographie', description: 'Shooting, retouche, événementiel.', color: '#f59e0b', rate: 50,
    services: [
      { name: 'Shooting 2 h', method: 'hourly', input: { hours: 2, travelKm: 30, unitLabel: 'séance' } },
      { name: 'Retouche photo', method: 'unit', input: { unitPrice: 8, hours: 0.15, quantity: 20, unitLabel: 'photo' } },
    ],
    options: [{ name: 'Tirages A4', price: 12, unit: 'tirage' }],
    packs: [{ name: 'Événement demi-journée', description: '', quantity: 1, totalPrice: 450, referenceUnitPrice: 450, includes: ['4 h sur place', '80 photos retouchées'], periodicity: 'once' }],
    costs: [{ name: 'Assurance matériel', amount: 15, periodicity: 'monthly' }],
  },
  {
    key: 'cm', name: 'Community management', description: 'Gestion des réseaux sociaux, création de contenus.', color: '#34d399', rate: 35,
    services: [{ name: 'Gestion mensuelle', method: 'subscription', input: { subscriptionPrice: 450, subscriptionDuration: 3, hours: 12, unitLabel: 'mois' } }],
    options: [{ name: 'Publicité sponsorisée (gestion)', price: 100, unit: 'mois' }],
    packs: [
      { name: 'Starter', description: '8 publications / mois', quantity: 8, totalPrice: 300, referenceUnitPrice: 45, includes: ['8 posts', '1 réseau'], periodicity: 'monthly' },
      { name: 'Pro', description: '16 publications / mois', quantity: 16, totalPrice: 550, referenceUnitPrice: 45, includes: ['16 posts', '2 réseaux', 'Rapport mensuel'], periodicity: 'monthly' },
    ],
    costs: [{ name: 'Outil de planification', amount: 20, periodicity: 'monthly' }],
  },
  {
    key: 'it', name: 'Prestations informatiques', description: 'Dépannage, installation, assistance.', color: '#60a5fa', rate: 45,
    services: [{ name: 'Dépannage à domicile', method: 'hourly', input: { hours: 1.5, travelFlat: 15, unitLabel: 'intervention' } }],
    options: [{ name: 'Intervention urgente', price: 30, unit: 'intervention' }],
    packs: [{ name: 'Carnet 5 h d\'assistance', description: '', quantity: 5, totalPrice: 200, referenceUnitPrice: 45, includes: ['5 h valables 1 an'], periodicity: 'once' }],
    costs: [],
  },
  {
    key: 'build', name: 'Bâtiment & rénovation', description: 'Travaux, rénovation, au m² ou au forfait.', color: '#fb7185', rate: 40,
    services: [
      { name: 'Peinture au m²', method: 'unit', input: { unitPrice: 18, hours: 0.25, quantity: 40, unitLabel: 'm²', materials: 120 } },
      { name: 'Rénovation salle de bain', method: 'custom', input: { hours: 40, customLines: [{ id: 'c1', label: 'Matériaux', qty: 1, amount: 2200, kind: 'cost' }, { id: 'c2', label: 'Location benne', qty: 1, amount: 180, kind: 'cost' }], marginPct: 25, unitLabel: 'chantier' } },
    ],
    options: [{ name: 'Évacuation des déchets', price: 150, unit: 'forfait' }],
    packs: [],
    costs: [{ name: 'Assurance professionnelle', amount: 60, periodicity: 'monthly' }],
  },
  {
    key: 'home', name: 'Services à domicile', description: 'Ménage, jardinage, petits travaux.', color: '#a3e635', rate: 25,
    services: [{ name: 'Intervention 2 h', method: 'hourly', input: { hours: 2, unitLabel: 'intervention' } }],
    options: [],
    packs: [{ name: 'Forfait mensuel 8 h', description: '', quantity: 8, totalPrice: 180, referenceUnitPrice: 25, includes: ['8 h / mois'], periodicity: 'monthly' }],
    costs: [],
  },
];

export function tradeFromTemplate(key: string, settings: Settings): Trade | null {
  const t = TRADE_TEMPLATES.find(x => x.key === key);
  if (!t) return null;
  const now = new Date().toISOString();
  const tradeId = uid();
  const options = t.options.map(o => ({ ...o, id: uid() }));
  return {
    id: tradeId, name: t.name, description: t.description, color: t.color, defaultHourlyRate: t.rate,
    services: t.services.map(s => ({
      id: uid(), name: s.name, description: s.description || '',
      input: defaultCalcInput({
        ...s.input, method: s.method, name: s.name, tradeId, hourlyRate: t.rate,
        marginPct: s.input.marginPct ?? settings.defaultMarginPct, marginMode: settings.defaultMarginMode,
        chargesPct: settings.chargesPct, vatRate: settings.vat.enabled ? settings.vat.defaultRate ?? 0 : 0,
        tiers: (s.input.tiers || [{ id: '', minQty: 1, unitPrice: 0 }]).map(x => ({ ...x, id: uid() })),
        customLines: (s.input.customLines || []).map(x => ({ ...x, id: uid() })),
      }),
    })),
    options,
    packs: t.packs.map(p => ({ ...p, id: uid(), optionIds: [] })),
    costs: t.costs.map(c => ({ ...c, id: uid() })),
    createdAt: now, updatedAt: now,
  };
}

export function blankTrade(settings: Settings): Trade {
  const now = new Date().toISOString();
  return { id: uid(), name: 'Nouveau métier', description: '', color: '#7c5cff', defaultHourlyRate: settings.defaultHourlyRate, services: [], options: [], packs: [], costs: [], createdAt: now, updatedAt: now };
}
