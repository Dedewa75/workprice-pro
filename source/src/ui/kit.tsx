import React, { useEffect, useRef, useState, createContext, useContext, useCallback } from 'react';
import { LuX, LuCircleCheck, LuCircleAlert, LuInfo } from 'react-icons/lu';
import type { Tone } from './format';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

// ---------- Boutons ----------
type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle';
export function Button({ variant = 'secondary', size = 'md', icon, className, children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md'; icon?: React.ReactNode }) {
  const v: Record<BtnVariant, string> = {
    primary: 'bg-accent text-accent-ink hover:brightness-110 shadow-[0_6px_20px_-8px_var(--wp-accent)]',
    secondary: 'bg-surface-2 text-ink border border-line hover:bg-surface-3',
    ghost: 'text-muted hover:text-ink hover:bg-surface-2',
    subtle: 'bg-accent/12 text-accent hover:bg-accent/20',
    danger: 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20',
  };
  return (
    <button
      type="button"
      {...rest}
      className={cx('inline-flex items-center justify-center gap-2 rounded-xl font-medium transition active:scale-[.98] disabled:opacity-40 disabled:pointer-events-none ring-accent whitespace-nowrap',
        size === 'sm' ? 'h-8 px-3 text-xs' : 'h-10 px-4 text-sm', v[variant], className)}
    >
      {icon}{children}
    </button>
  );
}
export function IconButton({ label, className, children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button type="button" aria-label={label} title={label} {...rest}
      className={cx('inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted transition hover:bg-surface-3 hover:text-ink ring-accent disabled:opacity-40', className)}>
      {children}
    </button>
  );
}

// ---------- Cartes ----------
export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...rest} className={cx('rounded-2xl border border-line bg-surface', className)}>{children}</div>;
}
export function CardHeader({ title, subtitle, action, icon }: { title: React.ReactNode; subtitle?: React.ReactNode; action?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
      <div className="flex items-start gap-3 min-w-0">
        {icon && <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/12 text-accent">{icon}</div>}
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

// ---------- Champs ----------
export function Field({ label, hint, children, className }: { label?: React.ReactNode; hint?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      {label && <span className="mb-1.5 block text-xs font-medium text-muted">{label}</span>}
      {children}
      {hint && <span className="mt-1 block text-[11px] text-faint">{hint}</span>}
    </label>
  );
}
const inputCls = 'w-full h-10 rounded-xl border border-line bg-surface-2 px-3 text-sm text-ink placeholder:text-faint outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25';

export function TextInput({ value, onChange, className, ...rest }: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & { value: string; onChange: (v: string) => void }) {
  return <input {...rest} value={value ?? ''} onChange={e => onChange(e.target.value)} className={cx(inputCls, className)} />;
}

/** Champ numérique tolérant : accepte la virgule, garde la saisie en cours. */
export function NumberInput({ value, onChange, suffix, min, max, step, className, ...rest }: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'min' | 'max'> & { value: number; onChange: (v: number) => void; suffix?: string; min?: number; max?: number }) {
  const [text, setText] = useState(fmtIn(value));
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setText(fmtIn(value)); }, [value]);
  return (
    <div className={cx('relative', className)}>
      <input
        {...rest}
        inputMode="decimal"
        value={text}
        onFocus={e => { focused.current = true; e.target.select(); }}
        onBlur={() => { focused.current = false; setText(fmtIn(value)); }}
        onChange={e => {
          const t = e.target.value.replace(/[^\d.,\-]/g, '');
          setText(t);
          let n = parseFloat(t.replace(',', '.'));
          if (!isFinite(n)) n = 0;
          if (min !== undefined) n = Math.max(min, n);
          if (max !== undefined) n = Math.min(max, n);
          onChange(n);
        }}
        className={cx(inputCls, 'tnum', suffix && 'pr-12')}
      />
      {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-faint">{suffix}</span>}
    </div>
  );
}
const fmtIn = (n: number) => (isFinite(n) ? String(Math.round(n * 10000) / 10000).replace('.', ',') : '0');

export function Select<T extends string>({ value, onChange, options, className, ...rest }: Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'value'> & { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <select {...rest} value={value} onChange={e => onChange(e.target.value as T)} className={cx(inputCls, 'appearance-none pr-8 bg-[length:12px] bg-no-repeat bg-[right_12px_center]', className)}
      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%239aa3b2' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")` }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export function TextArea({ value, onChange, className, ...rest }: Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value'> & { value: string; onChange: (v: string) => void }) {
  return <textarea {...rest} value={value ?? ''} onChange={e => onChange(e.target.value)} className={cx(inputCls, 'h-auto min-h-[84px] py-2.5 leading-relaxed', className)} />;
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex w-full items-start gap-3 text-left ring-accent rounded-lg">
      <span className={cx('mt-0.5 relative h-5 w-9 shrink-0 rounded-full transition', checked ? 'bg-accent' : 'bg-surface-3 border border-line')}>
        <span className={cx('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all', checked ? 'left-[18px]' : 'left-0.5')} />
      </span>
      <span>
        <span className="block text-sm text-ink">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
    </button>
  );
}

export function Segmented<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: React.ReactNode }[]; className?: string }) {
  return (
    <div className={cx('inline-flex flex-wrap gap-1 rounded-xl border border-line bg-surface-2 p-1', className)}>
      {options.map(o => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)}
          className={cx('rounded-lg px-3 py-1.5 text-xs font-medium transition ring-accent', value === o.value ? 'bg-accent text-accent-ink shadow' : 'text-muted hover:text-ink')}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---------- Badges ----------
const TONES: Record<Tone, string> = {
  slate: 'bg-slate-500/15 text-slate-400',
  blue: 'bg-sky-500/15 text-sky-400',
  green: 'bg-emerald-500/15 text-emerald-400',
  red: 'bg-rose-500/15 text-rose-400',
  violet: 'bg-violet-500/15 text-violet-400',
  amber: 'bg-amber-500/15 text-amber-400',
};
export function Badge({ tone = 'slate', children }: { tone?: Tone; children: React.ReactNode }) {
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap', TONES[tone])}>{children}</span>;
}

export function Empty({ icon, title, text, action }: { icon: React.ReactNode; title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/12 text-2xl text-accent">{icon}</div>
      <p className="font-medium text-ink">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-muted">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// ---------- Modale ----------
export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div className="anim-fade absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div role="dialog" aria-modal="true" className={cx('anim-pop relative flex max-h-[92vh] w-full flex-col rounded-t-2xl border border-line bg-surface shadow-2xl sm:rounded-2xl', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}>
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 className="font-semibold text-ink">{title}</h2>
          <IconButton label="Fermer" onClick={onClose}><LuX /></IconButton>
        </div>
        <div className="scroll-thin overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

// ---------- Toasts + confirmation ----------
interface ToastItem { id: number; text: string; tone: 'ok' | 'err' | 'info' }
interface ConfirmReq { title: string; text: string; confirm: string; danger?: boolean; resolve: (b: boolean) => void }
const UICtx = createContext<{ toast: (t: string, tone?: ToastItem['tone']) => void; confirm: (o: Omit<ConfirmReq, 'resolve'>) => Promise<boolean> }>({ toast: () => {}, confirm: async () => false });
export const useUI = () => useContext(UICtx);

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [req, setReq] = useState<ConfirmReq | null>(null);
  const toast = useCallback((text: string, tone: ToastItem['tone'] = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, text, tone }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200);
  }, []);
  const confirm = useCallback((o: Omit<ConfirmReq, 'resolve'>) => new Promise<boolean>(resolve => setReq({ ...o, resolve })), []);
  const close = (b: boolean) => { req?.resolve(b); setReq(null); };
  return (
    <UICtx.Provider value={{ toast, confirm }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:items-end lg:pr-6" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className="anim-pop pointer-events-auto flex items-center gap-2 rounded-xl border border-line bg-surface-3 px-4 py-2.5 text-sm text-ink shadow-xl">
            {t.tone === 'ok' ? <LuCircleCheck className="text-emerald-400" /> : t.tone === 'err' ? <LuCircleAlert className="text-rose-400" /> : <LuInfo className="text-sky-400" />}
            {t.text}
          </div>
        ))}
      </div>
      <Modal open={!!req} onClose={() => close(false)} title={req?.title}
        footer={<><Button variant="ghost" onClick={() => close(false)}>Annuler</Button><Button variant={req?.danger ? 'danger' : 'primary'} onClick={() => close(true)}>{req?.confirm}</Button></>}>
        <p className="text-sm text-muted whitespace-pre-line">{req?.text}</p>
      </Modal>
    </UICtx.Provider>
  );
}

export function Stat({ label, value, sub, icon, tone }: { label: string; value: React.ReactNode; sub?: React.ReactNode; icon: React.ReactNode; tone?: string }) {
  return (
    <Card className="anim-in relative overflow-hidden p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted">{label}</p>
        <span className={cx('flex h-8 w-8 items-center justify-center rounded-lg', tone || 'bg-accent/12 text-accent')}>{icon}</span>
      </div>
      <p className="tnum mt-2 text-xl font-semibold tracking-tight text-ink sm:text-2xl">{value}</p>
      {sub && <p className="mt-1 text-xs text-faint">{sub}</p>}
    </Card>
  );
}
