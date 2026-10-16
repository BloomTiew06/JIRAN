import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { ApiError, type Api, type Me, type Options } from './api.ts';
import { Icon, type IconName } from './icons.tsx';

export type Tab = 'map' | 'neighbours' | 'share' | 'activities' | 'help' | 'me';
export type Overlay = { kind: 'neighbour' | 'chat' | 'group' | 'activity' | 'guide' | 'notifications' | 'flood' | 'item' | 'intro'; id?: string };

export interface AppCtx {
  api: Api;
  me: Me;
  options: Options;
  bump: number;
  refresh: () => void;
  toast: (msg: string, tone?: 'ok' | 'warn' | 'points') => void;
  /** Follow a link such as "neighbours:connections", "chat:<id>" or "activity:<id>" */
  go: (link: string) => void;
  tab: Tab;
  section: string | null;
  focus: string | null;
  open: (o: Overlay) => void;
  close: () => void;
  signOut: () => void;
  switchTo: (code: string) => void;
  t: (key: string) => string;
}

export const Ctx = createContext<AppCtx | null>(null);
export const useApp = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('no app context');
  return c;
};

/** Fetch a path and refetch when live events arrive. */
export function useData<T>(path: string | null) {
  const { api, bump } = useApp();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!path) return;
    let live = true;
    api.get<T>(path).then((d) => { if (live) { setData(d); setError(null); } })
      .catch((e: Error) => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [api, path, bump, n]);
  return { data, error, reload: useCallback(() => setN((x) => x + 1), []) };
}

/** Run an API action with toasts for success and errors. */
export function useAction() {
  const { api, toast, refresh } = useApp();
  const [busy, setBusy] = useState(false);
  const run = useCallback(async <T,>(method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, body?: unknown, ok?: string | ((r: T) => string | null)) => {
    setBusy(true);
    try {
      const r = await api.send<T>(method, path, body);
      const msg = typeof ok === 'function' ? ok(r) : ok;
      if (msg) toast(msg, msg.startsWith('+') ? 'points' : 'ok');
      refresh();
      return r;
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Something went wrong', 'warn');
      return null;
    } finally {
      setBusy(false);
    }
  }, [api, toast, refresh]);
  return { run, busy };
}

export function Avatar({ name, color, photo, size = 44 }: { name: string; color: string; photo?: string | null; size?: number }) {
  if (photo) return <img className="avatar" src={photo} alt="" width={size} height={size} style={{ width: size, height: size }} />;
  return (
    <span className="avatar" style={{ width: size, height: size, background: color, fontSize: size * 0.42 }} aria-hidden="true">
      {name.charAt(0)}
    </span>
  );
}

export function Header({ title, kicker, back, right }: { title: string; kicker?: string; back?: () => void; right?: ReactNode }) {
  return (
    <header className="screen-head">
      {back && <button className="round-btn" onClick={back} aria-label="Back"><Icon name="back" /></button>}
      <div className="grow">
        {kicker && <div className="kicker">{kicker}</div>}
        <h1>{title}</h1>
      </div>
      {right}
    </header>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T; options: { id: T; label: string; count?: number }[]; onChange: (v: T) => void; label: string;
}) {
  return (
    <div className="segmented" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} role="tab" aria-selected={value === o.id} className={value === o.id ? 'on' : ''} onClick={() => onChange(o.id)}>
          {o.label}{o.count ? <span className="count">{o.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function Chips<T extends string>({ value, options, onChange, label, multi = false, wrap = false }: {
  value: T | T[]; options: { id: T; label: string }[]; onChange: (v: T) => void; label: string; multi?: boolean; wrap?: boolean;
}) {
  const on = (id: T) => (Array.isArray(value) ? value.includes(id) : value === id);
  return (
    <div className={`chips${wrap ? ' wrap' : ''}`} role={multi ? 'group' : 'radiogroup'} aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" role={multi ? undefined : 'radio'} aria-checked={multi ? undefined : on(o.id)} aria-pressed={multi ? on(o.id) : undefined}
          className={on(o.id) ? 'chip on' : 'chip'} onClick={() => onChange(o.id)}>{o.label}</button>
      ))}
    </div>
  );
}

export const toggleIn = <T,>(list: T[], x: T) => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x]);

export function Empty({ icon, title, text, action }: { icon: IconName; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <Icon name={icon} size={32} />
      <strong>{title}</strong>
      <span>{text}</span>
      {action}
    </div>
  );
}

export function Sheet({ children, onClose, label }: { children: ReactNode; onClose: () => void; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <div className="sheet-wrap" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label={label} tabIndex={-1} ref={ref} onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}>
        <button className="round-btn sheet-close" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
        {children}
      </div>
    </div>
  );
}

/** A full-screen page on top of the tabs (chat, group, activity, guide). */
export function Page({ title, kicker, children, right }: { title: string; kicker?: string; children: ReactNode; right?: ReactNode }) {
  const { close } = useApp();
  return (
    <div className="page" role="dialog" aria-label={title}>
      <Header title={title} kicker={kicker} back={close} right={right} />
      <div className="screen-body">{children}</div>
    </div>
  );
}

export function Coin({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true">
      <circle cx="14" cy="14" r="11.5" fill="#FFC94A" stroke="#2B2340" strokeWidth="2" />
      <circle cx="14" cy="14" r="7" fill="none" stroke="#E8A21C" strokeWidth="2" />
      <path d="M11 14l2 2 4-4" fill="none" stroke="#2B2340" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Stars({ value, onPick, size = 30, disabled }: { value: number; onPick?: (n: number) => void; size?: number; disabled?: boolean }) {
  return (
    <div className="stars" role={onPick ? 'radiogroup' : 'img'} aria-label={onPick ? 'Rating' : `${value} of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => onPick ? (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} disabled={disabled} onClick={() => onPick(n)}>
          <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" fill={n <= value ? '#FFC94A' : '#fff'} stroke="#2B2340" strokeWidth="1.6" strokeLinejoin="round" /></svg>
        </button>
      ) : (
        <svg key={n} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" fill={n <= value ? '#FFC94A' : '#fff'} stroke="#2B2340" strokeWidth="1.6" strokeLinejoin="round" /></svg>
      ))}
    </div>
  );
}

export function Toggle({ id, label, hint, checked, onChange, disabled }: { id: string; label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className="toggle" htmlFor={id}>
      <span className="grow"><strong>{label}</strong>{hint && <span className="muted small block">{hint}</span>}</span>
      <input id={id} type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="switch" aria-hidden="true" />
    </label>
  );
}

const TZ = 'Asia/Kuala_Lumpur';
const WHEN = new Intl.DateTimeFormat('en-MY', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: TZ });
const DAY = new Intl.DateTimeFormat('en-MY', { weekday: 'short', day: 'numeric', month: 'short', timeZone: TZ });
const TIME = new Intl.DateTimeFormat('en-MY', { hour: 'numeric', minute: '2-digit', timeZone: TZ });
export const fmtWhen = (iso: string) => WHEN.format(new Date(iso));
export const fmtDay = (iso: string) => DAY.format(new Date(iso.length === 10 ? `${iso}T04:00:00Z` : iso));
export const fmtTime = (iso: string) => TIME.format(new Date(iso));
export const monthName = (ym: string) => new Date(`${ym}-01T00:00:00Z`).toLocaleString('en-MY', { month: 'long', timeZone: 'UTC' });
export const ago = (iso: string, now = Date.now()) => {
  const m = Math.round((now - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return fmtDay(iso);
};

/** Today in Malaysia, plus n days, as YYYY-MM-DD. The demo clock is passed in from the API mode. */
export function dayPlus(n: number, base = Date.now()) {
  return new Date(base + 8 * 3600000 + n * 86400000).toISOString().slice(0, 10);
}
