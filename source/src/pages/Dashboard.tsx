import React, { useMemo, useState } from 'react';
import { LuTrendingUp, LuWallet, LuUsers, LuFileText, LuHourglass, LuCircleCheck, LuCircleAlert, LuLayers, LuCalculator, LuPlus, LuBanknote } from 'react-icons/lu';
import { useData } from '../core/store';
import { dashboardStats, monthlySeries, computeTotals, isOverdue, todayISO, type Period } from '../core/docs';
import { Card, CardHeader, PageHeader, Stat, Segmented, Button, Badge, Empty, TextInput } from '../ui/kit';
import { ComboChart, Donut, Bar } from '../ui/charts';
import { money, dateFmt, INVOICE_STATUS } from '../ui/format';
import { go } from '../ui/router';
import { createQuote } from '../core/actions';

type PKey = 'month' | '3m' | '12m' | 'year' | 'all' | 'custom';

function periodFor(k: PKey, custom: Period): Period | null {
  const t = new Date();
  const iso = (d: Date) => todayISO(d);
  switch (k) {
    case 'month': return { from: iso(new Date(t.getFullYear(), t.getMonth(), 1)), to: iso(t) };
    case '3m': return { from: iso(new Date(t.getFullYear(), t.getMonth() - 2, 1)), to: iso(t) };
    case '12m': return { from: iso(new Date(t.getFullYear(), t.getMonth() - 11, 1)), to: iso(t) };
    case 'year': return { from: `${t.getFullYear()}-01-01`, to: `${t.getFullYear()}-12-31` };
    case 'custom': return custom;
    default: return null;
  }
}

export default function Dashboard() {
  const data = useData();
  const s = data.settings;
  const [pk, setPk] = useState<PKey>('12m');
  const [custom, setCustom] = useState<Period>({ from: `${new Date().getFullYear()}-01-01`, to: todayISO() });
  const period = periodFor(pk, custom);
  const st = useMemo(() => dashboardStats(data, period), [data, period?.from, period?.to]);
  const monthsCount = pk === 'month' ? 6 : pk === '3m' ? 6 : 12;
  const series = useMemo(() => monthlySeries(data, monthsCount), [data, monthsCount]);
  const m = (n: number) => money(n, s);

  const topClients = useMemo(() => {
    const map = new Map<string, number>();
    for (const i of data.invoices) {
      if (i.status === 'draft' || i.status === 'cancelled' || !i.clientId) continue;
      if (period && (i.issueDate < period.from || i.issueDate > period.to)) continue;
      map.set(i.clientId, (map.get(i.clientId) || 0) + computeTotals(i).totalHT);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, v]) => ({ client: data.clients.find(c => c.id === id), v }));
  }, [data, period?.from, period?.to]);

  const unpaid = data.invoices.filter(i => i.status === 'issued' || i.status === 'partial').sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 6);
  const empty = data.invoices.length === 0 && data.quotes.length === 0;
  const clientName = (id: string | null) => { const c = data.clients.find(x => x.id === id); return c ? c.company || c.name : 'Sans client'; };

  return (
    <div>
      <PageHeader
        title={`Bonjour${s.company.owner ? ' ' + s.company.owner.split(' ')[0] : ''} 👋`}
        subtitle="Vue d'ensemble de ton activité"
        actions={<>
          <Button icon={<LuCalculator />} onClick={() => go('calculator')}>Calculer un prix</Button>
          <Button variant="primary" icon={<LuPlus />} onClick={() => { const q = createQuote(); go(`quotes/${q.id}`); }}>Nouveau devis</Button>
        </>}
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Segmented value={pk} onChange={setPk} options={[
          { value: 'month', label: 'Ce mois' }, { value: '3m', label: '3 mois' }, { value: '12m', label: '12 mois' },
          { value: 'year', label: 'Cette année' }, { value: 'all', label: 'Tout' }, { value: 'custom', label: 'Période…' },
        ]} />
        {pk === 'custom' && (
          <div className="flex items-center gap-2">
            <TextInput type="date" value={custom.from} onChange={v => setCustom(c => ({ ...c, from: v }))} className="w-40" aria-label="Du" />
            <span className="text-muted">→</span>
            <TextInput type="date" value={custom.to} onChange={v => setCustom(c => ({ ...c, to: v }))} className="w-40" aria-label="Au" />
          </div>
        )}
      </div>

      {empty && (
        <Card className="glow-accent mb-6 p-6">
          <p className="text-lg font-semibold">Bienvenue dans WORKPRICE PRO</p>
          <p className="mt-1 max-w-2xl text-sm text-muted">Les chiffres se remplissent dès que tu émets des factures. Commence par calculer le prix d'une prestation, puis transforme-le en devis en un clic.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="primary" icon={<LuCalculator />} onClick={() => go('calculator')}>Ouvrir le calculateur</Button>
            <Button icon={<LuLayers />} onClick={() => go('trades')}>Configurer mes métiers</Button>
            <Button icon={<LuUsers />} onClick={() => go('clients')}>Ajouter un client</Button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Chiffre d'affaires HT" value={m(st.revenue)} sub={`Encaissé : ${m(st.collected)}`} icon={<LuTrendingUp />} />
        <Stat label="Bénéfice estimé" value={m(st.profit)} sub={`Frais ${m(st.cost)} · charges ${m(st.charges)}`} icon={<LuWallet />} tone="bg-emerald-500/12 text-emerald-400" />
        <Stat label="Clients" value={st.clientsTotal} sub={`${st.clientsActive} actifs sur la période`} icon={<LuUsers />} tone="bg-sky-500/12 text-sky-400" />
        <Stat label="Devis réalisés" value={st.quotesCount} sub={`${st.quotesPending} en attente de réponse`} icon={<LuFileText />} tone="bg-violet-500/12 text-violet-400" />
        <Stat label="Devis en attente" value={st.quotesPending} sub={`${st.quotesDraft} brouillon(s)`} icon={<LuHourglass />} tone="bg-amber-500/12 text-amber-400" />
        <Stat label="Prestations réalisées" value={st.servicesDone} sub="Lignes facturées" icon={<LuLayers />} tone="bg-fuchsia-500/12 text-fuchsia-400" />
        <Stat label="Factures payées" value={st.invoicesPaid} sub={m(st.paidAmount)} icon={<LuCircleCheck />} tone="bg-emerald-500/12 text-emerald-400" />
        <Stat label="Factures impayées" value={st.invoicesUnpaid} sub={`${m(st.unpaidAmount)}${st.overdue ? ` · ${st.overdue} en retard` : ''}`} icon={<LuCircleAlert />} tone="bg-rose-500/12 text-rose-400" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="anim-in xl:col-span-2">
          <CardHeader title="Évolution des revenus" subtitle={`${monthsCount} derniers mois · CA HT facturé, encaissements et bénéfice estimé`} />
          <div className="px-3 pb-4">
            <ComboChart
              labels={series.map(x => x.label)}
              series={[
                { key: 'revenue', label: 'CA HT', color: 'var(--wp-accent)', type: 'bar' },
                { key: 'collected', label: 'Encaissé', color: '#22c3ee', type: 'bar' },
                { key: 'profit', label: 'Bénéfice estimé', color: '#34d399', type: 'line' },
              ]}
              data={{ revenue: series.map(x => x.revenue), collected: series.map(x => x.collected), profit: series.map(x => x.profit) }}
              format={m}
            />
          </div>
        </Card>
        <Card className="anim-in">
          <CardHeader title="Statut des devis" subtitle="Sur la période sélectionnée" />
          <div className="px-5 pb-5">
            <Donut center={st.quotesCount} sub="devis" items={[
              { label: 'Acceptés / facturés', value: st.quotesAccepted, color: '#34d399' },
              { label: 'En attente', value: st.quotesPending, color: '#fbbf24' },
              { label: 'Refusés', value: st.quotesRefused, color: '#fb7185' },
              { label: 'Brouillons', value: st.quotesDraft, color: '#64748b' },
            ]} />
            <div className="mt-4 rounded-xl bg-surface-2 p-3 text-xs text-muted">
              Taux de transformation : <b className="text-ink">{st.quotesAccepted + st.quotesRefused > 0 ? Math.round((st.quotesAccepted / (st.quotesAccepted + st.quotesRefused)) * 100) : 0} %</b> (acceptés / réponses reçues)
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="anim-in">
          <CardHeader title="Statistiques mensuelles" subtitle="Détail mois par mois" />
          <div className="scroll-thin overflow-x-auto px-2 pb-3">
            <table className="w-full min-w-[420px] text-sm">
              <thead><tr className="text-left text-xs text-faint"><th className="px-3 py-2 font-medium">Mois</th><th className="px-3 py-2 text-right font-medium">Devis</th><th className="px-3 py-2 text-right font-medium">CA HT</th><th className="px-3 py-2 text-right font-medium">Encaissé</th><th className="px-3 py-2 text-right font-medium">Bénéfice</th></tr></thead>
              <tbody>
                {[...series].reverse().map(r => (
                  <tr key={r.key} className="border-t border-line">
                    <td className="px-3 py-2 text-muted">{r.label}</td>
                    <td className="tnum px-3 py-2 text-right">{r.quotes}</td>
                    <td className="tnum px-3 py-2 text-right font-medium">{m(r.revenue)}</td>
                    <td className="tnum px-3 py-2 text-right text-muted">{m(r.collected)}</td>
                    <td className={`tnum px-3 py-2 text-right ${r.profit < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>{m(r.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <div className="grid gap-4">
          <Card className="anim-in">
            <CardHeader title="Factures à encaisser" icon={<LuBanknote />} action={<Button size="sm" variant="ghost" onClick={() => go('invoices')}>Tout voir</Button>} />
            {unpaid.length === 0 ? <p className="px-5 pb-5 text-sm text-muted">Aucune facture en attente de paiement. 🎉</p> : (
              <ul className="px-2 pb-3">
                {unpaid.map(i => {
                  const t = computeTotals(i);
                  const late = isOverdue(i);
                  return (
                    <li key={i.id}>
                      <a href={`#/invoices/${i.id}`} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 hover:bg-surface-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{i.number} · {clientName(i.clientId)}</p>
                          <p className="text-xs text-faint">Échéance {dateFmt(i.dueDate)}</p>
                        </div>
                        <div className="text-right">
                          <p className="tnum text-sm font-semibold">{m(t.balance)}</p>
                          {late ? <Badge tone="red">En retard</Badge> : <Badge tone={INVOICE_STATUS[i.status].tone}>{INVOICE_STATUS[i.status].label}</Badge>}
                        </div>
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
          <Card className="anim-in">
            <CardHeader title="Meilleurs clients" subtitle="CA HT sur la période" icon={<LuUsers />} />
            {topClients.length === 0 ? <Empty icon={<LuUsers />} title="Pas encore de chiffre d'affaires" text="Tes meilleurs clients apparaîtront ici." /> : (
              <ul className="space-y-3 px-5 pb-5">
                {topClients.map(({ client, v }) => (
                  <li key={client?.id || 'x'}>
                    <div className="mb-1 flex justify-between text-sm"><span className="truncate">{client ? client.company || client.name : 'Client supprimé'}</span><span className="tnum font-medium">{m(v)}</span></div>
                    <Bar value={v} max={topClients[0].v} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
