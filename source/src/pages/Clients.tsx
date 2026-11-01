import React, { useMemo, useState } from 'react';
import { LuPlus, LuUsers, LuSearch, LuMail, LuPhone, LuMapPin, LuArrowLeft, LuPencil, LuTrash2, LuFileText, LuReceipt, LuLayers, LuBuilding2 } from 'react-icons/lu';
import { useData } from '../core/store';
import { blankClient, saveClient, deleteClient, clientUsage, createQuote, createInvoice } from '../core/actions';
import { computeTotals, isOverdue } from '../core/docs';
import type { Client } from '../core/types';
import { Button, Card, CardHeader, Empty, Field, Modal, PageHeader, Segmented, TextArea, TextInput, useUI, Badge, Select, Stat } from '../ui/kit';
import { money, dateFmt, QUOTE_STATUS, INVOICE_STATUS, numFmt } from '../ui/format';
import { go } from '../ui/router';

export default function Clients({ route }: { route: string[] }) {
  const data = useData();
  const c = route[1] && data.clients.find(x => x.id === route[1]);
  return c ? <ClientDetail key={c.id} client={c} /> : <ClientList />;
}

function ClientList() {
  const data = useData();
  const s = data.settings;
  const [q, setQ] = useState('');
  const [type, setType] = useState<'all' | 'pro' | 'particulier' | 'unpaid'>('all');
  const [sort, setSort] = useState<'name' | 'revenue' | 'recent'>('name');
  const [edit, setEdit] = useState<Client | null>(null);

  const stats = useMemo(() => {
    const map = new Map<string, { revenue: number; unpaid: number; quotes: number; invoices: number }>();
    for (const c of data.clients) map.set(c.id, { revenue: 0, unpaid: 0, quotes: 0, invoices: 0 });
    for (const qq of data.quotes) { const x = qq.clientId && map.get(qq.clientId); if (x) x.quotes++; }
    for (const i of data.invoices) {
      const x = i.clientId && map.get(i.clientId); if (!x) continue;
      x.invoices++;
      if (i.status === 'draft' || i.status === 'cancelled') continue;
      const t = computeTotals(i);
      x.revenue += t.totalHT;
      if (i.status !== 'paid') x.unpaid += t.balance;
    }
    return map;
  }, [data]);

  const list = data.clients
    .filter(c => {
      const hay = `${c.name} ${c.company} ${c.email} ${c.phone} ${c.city}`.toLowerCase();
      if (q && !hay.includes(q.toLowerCase())) return false;
      if (type === 'pro' || type === 'particulier') return c.type === type;
      if (type === 'unpaid') return (stats.get(c.id)?.unpaid || 0) > 0;
      return true;
    })
    .sort((a, b) => sort === 'revenue' ? (stats.get(b.id)?.revenue || 0) - (stats.get(a.id)?.revenue || 0)
      : sort === 'recent' ? b.createdAt.localeCompare(a.createdAt)
      : (a.company || a.name).localeCompare(b.company || b.name, 'fr'));

  return (
    <div>
      <PageHeader title="Clients" subtitle={`${data.clients.length} client(s) dans ton CRM`}
        actions={<Button variant="primary" icon={<LuPlus />} onClick={() => setEdit(blankClient())}>Nouveau client</Button>} />
      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <LuSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
            <TextInput value={q} onChange={setQ} placeholder="Rechercher nom, entreprise, e-mail, ville…" className="pl-9" />
          </div>
          <Segmented value={type} onChange={setType} options={[{ value: 'all', label: 'Tous' }, { value: 'pro', label: 'Pros' }, { value: 'particulier', label: 'Particuliers' }, { value: 'unpaid', label: 'Avec impayés' }]} />
          <Select className="lg:w-44" value={sort} onChange={setSort} aria-label="Trier" options={[{ value: 'name', label: 'Tri : nom' }, { value: 'revenue', label: 'Tri : CA' }, { value: 'recent', label: 'Tri : plus récents' }]} />
        </div>
        {list.length === 0 ? (
          <Empty icon={<LuUsers />} title={data.clients.length ? 'Aucun résultat' : 'Aucun client'} text={data.clients.length ? 'Modifie ta recherche ou tes filtres.' : 'Ajoute ton premier client pour lui faire un devis.'}
            action={!data.clients.length && <Button variant="primary" icon={<LuPlus />} onClick={() => setEdit(blankClient())}>Ajouter un client</Button>} />
        ) : (
          <ul className="divide-y divide-line">
            {list.map(c => {
              const st = stats.get(c.id)!;
              return (
                <li key={c.id}>
                  <a href={`#/clients/${c.id}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-surface-2">
                    <Avatar c={c} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{c.company || c.name || 'Sans nom'}</p>
                      <p className="truncate text-xs text-faint">{[c.company ? c.name : '', c.email, c.city].filter(Boolean).join(' · ') || '—'}</p>
                    </div>
                    <div className="hidden text-right text-xs text-muted sm:block">{st.quotes} devis · {st.invoices} factures</div>
                    <div className="w-28 text-right">
                      <p className="tnum text-sm font-semibold">{money(st.revenue, s)}</p>
                      {st.unpaid > 0 && <p className="tnum text-[11px] text-rose-400">{money(st.unpaid, s)} dû</p>}
                    </div>
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <ClientModal client={edit} onClose={() => setEdit(null)} onSaved={c => go(`clients/${c.id}`)} />
    </div>
  );
}

export function Avatar({ c }: { c: Client }) {
  const label = (c.company || c.name || '?').trim();
  const ini = label.split(/\s+/).slice(0, 2).map(x => x[0]?.toUpperCase()).join('');
  let h = 0; for (const ch of label) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold text-white" style={{ background: `linear-gradient(135deg, hsl(${h} 70% 55%), hsl(${(h + 40) % 360} 70% 40%))` }}>{ini}</span>;
}

export function ClientModal({ client, onClose, onSaved }: { client: Client | null; onClose: () => void; onSaved?: (c: Client) => void }) {
  const [c, setC] = useState<Client | null>(client);
  const ui = useUI();
  React.useEffect(() => setC(client), [client]);
  if (!client || !c) return null;
  const set = (p: Partial<Client>) => setC(o => (o ? { ...o, ...p } : o));
  const valid = (c.name.trim() || c.company.trim()) && (!c.email || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.email));
  return (
    <Modal open onClose={onClose} title={client.name || client.company ? 'Modifier le client' : 'Nouveau client'} wide
      footer={<><Button variant="ghost" onClick={onClose}>Annuler</Button><Button variant="primary" disabled={!valid} onClick={() => { saveClient(c); ui.toast('Client enregistré'); onClose(); onSaved?.(c); }}>Enregistrer</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2"><Segmented value={c.type} onChange={v => set({ type: v })} options={[{ value: 'pro', label: 'Professionnel' }, { value: 'particulier', label: 'Particulier' }]} /></div>
        <Field label="Nom du contact *"><TextInput value={c.name} onChange={v => set({ name: v })} placeholder="Prénom Nom" autoFocus /></Field>
        <Field label={c.type === 'pro' ? 'Entreprise' : 'Entreprise (facultatif)'}><TextInput value={c.company} onChange={v => set({ company: v })} /></Field>
        <Field label="E-mail" hint={c.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.email) ? 'Adresse e-mail invalide' : undefined}><TextInput type="email" value={c.email} onChange={v => set({ email: v })} /></Field>
        <Field label="Téléphone"><TextInput type="tel" value={c.phone} onChange={v => set({ phone: v })} /></Field>
        <Field label="Adresse" className="sm:col-span-2"><TextInput value={c.address} onChange={v => set({ address: v })} /></Field>
        <Field label="Code postal"><TextInput value={c.zip} onChange={v => set({ zip: v })} /></Field>
        <Field label="Ville"><TextInput value={c.city} onChange={v => set({ city: v })} /></Field>
        <Field label="Pays"><TextInput value={c.country} onChange={v => set({ country: v })} /></Field>
        {c.type === 'pro' && <Field label="N° de TVA / d'entreprise"><TextInput value={c.vatNumber} onChange={v => set({ vatNumber: v })} /></Field>}
        <Field label="Notes" className="sm:col-span-2"><TextArea value={c.notes} onChange={v => set({ notes: v })} /></Field>
      </div>
      {!valid && <p className="mt-3 text-xs text-faint">* Indique au moins un nom ou une entreprise.</p>}
    </Modal>
  );
}

function ClientDetail({ client }: { client: Client }) {
  const data = useData();
  const s = data.settings;
  const ui = useUI();
  const [edit, setEdit] = useState<Client | null>(null);
  const m = (n: number) => money(n, s);
  const quotes = data.quotes.filter(q => q.clientId === client.id);
  const invoices = data.invoices.filter(i => i.clientId === client.id);
  const live = invoices.filter(i => i.status !== 'draft' && i.status !== 'cancelled');
  const revenue = live.reduce((a, i) => a + computeTotals(i).totalHT, 0);
  const unpaid = live.filter(i => i.status !== 'paid').reduce((a, i) => a + computeTotals(i).balance, 0);
  const services = live.flatMap(i => i.lines.map(l => ({ ...l, inv: i }))).sort((a, b) => b.inv.issueDate.localeCompare(a.inv.issueDate));

  return (
    <div>
      <button onClick={() => go('clients')} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><LuArrowLeft /> Tous les clients</button>
      <Card className="mb-4 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <Avatar c={client} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><h1 className="text-xl font-semibold">{client.company || client.name}</h1><Badge tone={client.type === 'pro' ? 'violet' : 'blue'}>{client.type === 'pro' ? 'Pro' : 'Particulier'}</Badge></div>
            {client.company && <p className="text-sm text-muted">{client.name}</p>}
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted">
              {client.email && <a href={`mailto:${client.email}`} className="flex items-center gap-1.5 hover:text-ink"><LuMail /> {client.email}</a>}
              {client.phone && <a href={`tel:${client.phone}`} className="flex items-center gap-1.5 hover:text-ink"><LuPhone /> {client.phone}</a>}
              {(client.address || client.city) && <span className="flex items-center gap-1.5"><LuMapPin /> {[client.address, client.zip, client.city, client.country].filter(Boolean).join(', ')}</span>}
              {client.vatNumber && <span className="flex items-center gap-1.5"><LuBuilding2 /> {client.vatNumber}</span>}
            </div>
            {client.notes && <p className="mt-3 whitespace-pre-line rounded-xl bg-surface-2 p-3 text-sm text-muted">{client.notes}</p>}
          </div>
          <div className="flex flex-wrap gap-2 sm:flex-col">
            <Button variant="primary" icon={<LuFileText />} onClick={() => { const q = createQuote({ clientId: client.id }); go(`quotes/${q.id}`); }}>Nouveau devis</Button>
            <Button icon={<LuReceipt />} onClick={() => { const i = createInvoice({ clientId: client.id }); go(`invoices/${i.id}`); }}>Nouvelle facture</Button>
            <Button icon={<LuPencil />} onClick={() => setEdit(client)}>Modifier</Button>
            <Button variant="danger" icon={<LuTrash2 />} onClick={async () => {
              const u = clientUsage(client.id);
              if (u.quotes + u.invoices > 0) { ui.toast(`Impossible : ${u.quotes} devis et ${u.invoices} factures sont liés à ce client.`, 'err'); return; }
              if (await ui.confirm({ title: 'Supprimer ce client ?', text: client.company || client.name, confirm: 'Supprimer', danger: true })) { deleteClient(client.id); go('clients'); ui.toast('Client supprimé'); }
            }}>Supprimer</Button>
          </div>
        </div>
      </Card>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="CA HT total" value={m(revenue)} icon={<LuReceipt />} />
        <Stat label="Reste dû" value={m(unpaid)} icon={<LuReceipt />} tone="bg-rose-500/12 text-rose-400" />
        <Stat label="Devis" value={quotes.length} icon={<LuFileText />} tone="bg-violet-500/12 text-violet-400" />
        <Stat label="Prestations facturées" value={services.length} icon={<LuLayers />} tone="bg-emerald-500/12 text-emerald-400" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Historique des devis" icon={<LuFileText />} />
          {quotes.length === 0 ? <p className="px-5 pb-5 text-sm text-muted">Aucun devis.</p> : (
            <ul className="px-2 pb-3">{quotes.map(q => (
              <li key={q.id}><a href={`#/quotes/${q.id}`} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 hover:bg-surface-2">
                <div className="min-w-0"><p className="truncate text-sm font-medium">{q.number}{q.title ? ` · ${q.title}` : ''}</p><p className="text-xs text-faint">{dateFmt(q.issueDate)}</p></div>
                <div className="text-right"><p className="tnum text-sm font-semibold">{m(computeTotals(q).totalHT)}</p><Badge tone={QUOTE_STATUS[q.status].tone}>{QUOTE_STATUS[q.status].label}</Badge></div>
              </a></li>
            ))}</ul>
          )}
        </Card>
        <Card>
          <CardHeader title="Historique des factures" icon={<LuReceipt />} />
          {invoices.length === 0 ? <p className="px-5 pb-5 text-sm text-muted">Aucune facture.</p> : (
            <ul className="px-2 pb-3">{invoices.map(i => (
              <li key={i.id}><a href={`#/invoices/${i.id}`} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 hover:bg-surface-2">
                <div className="min-w-0"><p className="truncate text-sm font-medium">{i.number || 'Brouillon'}{i.title ? ` · ${i.title}` : ''}</p><p className="text-xs text-faint">{dateFmt(i.issueDate)}</p></div>
                <div className="text-right"><p className="tnum text-sm font-semibold">{m(computeTotals(i).totalTTC)}</p>{isOverdue(i) ? <Badge tone="red">En retard</Badge> : <Badge tone={INVOICE_STATUS[i.status].tone}>{INVOICE_STATUS[i.status].label}</Badge>}</div>
              </a></li>
            ))}</ul>
          )}
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Historique des prestations" subtitle="Lignes des factures émises" icon={<LuLayers />} />
          {services.length === 0 ? <p className="px-5 pb-5 text-sm text-muted">Aucune prestation facturée.</p> : (
            <div className="scroll-thin overflow-x-auto px-2 pb-3">
              <table className="w-full min-w-[520px] text-sm">
                <thead><tr className="text-left text-xs text-faint"><th className="px-3 py-2 font-medium">Date</th><th className="px-3 py-2 font-medium">Prestation</th><th className="px-3 py-2 text-right font-medium">Qté</th><th className="px-3 py-2 text-right font-medium">Montant HT</th><th className="px-3 py-2 font-medium">Facture</th></tr></thead>
                <tbody>{services.map(l => (
                  <tr key={l.id} className="border-t border-line">
                    <td className="px-3 py-2 text-muted">{dateFmt(l.inv.issueDate)}</td>
                    <td className="px-3 py-2">{l.description}</td>
                    <td className="tnum px-3 py-2 text-right">{numFmt(l.qty)} {l.unit}</td>
                    <td className="tnum px-3 py-2 text-right font-medium">{m(l.qty * l.unitPrice * (1 - l.discountPct / 100))}</td>
                    <td className="px-3 py-2"><a className="text-accent hover:underline" href={`#/invoices/${l.inv.id}`}>{l.inv.number}</a></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
      <ClientModal client={edit} onClose={() => setEdit(null)} />
    </div>
  );
}
