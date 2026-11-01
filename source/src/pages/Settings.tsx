import React, { useRef, useState } from 'react';
import { LuBuilding2, LuGlobe, LuPercent, LuHash, LuFileText, LuPalette, LuDatabase, LuUpload, LuDownload, LuTrash2, LuPlus, LuX, LuSparkles, LuInfo, LuImage, LuRotateCcw } from 'react-icons/lu';
import { useData, store } from '../core/store';
import { updateSettings } from '../core/actions';
import { formatNumber } from '../core/docs';
import { emptyData, isValidBackup, migrate } from '../core/defaults';
import { withDemoData, isDemoClient } from '../core/demo';
import type { Settings, PdfTemplate } from '../core/types';
import { Button, Card, CardHeader, Field, NumberInput, PageHeader, Segmented, Select, TextArea, TextInput, Toggle, useUI, cx } from '../ui/kit';
import { numFmt } from '../ui/format';

export const COUNTRIES = [
  { value: 'Belgique', locale: 'fr-BE', currency: 'EUR' },
  { value: 'France', locale: 'fr-FR', currency: 'EUR' },
  { value: 'Luxembourg', locale: 'fr-LU', currency: 'EUR' },
  { value: 'Suisse', locale: 'fr-CH', currency: 'CHF' },
  { value: 'Canada', locale: 'fr-CA', currency: 'CAD' },
  { value: 'Maroc', locale: 'fr-MA', currency: 'MAD' },
  { value: 'Autre', locale: 'fr-BE', currency: 'EUR' },
];
const CURRENCIES = ['EUR', 'CHF', 'CAD', 'USD', 'GBP', 'MAD', 'XOF', 'TND', 'DZD'];
const ACCENTS = ['#7c5cff', '#2563eb', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#111827'];

export async function fileToLogo(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const max = 400;
    const sc = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.width * sc)); c.height = Math.max(1, Math.round(img.height * sc));
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/png');
  } finally { URL.revokeObjectURL(url); }
}

export function downloadBackup() {
  const d = store.get();
  const blob = new Blob([JSON.stringify({ app: 'WORKPRICE PRO', exportedAt: new Date().toISOString(), ...d }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `workprice-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
}

export default function SettingsPage() {
  const data = useData();
  const s = data.settings;
  const ui = useUI();
  const set = (fn: (x: Settings) => Settings) => updateSettings(fn);
  const co = (p: Partial<Settings['company']>) => set(x => ({ ...x, company: { ...x.company, ...p } }));
  const num = (p: Partial<Settings['numbering']>) => set(x => ({ ...x, numbering: { ...x.numbering, ...p } }));
  const vat = (p: Partial<Settings['vat']>) => set(x => ({ ...x, vat: { ...x.vat, ...p } }));
  const [newRate, setNewRate] = useState(0);
  const importRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const year = new Date().getFullYear();
  const size = new Blob([JSON.stringify(data)]).size;

  return (
    <div>
      <PageHeader title="Paramètres" subtitle="Les modifications sont enregistrées automatiquement." />
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Entreprise" subtitle="Apparaît sur tes devis et factures" icon={<LuBuilding2 />} />
          <div className="grid gap-3 px-5 pb-5 sm:grid-cols-2">
            <div className="flex items-center gap-4 sm:col-span-2">
              <div className="flex h-16 w-28 items-center justify-center overflow-hidden rounded-xl border border-dashed border-line bg-white/95">
                {s.company.logo ? <img src={s.company.logo} alt="Logo" className="max-h-full max-w-full object-contain" /> : <LuImage className="text-2xl text-slate-400" />}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" icon={<LuUpload />} onClick={() => logoRef.current?.click()}>{s.company.logo ? 'Changer le logo' : 'Ajouter un logo'}</Button>
                {s.company.logo && <Button size="sm" variant="ghost" onClick={() => co({ logo: '' })}>Retirer</Button>}
                <input ref={logoRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={async e => {
                  const f = e.target.files?.[0]; e.target.value = '';
                  if (!f) return;
                  try { co({ logo: await fileToLogo(f) }); ui.toast('Logo enregistré'); } catch { ui.toast('Image illisible', 'err'); }
                }} />
              </div>
            </div>
            <Field label="Nom de l'entreprise"><TextInput value={s.company.name} onChange={v => co({ name: v })} /></Field>
            <Field label="Ton nom"><TextInput value={s.company.owner} onChange={v => co({ owner: v })} /></Field>
            <Field label="Forme / statut" hint="Ex. Indépendant, SRL, auto-entrepreneur…"><TextInput value={s.company.legalForm} onChange={v => co({ legalForm: v })} /></Field>
            <Field label="N° d'entreprise"><TextInput value={s.company.companyNumber} onChange={v => co({ companyNumber: v })} /></Field>
            <Field label="Adresse" className="sm:col-span-2"><TextInput value={s.company.address} onChange={v => co({ address: v })} /></Field>
            <Field label="Code postal"><TextInput value={s.company.zip} onChange={v => co({ zip: v })} /></Field>
            <Field label="Ville"><TextInput value={s.company.city} onChange={v => co({ city: v })} /></Field>
            <Field label="Téléphone"><TextInput value={s.company.phone} onChange={v => co({ phone: v })} /></Field>
            <Field label="E-mail"><TextInput value={s.company.email} onChange={v => co({ email: v })} /></Field>
            <Field label="Site web"><TextInput value={s.company.website} onChange={v => co({ website: v })} /></Field>
            <Field label="N° de TVA"><TextInput value={s.company.vatNumber} onChange={v => co({ vatNumber: v })} /></Field>
            <Field label="IBAN"><TextInput value={s.company.iban} onChange={v => co({ iban: v })} /></Field>
            <Field label="BIC"><TextInput value={s.company.bic} onChange={v => co({ bic: v })} /></Field>
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Pays & devise" icon={<LuGlobe />} />
            <div className="grid gap-3 px-5 pb-5 sm:grid-cols-3">
              <Field label="Pays"><Select value={COUNTRIES.some(c => c.value === s.country) ? s.country : 'Autre'} onChange={v => { const c = COUNTRIES.find(x => x.value === v)!; set(x => ({ ...x, country: v, locale: c.locale, currency: c.currency, company: { ...x.company, country: v === 'Autre' ? x.company.country : v } })); }} options={COUNTRIES.map(c => ({ value: c.value, label: c.value }))} /></Field>
              <Field label="Devise"><Select value={s.currency} onChange={v => set(x => ({ ...x, currency: v }))} options={[...new Set([...CURRENCIES, s.currency])].map(c => ({ value: c, label: c }))} /></Field>
              <Field label="Format des nombres"><Select value={s.locale} onChange={v => set(x => ({ ...x, locale: v }))} options={['fr-BE', 'fr-FR', 'fr-CH', 'fr-CA', 'fr-LU', 'fr-MA', 'en-US', 'en-GB', 'nl-BE', 'de-DE'].map(l => ({ value: l, label: l }))} /></Field>
            </div>
          </Card>

          <Card>
            <CardHeader title="TVA" subtitle="Aucun taux n'est appliqué automatiquement : saisis ceux de ton pays et de ton régime." icon={<LuPercent />} />
            <div className="space-y-4 px-5 pb-5">
              <Toggle checked={s.vat.enabled} onChange={v => vat({ enabled: v })} label="Je facture la TVA (assujetti)" hint="Désactivé : les documents affichent un total sans TVA et ta mention d'exonération." />
              {s.vat.enabled ? (
                <>
                  <div>
                    <p className="mb-2 text-xs font-medium text-muted">Mes taux de TVA</p>
                    <div className="flex flex-wrap items-center gap-2">
                      {s.vat.rates.map(r => (
                        <span key={r} className={cx('inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm', s.vat.defaultRate === r ? 'border-accent bg-accent/12' : 'border-line')}>
                          <button onClick={() => vat({ defaultRate: r })} title="Définir par défaut">{numFmt(r)} %{s.vat.defaultRate === r && <span className="ml-1 text-[10px] text-accent">par défaut</span>}</button>
                          <button aria-label={`Supprimer ${r} %`} onClick={() => vat({ rates: s.vat.rates.filter(x => x !== r), defaultRate: s.vat.defaultRate === r ? null : s.vat.defaultRate })} className="text-faint hover:text-rose-400"><LuX /></button>
                        </span>
                      ))}
                      <div className="flex items-center gap-1.5">
                        <NumberInput className="w-24" value={newRate} onChange={setNewRate} suffix="%" min={0} max={100} aria-label="Nouveau taux" />
                        <Button size="sm" icon={<LuPlus />} onClick={() => { if (!s.vat.rates.includes(newRate)) vat({ rates: [...s.vat.rates, newRate].sort((a, b) => a - b), defaultRate: s.vat.defaultRate ?? newRate }); }}>Ajouter</Button>
                      </div>
                    </div>
                  </div>
                  {s.vat.rates.length === 0 && <p className="text-xs text-amber-300">Ajoute au moins un taux pour l'utiliser dans tes devis.</p>}
                </>
              ) : (
                <Field label="Mention affichée sur les documents" hint="Écris la mention exacte exigée par ton régime (à vérifier auprès de ton comptable ou de l'administration fiscale).">
                  <TextArea value={s.vat.exemptionMention} onChange={v => vat({ exemptionMention: v })} placeholder="Mention légale d'exonération de TVA de ton régime" className="min-h-[64px]" />
                </Field>
              )}
              <p className="flex items-start gap-2 rounded-xl bg-surface-2 p-3 text-xs text-muted"><LuInfo className="mt-0.5 shrink-0" />WORKPRICE PRO calcule la TVA avec les taux que tu saisis, mais ne garantit pas la conformité fiscale de tes documents. Vérifie les taux et mentions obligatoires de ton pays.</p>
            </div>
          </Card>
        </div>

        <Card>
          <CardHeader title="Tarifs & marges par défaut" subtitle="Pré-remplis dans chaque nouveau calcul" icon={<LuPercent />} />
          <div className="grid gap-3 px-5 pb-5 sm:grid-cols-2">
            <Field label="Tarif horaire"><NumberInput value={s.defaultHourlyRate} onChange={v => set(x => ({ ...x, defaultHourlyRate: v }))} suffix={`${s.currency}/h`} min={0} /></Field>
            <Field label="Marge habituelle"><NumberInput value={s.defaultMarginPct} onChange={v => set(x => ({ ...x, defaultMarginPct: v }))} suffix="%" min={0} /></Field>
            <Field label="Type de marge"><Segmented value={s.defaultMarginMode} onChange={v => set(x => ({ ...x, defaultMarginMode: v }))} options={[{ value: 'margin', label: 'Sur prix de vente' }, { value: 'markup', label: 'Sur coût' }]} /></Field>
            <Field label="Charges estimées" hint="Cotisations sociales + impôts, en % du revenu. Sert au bénéfice estimé."><NumberInput value={s.chargesPct} onChange={v => set(x => ({ ...x, chargesPct: v }))} suffix="%" min={0} max={100} /></Field>
          </div>
        </Card>

        <Card>
          <CardHeader title="Numérotation des documents" icon={<LuHash />} subtitle={`Prochain devis : ${formatNumber(s.numbering.quotePrefix, year, s.numbering.nextQuote, s.numbering.includeYear, s.numbering.padding)} · prochaine facture : ${formatNumber(s.numbering.invoicePrefix, year, s.numbering.nextInvoice, s.numbering.includeYear, s.numbering.padding)}`} />
          <div className="grid gap-3 px-5 pb-5 sm:grid-cols-2">
            <Field label="Préfixe des devis"><TextInput value={s.numbering.quotePrefix} onChange={v => num({ quotePrefix: v })} /></Field>
            <Field label="Préfixe des factures"><TextInput value={s.numbering.invoicePrefix} onChange={v => num({ invoicePrefix: v })} /></Field>
            <Field label="Prochain n° de devis"><NumberInput value={s.numbering.nextQuote} onChange={v => num({ nextQuote: Math.max(1, Math.round(v)) })} min={1} /></Field>
            <Field label="Prochain n° de facture" hint="Les factures doivent suivre une séquence continue."><NumberInput value={s.numbering.nextInvoice} onChange={v => num({ nextInvoice: Math.max(1, Math.round(v)) })} min={1} /></Field>
            <Field label="Nombre de chiffres"><NumberInput value={s.numbering.padding} onChange={v => num({ padding: Math.min(8, Math.max(1, Math.round(v))) })} min={1} max={8} /></Field>
            <div className="space-y-3 pt-5">
              <Toggle checked={s.numbering.includeYear} onChange={v => num({ includeYear: v })} label="Inclure l'année" />
              <Toggle checked={s.numbering.resetYearly} onChange={v => num({ resetYearly: v })} label="Repartir à 1 chaque année" />
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Devis, factures & PDF" icon={<LuFileText />} />
          <div className="grid gap-3 px-5 pb-5 sm:grid-cols-2">
            <Field label="Validité des devis"><NumberInput value={s.quoteValidityDays} onChange={v => set(x => ({ ...x, quoteValidityDays: Math.max(0, Math.round(v)) }))} suffix="jours" min={0} /></Field>
            <Field label="Délai de paiement"><NumberInput value={s.paymentTermsDays} onChange={v => set(x => ({ ...x, paymentTermsDays: Math.max(0, Math.round(v)) }))} suffix="jours" min={0} /></Field>
            <Field label="Modèle PDF par défaut" className="sm:col-span-2"><Segmented value={s.pdfTemplate} onChange={(v: PdfTemplate) => set(x => ({ ...x, pdfTemplate: v }))} options={[{ value: 'modern', label: 'Moderne' }, { value: 'classic', label: 'Classique' }, { value: 'minimal', label: 'Minimal' }]} /></Field>
            <Field label="Conditions par défaut des devis" className="sm:col-span-2"><TextArea value={s.defaultQuoteConditions} onChange={v => set(x => ({ ...x, defaultQuoteConditions: v }))} /></Field>
            <Field label="Notes par défaut des factures" className="sm:col-span-2"><TextArea value={s.defaultInvoiceNotes} onChange={v => set(x => ({ ...x, defaultInvoiceNotes: v }))} /></Field>
            <Field label="Mentions légales (pied de page)" className="sm:col-span-2" hint="Ex. conditions générales, pénalités de retard, mentions obligatoires de ton pays."><TextArea value={s.legalFooter} onChange={v => set(x => ({ ...x, legalFooter: v }))} className="min-h-[64px]" /></Field>
          </div>
        </Card>

        <Card>
          <CardHeader title="Apparence" icon={<LuPalette />} />
          <div className="space-y-4 px-5 pb-5">
            <Segmented value={s.theme} onChange={v => set(x => ({ ...x, theme: v }))} options={[{ value: 'dark', label: '🌙 Sombre' }, { value: 'light', label: '☀️ Clair' }]} />
            <div>
              <p className="mb-2 text-xs font-medium text-muted">Couleur principale (application et PDF)</p>
              <div className="flex flex-wrap items-center gap-2">
                {ACCENTS.map(c => <button key={c} aria-label={`Couleur ${c}`} onClick={() => set(x => ({ ...x, accentColor: c }))} className={cx('h-8 w-8 rounded-full border-2 transition', s.accentColor === c ? 'scale-110 border-white' : 'border-transparent')} style={{ background: c }} />)}
                <label className="flex items-center gap-2 text-xs text-muted">Perso <input type="color" value={s.accentColor} onChange={e => set(x => ({ ...x, accentColor: e.target.value }))} className="h-8 w-10 cursor-pointer rounded bg-transparent" /></label>
              </div>
            </div>
          </div>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader title="Sauvegarde & données" subtitle={`Données stockées dans ce navigateur (${numFmt(size / 1024, 0)} Ko). Exporte régulièrement une sauvegarde : vider le navigateur efface les données.`} icon={<LuDatabase />} />
          <div className="flex flex-wrap gap-2 px-5 pb-5">
            <Button variant="primary" icon={<LuDownload />} onClick={() => { downloadBackup(); ui.toast('Sauvegarde téléchargée'); }}>Exporter une sauvegarde (.json)</Button>
            <Button icon={<LuUpload />} onClick={() => importRef.current?.click()}>Restaurer une sauvegarde</Button>
            <input ref={importRef} type="file" accept="application/json,.json" hidden onChange={async e => {
              const f = e.target.files?.[0]; e.target.value = '';
              if (!f) return;
              try {
                const raw = JSON.parse(await f.text());
                if (!isValidBackup(raw)) { ui.toast('Ce fichier n\'est pas une sauvegarde WORKPRICE PRO', 'err'); return; }
                const d = migrate(raw);
                if (!(await ui.confirm({ title: 'Restaurer cette sauvegarde ?', text: `${d.clients.length} clients, ${d.quotes.length} devis, ${d.invoices.length} factures, ${d.trades.length} métiers.\nLes données actuelles seront remplacées.`, confirm: 'Restaurer' }))) return;
                store.replace({ ...d, settings: { ...d.settings, onboarded: true } });
                ui.toast('Sauvegarde restaurée');
              } catch { ui.toast('Fichier illisible', 'err'); }
            }} />
            <Button icon={<LuSparkles />} onClick={async () => {
              if (await ui.confirm({ title: 'Ajouter des données de démonstration ?', text: '6 clients fictifs, des devis et factures sur 8 mois, et 2 métiers modèles. Tu pourras les retirer ensuite.', confirm: 'Ajouter' })) { store.set(d => withDemoData(d)); ui.toast('Données de démo ajoutées'); }
            }}>Données de démo</Button>
            {data.clients.some(isDemoClient) && <Button variant="ghost" icon={<LuRotateCcw />} onClick={async () => {
              if (!(await ui.confirm({ title: 'Retirer les données de démo ?', text: 'Les clients de démonstration et tous leurs devis / factures seront supprimés.', confirm: 'Retirer', danger: true }))) return;
              store.set(d => {
                const ids = new Set(d.clients.filter(isDemoClient).map(c => c.id));
                return { ...d, clients: d.clients.filter(c => !ids.has(c.id)), quotes: d.quotes.filter(q => !q.clientId || !ids.has(q.clientId)), invoices: d.invoices.filter(i => !i.clientId || !ids.has(i.clientId)) };
              });
              ui.toast('Données de démo retirées');
            }}>Retirer la démo</Button>}
            <Button variant="danger" icon={<LuTrash2 />} onClick={async () => {
              if (!(await ui.confirm({ title: 'Tout effacer ?', text: 'Clients, devis, factures, métiers, calculs et paramètres seront supprimés de ce navigateur.\nExporte une sauvegarde avant si tu veux les garder.', confirm: 'Tout effacer', danger: true }))) return;
              store.replace(emptyData());
              ui.toast('Données effacées', 'info');
            }}>Tout effacer</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
