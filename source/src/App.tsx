import React, { useEffect, useState } from 'react';
import { LuLayoutDashboard, LuCalculator, LuBriefcase, LuUsers, LuFileText, LuReceipt, LuSettings, LuMenu, LuX, LuTriangleAlert, LuEllipsisVertical } from 'react-icons/lu';
import { useData, store } from './core/store';
import { useRoute, go } from './ui/router';
import { cx, UIProvider } from './ui/kit';
import Dashboard from './pages/Dashboard';
import Calculator from './pages/Calculator';
import Trades from './pages/Trades';
import Clients from './pages/Clients';
import { QuotesList, InvoicesList } from './pages/DocsList';
import DocEditor from './pages/DocEditor';
import SettingsPage from './pages/Settings';
import Onboarding from './pages/Onboarding';

const NAV = [
  { key: 'dashboard', label: 'Tableau de bord', icon: <LuLayoutDashboard /> },
  { key: 'calculator', label: 'Calculateur', icon: <LuCalculator /> },
  { key: 'trades', label: 'Métiers & packs', icon: <LuBriefcase /> },
  { key: 'clients', label: 'Clients', icon: <LuUsers /> },
  { key: 'quotes', label: 'Devis', icon: <LuFileText /> },
  { key: 'invoices', label: 'Factures', icon: <LuReceipt /> },
  { key: 'settings', label: 'Paramètres', icon: <LuSettings /> },
];
const MOBILE = ['dashboard', 'calculator', 'quotes', 'invoices'];

export default function App() {
  const data = useData();
  const route = useRoute();
  const [menu, setMenu] = useState(false);
  const s = data.settings;

  useEffect(() => {
    document.documentElement.dataset.theme = s.theme;
    document.documentElement.style.setProperty('--wp-accent', s.accentColor || '#7c5cff');
  }, [s.theme, s.accentColor]);
  useEffect(() => { setMenu(false); }, [route.join('/')]);

  const page = route[0];
  let content: React.ReactNode;
  switch (page) {
    case 'calculator': content = <Calculator key={route.join('/')} route={route} />; break;
    case 'trades': content = <Trades route={route} />; break;
    case 'clients': content = <Clients route={route} />; break;
    case 'quotes': content = route[1] ? <DocEditor key={route[1]} kind="quote" id={route[1]} /> : <QuotesList />; break;
    case 'invoices': content = route[1] ? <DocEditor key={route[1]} kind="invoice" id={route[1]} /> : <InvoicesList />; break;
    case 'settings': content = <SettingsPage />; break;
    default: content = <Dashboard />;
  }
  const err = store.saveError();

  return (
    <UIProvider>
      <div className="min-h-screen bg-bg text-ink">
        {/* Barre latérale */}
        <aside className={cx('fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-line bg-surface transition-transform lg:translate-x-0', menu ? 'translate-x-0 shadow-2xl' : '-translate-x-full')}>
          <div className="glow-accent flex items-center gap-3 px-5 pb-5 pt-6">
            <Logo />
            <div>
              <p className="text-[15px] font-bold tracking-tight">WORKPRICE <span className="text-accent">PRO</span></p>
              <p className="text-[11px] text-faint">Tarifs · Devis · Factures</p>
            </div>
            <button className="ml-auto text-muted lg:hidden" aria-label="Fermer le menu" onClick={() => setMenu(false)}><LuX /></button>
          </div>
          <nav className="flex-1 space-y-0.5 px-3">
            {NAV.map(n => (
              <a key={n.key} href={`#/${n.key}`}
                className={cx('group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                  page === n.key || (!page && n.key === 'dashboard') ? 'bg-accent/12 text-ink' : 'text-muted hover:bg-surface-2 hover:text-ink')}>
                <span className={cx('text-[17px] transition', page === n.key ? 'text-accent' : 'text-faint group-hover:text-muted')}>{n.icon}</span>
                {n.label}
              </a>
            ))}
          </nav>
          <div className="m-3 rounded-xl border border-line bg-surface-2 p-3">
            <p className="truncate text-sm font-medium">{s.company.name || 'Mon entreprise'}</p>
            <p className="truncate text-xs text-faint">{data.clients.length} clients · {data.trades.length} métiers</p>
            <p className="mt-2 text-[11px] text-faint">Données enregistrées sur cet appareil. Pense à exporter une sauvegarde.</p>
          </div>
        </aside>
        {menu && <div className="anim-fade fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setMenu(false)} />}

        {/* Barre du haut mobile */}
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-bg/85 px-4 py-3 backdrop-blur lg:hidden">
          <button aria-label="Ouvrir le menu" onClick={() => setMenu(true)} className="text-xl text-muted"><LuMenu /></button>
          <Logo small />
          <p className="font-bold tracking-tight">WORKPRICE <span className="text-accent">PRO</span></p>
        </header>

        <main className="pb-24 lg:pb-10 lg:pl-64">
          {err && (
            <div className="mx-4 mt-4 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300 lg:mx-8">
              <LuTriangleAlert /> {err}
            </div>
          )}
          <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{content}</div>
        </main>

        {/* Navigation basse mobile */}
        <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
          {NAV.filter(n => MOBILE.includes(n.key)).map(n => (
            <a key={n.key} href={`#/${n.key}`} className={cx('flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium', page === n.key || (!page && n.key === 'dashboard') ? 'text-accent' : 'text-faint')}>
              <span className="text-lg">{n.icon}</span>{n.label.split(' ')[0]}
            </a>
          ))}
          <button onClick={() => setMenu(true)} className="flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium text-faint">
            <span className="text-lg"><LuEllipsisVertical /></span>Plus
          </button>
        </nav>
        {!s.onboarded && <Onboarding />}
      </div>
    </UIProvider>
  );
}

function Logo({ small }: { small?: boolean }) {
  return (
    <div className={cx('flex items-center justify-center rounded-xl bg-accent text-accent-ink shadow-[0_8px_24px_-8px_var(--wp-accent)]', small ? 'h-7 w-7' : 'h-10 w-10')}>
      <svg viewBox="0 0 24 24" className={small ? 'h-4 w-4' : 'h-5 w-5'} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 6l4 12 5-9 5 9 4-12" />
      </svg>
    </div>
  );
}

export { go };
