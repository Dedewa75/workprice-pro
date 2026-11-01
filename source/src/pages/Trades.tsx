import React, { useState } from 'react';
import { LuPlus, LuBriefcase, LuTrash2, LuCopy, LuArrowLeft, LuCalculator, LuPackage, LuTag, LuWallet, LuPencil, LuFilePlus, LuSparkles, LuCheck } from 'react-icons/lu';
import { useData } from '../core/store';
import { saveTrade, deleteTrade, duplicateTrade, createQuote, newCalcInput, defaultVat } from '../core/actions';
import { TRADE_TEMPLATES, tradeFromTemplate, blankTrade } from '../core/defaults';
import { computeCalc, uid, round2 } from '../core/calc';
import { newLine } from '../core/docs';
import type { Trade, Pack, Periodicity, TradeOption, TradeCost } from '../core/types';
import { Button, Card, CardHeader, Empty, Field, IconButton, Modal, NumberInput, PageHeader, Segmented, Select, TextArea, TextInput, useUI, Badge, cx } from '../ui/kit';
import { money, METHOD_LABELS, PERIOD_LABELS, PERIOD_SHORT, numFmt } from '../ui/format';
import { go, handoff } from '../ui/router';

const COLORS = ['#7c5cff', '#22c3ee', '#f472b6', '#f59e0b', '#34d399', '#60a5fa', '#fb7185', '#a3e635', '#e879f9', '#94a3b8'];

export default function Trades({ route }: { route: string[] }) {
  const data = useData();
  if (route[1]) {
    const t = data.trades.find(x => x.id === route[1]);
    if (t) return <TradeDetail key={t.id} trade={t} />;
  }
  return <TradeList />;
}

function TradeList() {
  const data = useData();
  const s = data.settings;
  const [gallery, setGallery] = useState(false);
  const add = (key: string | null) => {
    const t = key ? tradeFromTemplate(key, s) : blankTrade(s);
    if (!t) return;
    saveTrade(t);
    setGallery(false);
    go(`trades/${t.id}`);
  };
  return (
    <div>
      <PageHeader title="Métiers & packs" subtitle="Tes catégories professionnelles, leurs prestations, options, packs et coûts."
        actions={<Button variant="primary" icon={<LuPlus />} onClick={() => setGallery(true)}>Ajouter un métier</Button>} />
      {data.trades.length === 0 ? (
        <Card><Empty icon={<LuBriefcase />} title="Aucun métier pour l'instant" text="Pars d'un modèle préconfiguré (montage vidéo, sites web, bâtiment…) ou crée le tien de zéro." action={<Button variant="primary" icon={<LuSparkles />} onClick={() => setGallery(true)}>Choisir un modèle</Button>} /></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.trades.map(t => (
            <a key={t.id} href={`#/trades/${t.id}`} className="anim-in group block">
              <Card className="h-full p-5 transition group-hover:border-accent/50 group-hover:bg-surface-2">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 h-10 w-10 shrink-0 rounded-xl" style={{ background: `linear-gradient(135deg, ${t.color}, ${t.color}66)` }} />
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{t.name}</p>
                    <p className="line-clamp-2 text-xs text-muted">{t.description || 'Sans description'}</p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <MiniStat n={t.services.length} label="prestations" />
                  <MiniStat n={t.packs.length} label="packs" />
                  <MiniStat n={t.options.length} label="options" />
                </div>
                <p className="mt-3 text-xs text-faint">Tarif horaire par défaut : <b className="text-muted">{money(t.defaultHourlyRate, s)}/h</b></p>
              </Card>
            </a>
          ))}
        </div>
      )}
      <Modal open={gallery} onClose={() => setGallery(false)} title="Ajouter un métier" wide>
        <p className="mb-4 text-sm text-muted">Les modèles contiennent des prestations, packs et options d'exemple. <b className="text-ink">Les prix sont indicatifs</b> : adapte-les à ton marché.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <button onClick={() => add(null)} className="flex items-start gap-3 rounded-xl border border-dashed border-line p-4 text-left transition hover:border-accent hover:bg-surface-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/12 text-accent"><LuPlus /></span>
            <span><b className="block text-sm">Métier vierge</b><span className="text-xs text-muted">Partir de zéro, sans restriction</span></span>
          </button>
          {TRADE_TEMPLATES.map(t => (
            <button key={t.key} data-template={t.key} onClick={() => add(t.key)} className="flex items-start gap-3 rounded-xl border border-line p-4 text-left transition hover:border-accent hover:bg-surface-2">
              <span className="h-9 w-9 shrink-0 rounded-lg" style={{ background: `linear-gradient(135deg, ${t.color}, ${t.color}66)` }} />
              <span className="min-w-0"><b className="block text-sm">{t.name}</b><span className="text-xs text-muted">{t.services.length} prestations · {t.packs.length} packs · {t.options.length} options</span></span>
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}

const MiniStat = ({ n, label }: { n: number; label: string }) => (
  <div className="rounded-lg bg-surface-2 py-2"><p className="tnum font-semibold">{n}</p><p className="text-[10px] text-faint">{label}</p></div>
);

type Tab = 'services' | 'packs' | 'options' | 'costs';

function TradeDetail({ trade }: { trade: Trade }) {
  const data = useData();
  const s = data.settings;
  const ui = useUI();
  const [tab, setTab] = useState<Tab>('services');
  const [packEdit, setPackEdit] = useState<Pack | null>(null);
  const upd = (p: Partial<Trade>) => saveTrade({ ...trade, ...p });
  const m = (n: number) => money(n, s);

  const monthlyCosts = trade.costs.reduce((a, c) => a + (c.periodicity === 'monthly' ? c.amount : c.periodicity === 'quarterly' ? c.amount / 3 : c.periodicity === 'yearly' ? c.amount / 12 : 0), 0);

  const quoteFromPack = (p: Pack) => {
    const opts = trade.options.filter(o => p.optionIds.includes(o.id));
    const vat = defaultVat(s);
    const lines = [newLine({ description: `${trade.name} — ${p.name}`, detail: [p.description, p.includes.length ? 'Inclus : ' + p.includes.join(', ') : ''].filter(Boolean).join('\n'), qty: 1, unit: p.periodicity === 'once' ? 'pack' : PERIOD_SHORT[p.periodicity].replace('/', ''), unitPrice: p.totalPrice, vatRate: vat })];
    for (const o of opts) lines.push(newLine({ description: o.name, qty: 1, unit: o.unit, unitPrice: o.price, vatRate: vat }));
    const q = createQuote({ title: p.name, lines });
    ui.toast(`Devis ${q.number} créé`);
    go(`quotes/${q.id}`);
  };

  return (
    <div>
      <button onClick={() => go('trades')} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><LuArrowLeft /> Tous les métiers</button>
      <Card className="mb-5 p-5">
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
          <div className="space-y-3">
            <Field label="Nom du métier"><TextInput value={trade.name} onChange={v => upd({ name: v })} /></Field>
            <Field label="Tarif horaire par défaut"><NumberInput value={trade.defaultHourlyRate} onChange={v => upd({ defaultHourlyRate: v })} suffix={`${s.currency}/h`} min={0} /></Field>
          </div>
          <div className="space-y-3">
            <Field label="Description"><TextArea value={trade.description} onChange={v => upd({ description: v })} className="min-h-[92px]" /></Field>
            <div className="flex flex-wrap gap-1.5">
              {COLORS.map(c => <button key={c} aria-label={`Couleur ${c}`} onClick={() => upd({ color: c })} className={cx('h-6 w-6 rounded-full transition', trade.color === c && 'ring-2 ring-offset-2 ring-offset-[var(--wp-surface)]')} style={{ background: c, ['--tw-ring-color' as any]: c }} />)}
            </div>
          </div>
          <div className="flex flex-row gap-2 lg:flex-col">
            <Button icon={<LuCopy />} onClick={() => { const c = duplicateTrade(trade); ui.toast('Métier dupliqué'); go(`trades/${c.id}`); }}>Dupliquer</Button>
            <Button variant="danger" icon={<LuTrash2 />} onClick={async () => {
              if (await ui.confirm({ title: 'Supprimer ce métier ?', text: `« ${trade.name} » et ses ${trade.services.length} prestations, ${trade.packs.length} packs seront supprimés. Les devis et factures existants ne sont pas touchés.`, confirm: 'Supprimer', danger: true })) {
                deleteTrade(trade.id); go('trades'); ui.toast('Métier supprimé');
              }
            }}>Supprimer</Button>
          </div>
        </div>
      </Card>

      <Segmented className="mb-4" value={tab} onChange={setTab} options={[
        { value: 'services', label: `Prestations (${trade.services.length})` },
        { value: 'packs', label: `Packs & abonnements (${trade.packs.length})` },
        { value: 'options', label: `Options (${trade.options.length})` },
        { value: 'costs', label: `Coûts associés (${trade.costs.length})` },
      ]} />

      {tab === 'services' && (
        <Card>
          <CardHeader title="Prestations" subtitle="Chaque prestation est un calcul complet réutilisable" icon={<LuCalculator />}
            action={<Button size="sm" variant="primary" icon={<LuPlus />} onClick={() => { handoff.set({ input: { ...newCalcInput(), tradeId: trade.id, hourlyRate: trade.defaultHourlyRate } }); go('calculator'); }}>Nouvelle prestation</Button>} />
          {trade.services.length === 0 ? <Empty icon={<LuCalculator />} title="Aucune prestation" text="Crée une prestation dans le calculateur, puis enregistre-la dans ce métier." /> : (
            <ul className="divide-y divide-line border-t border-line">
              {trade.services.map(sv => {
                const r = computeCalc(sv.input);
                return (
                  <li key={sv.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="font-medium">{sv.name}</p>
                      <p className="text-xs text-faint">{METHOD_LABELS[sv.input.method]} · {numFmt(r.hoursTotal)} h · marge {numFmt(r.marginOnPricePct, 1)} %</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="tnum font-semibold">{m(r.priceHT)} <span className="text-xs font-normal text-faint">HT</span></span>
                      <Button size="sm" icon={<LuPencil />} onClick={() => { handoff.set({ input: { ...sv.input, tradeId: trade.id }, serviceId: sv.id }); go('calculator'); }}>Ouvrir</Button>
                      <IconButton label="Supprimer la prestation" onClick={async () => { if (await ui.confirm({ title: 'Supprimer cette prestation ?', text: sv.name, confirm: 'Supprimer', danger: true })) upd({ services: trade.services.filter(x => x.id !== sv.id) }); }}><LuTrash2 /></IconButton>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}

      {tab === 'packs' && (
        <div>
          <div className="mb-3 flex justify-end"><Button variant="primary" icon={<LuPlus />} onClick={() => setPackEdit({ id: uid(), name: '', description: '', quantity: 1, totalPrice: 0, referenceUnitPrice: 0, includes: [], optionIds: [], periodicity: 'once' })}>Nouveau pack</Button></div>
          {trade.packs.length === 0 ? <Card><Empty icon={<LuPackage />} title="Aucun pack" text="Ex. : 1 vidéo 70 €, 2 vidéos 120 €, 5 vidéos 250 €, ou une maintenance mensuelle." /></Card> : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {trade.packs.map(p => {
                const unit = p.quantity > 0 ? p.totalPrice / p.quantity : p.totalPrice;
                const saving = p.referenceUnitPrice > 0 && p.quantity > 0 ? (1 - p.totalPrice / (p.referenceUnitPrice * p.quantity)) * 100 : 0;
                return (
                  <Card key={p.id} className="anim-in flex flex-col p-5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{p.name || 'Pack sans nom'}</p>
                        {p.description && <p className="text-xs text-muted">{p.description}</p>}
                      </div>
                      {saving > 0.05 && <Badge tone="green">−{numFmt(saving, 0)} %</Badge>}
                    </div>
                    <p className="tnum mt-3 text-3xl font-bold tracking-tight">{m(p.totalPrice)}<span className="text-sm font-normal text-faint">{PERIOD_SHORT[p.periodicity]}</span></p>
                    <p className="text-xs text-muted">{p.quantity} prestation(s) · {m(unit)} l'unité{p.referenceUnitPrice > 0 ? ` (au lieu de ${m(p.referenceUnitPrice)})` : ''}</p>
                    {p.includes.length > 0 && <ul className="mt-3 space-y-1 text-sm">{p.includes.map((x, i) => <li key={i} className="flex gap-2 text-muted"><LuCheck className="mt-0.5 shrink-0 text-emerald-400" />{x}</li>)}</ul>}
                    {p.optionIds.length > 0 && <p className="mt-2 text-xs text-faint">Options : {trade.options.filter(o => p.optionIds.includes(o.id)).map(o => o.name).join(', ')}</p>}
                    <div className="mt-auto flex flex-wrap gap-2 pt-4">
                      <Button size="sm" variant="subtle" icon={<LuFilePlus />} onClick={() => quoteFromPack(p)}>Devis</Button>
                      <Button size="sm" icon={<LuPencil />} onClick={() => setPackEdit(p)}>Modifier</Button>
                      <IconButton label="Supprimer le pack" onClick={async () => { if (await ui.confirm({ title: 'Supprimer ce pack ?', text: p.name, confirm: 'Supprimer', danger: true })) upd({ packs: trade.packs.filter(x => x.id !== p.id) }); }}><LuTrash2 /></IconButton>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'options' && (
        <EditableTable<TradeOption>
          icon={<LuTag />} title="Options supplémentaires" subtitle="Ajoutables aux packs et aux devis"
          rows={trade.options} onChange={rows => upd({ options: rows, packs: trade.packs.map(p => ({ ...p, optionIds: p.optionIds.filter(id => rows.some(r => r.id === id)) })) })}
          make={() => ({ id: uid(), name: '', price: 0, unit: 'unité' })}
          cols={[
            { label: 'Nom', render: (r, ch) => <TextInput value={r.name} onChange={v => ch({ name: v })} placeholder="Ex. Sous-titres" aria-label="Nom de l'option" /> },
            { label: 'Prix HT', w: 'w-36', render: (r, ch) => <NumberInput value={r.price} onChange={v => ch({ price: v })} suffix={s.currency} min={0} aria-label="Prix" /> },
            { label: 'Par', w: 'w-32', render: (r, ch) => <TextInput value={r.unit} onChange={v => ch({ unit: v })} aria-label="Unité" /> },
          ]}
        />
      )}

      {tab === 'costs' && (
        <EditableTable<TradeCost>
          icon={<LuWallet />} title="Coûts associés" subtitle={`Abonnements, assurances, matériel… ≈ ${m(round2(monthlyCosts))} / mois`}
          rows={trade.costs} onChange={rows => upd({ costs: rows })}
          make={() => ({ id: uid(), name: '', amount: 0, periodicity: 'monthly' })}
          cols={[
            { label: 'Nom', render: (r, ch) => <TextInput value={r.name} onChange={v => ch({ name: v })} placeholder="Ex. Logiciel" aria-label="Nom du coût" /> },
            { label: 'Montant HT', w: 'w-36', render: (r, ch) => <NumberInput value={r.amount} onChange={v => ch({ amount: v })} suffix={s.currency} min={0} aria-label="Montant" /> },
            { label: 'Périodicité', w: 'w-40', render: (r, ch) => <Select value={r.periodicity} onChange={(v: Periodicity) => ch({ periodicity: v })} options={(Object.keys(PERIOD_LABELS) as Periodicity[]).map(k => ({ value: k, label: PERIOD_LABELS[k] }))} aria-label="Périodicité" /> },
          ]}
        />
      )}

      <PackModal pack={packEdit} trade={trade} onClose={() => setPackEdit(null)} onSave={p => {
        upd({ packs: trade.packs.some(x => x.id === p.id) ? trade.packs.map(x => (x.id === p.id ? p : x)) : [...trade.packs, p] });
        setPackEdit(null);
        ui.toast('Pack enregistré');
      }} />
    </div>
  );
}

function EditableTable<T extends { id: string }>({ title, subtitle, icon, rows, onChange, make, cols }: {
  title: string; subtitle?: string; icon: React.ReactNode; rows: T[]; onChange: (r: T[]) => void; make: () => T;
  cols: { label: string; w?: string; render: (row: T, change: (p: Partial<T>) => void) => React.ReactNode }[];
}) {
  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle} icon={icon} action={<Button size="sm" variant="primary" icon={<LuPlus />} onClick={() => onChange([...rows, make()])}>Ajouter</Button>} />
      {rows.length === 0 ? <p className="px-5 pb-5 text-sm text-muted">Rien pour l'instant.</p> : (
        <div className="space-y-2 px-5 pb-5">
          {rows.map(r => (
            <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface-2 p-2 sm:flex-nowrap">
              {cols.map((c, i) => <div key={i} className={cx(c.w || 'min-w-0 flex-1', 'max-sm:w-full')}>{c.render(r, p => onChange(rows.map(x => (x.id === r.id ? { ...x, ...p } : x))))}</div>)}
              <IconButton label="Supprimer" onClick={() => onChange(rows.filter(x => x.id !== r.id))}><LuTrash2 /></IconButton>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function PackModal({ pack, trade, onClose, onSave }: { pack: Pack | null; trade: Trade; onClose: () => void; onSave: (p: Pack) => void }) {
  const s = useData().settings;
  const [p, setP] = useState<Pack | null>(pack);
  const [includes, setIncludes] = useState('');
  React.useEffect(() => { setP(pack); setIncludes(pack?.includes.join('\n') || ''); }, [pack]);
  if (!pack || !p) return null;
  const set = (x: Partial<Pack>) => setP(o => (o ? { ...o, ...x } : o));
  const unit = p.quantity > 0 ? p.totalPrice / p.quantity : 0;
  const saving = p.referenceUnitPrice > 0 && p.quantity > 0 ? (1 - p.totalPrice / (p.referenceUnitPrice * p.quantity)) * 100 : 0;
  return (
    <Modal open onClose={onClose} title={trade.packs.some(x => x.id === p.id) ? 'Modifier le pack' : 'Nouveau pack'} wide
      footer={<><Button variant="ghost" onClick={onClose}>Annuler</Button><Button variant="primary" disabled={!p.name.trim()} onClick={() => onSave({ ...p, includes: includes.split('\n').map(x => x.trim()).filter(Boolean) })}>Enregistrer le pack</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nom du pack"><TextInput value={p.name} onChange={v => set({ name: v })} placeholder="Ex. Pack 5 vidéos" /></Field>
        <Field label="Périodicité"><Select value={p.periodicity} onChange={(v: Periodicity) => set({ periodicity: v })} options={(Object.keys(PERIOD_LABELS) as Periodicity[]).map(k => ({ value: k, label: PERIOD_LABELS[k] }))} /></Field>
        <Field label="Description" className="sm:col-span-2"><TextInput value={p.description} onChange={v => set({ description: v })} /></Field>
        <Field label="Nombre de prestations"><NumberInput value={p.quantity} onChange={v => set({ quantity: v })} min={0} /></Field>
        <Field label="Prix total HT"><NumberInput value={p.totalPrice} onChange={v => set({ totalPrice: v })} suffix={s.currency} min={0} /></Field>
        <Field label="Prix individuel HT (hors pack)" hint="Sert à afficher l'économie réalisée"><NumberInput value={p.referenceUnitPrice} onChange={v => set({ referenceUnitPrice: v })} suffix={s.currency} min={0} /></Field>
        <Field label="Réduction (calculée)">
          <div className="flex gap-2">
            <NumberInput className="flex-1" value={round2(saving)} suffix="%" aria-label="Réduction en pourcentage" onChange={v => set({ totalPrice: round2(p.referenceUnitPrice * p.quantity * (1 - v / 100)) })} />
          </div>
        </Field>
        <div className="rounded-xl bg-surface-2 p-3 text-sm text-muted sm:col-span-2">
          Prix par prestation dans le pack : <b className="tnum text-ink">{money(unit, s)}</b>
          {saving > 0 && <> · le client économise <b className="tnum text-emerald-400">{money(p.referenceUnitPrice * p.quantity - p.totalPrice, s)}</b></>}
        </div>
        <Field label="Prestations incluses (une par ligne)" className="sm:col-span-2"><TextArea value={includes} onChange={setIncludes} placeholder={'5 vidéos montées\n2 modifications par vidéo'} /></Field>
        {trade.options.length > 0 && (
          <div className="sm:col-span-2">
            <p className="mb-2 text-xs font-medium text-muted">Options incluses / proposées</p>
            <div className="flex flex-wrap gap-2">
              {trade.options.map(o => {
                const on = p.optionIds.includes(o.id);
                return <button key={o.id} type="button" onClick={() => set({ optionIds: on ? p.optionIds.filter(x => x !== o.id) : [...p.optionIds, o.id] })}
                  className={cx('rounded-full border px-3 py-1 text-xs transition', on ? 'border-accent bg-accent/15 text-ink' : 'border-line text-muted hover:text-ink')}>{on && '✓ '}{o.name} · {money(o.price, s)}</button>;
              })}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
