import React, { useState } from 'react';
import { LuArrowRight, LuCheck } from 'react-icons/lu';
import { useData, store } from '../core/store';
import { TRADE_TEMPLATES, tradeFromTemplate } from '../core/defaults';
import { withDemoData } from '../core/demo';
import { Button, Field, NumberInput, Select, TextInput, Toggle, cx } from '../ui/kit';
import { COUNTRIES } from './Settings';

export default function Onboarding() {
  const s = useData().settings;
  const [step, setStep] = useState(0);
  const [name, setName] = useState(s.company.name);
  const [owner, setOwner] = useState(s.company.owner);
  const [country, setCountry] = useState(s.country);
  const [rate, setRate] = useState(s.defaultHourlyRate);
  const [margin, setMargin] = useState(s.defaultMarginPct);
  const [vatOn, setVatOn] = useState(false);
  const [vatRate, setVatRate] = useState(0);
  const [picked, setPicked] = useState<string[]>([]);
  const [demo, setDemo] = useState(false);

  const finish = (skip = false) => {
    store.set(d => {
      const c = COUNTRIES.find(x => x.value === country) || COUNTRIES[0];
      let next = skip ? d : {
        ...d,
        settings: {
          ...d.settings,
          company: { ...d.settings.company, name, owner, country: country === 'Autre' ? '' : country },
          country, locale: c.locale, currency: c.currency,
          defaultHourlyRate: rate, defaultMarginPct: margin,
          vat: vatOn && vatRate > 0 ? { ...d.settings.vat, enabled: true, rates: [vatRate], defaultRate: vatRate } : { ...d.settings.vat, enabled: false },
        },
      };
      if (!skip) next = { ...next, trades: [...next.trades, ...picked.map(k => tradeFromTemplate(k, next.settings)!).filter(Boolean)] };
      if (!skip && demo) next = withDemoData(next);
      return { ...next, settings: { ...next.settings, onboarded: true } };
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-6">
      <div className="anim-pop relative max-h-[94vh] w-full overflow-y-auto rounded-t-3xl border border-line bg-surface shadow-2xl sm:max-w-xl sm:rounded-3xl" role="dialog" aria-label="Configuration initiale">
        <div className="glow-accent px-6 pb-4 pt-6">
          <div className="mb-4 flex gap-1.5">{[0, 1, 2].map(i => <span key={i} className={cx('h-1 flex-1 rounded-full transition', i <= step ? 'bg-accent' : 'bg-surface-3')} />)}</div>
          <p className="text-xs font-medium uppercase tracking-wider text-accent">Étape {step + 1} / 3</p>
          <h2 className="mt-1 text-xl font-semibold">{['Bienvenue sur WORKPRICE PRO', 'Tes tarifs et ta TVA', 'Tes métiers'][step]}</h2>
          <p className="mt-1 text-sm text-muted">{['Quelques infos pour personnaliser tes devis. Tout reste modifiable.', 'Valeurs par défaut du calculateur. Aucun taux de TVA n\'est imposé.', 'Choisis des modèles préconfigurés (prix indicatifs à adapter).'][step]}</p>
        </div>
        <div className="space-y-3 px-6 pb-2">
          {step === 0 && <>
            <Field label="Nom de ton entreprise / activité"><TextInput value={name} onChange={setName} placeholder="Ex. Studio Nathan" autoFocus /></Field>
            <Field label="Ton nom"><TextInput value={owner} onChange={setOwner} placeholder="Prénom Nom" /></Field>
            <Field label="Pays" hint="Définit la devise et le format des nombres."><Select value={country} onChange={setCountry} options={COUNTRIES.map(c => ({ value: c.value, label: `${c.value} (${c.currency})` }))} /></Field>
          </>}
          {step === 1 && <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tarif horaire habituel"><NumberInput value={rate} onChange={setRate} suffix="/h" min={0} /></Field>
              <Field label="Marge habituelle"><NumberInput value={margin} onChange={setMargin} suffix="%" min={0} max={95} /></Field>
            </div>
            <div className="rounded-xl border border-line bg-surface-2 p-4">
              <Toggle checked={vatOn} onChange={setVatOn} label="Je facture la TVA" hint="Si tu n'es pas assujetti (ou pas encore de statut), laisse désactivé." />
              {vatOn && <Field label="Ton taux principal (tu pourras en ajouter d'autres)" className="mt-3"><NumberInput value={vatRate} onChange={setVatRate} suffix="%" min={0} max={100} /></Field>}
            </div>
          </>}
          {step === 2 && <>
            <div className="grid gap-2 sm:grid-cols-2">
              {TRADE_TEMPLATES.map(t => {
                const on = picked.includes(t.key);
                return (
                  <button key={t.key} type="button" onClick={() => setPicked(p => on ? p.filter(x => x !== t.key) : [...p, t.key])}
                    className={cx('flex items-center gap-3 rounded-xl border p-3 text-left text-sm transition', on ? 'border-accent bg-accent/10' : 'border-line hover:bg-surface-2')}>
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-white" style={{ background: on ? t.color : 'var(--wp-surface-3)' }}>{on && <LuCheck />}</span>
                    {t.name}
                  </button>
                );
              })}
            </div>
            <div className="rounded-xl border border-line bg-surface-2 p-4"><Toggle checked={demo} onChange={setDemo} label="Ajouter des données de démonstration" hint="Clients et factures fictifs pour découvrir le tableau de bord. Supprimables en un clic." /></div>
          </>}
        </div>
        <div className="flex items-center justify-between gap-2 px-6 py-5">
          <Button variant="ghost" onClick={() => (step === 0 ? finish(true) : setStep(step - 1))}>{step === 0 ? 'Passer' : 'Retour'}</Button>
          {step < 2 ? <Button variant="primary" icon={<LuArrowRight />} onClick={() => setStep(step + 1)}>Continuer</Button>
            : <Button variant="primary" icon={<LuCheck />} onClick={() => finish()}>C'est parti</Button>}
        </div>
      </div>
    </div>
  );
}
