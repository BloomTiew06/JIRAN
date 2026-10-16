import type {
  Activity, BuddyLink, Connection, Contact, Dismissal, FloodAlert, FloodCheckin, Giveaway, Group, GroupPost,
  HelpOffer, HelpRequest, Item, LedgerEntry, Loan, Message, Notice, Notification, Precinct, Resident, Skill,
  SkillRequest, SosAlert, Unit, WatchRequest,
} from './types.ts';

/** A typed table. Implementations: MemoryCollection (tests, offline demo) and the server's SQLite table. */
export interface Collection<T extends { id: string }> {
  all(): T[];
  get(id: string): T | undefined;
  insert(row: T): T;
  update(id: string, patch: Partial<T>): T;
  remove(id: string): void;
}

export interface Store {
  precincts: Collection<Precinct>;
  units: Collection<Unit>;
  residents: Collection<Resident>;
  connections: Collection<Connection>;
  messages: Collection<Message>;
  dismissals: Collection<Dismissal>;
  groups: Collection<Group>;
  groupPosts: Collection<GroupPost>;
  activities: Collection<Activity>;
  items: Collection<Item>;
  loans: Collection<Loan>;
  giveaways: Collection<Giveaway>;
  skills: Collection<Skill>;
  skillRequests: Collection<SkillRequest>;
  help: Collection<HelpRequest>;
  helpOffers: Collection<HelpOffer>;
  contacts: Collection<Contact>;
  watches: Collection<WatchRequest>;
  floodAlerts: Collection<FloodAlert>;
  floodCheckins: Collection<FloodCheckin>;
  sos: Collection<SosAlert>;
  notices: Collection<Notice>;
  buddies: Collection<BuddyLink>;
  notifications: Collection<Notification>;
  ledger: Collection<LedgerEntry>;
}

export const TABLES = [
  'precincts', 'units', 'residents', 'connections', 'messages', 'dismissals', 'groups', 'groupPosts',
  'activities', 'items', 'loans', 'giveaways', 'skills', 'skillRequests', 'help', 'helpOffers', 'contacts',
  'watches', 'floodAlerts', 'floodCheckins', 'sos', 'notices', 'buddies', 'notifications', 'ledger',
] as const satisfies readonly (keyof Store)[];

export type TableName = (typeof TABLES)[number];
export type SeedData = Partial<{ [K in TableName]: Store[K] extends Collection<infer R> ? R[] : never }>;

export class MemoryCollection<T extends { id: string }> implements Collection<T> {
  protected rows = new Map<string, T>();
  constructor(initial: T[] = []) {
    for (const r of initial) this.rows.set(r.id, structuredClone(r));
  }
  all(): T[] { return [...this.rows.values()]; }
  get(id: string): T | undefined { return this.rows.get(id); }
  insert(row: T): T {
    if (this.rows.has(row.id)) throw new Error(`duplicate id ${row.id}`);
    this.rows.set(row.id, row);
    return row;
  }
  update(id: string, patch: Partial<T>): T {
    const cur = this.rows.get(id);
    if (!cur) throw new Error(`missing id ${id}`);
    const next = { ...cur, ...patch, id };
    this.rows.set(id, next);
    return next;
  }
  remove(id: string): void { this.rows.delete(id); }
}

export function memoryStore(seed?: SeedData): Store {
  const s = {} as Record<TableName, MemoryCollection<{ id: string }>>;
  for (const t of TABLES) s[t] = new MemoryCollection((seed?.[t] as { id: string }[] | undefined) ?? []);
  return s as unknown as Store;
}
