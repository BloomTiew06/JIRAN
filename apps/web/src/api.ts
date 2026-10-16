import { Jiran, JiranError, matchRoute, memoryStore, seedStore, HTTP_STATUS, TABLES, type JiranEvent, type SeedData, type Store } from '@jiran/core';

declare const __FORCE_DEMO__: boolean;

export type Svc = Jiran;
type R<K extends keyof Jiran> = Jiran[K] extends (...a: never[]) => infer T ? T : never;
export type Me = R<'me'>;
export type Township = R<'township'>;
export type Site = R<'site'>;
export type Person = R<'directory'>[number];
export type NeighbourCard = R<'neighbour'>;
export type Suggestions = R<'suggestions'>;
export type Partners = R<'partners'>;
export type Connections = R<'connections'>;
export type Thread = R<'thread'>;
export type GroupList = R<'groups'>;
export type GroupDetail = R<'group'>;
export type ActivityCard = R<'activities'>[number];
export type ActivityDetail = R<'activity'>;
export type MyActivities = R<'myActivities'>;
export type SuggestedActivities = R<'suggestedActivities'>;
export type ItemView = R<'items'>[number];
export type Loans = R<'loans'>;
export type LoanView = Loans['active'][number];
export type Giveaways = R<'giveaways'>;
export type SkillView = R<'skills'>[number];
export type SkillRequests = R<'skillRequests'>;
export type HelpBoard = R<'helpBoard'>;
export type HelpView = HelpBoard['mine'][number];
export type Safety = R<'safety'>;
export type FloodBoard = R<'floodBoard'>;
export type Guide = R<'guide'>;
export type Newcomers = R<'newcomers'>;
export type Buddies = R<'buddies'>;
export type Recommendations = R<'recommendations'>;
export type Checklist = R<'checklist'>;
export type Notices = R<'notices'>;
export type Notifications = R<'notifications'>;
export type Progress = R<'progress'>;
export type Dashboard = R<'dashboard'>;
export interface Options {
  interests: string[]; activities: string[]; languages: string[];
  timeSlots: { id: string; label: string }[]; appLangs: { id: string; label: string }[];
  avatarColors: string[]; houseColors: string[]; activityCategories: { id: string; label: string }[];
}
export type LiveEvent = JiranEvent & { personal: boolean };

export class ApiError extends Error {
  constructor(public code: string, message: string, public status = 400) {
    super(message);
  }
}

export interface Api {
  mode: 'live' | 'demo';
  token: string | null;
  setToken(t: string | null): void;
  get<T>(path: string): Promise<T>;
  send<T>(method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, body?: unknown): Promise<T>;
  subscribe(fn: (e: LiveEvent) => void): () => void;
  /** Demo only: true when the data was restored from an earlier visit. */
  restored?: boolean;
  /** Demo only: throw away saved changes and start again from the seed data. */
  resetDemo?(): void;
}

/** Talks to the Fastify backend. */
class HttpApi implements Api {
  mode = 'live' as const;
  token: string | null = null;
  constructor(private base: string) {}
  setToken(t: string | null) { this.token = t; }

  private async req<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(this.base + path, {
      method,
      headers: {
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(data.error ?? 'server', data.message ?? 'Something went wrong', res.status);
    return data as T;
  }

  get<T>(path: string) { return this.req<T>('GET', path); }
  send<T>(method: string, path: string, body?: unknown) { return this.req<T>(method, path, body ?? {}); }

  subscribe(fn: (e: LiveEvent) => void) {
    if (!this.token) return () => {};
    const es = new EventSource(`${this.base}/api/events?token=${encodeURIComponent(this.token)}`);
    es.onmessage = (m) => { try { fn(JSON.parse(m.data)); } catch { /* ignore */ } };
    return () => es.close();
  }
}

/**
 * Offline demo: runs the same core service and route table in the browser,
 * on seeded data, with a clock that starts on 16 Oct 2026.
 *
 * Everything you change is saved in this browser (localStorage) and restored
 * on the next visit, including after the app itself is updated. The demo clock
 * pauses while the app is closed, so seeded activities stay upcoming.
 */
const DEMO_KEY = 'jiran-demo-data';
/** Bump only when saved data can no longer be read by the new code. */
const DEMO_SCHEMA = 1;
const DEMO_START = new Date('2026-10-16T02:00:00.000Z').getTime();
interface DemoSnapshot { schema: number; clock: number; savedAt: string; tables: SeedData }

function loadSnapshot(): DemoSnapshot | null {
  try {
    const raw = storage.get(DEMO_KEY);
    if (!raw) return null;
    const snap = JSON.parse(raw) as DemoSnapshot;
    if (snap.schema !== DEMO_SCHEMA || !snap.tables || typeof snap.clock !== 'number') return null;
    return snap;
  } catch {
    return null;
  }
}

/** Saved tables win; any table added in a newer version starts from the seed. */
function restoreStore(snap: DemoSnapshot): Store {
  const seed = seedStore();
  const data: Record<string, unknown[]> = {};
  for (const t of TABLES) data[t] = (snap.tables[t] as unknown[] | undefined) ?? seed[t].all();
  return memoryStore(data as SeedData);
}

class DemoApi implements Api {
  mode = 'demo' as const;
  token: string | null = null;
  restored = false;
  private listeners = new Set<(e: LiveEvent) => void>();
  private svc: Jiran;
  private store: Store;
  private clock: () => number;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private resetting = false;

  constructor() {
    const snap = loadSnapshot();
    let store: Store | null = null;
    if (snap) {
      try { store = restoreStore(snap); this.restored = true; } catch { store = null; }
    }
    this.store = store ?? seedStore();
    const opened = Date.now();
    const base = this.restored && snap ? snap.clock : DEMO_START;
    this.clock = () => base + (Date.now() - opened);
    this.svc = new Jiran(this.store, {
      now: () => new Date(this.clock()),
      emit: (e) => {
        const me = this.token ? this.svc.me(this.token) : null;
        if (!me) return;
        const personal = !!e.to?.includes(me.id);
        const inScope = e.precinctId === null ? !e.to : e.precinctId === me.precinct.id;
        if (personal || inScope) setTimeout(() => this.listeners.forEach((l) => l({ ...e, personal })), 60);
      },
    });
    if (typeof window !== 'undefined') {
      const flush = () => this.save();
      window.addEventListener('pagehide', flush);
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
    }
  }

  private scheduleSave() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.save(), 300);
  }

  private save() {
    if (this.saveTimer) { clearTimeout(this.saveTimer); this.saveTimer = null; }
    if (this.resetting) return;
    try {
      const tables: Record<string, unknown[]> = {};
      for (const t of TABLES) tables[t] = this.store[t].all();
      const snap: DemoSnapshot = { schema: DEMO_SCHEMA, clock: this.clock(), savedAt: new Date().toISOString(), tables: tables as SeedData };
      storage.set(DEMO_KEY, JSON.stringify(snap));
    } catch { /* storage full or blocked: the demo keeps working, it just won't remember */ }
  }

  resetDemo() {
    this.resetting = true;
    storage.set(DEMO_KEY, null);
    storage.set('jiran-token-demo', null);
    storage.set(UI_KEY, null);
  }

  setToken(t: string | null) { this.token = t; }

  private run<T>(method: string, path: string, body?: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        try {
          const m = matchRoute(method, path);
          if (!m) throw new ApiError('not_found', 'No such endpoint', 404);
          const ctx = { svc: this.svc, actorId: this.token ?? '', params: m.params, query: m.query, body: body ?? {} };
          if (m.route.access === 'resident' && !this.token) throw new ApiError('unauthorised', 'Please sign in', 401);
          // Some reads also update state (marking notifications read), so save after every call.
          this.scheduleSave();
          if (m.route.access === 'signin') {
            const r = m.route.run(ctx) as { id: string };
            resolve(structuredClone({ token: r.id, me: this.svc.me(r.id) }) as T);
            return;
          }
          resolve(structuredClone(m.route.run(ctx)) as T);
        } catch (err) {
          if (err instanceof JiranError) reject(new ApiError(err.code, err.message, HTTP_STATUS[err.code] ?? 400));
          else reject(err);
        }
      }, 40);
    });
  }

  get<T>(path: string) { return this.run<T>('GET', path); }
  send<T>(method: string, path: string, body?: unknown) { return this.run<T>(method, path, body); }
  subscribe(fn: (e: LiveEvent) => void) {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }
}

export async function createApi(): Promise<Api> {
  if (__FORCE_DEMO__) return new DemoApi();
  const base = (import.meta.env.VITE_API_URL as string | undefined) ?? '';
  try {
    const res = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(1500) });
    if (res.ok && (await res.json()).ok) return new HttpApi(base);
  } catch { /* fall through to demo */ }
  return new DemoApi();
}

/** Where the app remembers which tab and map level you were on. */
export const UI_KEY = 'jiran-ui';

export const storage = {
  get(key: string): string | null { try { return localStorage.getItem(key); } catch { return null; } },
  set(key: string, value: string | null) {
    try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch { /* private mode */ }
  },
};
