import React, { useState } from 'react';
import { LuArrowLeft, LuDownload, LuPrinter, LuPlus, LuTrash2, LuSend, LuCircleCheck, LuCircleX, LuReceipt, LuCopy, LuLock, LuChevronDown, LuChevronRight, LuBanknote, LuBriefcase, LuUserPlus, LuArrowUp, LuArrowDown, LuFileCheck, LuInfo } from 'react-icons/lu';
import { useData } from '../core/store';
import { saveQuote, saveInvoice, deleteQuote, deleteDraftInvoice, duplicateQuote, convertQuoteToInvoice, issueInvoice, addPayment, removePayment, cancelInvoice, defaultVat, blankClient } from '../core/actions';
import { computeTotals, lineTotal, newLine, isOverdue, isQuoteExpired, todayISO, addDays } from '../core/docs';
import { computeCalc } from '../core/calc';
import { buildDocPdf, pdfFileName } from '../core/pdf';
import type { Doc, DocLine, Invoice, Quote, PdfTemplate, AppData } from '../core/types';
import { Button, Card, CardHeader, Field, IconButton, Modal, NumberInput, Select, TextArea, TextInput, useUI, Empty, cx } from '../ui/kit';
import { money, numFmt, dateFmt, METHOD_LABELS, PERIOD_SHORT } from '../ui/format';
import { go } from '../ui/router';
import { StatusBadge } from './DocsList';
import { ClientModal } from './Clients';

const TEMPLATES: { value: PdfTemplate; label: string }[] = [{ value: 'modern', label: 'Moderne' }, { value: 'classic', label: 'Classique' }, { value: 'minimal', label: 'Minimal' }];

export async function exportPdf(doc: Doc, data: AppData, mode: 'download' | 'open') {
  const client = data.clients.find(c => c.id === doc.clientId) || null;
  const quoteNumber = doc.kind === 'invoice' && doc.quoteId ? data.quotes.find(q => q.id === doc.quoteId)?.number : undefined;
  const bytes = await buildDocPdf(doc, client, data.settings, { quoteNumber });
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  if (mode === 'open') {
    const w = window.open(url, '_blank');
    if (!w) mode = 'download';
  }
  if (mode === 'download') {
    const a = document.createElement('a');
    a.href = url; a.download = pdfFileName(doc, client);
    document.body.appendChild(a); a.click(); a.remove();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export default function DocEditor({ kind, id }: { kind: 'quote' | 'invoice'; id: string }) {
  const data = useData();
  const doc: Doc | undefined = kind === 'quote' ? data.quotes.find(q => q.id === id) : data.invoices.find(i => i.id === id);
  if (!doc) return <Card><Empty icon={<LuInfo />} title="Document introuvable" text="Il a peut-être été supprimé." action={<Button onClick={() => go(kind === 'quote' ? 'quotes' : 'invoices')}>Retour à la liste</Button>} /></Card>;
  return <Editor doc={doc} />;
}

function Editor({ doc }: { doc: Doc }) {
  const data = useData();
  const s = data.settings;
  const ui = useUI();
  const [busy, setBusy] = useState(false);
  const [catalog, setCatalog] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [newClient, setNewClient] = useState<ReturnType<typeof blankClient> | null>(null);
  const isQuote = doc.kind === 'quote';
  const locked = isQuote ? doc.status === 'invoiced' : doc.status !== 'draft';
  const t = computeTotals(doc);
  const m = (n: number) => money(n, s);
  const vatOn = s.vat.enabled;

  const save = (p: Partial<Doc>) => {
    if (doc.kind === 'quote') saveQuote({ ...doc, ...(p as Partial<Quote>) });
    else saveInvoice({ ...doc, ...(p as Partial<Invoice>) });
  };
  const setLine = (lid: string, p: Partial<DocLine>) => save({ lines: doc.lines.map(l => (l.id === lid ? { ...l, ...p } : l)) });
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir; if (j < 0 || j >= doc.lines.length) return;
    const lines = [...doc.lines]; [lines[i], lines[j]] = [lines[j], lines[i]]; save({ lines });
  };
  const pdf = async (mode: 'download' | 'open') => {
    if (!doc.clientId) { const ok = await ui.confirm({ title: 'Aucun client sélectionné', text: 'Le PDF sera généré sans destinataire. Continuer ?', confirm: 'Générer quand même' }); if (!ok) return; }
    setBusy(true);
    try { await exportPdf(doc, data, mode); ui.toast(mode === 'download' ? 'PDF téléchargé' : 'PDF ouvert dans un nouvel onglet'); }
    catch (e) { console.error(e); ui.toast('Erreur lors de la création du PDF', 'err'); }
    finally { setBusy(false); }
  };
  const missingCompany = !s.company.name;

  return (
    <div>
      <button onClick={() => go(isQuote ? 'quotes' : 'invoices')} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><LuArrowLeft /> {isQuote ? 'Tous les devis' : 'Toutes les factures'}</button>

      <div className="mb-5 flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="whitespace-nowrap text-2xl font-semibold tracking-tight" data-testid="doc-number">{isQuote ? 'Devis' : 'Facture'} {doc.number || <span className="text-muted">brouillon</span>}</h1>
          <StatusBadge d={doc} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button icon={<LuDownload />} onClick={() => pdf('download')} disabled={busy}>Télécharger PDF</Button>
          <Button icon={<LuPrinter />} onClick={() => pdf('open')} disabled={busy}>Ouvrir / imprimer</Button>
          {isQuote ? <QuoteActions q={doc} /> : <InvoiceActions inv={doc} onPay={() => setPayOpen(true)} />}
        </div>
      </div>

      {missingCompany && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          <span className="flex items-center gap-2"><LuInfo /> Renseigne les informations de ton entreprise pour qu'elles apparaissent sur le PDF.</span>
          <Button size="sm" onClick={() => go('settings')}>Paramètres</Button>
        </div>
      )}
      {locked && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm text-muted">
          <LuLock className="mt-0.5 shrink-0" />
          {isQuote ? 'Ce devis a été transformé en facture : il n\'est plus modifiable. Duplique-le pour en faire une variante.'
            : 'Facture émise : son contenu est verrouillé pour garantir la numérotation et la traçabilité. Pour corriger, annule-la et crée une nouvelle facture (ou une note de crédit selon les règles de ton pays).'}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <Card className="p-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Client" className="sm:col-span-2">
                <div className="flex gap-2">
                  <Select className="flex-1" disabled={locked} value={doc.clientId || ''} onChange={v => save({ clientId: v || null })} aria-label="Client"
                    options={[{ value: '', label: '— Choisir un client —' }, ...[...data.clients].sort((a, b) => (a.company || a.name).localeCompare(b.company || b.name, 'fr')).map(c => ({ value: c.id, label: c.company ? `${c.company} (${c.name})` : c.name }))]} />
                  {!locked && <IconButton label="Nouveau client" className="h-10 w-10 border border-line" onClick={() => setNewClient(blankClient())}><LuUserPlus /></IconButton>}
                </div>
              </Field>
              <Field label="Date d'émission"><TextInput type="date" disabled={locked} value={doc.issueDate} onChange={v => save({ issueDate: v })} /></Field>
              {doc.kind === 'quote'
                ? <Field label="Valable jusqu'au"><TextInput type="date" disabled={locked} value={doc.validUntil} onChange={v => saveQuote({ ...doc, validUntil: v })} /></Field>
                : <Field label="Échéance"><TextInput type="date" disabled={doc.status === 'cancelled'} value={doc.dueDate} onChange={v => saveInvoice({ ...doc, dueDate: v })} /></Field>}
              <Field label="Objet" className="sm:col-span-2 lg:col-span-3"><TextInput disabled={locked} value={doc.title} onChange={v => save({ title: v })} placeholder="Ex. Création d'un site vitrine" /></Field>
              <Field label="Modèle PDF"><Select value={doc.template} onChange={v => save({ template: v })} options={TEMPLATES} /></Field>
            </div>
          </Card>

          <Card>
            <CardHeader title="Prestations" subtitle={`${doc.lines.length} ligne(s)`} action={!locked && (
              <div className="flex gap-2">
                <Button size="sm" variant="subtle" icon={<LuBriefcase />} onClick={() => setCatalog(true)}>Catalogue</Button>
                <Button size="sm" variant="primary" icon={<LuPlus />} onClick={() => save({ lines: [...doc.lines, newLine({ vatRate: defaultVat(s) })] })}>Ligne</Button>
              </div>
            )} />
            <div className="space-y-3 px-4 pb-4">
              {doc.lines.length === 0 && <p className="py-6 text-center text-sm text-muted">Aucune ligne. Ajoute une prestation.</p>}
              {doc.lines.map((l, i) => <LineRow key={l.id} l={l} i={i} n={doc.lines.length} locked={locked} vatOn={vatOn} rates={s.vat.rates} cur={s.currency} m={m}
                onChange={p => setLine(l.id, p)} onDelete={() => save({ lines: doc.lines.filter(x => x.id !== l.id) })} onMove={d => move(i, d)} />)}
            </div>
          </Card>

          <Card className="p-5">
            <div className="grid gap-3 lg:grid-cols-2">
              <Field label="Notes (visibles sur le document)"><TextArea disabled={locked && isQuote} value={doc.notes} onChange={v => save({ notes: v })} /></Field>
              <Field label="Conditions"><TextArea disabled={locked && isQuote} value={doc.conditions} onChange={v => save({ conditions: v })} placeholder={isQuote ? 'Acompte, délais, validité…' : 'Pénalités de retard, escompte…'} /></Field>
            </div>
          </Card>

          {doc.kind === 'invoice' && doc.status !== 'draft' && (
            <Card>
              <CardHeader title="Paiements" icon={<LuBanknote />} action={doc.status !== 'cancelled' && doc.status !== 'paid' && <Button size="sm" variant="primary" icon={<LuPlus />} onClick={() => setPayOpen(true)}>Enregistrer un paiement</Button>} />
              {doc.payments.length === 0 ? <p className="px-5 pb-5 text-sm text-muted">Aucun paiement enregistré.</p> : (
                <ul className="divide-y divide-line border-t border-line">
                  {doc.payments.map(p => (
                    <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                      <div><p className="font-medium">{dateFmt(p.date)} · {p.method}</p>{p.note && <p className="text-xs text-faint">{p.note}</p>}</div>
                      <div className="flex items-center gap-2"><span className="tnum font-semibold text-emerald-400">{m(p.amount)}</span>
                        <IconButton label="Supprimer le paiement" onClick={async () => { if (await ui.confirm({ title: 'Supprimer ce paiement ?', text: `${m(p.amount)} du ${dateFmt(p.date)}`, confirm: 'Supprimer', danger: true })) removePayment(doc.id, p.id); }}><LuTrash2 /></IconButton>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </div>

        {/* Totaux */}
        <div className="xl:sticky xl:top-6 xl:self-start">
          <Card className="overflow-hidden" data-testid="totals">
            <div className="space-y-1.5 px-5 py-4 text-sm">
              <TotRow label="Sous-total" v={m(t.subtotal)} />
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted">Remise globale</span>
                <NumberInput className="w-28" disabled={locked} value={doc.globalDiscountPct} onChange={v => save({ globalDiscountPct: v })} suffix="%" min={0} max={100} aria-label="Remise globale" />
              </div>
              {t.globalDiscount > 0 && <TotRow label="Montant de la remise" v={`− ${m(t.globalDiscount)}`} />}
              <TotRow label="Total HT" v={m(t.totalHT)} strong />
              {vatOn && t.vat.map(v => <TotRow key={v.rate} label={`TVA ${numFmt(v.rate)} %`} v={m(v.vat)} />)}
            </div>
            <div className="glow-accent border-t border-line px-5 py-4">
              <p className="text-xs uppercase tracking-wider text-muted">{vatOn ? 'Total TTC' : 'Total'}</p>
              <p className="tnum text-3xl font-bold tracking-tight" data-testid="total-ttc">{m(t.totalTTC)}</p>
              {doc.kind === 'invoice' && t.paid > 0 && <p className="mt-1 text-sm text-muted">Payé {m(t.paid)} · <b className={t.balance > 0 ? 'text-amber-400' : 'text-emerald-400'}>reste {m(Math.max(0, t.balance))}</b></p>}
              {!vatOn && s.vat.exemptionMention && <p className="mt-2 text-[11px] text-faint">{s.vat.exemptionMention}</p>}
            </div>
            <div className="border-t border-line px-5 py-3 text-xs text-muted">
              <p>Coûts directs internes : <b className="tnum text-ink">{m(t.totalCost)}</b></p>
              <p>Marge brute estimée : <b className="tnum text-ink">{m(t.totalHT - t.totalCost)}</b> <span className="text-faint">(non imprimé)</span></p>
            </div>
          </Card>
        </div>
      </div>

      <CatalogModal open={catalog} onClose={() => setCatalog(false)} onAdd={ls => { const keep = doc.lines.filter(l => l.description || l.unitPrice); save({ lines: [...keep, ...ls] }); ui.toast(`${ls.length} ligne(s) ajoutée(s)`); }} />
      {doc.kind === 'invoice' && <PaymentModal open={payOpen} onClose={() => setPayOpen(false)} inv={doc} />}
      <ClientModal client={newClient} onClose={() => setNewClient(null)} onSaved={c => save({ clientId: c.id })} />
    </div>
  );
}

const TotRow = ({ label, v, strong }: { label: string; v: string; strong?: boolean }) => (
  <div className="flex items-center justify-between gap-3"><span className={strong ? 'font-medium' : 'text-muted'}>{label}</span><span className={cx('tnum', strong && 'font-semibold')}>{v}</span></div>
);

function LineRow({ l, i, n, locked, vatOn, rates, cur, m, onChange, onDelete, onMove }: {
  l: DocLine; i: number; n: number; locked: boolean; vatOn: boolean; rates: number[]; cur: string; m: (n: number) => string;
  onChange: (p: Partial<DocLine>) => void; onDelete: () => void; onMove: (d: -1 | 1) => void;
}) {
  const [more, setMore] = useState(!!l.detail || l.unitCost > 0);
  return (
    <div className="anim-in rounded-xl border border-line bg-surface-2 p-3" data-testid="line">
      <div className="grid gap-2 sm:grid-cols-12">
        <div className="sm:col-span-4"><TextInput disabled={locked} value={l.description} onChange={v => onChange({ description: v })} placeholder="Description de la prestation" aria-label="Description" /></div>
        <div className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1.6fr)] gap-2 sm:col-span-6">
          <NumberInput disabled={locked} value={l.qty} onChange={v => onChange({ qty: v })} aria-label="Quantité" min={0} />
          <TextInput disabled={locked} value={l.unit} onChange={v => onChange({ unit: v })} aria-label="Unité" placeholder="unité" />
          <NumberInput disabled={locked} value={l.unitPrice} onChange={v => onChange({ unitPrice: v })} suffix={cur} aria-label="Prix unitaire HT" />
        </div>
        <div className="flex items-center justify-between gap-1 sm:col-span-2 sm:justify-end">
          <span className="tnum text-sm font-semibold sm:hidden">{m(lineTotal(l))}</span>
          {!locked && <div className="flex">
            <IconButton label="Monter" disabled={i === 0} onClick={() => onMove(-1)}><LuArrowUp /></IconButton>
            <IconButton label="Descendre" disabled={i === n - 1} onClick={() => onMove(1)}><LuArrowDown /></IconButton>
            <IconButton label="Supprimer la ligne" onClick={onDelete}><LuTrash2 /></IconButton>
          </div>}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <button type="button" className="flex items-center gap-1 text-xs text-muted hover:text-ink" onClick={() => setMore(!more)}>{more ? <LuChevronDown /> : <LuChevronRight />} Détail, remise{vatOn ? ', TVA' : ''}, coût interne</button>
        <span className="tnum hidden text-sm font-semibold sm:block">{m(lineTotal(l))} <span className="text-xs font-normal text-faint">HT</span></span>
      </div>
      {more && (
        <div className="mt-2 grid gap-2 sm:grid-cols-4">
          <div className="sm:col-span-4"><TextArea disabled={locked} value={l.detail} onChange={v => onChange({ detail: v })} placeholder="Détail (facultatif)" className="min-h-[56px]" aria-label="Détail" /></div>
          <Field label="Remise ligne"><NumberInput disabled={locked} value={l.discountPct} onChange={v => onChange({ discountPct: v })} suffix="%" min={0} max={100} /></Field>
          {vatOn && <Field label="TVA">{rates.length ? <Select disabled={locked} value={String(l.vatRate)} onChange={v => onChange({ vatRate: parseFloat(v) })} options={[...new Set([...rates, l.vatRate])].sort((a, b) => a - b).map(x => ({ value: String(x), label: `${numFmt(x)} %` }))} /> : <NumberInput disabled={locked} value={l.vatRate} onChange={v => onChange({ vatRate: v })} suffix="%" min={0} />}</Field>}
          <Field label="Coût direct / unité" hint="Interne, jamais imprimé"><NumberInput disabled={locked} value={l.unitCost} onChange={v => onChange({ unitCost: v })} suffix={cur} min={0} /></Field>
        </div>
      )}
    </div>
  );
}

function QuoteActions({ q }: { q: Quote }) {
  const ui = useUI();
  const expired = isQuoteExpired(q);
  return (
    <>
      {q.status === 'draft' && <Button icon={<LuSend />} onClick={() => { saveQuote({ ...q, status: 'sent' }); ui.toast('Devis marqué comme envoyé'); }}>Marquer envoyé</Button>}
      {(q.status === 'sent' || q.status === 'draft') && <>
        <Button variant="subtle" icon={<LuCircleCheck />} onClick={() => { saveQuote({ ...q, status: 'accepted' }); ui.toast('Devis accepté 🎉'); }}>Accepté</Button>
        <Button variant="ghost" icon={<LuCircleX />} onClick={() => { saveQuote({ ...q, status: 'refused' }); ui.toast('Devis marqué refusé', 'info'); }}>Refusé</Button>
      </>}
      {(q.status === 'refused' || q.status === 'accepted') && <Button variant="ghost" onClick={() => saveQuote({ ...q, status: 'sent' })}>Remettre en attente</Button>}
      {q.status !== 'invoiced' && q.status !== 'refused' && <Button variant="primary" icon={<LuReceipt />} onClick={async () => {
        if (q.status !== 'accepted' && !(await ui.confirm({ title: 'Transformer en facture ?', text: 'Le devis sera marqué comme accepté puis facturé.', confirm: 'Transformer' }))) return;
        if (expired) ui.toast('Attention : la validité du devis est dépassée', 'info');
        const inv = convertQuoteToInvoice(q.id);
        if (inv) { ui.toast('Facture brouillon créée — vérifie-la puis émets-la'); go(`invoices/${inv.id}`); }
      }}>Transformer en facture</Button>}
      {q.status === 'invoiced' && q.invoiceId && <Button icon={<LuReceipt />} onClick={() => go(`invoices/${q.invoiceId}`)}>Voir la facture</Button>}
      <Button variant="ghost" icon={<LuCopy />} onClick={() => { const d = duplicateQuote(q); ui.toast(`Copie créée : ${d.number}`); go(`quotes/${d.id}`); }}>Dupliquer</Button>
      {q.status !== 'invoiced' && <Button variant="danger" icon={<LuTrash2 />} onClick={async () => {
        if (await ui.confirm({ title: 'Supprimer ce devis ?', text: `${q.number} sera définitivement supprimé.`, confirm: 'Supprimer', danger: true })) { deleteQuote(q.id); go('quotes'); ui.toast('Devis supprimé'); }
      }}>Supprimer</Button>}
    </>
  );
}

function InvoiceActions({ inv, onPay }: { inv: Invoice; onPay: () => void }) {
  const ui = useUI();
  const data = useData();
  const t = computeTotals(inv);
  return (
    <>
      {inv.status === 'draft' && <Button variant="primary" icon={<LuFileCheck />} onClick={async () => {
        if (!inv.clientId) { ui.toast('Choisis un client avant d\'émettre la facture', 'err'); return; }
        if (inv.lines.length === 0 || t.totalHT <= 0) { ui.toast('La facture doit contenir au moins une ligne avec un montant', 'err'); return; }
        if (!(await ui.confirm({ title: 'Émettre la facture ?', text: 'Un numéro définitif va lui être attribué et son contenu sera verrouillé.\nVérifie le client, les lignes et les montants.', confirm: 'Émettre' }))) return;
        const r = issueInvoice(inv.id);
        ui.toast(`Facture ${r?.number} émise`);
      }}>Émettre la facture</Button>}
      {(inv.status === 'issued' || inv.status === 'partial') && <Button variant="primary" icon={<LuBanknote />} onClick={onPay}>Paiement reçu</Button>}
      {inv.quoteId && <Button variant="ghost" onClick={() => go(`quotes/${inv.quoteId}`)}>Voir le devis</Button>}
      {inv.status === 'draft' && <Button variant="danger" icon={<LuTrash2 />} onClick={async () => {
        if (await ui.confirm({ title: 'Supprimer ce brouillon ?', text: 'Le brouillon n\'a pas de numéro, il peut être supprimé.', confirm: 'Supprimer', danger: true })) {
          if (inv.quoteId) { const q = data.quotes.find(x => x.id === inv.quoteId); if (q) saveQuote({ ...q, status: 'accepted', invoiceId: null }); }
          deleteDraftInvoice(inv.id); go('invoices'); ui.toast('Brouillon supprimé');
        }
      }}>Supprimer</Button>}
      {(inv.status === 'issued' || inv.status === 'partial') && <Button variant="danger" icon={<LuCircleX />} onClick={async () => {
        if (await ui.confirm({ title: 'Annuler cette facture ?', text: 'Elle restera dans l\'historique avec le statut « Annulée » (son numéro n\'est pas réutilisé).\nSelon ton pays, une note de crédit peut être obligatoire.', confirm: 'Annuler la facture', danger: true })) { cancelInvoice(inv.id); ui.toast('Facture annulée', 'info'); }
      }}>Annuler</Button>}
    </>
  );
}

function PaymentModal({ open, onClose, inv }: { open: boolean; onClose: () => void; inv: Invoice }) {
  const s = useData().settings;
  const ui = useUI();
  const bal = Math.max(0, computeTotals(inv).balance);
  const [amount, setAmount] = useState(bal);
  const [date, setDate] = useState(todayISO());
  const [method, setMethod] = useState('Virement');
  const [note, setNote] = useState('');
  React.useEffect(() => { if (open) { setAmount(bal); setDate(todayISO()); setNote(''); } }, [open]);
  return (
    <Modal open={open} onClose={onClose} title="Enregistrer un paiement"
      footer={<><Button variant="ghost" onClick={onClose}>Annuler</Button><Button variant="primary" disabled={amount <= 0} onClick={() => {
        addPayment(inv.id, { amount, date, method, note });
        ui.toast(amount >= bal - 0.004 ? 'Facture soldée ✅' : 'Paiement partiel enregistré');
        onClose();
      }}>Enregistrer</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Montant reçu" hint={`Reste dû : ${money(bal, s)}`}><NumberInput value={amount} onChange={setAmount} suffix={s.currency} min={0} /></Field>
        <Field label="Date"><TextInput type="date" value={date} onChange={setDate} /></Field>
        <Field label="Moyen de paiement"><Select value={method} onChange={setMethod} options={['Virement', 'Espèces', 'Carte', 'Chèque', 'PayPal', 'Autre'].map(x => ({ value: x, label: x }))} /></Field>
        <Field label="Note"><TextInput value={note} onChange={setNote} placeholder="Facultatif" /></Field>
      </div>
      {amount > bal + 0.004 && <p className="mt-3 text-xs text-amber-300">Le montant dépasse le reste dû.</p>}
    </Modal>
  );
}

function CatalogModal({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (l: DocLine[]) => void }) {
  const data = useData();
  const s = data.settings;
  const [tid, setTid] = useState('');
  if (!open) return null;
  const trade = data.trades.find(t => t.id === (tid || data.trades[0]?.id));
  const vat = defaultVat(s);
  const add = (l: DocLine[]) => { onAdd(l); onClose(); };
  return (
    <Modal open onClose={onClose} title="Ajouter depuis le catalogue" wide>
      {data.trades.length === 0 ? <Empty icon={<LuBriefcase />} title="Catalogue vide" text="Crée des métiers avec prestations, packs et options pour les insérer en un clic." action={<Button onClick={() => { onClose(); go('trades'); }}>Créer un métier</Button>} /> : (
        <>
          <Select className="mb-4" value={trade?.id || ''} onChange={setTid} options={data.trades.map(t => ({ value: t.id, label: t.name }))} aria-label="Métier" />
          {trade && (
            <div className="space-y-4">
              <Section title="Prestations">
                {trade.services.map(sv => {
                  const r = computeCalc(sv.input);
                  const qty = sv.input.method === 'flat' || sv.input.method === 'custom' ? 1 : sv.input.method === 'subscription' ? Math.max(1, sv.input.subscriptionDuration) : Math.max(1, sv.input.quantity);
                  return <Item key={sv.id} title={sv.name} sub={`${METHOD_LABELS[sv.input.method]} · ${qty} × ${money(r.priceHT / qty, s)}`} price={money(r.priceHT, s)}
                    onClick={() => add([newLine({ description: sv.name, detail: sv.input.description, qty, unit: sv.input.method === 'flat' || sv.input.method === 'custom' ? 'forfait' : sv.input.method === 'subscription' ? 'période' : sv.input.unitLabel, unitPrice: Math.round(r.priceHT / qty * 100) / 100, unitCost: Math.round(r.expenses / qty * 100) / 100, vatRate: vat })])} />;
                })}
              </Section>
              <Section title="Packs">
                {trade.packs.map(p => <Item key={p.id} title={p.name} sub={`${p.quantity} prestation(s)${p.includes.length ? ' · ' + p.includes.join(', ') : ''}`} price={`${money(p.totalPrice, s)}${PERIOD_SHORT[p.periodicity]}`}
                  onClick={() => add([newLine({ description: `${trade.name} — ${p.name}`, detail: [p.description, p.includes.length ? 'Inclus : ' + p.includes.join(', ') : ''].filter(Boolean).join('\n'), qty: 1, unit: p.periodicity === 'once' ? 'pack' : PERIOD_SHORT[p.periodicity].slice(1), unitPrice: p.totalPrice, vatRate: vat })])} />)}
              </Section>
              <Section title="Options">
                {trade.options.map(o => <Item key={o.id} title={o.name} sub={`par ${o.unit}`} price={money(o.price, s)} onClick={() => add([newLine({ description: o.name, qty: 1, unit: o.unit, unitPrice: o.price, vatRate: vat })])} />)}
              </Section>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
const Section = ({ title, children }: { title: string; children: React.ReactNode }) => {
  const arr = React.Children.toArray(children);
  return <div><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-faint">{title}</p>{arr.length ? <div className="grid gap-2 sm:grid-cols-2">{arr}</div> : <p className="text-sm text-muted">Aucun élément.</p>}</div>;
};
const Item = ({ title, sub, price, onClick }: { title: string; sub: string; price: string; onClick: () => void }) => (
  <button type="button" onClick={onClick} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface-2 p-3 text-left transition hover:border-accent">
    <span className="min-w-0"><b className="block truncate text-sm">{title}</b><span className="block truncate text-xs text-muted">{sub}</span></span>
    <span className="tnum shrink-0 text-sm font-semibold">{price}</span>
  </button>
);
