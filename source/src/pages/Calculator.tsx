import React, { useMemo, useState } from 'react';
import { LuClock, LuPackage, LuHash, LuLayers, LuRepeat, LuWand, LuPlus, LuTrash2, LuSave, LuFilePlus, LuRotateCcw, LuTriangleAlert, LuHistory, LuBriefcase, LuCalculator, LuArrowRight, LuFolderOpen } from 'react-icons/lu';
import { useData } from '../core/store';
import { computeCalc, uid, convertMargin, round2 } from '../core/calc';
import { saveCalculation, saveServiceToTrade, newCalcInput, createQuote, lineFromCalc, deleteCalculation, saveQuote } from '../core/actions';
import type { BillingMethod, CalcInput, Periodicity, CalcResult } from '../core/types';
import { Button, Card, CardHeader, Field, NumberInput, PageHeader, Segmented, Select, TextArea, TextInput, Toggle, cx, useUI, Modal, Empty, Badge, IconButton } from '../ui/kit';
import { money, pct, numFmt, METHOD_LABELS, METHOD_HELP, PERIOD_LABELS, dateFmt } from '../ui/format';
import { go, handoff } from '../ui/router';

const METHOD_ICONS: Record<BillingMethod, React.ReactNode> = {
  hourly: <LuClock />, flat: <LuPackage />, unit: <LuHash />, quantity: <LuLayers />, subscription: <LuRepeat />, custom: <LuWand />,
};
const PERIOD_UNIT: Record<Periodicity, string> = { once: 'unité', monthly: 'mois', quarterly: 'trimestre', yearly: 'an' };
const DIFFICULTY = [
  { value: '0.9', label: 'Facile ×0,9' }, { value: '1', label: 'Normale ×1' }, { value: '1.2', label: 'Complexe ×1,2' },
  { value: '1.5', label: 'Très complexe ×1,5' }, { value: 'custom', label: 'Coefficient perso…' },
];

export interface CalcHandoff { input: CalcInput; serviceId?: string }

export default function Calculator({ route }: { route: string[] }) {
  const data = useData();
  const s = data.settings;
  const ui = useUI();
  const initial = useMemo(() => handoff.take<CalcHandoff>(), []);
  const [input, setInput] = useState<CalcInput>(() => initial?.input ? JSON.parse(JSON.stringify(initial.input)) : newCalcInput());
  const [serviceId, setServiceId] = useState<string | undefined>(initial?.serviceId);
  const [saveTo, setSaveTo] = useState<null | 'trade' | 'quote'>(null);
  const tab = route[1] === 'history' ? 'history' : 'calc';
  const r = useMemo(() => computeCalc(input), [input]);
  const set = (p: Partial<CalcInput>) => setInput(i => ({ ...i, ...p }));
  const m = (n: number) => money(n, s);
  const trade = data.trades.find(t => t.id === input.tradeId);
  const diffKey = DIFFICULTY.some(d => d.value === String(input.difficulty)) ? String(input.difficulty) : 'custom';
  const [customDiff, setCustomDiff] = useState(diffKey === 'custom');

  const loadService = (tradeId: string, sid: string) => {
    const t = data.trades.find(x => x.id === tradeId);
    const sv = t?.services.find(x => x.id === sid);
    if (!sv) return;
    setInput(JSON.parse(JSON.stringify({ ...sv.input, tradeId })));
    setServiceId(sv.id);
    ui.toast(`Prestation « ${sv.name} » chargée`, 'info');
  };
  const onTrade = (id: string) => {
    const t = data.trades.find(x => x.id === id);
    set({ tradeId: id || null, ...(t ? { hourlyRate: t.defaultHourlyRate } : {}) });
    setServiceId(undefined);
  };

  const createQuoteFromCalc = () => {
    const q = createQuote({ title: input.name, lines: [lineFromCalc(input)] });
    ui.toast(`Devis ${q.number} créé`);
    go(`quotes/${q.id}`);
  };

  if (tab === 'history') return <History />;

  return (
    <div>
      <PageHeader title="Calculateur universel" subtitle="Calcule un prix juste, quelle que soit ta prestation. Tout se met à jour en direct."
        actions={<>
          <Button icon={<LuHistory />} onClick={() => go('calculator/history')}>Historique ({data.calculations.length})</Button>
          <Button variant="ghost" icon={<LuRotateCcw />} onClick={() => { setInput(newCalcInput()); setServiceId(undefined); }}>Réinitialiser</Button>
        </>} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          {/* Prestation */}
          <Card className="anim-in">
            <CardHeader title="Prestation" icon={<LuBriefcase />} subtitle="Choisis un métier ou pars de zéro" />
            <div className="grid gap-3 px-5 pb-5 sm:grid-cols-2">
              <Field label="Nom de la prestation"><TextInput value={input.name} onChange={v => set({ name: v })} placeholder="Ex. Montage vidéo YouTube" /></Field>
              <Field label="Catégorie (métier)">
                <Select value={input.tradeId || ''} onChange={onTrade} options={[{ value: '', label: '— Aucune —' }, ...data.trades.map(t => ({ value: t.id, label: t.name }))]} />
              </Field>
              {trade && trade.services.length > 0 && (
                <Field label="Partir d'une prestation enregistrée" className="sm:col-span-2">
                  <Select value={serviceId && trade.services.some(x => x.id === serviceId) ? serviceId : ''} onChange={v => v && loadService(trade.id, v)}
                    options={[{ value: '', label: `— ${trade.services.length} prestation(s) disponible(s) —` }, ...trade.services.map(x => ({ value: x.id, label: `${x.name} · ${METHOD_LABELS[x.input.method]}` }))]} />
                </Field>
              )}
              <Field label="Description" className="sm:col-span-2"><TextArea value={input.description} onChange={v => set({ description: v })} placeholder="Détail visible sur le devis (facultatif)" className="min-h-[64px]" /></Field>
            </div>
          </Card>

          {/* Méthode */}
          <Card className="anim-in">
            <CardHeader title="Méthode de facturation" subtitle={METHOD_HELP[input.method]} icon={<LuCalculator />} />
            <div className="grid grid-cols-2 gap-2 px-5 pb-5 sm:grid-cols-3">
              {(Object.keys(METHOD_LABELS) as BillingMethod[]).map(k => (
                <button key={k} type="button" onClick={() => set({ method: k })} data-method={k}
                  className={cx('flex items-center gap-2.5 rounded-xl border px-3 py-3 text-left text-sm font-medium transition ring-accent',
                    input.method === k ? 'border-accent bg-accent/10 text-ink' : 'border-line bg-surface-2 text-muted hover:text-ink')}>
                  <span className={cx('text-lg', input.method === k ? 'text-accent' : 'text-faint')}>{METHOD_ICONS[k]}</span>{METHOD_LABELS[k]}
                </button>
              ))}
            </div>
            <div className="grid gap-3 border-t border-line px-5 py-5 sm:grid-cols-2 lg:grid-cols-3">
              <MethodFields input={input} set={set} />
            </div>
          </Card>

          {/* Temps */}
          <Card className="anim-in">
            <CardHeader title="Temps de travail & difficulté" icon={<LuClock />} subtitle={input.method === 'hourly' ? 'Base du prix' : 'Sert à calculer ton coût de revient et ta rentabilité'} />
            <div className="grid gap-3 px-5 pb-5 sm:grid-cols-2 lg:grid-cols-4">
              <Field label={hoursLabel(input)}><NumberInput value={input.hours} onChange={v => set({ hours: v })} suffix="h" min={0} /></Field>
              <Field label="Tarif horaire"><NumberInput value={input.hourlyRate} onChange={v => set({ hourlyRate: v })} suffix={`${s.currency}/h`} min={0} /></Field>
              <Field label="Difficulté du travail">
                <Select value={customDiff ? 'custom' : diffKey} onChange={v => { if (v === 'custom') setCustomDiff(true); else { setCustomDiff(false); set({ difficulty: parseFloat(v) }); } }} options={DIFFICULTY} />
              </Field>
              {customDiff && <Field label="Coefficient"><NumberInput value={input.difficulty} onChange={v => set({ difficulty: v || 1 })} suffix="×" min={0} /></Field>}
            </div>
            <div className="grid gap-3 border-t border-line px-5 py-4 sm:grid-cols-3">
              <Field label="Nombre de modifications prévues"><NumberInput value={input.revisions} onChange={v => set({ revisions: Math.round(v) })} min={0} /></Field>
              <Field label="Dont incluses dans le prix"><NumberInput value={input.revisionsIncluded} onChange={v => set({ revisionsIncluded: Math.round(v) })} min={0} /></Field>
              <Field label="Temps par modification supplémentaire" hint={input.revisions > input.revisionsIncluded ? `${input.revisions - input.revisionsIncluded} modif. facturée(s)` : undefined}>
                <NumberInput value={input.hoursPerRevision} onChange={v => set({ hoursPerRevision: v })} suffix="h" min={0} />
              </Field>
            </div>
          </Card>

          {/* Frais */}
          <Card className="anim-in">
            <CardHeader title="Frais & coûts" icon={<LuPackage />} subtitle="Montants HT pour cette prestation" />
            <div className="grid gap-3 px-5 pb-5 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Matériel utilisé"><NumberInput value={input.materials} onChange={v => set({ materials: v })} suffix={s.currency} min={0} /></Field>
              <Field label="Coûts logiciels"><NumberInput value={input.softwareCosts} onChange={v => set({ softwareCosts: v })} suffix={s.currency} min={0} /></Field>
              <Field label="Frais supplémentaires"><NumberInput value={input.extraFees} onChange={v => set({ extraFees: v })} suffix={s.currency} min={0} /></Field>
              <Field label="Déplacement : distance"><NumberInput value={input.travelKm} onChange={v => set({ travelKm: v })} suffix="km" min={0} /></Field>
              <Field label="Coût au km"><NumberInput value={input.travelRatePerKm} onChange={v => set({ travelRatePerKm: v })} suffix={`${s.currency}/km`} min={0} /></Field>
              <Field label="Déplacement forfaitaire"><NumberInput value={input.travelFlat} onChange={v => set({ travelFlat: v })} suffix={s.currency} min={0} /></Field>
            </div>
            {r.priceDriven && (
              <div className="border-t border-line px-5 py-4">
                <Toggle checked={input.rebillExpenses} onChange={v => set({ rebillExpenses: v })} label="Refacturer ces frais au client en plus du prix" hint="Sinon, les frais sont inclus dans ton prix et réduisent ta marge." />
              </div>
            )}
          </Card>

          {/* Ajustements */}
          <Card className="anim-in">
            <CardHeader title="Marge, urgence, remise & TVA" icon={<LuLayers />} />
            <div className="grid gap-4 px-5 pb-5 lg:grid-cols-2">
              <div className="space-y-3 rounded-xl border border-line bg-surface-2 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{r.priceDriven ? 'Marge cible (pour le prix conseillé)' : 'Marge souhaitée'}</p>
                </div>
                <NumberInput value={input.marginPct} onChange={v => set({ marginPct: v })} suffix="%" min={0} aria-label="Marge souhaitée" />
                <Segmented value={input.marginMode} onChange={v => set({ marginMode: v })} options={[{ value: 'margin', label: 'Sur prix de vente' }, { value: 'markup', label: 'Sur coût' }]} />
                <p className="text-[11px] text-faint">
                  {input.marginMode === 'margin'
                    ? `PV = coût ÷ (1 − ${numFmt(input.marginPct)} %). Équivaut à ${numFmt(convertMargin(input.marginPct, 'margin'), 1)} % sur coût.`
                    : `PV = coût × (1 + ${numFmt(input.marginPct)} %). Équivaut à ${numFmt(convertMargin(input.marginPct, 'markup'), 1)} % du prix de vente.`}
                </p>
                <Select value={input.marginScope} onChange={v => set({ marginScope: v })} aria-label="Appliquer la marge sur"
                  options={[{ value: 'all', label: 'Marge sur tout le coût (temps + frais)' }, { value: 'expenses', label: 'Marge seulement sur les frais (mon tarif horaire est déjà un prix de vente)' }]} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Majoration pour urgence"><NumberInput value={input.urgencyPct} onChange={v => set({ urgencyPct: v })} suffix="%" min={0} /></Field>
                <Field label="Remise éventuelle">
                  <div className="flex gap-2">
                    <NumberInput className="flex-1" value={input.discountValue} onChange={v => set({ discountValue: v })} min={0} suffix={input.discountType === 'pct' ? '%' : s.currency} />
                    <div className="w-24 shrink-0"><Select value={input.discountType} onChange={v => set({ discountType: v })} options={[{ value: 'pct', label: '%' }, { value: 'amount', label: s.currency }]} aria-label="Type de remise" /></div>
                  </div>
                </Field>
                <Field label="TVA" hint={!s.vat.enabled ? 'TVA désactivée dans les paramètres' : undefined}>
                  {s.vat.enabled && s.vat.rates.length > 0 ? (
                    <Select value={String(input.vatRate)} onChange={v => set({ vatRate: parseFloat(v) })}
                      options={[...new Set([...s.vat.rates, input.vatRate])].sort((a, b) => a - b).map(x => ({ value: String(x), label: `${numFmt(x)} %` }))} />
                  ) : <NumberInput value={input.vatRate} onChange={v => set({ vatRate: v })} suffix="%" min={0} />}
                </Field>
                <Field label="Charges estimées" hint="Cotisations / impôts, en % du revenu"><NumberInput value={input.chargesPct} onChange={v => set({ chargesPct: v })} suffix="%" min={0} max={100} /></Field>
              </div>
            </div>
          </Card>
        </div>

        {/* Résultat */}
        <div className="xl:sticky xl:top-6 xl:self-start">
          <ResultPanel r={r} input={input} m={m} onApplyRecommended={() => {
            const p = r.recommendedPriceHT;
            if (input.method === 'flat') set({ flatPrice: round2(p - (input.rebillExpenses ? r.expenses : 0)) });
            else if (input.method === 'unit') set({ unitPrice: round2((p - (input.rebillExpenses ? r.expenses : 0)) / Math.max(1, input.quantity)) });
            else if (input.method === 'subscription') set({ subscriptionPrice: round2((p - (input.rebillExpenses ? r.expenses : 0)) / Math.max(1, input.subscriptionDuration)) });
            ui.toast('Prix conseillé appliqué');
          }} />
          <Card className="mt-3 p-4">
            <div className="grid gap-2">
              <Button variant="primary" icon={<LuFilePlus />} onClick={createQuoteFromCalc} disabled={r.priceHT <= 0}>Créer un devis avec ce prix</Button>
              <Button icon={<LuArrowRight />} onClick={() => setSaveTo('quote')} disabled={r.priceHT <= 0}>Ajouter à un devis existant</Button>
              <div className="grid grid-cols-2 gap-2">
                <Button icon={<LuSave />} onClick={() => { saveCalculation(input); ui.toast('Calcul enregistré dans l\'historique'); }}>Enregistrer</Button>
                <Button icon={<LuBriefcase />} onClick={() => setSaveTo('trade')}>Dans un métier</Button>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <SaveToTrade open={saveTo === 'trade'} onClose={() => setSaveTo(null)} input={input} serviceId={serviceId} onSaved={(tid, sid) => { setServiceId(sid); set({ tradeId: tid }); }} />
      <AddToQuote open={saveTo === 'quote'} onClose={() => setSaveTo(null)} input={input} />
    </div>
  );
}

function hoursLabel(i: CalcInput) {
  switch (i.method) {
    case 'hourly': case 'unit': case 'quantity': return `Temps par ${i.unitLabel || 'unité'}`;
    case 'subscription': return 'Temps par période';
    default: return 'Temps total estimé';
  }
}

function MethodFields({ input, set }: { input: CalcInput; set: (p: Partial<CalcInput>) => void }) {
  const s = useData().settings;
  const cur = s.currency;
  const qtyFields = (
    <>
      <Field label="Quantité"><NumberInput value={input.quantity} onChange={v => set({ quantity: v })} min={0} /></Field>
      <Field label="Unité"><TextInput value={input.unitLabel} onChange={v => set({ unitLabel: v })} placeholder="vidéo, m², page…" /></Field>
    </>
  );
  switch (input.method) {
    case 'hourly': return qtyFields;
    case 'flat': return <Field label="Prix forfaitaire HT"><NumberInput value={input.flatPrice} onChange={v => set({ flatPrice: v })} suffix={cur} min={0} /></Field>;
    case 'unit': return <><Field label={`Prix par ${input.unitLabel || 'unité'} HT`}><NumberInput value={input.unitPrice} onChange={v => set({ unitPrice: v })} suffix={cur} min={0} /></Field>{qtyFields}</>;
    case 'quantity': return (
      <>
        {qtyFields}
        <div className="sm:col-span-2 lg:col-span-3">
          <p className="mb-2 text-xs font-medium text-muted">Paliers de prix (tarif dégressif)</p>
          <div className="space-y-2">
            {input.tiers.map((t, i) => (
              <div key={t.id} className="flex items-center gap-2">
                <span className="w-10 text-xs text-faint">dès</span>
                <NumberInput className="w-24" value={t.minQty} onChange={v => set({ tiers: input.tiers.map(x => x.id === t.id ? { ...x, minQty: v } : x) })} min={0} aria-label="Quantité minimum" />
                <span className="text-xs text-faint">{input.unitLabel || 'unité'}(s) →</span>
                <NumberInput className="flex-1" value={t.unitPrice} onChange={v => set({ tiers: input.tiers.map(x => x.id === t.id ? { ...x, unitPrice: v } : x) })} suffix={`${cur}/u`} min={0} aria-label="Prix unitaire" />
                <IconButton label="Supprimer le palier" disabled={input.tiers.length <= 1} onClick={() => set({ tiers: input.tiers.filter(x => x.id !== t.id) })}><LuTrash2 /></IconButton>
              </div>
            ))}
          </div>
          <Button size="sm" variant="subtle" className="mt-2" icon={<LuPlus />} onClick={() => {
            const last = input.tiers[input.tiers.length - 1];
            set({ tiers: [...input.tiers, { id: uid(), minQty: (last?.minQty || 0) + 5, unitPrice: last?.unitPrice || 0 }] });
          }}>Ajouter un palier</Button>
        </div>
      </>
    );
    case 'subscription': return (
      <>
        <Field label="Prix par période HT"><NumberInput value={input.subscriptionPrice} onChange={v => set({ subscriptionPrice: v })} suffix={cur} min={0} /></Field>
        <Field label="Périodicité"><Select value={input.subscriptionPeriod} onChange={(v: Periodicity) => set({ subscriptionPeriod: v })} options={(['monthly', 'quarterly', 'yearly'] as Periodicity[]).map(p => ({ value: p, label: PERIOD_LABELS[p] }))} /></Field>
        <Field label="Durée d'engagement" hint="Nombre de périodes"><NumberInput value={input.subscriptionDuration} onChange={v => set({ subscriptionDuration: Math.max(1, Math.round(v)) })} min={1} /></Field>
      </>
    );
    case 'custom': return (
      <div className="sm:col-span-2 lg:col-span-3">
        <p className="mb-2 text-xs text-muted">Ajoute tes propres lignes. Lignes « vente » = prix facturé ; lignes « coût » = ce que ça te coûte. Sans ligne de vente, le prix est calculé avec ta marge.</p>
        <div className="space-y-2">
          {input.customLines.map(l => (
            <div key={l.id} className="grid grid-cols-[1fr_auto] gap-2 rounded-xl border border-line bg-surface-2 p-2 sm:grid-cols-[1fr_80px_120px_110px_auto]">
              <TextInput value={l.label} onChange={v => set({ customLines: input.customLines.map(x => x.id === l.id ? { ...x, label: v } : x) })} placeholder="Libellé" className="col-span-1" />
              <NumberInput value={l.qty} onChange={v => set({ customLines: input.customLines.map(x => x.id === l.id ? { ...x, qty: v } : x) })} aria-label="Quantité" min={0} />
              <NumberInput value={l.amount} onChange={v => set({ customLines: input.customLines.map(x => x.id === l.id ? { ...x, amount: v } : x) })} suffix={cur} aria-label="Montant" />
              <Select value={l.kind} onChange={v => set({ customLines: input.customLines.map(x => x.id === l.id ? { ...x, kind: v } : x) })} options={[{ value: 'cost', label: 'Coût' }, { value: 'sale', label: 'Vente' }]} aria-label="Type" />
              <IconButton label="Supprimer la ligne" onClick={() => set({ customLines: input.customLines.filter(x => x.id !== l.id) })}><LuTrash2 /></IconButton>
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <Button size="sm" variant="subtle" icon={<LuPlus />} onClick={() => set({ customLines: [...input.customLines, { id: uid(), label: '', qty: 1, amount: 0, kind: 'cost' }] })}>Ligne de coût</Button>
          <Button size="sm" variant="subtle" icon={<LuPlus />} onClick={() => set({ customLines: [...input.customLines, { id: uid(), label: '', qty: 1, amount: 0, kind: 'sale' }] })}>Ligne de vente</Button>
        </div>
      </div>
    );
  }
}

function Row({ label, value, strong, muted, sign }: { label: React.ReactNode; value: string; strong?: boolean; muted?: boolean; sign?: string }) {
  return (
    <div className={cx('flex items-center justify-between gap-3 py-1.5 text-sm', muted && 'text-muted')}>
      <span>{label}</span>
      <span className={cx('tnum', strong && 'font-semibold text-ink')}>{sign}{value}</span>
    </div>
  );
}

function ResultPanel({ r, input, m, onApplyRecommended }: { r: CalcResult; input: CalcInput; m: (n: number) => string; onApplyRecommended: () => void }) {
  const total = Math.max(r.priceHT, 0.0001);
  const seg = [
    { label: 'Frais', v: Math.max(0, Math.min(r.expenses, r.priceHT)), c: '#f59e0b' },
    { label: 'Charges', v: Math.max(0, r.charges), c: '#fb7185' },
    { label: 'Bénéfice', v: Math.max(0, r.netProfit), c: '#34d399' },
  ];
  return (
    <Card className="anim-in overflow-hidden" data-testid="result">
      <div className="glow-accent border-b border-line px-5 py-5">
        <p className="text-xs font-medium uppercase tracking-wider text-muted">Prix de vente HT</p>
        <p className="tnum mt-1 text-4xl font-bold tracking-tight" data-testid="price-ht">{m(r.priceHT)}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
          {input.vatRate > 0 && <span className="tnum">TTC <b className="text-ink">{m(r.priceTTC)}</b></span>}
          {(input.method !== 'flat' && input.method !== 'custom') && <Badge tone="violet">{m(r.unitPriceHT)} / {input.method === 'subscription' ? PERIOD_UNIT[input.subscriptionPeriod] : input.unitLabel || 'unité'}</Badge>}
          <Badge tone="slate">{METHOD_LABELS[input.method]}</Badge>
        </div>
        <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-surface-3">
          {seg.map(x => <div key={x.label} style={{ width: `${(x.v / total) * 100}%`, background: x.c }} className="transition-all duration-500" title={x.label} />)}
        </div>
        <div className="mt-2 flex gap-3 text-[11px] text-muted">{seg.map(x => <span key={x.label} className="flex items-center gap-1"><i className="h-2 w-2 rounded-full" style={{ background: x.c }} />{x.label}</span>)}</div>
      </div>

      <div className="px-5 py-3">
        <Row label={`Main d'œuvre (${numFmt(r.hoursTotal)} h${input.difficulty !== 1 ? ` × ${numFmt(input.difficulty)}` : ''})`} value={m(r.labourCost)} muted />
        <Row label="Frais directs" value={m(r.expenses)} muted />
        <Row label="Coût de revient" value={m(r.costPrice)} strong />
        <div className="my-1 border-t border-dashed border-line" />
        <Row label={r.priceDriven ? `Prix ${METHOD_LABELS[input.method].toLowerCase()}${input.rebillExpenses ? ' + frais' : ''}` : `Prix avec marge (${numFmt(input.marginPct)} % ${input.marginMode === 'margin' ? 'sur PV' : 'sur coût'})`} value={m(r.basePrice)} />
        {r.urgencyAmount > 0 && <Row label={`Urgence +${numFmt(input.urgencyPct)} %`} value={m(r.urgencyAmount)} sign="+ " muted />}
        {r.discountAmount > 0 && <Row label="Remise" value={m(r.discountAmount)} sign="− " muted />}
        <Row label="Total HT" value={m(r.priceHT)} strong />
        {input.vatRate > 0 && <Row label={`TVA ${numFmt(input.vatRate)} %`} value={m(r.vatAmount)} muted />}
        {input.vatRate > 0 && <Row label="Total TTC" value={m(r.priceTTC)} strong />}
      </div>

      <div className="grid grid-cols-2 gap-2 border-t border-line px-5 py-4">
        <Metric label="Marge bénéficiaire" value={m(r.marginAmount)} sub={`${pct(r.marginOnPricePct)} du PV · ${pct(r.markupOnCostPct)} du coût`} bad={r.marginAmount < 0} />
        <Metric label="Bénéfice estimé" value={m(r.netProfit)} sub={`Après frais et charges (${m(r.charges)})`} bad={r.netProfit < 0} />
        <Metric label="Revenu net / heure" value={r.hoursTotal > 0 ? m(r.effectiveHourly) : '—'} sub="Bénéfice ÷ heures" />
        <Metric label="Prix conseillé HT" value={m(r.recommendedPriceHT)} sub="Coût + marge cible" />
      </div>

      {r.priceDriven && r.recommendedPriceHT > 0 && Math.abs(r.recommendedPriceHT - r.basePrice) > 0.01 && ['flat', 'unit', 'subscription'].includes(input.method) && (
        <div className="px-5 pb-4">
          <Button size="sm" variant="subtle" className="w-full" onClick={onApplyRecommended}>Appliquer le prix conseillé ({m(r.recommendedPriceHT)})</Button>
        </div>
      )}
      {r.warnings.length > 0 && (
        <div className="space-y-1.5 border-t border-line bg-amber-500/5 px-5 py-3" data-testid="warnings">
          {r.warnings.map(w => <p key={w} className="flex items-start gap-2 text-xs text-amber-300"><LuTriangleAlert className="mt-0.5 shrink-0" />{w}</p>)}
        </div>
      )}
    </Card>
  );
}

function Metric({ label, value, sub, bad }: { label: string; value: string; sub?: string; bad?: boolean }) {
  return (
    <div className="rounded-xl bg-surface-2 p-3">
      <p className="text-[11px] text-muted">{label}</p>
      <p className={cx('tnum mt-0.5 font-semibold', bad ? 'text-rose-400' : 'text-ink')}>{value}</p>
      {sub && <p className="mt-0.5 text-[10px] leading-tight text-faint">{sub}</p>}
    </div>
  );
}

function SaveToTrade({ open, onClose, input, serviceId, onSaved }: { open: boolean; onClose: () => void; input: CalcInput; serviceId?: string; onSaved: (tid: string, sid: string) => void }) {
  const data = useData();
  const ui = useUI();
  const [tid, setTid] = useState(input.tradeId || data.trades[0]?.id || '');
  const [name, setName] = useState(input.name);
  const existing = data.trades.find(t => t.id === tid)?.services.find(s => s.id === serviceId);
  const [overwrite, setOverwrite] = useState(true);
  React.useEffect(() => { if (open) { setTid(input.tradeId || data.trades[0]?.id || ''); setName(input.name); } }, [open]);
  if (!open) return null;
  const save = (asNew: boolean) => {
    if (!tid) return;
    const sid = !asNew && existing ? existing.id : uid();
    saveServiceToTrade(tid, { ...input, name: name || 'Prestation', tradeId: tid }, sid);
    onSaved(tid, sid);
    ui.toast('Prestation enregistrée dans le métier');
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="Enregistrer comme prestation"
      footer={data.trades.length ? <>
        <Button variant="ghost" onClick={onClose}>Annuler</Button>
        {existing && overwrite ? <Button variant="primary" onClick={() => save(false)}>Mettre à jour « {existing.name} »</Button> : <Button variant="primary" onClick={() => save(true)} disabled={!tid}>Enregistrer</Button>}
      </> : undefined}>
      {data.trades.length === 0 ? (
        <Empty icon={<LuBriefcase />} title="Aucun métier" text="Crée d'abord un métier (ou pars d'un modèle) pour y ranger tes prestations." action={<Button variant="primary" onClick={() => { onClose(); go('trades'); }}>Créer un métier</Button>} />
      ) : (
        <div className="space-y-3">
          <Field label="Nom de la prestation"><TextInput value={name} onChange={setName} /></Field>
          <Field label="Métier"><Select value={tid} onChange={setTid} options={data.trades.map(t => ({ value: t.id, label: t.name }))} /></Field>
          {existing && <Toggle checked={overwrite} onChange={setOverwrite} label={`Remplacer la prestation chargée (« ${existing.name} »)`} hint="Désactive pour l'enregistrer comme nouvelle prestation." />}
        </div>
      )}
    </Modal>
  );
}

function AddToQuote({ open, onClose, input }: { open: boolean; onClose: () => void; input: CalcInput }) {
  const data = useData();
  const ui = useUI();
  const editable = data.quotes.filter(q => q.status === 'draft' || q.status === 'sent');
  const [qid, setQid] = useState('');
  if (!open) return null;
  const target = qid || editable[0]?.id || '';
  const clientName = (id: string | null) => { const c = data.clients.find(x => x.id === id); return c ? c.company || c.name : 'sans client'; };
  return (
    <Modal open={open} onClose={onClose} title="Ajouter à un devis existant"
      footer={editable.length ? <><Button variant="ghost" onClick={onClose}>Annuler</Button><Button variant="primary" onClick={() => {
        const q = data.quotes.find(x => x.id === target);
        if (!q) return;
        const lines = q.lines.length === 1 && !q.lines[0].description && !q.lines[0].unitPrice ? [] : q.lines;
        saveQuote({ ...q, lines: [...lines, lineFromCalc(input)] });
        ui.toast(`Ajouté au devis ${q.number}`);
        onClose();
        go(`quotes/${q.id}`);
      }}>Ajouter la ligne</Button></> : undefined}>
      {editable.length === 0 ? <p className="text-sm text-muted">Aucun devis en brouillon ou envoyé. Crée plutôt un nouveau devis.</p> : (
        <Field label="Devis"><Select value={target} onChange={setQid} options={editable.map(q => ({ value: q.id, label: `${q.number} · ${clientName(q.clientId)}${q.title ? ' · ' + q.title : ''}` }))} /></Field>
      )}
    </Modal>
  );
}

function History() {
  const data = useData();
  const ui = useUI();
  const [q, setQ] = useState('');
  const list = data.calculations.filter(c => c.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <PageHeader title="Historique des calculs" subtitle="Retrouve et réutilise tes calculs enregistrés"
        actions={<Button icon={<LuCalculator />} onClick={() => go('calculator')}>Retour au calculateur</Button>} />
      <Card>
        <div className="border-b border-line p-4"><TextInput value={q} onChange={setQ} placeholder="Rechercher un calcul…" /></div>
        {list.length === 0 ? <Empty icon={<LuHistory />} title="Aucun calcul enregistré" text="Clique sur « Enregistrer » dans le calculateur pour garder une trace de tes calculs." /> : (
          <ul className="divide-y divide-line">
            {list.map(c => (
              <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{c.name}</p>
                  <p className="text-xs text-faint">{dateFmt(c.createdAt.slice(0, 10))} · {METHOD_LABELS[c.input.method]}{c.input.tradeId ? ' · ' + (data.trades.find(t => t.id === c.input.tradeId)?.name || '') : ''}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="tnum font-semibold">{money(c.priceHT, data.settings)}</span>
                  <Button size="sm" icon={<LuFolderOpen />} onClick={() => { handoff.set({ input: c.input }); go('calculator'); }}>Ouvrir</Button>
                  <IconButton label="Supprimer" onClick={async () => { if (await ui.confirm({ title: 'Supprimer ce calcul ?', text: c.name, confirm: 'Supprimer', danger: true })) deleteCalculation(c.id); }}><LuTrash2 /></IconButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
