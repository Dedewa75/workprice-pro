import React, { useState } from 'react';
import { LuPlus, LuFileText, LuReceipt, LuSearch } from 'react-icons/lu';
import { useData } from '../core/store';
import { createQuote, createInvoice } from '../core/actions';
import { computeTotals, isOverdue, isQuoteExpired } from '../core/docs';
import type { Doc } from '../core/types';
import { Button, Card, Empty, PageHeader, Segmented, TextInput, Badge, cx } from '../ui/kit';
import { money, dateFmt, QUOTE_STATUS, INVOICE_STATUS } from '../ui/format';
import { go } from '../ui/router';

function useClientName() {
  const data = useData();
  return (id: string | null) => { const c = data.clients.find(x => x.id === id); return c ? c.company || c.name : '—'; };
}

function DocTable({ docs, kind }: { docs: Doc[]; kind: 'quote' | 'invoice' }) {
  const data = useData();
  const s = data.settings;
  const name = useClientName();
  return (
    <>
      {/* Tableau (desktop) */}
      <div className="hidden md:block">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-line text-left text-xs text-faint">
            <th className="px-4 py-3 font-medium">Numéro</th><th className="px-4 py-3 font-medium">Client</th><th className="px-4 py-3 font-medium">Objet</th>
            <th className="px-4 py-3 font-medium">Date</th><th className="px-4 py-3 font-medium">{kind === 'quote' ? 'Validité' : 'Échéance'}</th>
            <th className="px-4 py-3 text-right font-medium">Total {s.vat.enabled ? 'TTC' : ''}</th><th className="px-4 py-3 font-medium">Statut</th>
          </tr></thead>
          <tbody>
            {docs.map(d => {
              const t = computeTotals(d);
              return (
                <tr key={d.id} onClick={() => go(`${kind === 'quote' ? 'quotes' : 'invoices'}/${d.id}`)} className="cursor-pointer border-b border-line/60 transition last:border-0 hover:bg-surface-2">
                  <td className="px-4 py-3 font-medium">{d.number || <span className="text-faint">Brouillon</span>}</td>
                  <td className="px-4 py-3">{name(d.clientId)}</td>
                  <td className="max-w-[220px] truncate px-4 py-3 text-muted">{d.title || '—'}</td>
                  <td className="px-4 py-3 text-muted">{dateFmt(d.issueDate)}</td>
                  <td className="px-4 py-3 text-muted">{dateFmt(d.kind === 'quote' ? d.validUntil : d.dueDate)}</td>
                  <td className="tnum px-4 py-3 text-right font-semibold">{money(t.totalTTC, s)}{d.kind === 'invoice' && d.status === 'partial' && <span className="block text-[11px] font-normal text-muted">reste {money(t.balance, s)}</span>}</td>
                  <td className="px-4 py-3"><StatusBadge d={d} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* Cartes (mobile) */}
      <ul className="divide-y divide-line md:hidden">
        {docs.map(d => (
          <li key={d.id}>
            <a href={`#/${kind === 'quote' ? 'quotes' : 'invoices'}/${d.id}`} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{d.number || 'Brouillon'} · {name(d.clientId)}</p>
                <p className="truncate text-xs text-faint">{dateFmt(d.issueDate)}{d.title ? ` · ${d.title}` : ''}</p>
              </div>
              <div className="text-right"><p className="tnum text-sm font-semibold">{money(computeTotals(d).totalTTC, s)}</p><StatusBadge d={d} /></div>
            </a>
          </li>
        ))}
      </ul>
    </>
  );
}

export function StatusBadge({ d }: { d: Doc }) {
  if (d.kind === 'quote') {
    if (isQuoteExpired(d)) return <Badge tone="amber">Expiré</Badge>;
    return <Badge tone={QUOTE_STATUS[d.status].tone}>{QUOTE_STATUS[d.status].label}</Badge>;
  }
  if (isOverdue(d)) return <Badge tone="red">En retard</Badge>;
  return <Badge tone={INVOICE_STATUS[d.status].tone}>{INVOICE_STATUS[d.status].label}</Badge>;
}

function Filters<T extends string>({ q, setQ, st, setSt, options }: { q: string; setQ: (v: string) => void; st: T; setSt: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center">
      <div className="relative flex-1"><LuSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" /><TextInput value={q} onChange={setQ} placeholder="Rechercher numéro, client, objet…" className="pl-9" /></div>
      <Segmented value={st} onChange={setSt} options={options} />
    </div>
  );
}

export function QuotesList() {
  const data = useData();
  const name = useClientName();
  const [q, setQ] = useState('');
  const [st, setSt] = useState<'all' | 'draft' | 'sent' | 'accepted' | 'refused' | 'invoiced'>('all');
  const list = data.quotes
    .filter(d => (st === 'all' || d.status === st) && `${d.number} ${name(d.clientId)} ${d.title}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.issueDate.localeCompare(a.issueDate) || b.number.localeCompare(a.number));
  const total = list.reduce((a, d) => a + computeTotals(d).totalHT, 0);
  return (
    <div>
      <PageHeader title="Devis" subtitle={`${data.quotes.length} devis · ${list.length} affiché(s) · ${money(total, data.settings)} HT`}
        actions={<Button variant="primary" icon={<LuPlus />} onClick={() => { const d = createQuote(); go(`quotes/${d.id}`); }}>Nouveau devis</Button>} />
      <Card>
        <Filters q={q} setQ={setQ} st={st} setSt={setSt} options={[{ value: 'all', label: 'Tous' }, { value: 'draft', label: 'Brouillons' }, { value: 'sent', label: 'Envoyés' }, { value: 'accepted', label: 'Acceptés' }, { value: 'refused', label: 'Refusés' }, { value: 'invoiced', label: 'Facturés' }]} />
        {list.length === 0 ? <Empty icon={<LuFileText />} title={data.quotes.length ? 'Aucun devis ne correspond' : 'Aucun devis'} text="Crée un devis ici ou depuis le calculateur." /> : <DocTable docs={list} kind="quote" />}
      </Card>
    </div>
  );
}

export function InvoicesList() {
  const data = useData();
  const s = data.settings;
  const name = useClientName();
  const [q, setQ] = useState('');
  const [st, setSt] = useState<'all' | 'draft' | 'unpaid' | 'overdue' | 'paid' | 'cancelled'>('all');
  const list = data.invoices
    .filter(d => {
      if (!`${d.number} ${name(d.clientId)} ${d.title}`.toLowerCase().includes(q.toLowerCase())) return false;
      if (st === 'unpaid') return d.status === 'issued' || d.status === 'partial';
      if (st === 'overdue') return isOverdue(d);
      return st === 'all' || d.status === st;
    })
    .sort((a, b) => (a.status === 'draft' ? -1 : 0) - (b.status === 'draft' ? -1 : 0) || b.issueDate.localeCompare(a.issueDate) || b.number.localeCompare(a.number));
  const live = data.invoices.filter(i => i.status !== 'draft' && i.status !== 'cancelled');
  const due = live.filter(i => i.status !== 'paid').reduce((a, i) => a + computeTotals(i).balance, 0);
  const paid = live.reduce((a, i) => a + computeTotals(i).paid, 0);
  return (
    <div>
      <PageHeader title="Factures" subtitle={`${data.invoices.length} facture(s)`}
        actions={<Button variant="primary" icon={<LuPlus />} onClick={() => { const d = createInvoice(); go(`invoices/${d.id}`); }}>Nouvelle facture</Button>} />
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card className="p-4"><p className="text-xs text-muted">Encaissé (total)</p><p className="tnum mt-1 text-xl font-semibold text-emerald-400">{money(paid, s)}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted">Reste à encaisser</p><p className={cx('tnum mt-1 text-xl font-semibold', due > 0 ? 'text-amber-400' : '')}>{money(due, s)}</p></Card>
        <Card className="col-span-2 p-4 sm:col-span-1"><p className="text-xs text-muted">Factures en retard</p><p className="tnum mt-1 text-xl font-semibold text-rose-400">{live.filter(i => isOverdue(i)).length}</p></Card>
      </div>
      <Card>
        <Filters q={q} setQ={setQ} st={st} setSt={setSt} options={[{ value: 'all', label: 'Toutes' }, { value: 'draft', label: 'Brouillons' }, { value: 'unpaid', label: 'Impayées' }, { value: 'overdue', label: 'En retard' }, { value: 'paid', label: 'Payées' }, { value: 'cancelled', label: 'Annulées' }]} />
        {list.length === 0 ? <Empty icon={<LuReceipt />} title={data.invoices.length ? 'Aucune facture ne correspond' : 'Aucune facture'} text="Transforme un devis accepté en facture, ou crée une facture directement." /> : <DocTable docs={list} kind="invoice" />}
      </Card>
    </div>
  );
}
