import { fail } from '../rules.ts';
import type { Store } from '../store.ts';
import type { Connection, FloodAlert, Id, JiranEvent, Resident } from '../types.ts';

export interface ServiceOptions {
  now?: () => Date;
  emit?: (e: JiranEvent) => void;
}

export type ConnState = 'none' | 'outgoing' | 'incoming' | 'connected';

let counter = 0;
export function newId(prefix: string): string {
  counter = (counter + 1) % 1e6;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

const DAY_MS = 86400000;

/** Shared helpers: identity, privacy, points, notifications. */
export class Base {
  constructor(protected s: Store, protected opts: ServiceOptions = {}) {}

  protected now(): string { return (this.opts.now?.() ?? new Date()).toISOString(); }
  protected nowMs(): number { return new Date(this.now()).getTime(); }
  /** Today's date in Malaysia (UTC+8), YYYY-MM-DD */
  protected today(): string { return new Date(this.nowMs() + 8 * 3600000).toISOString().slice(0, 10); }

  protected emit(e: Omit<JiranEvent, 'at'>): void {
    this.opts.emit?.({ ...e, at: this.now() });
  }

  /** Store a notification for each resident and push it live. */
  protected notify(to: Id[], text: string, link: string, precinctId: Id | null = null): void {
    const at = this.now();
    for (const id of new Set(to)) {
      this.s.notifications.insert({ id: newId('note'), residentId: id, text, link, at, readAt: null });
    }
    if (to.length) this.emit({ type: 'notify', precinctId, to: [...new Set(to)], message: text });
  }

  protected actor(id: Id): Resident {
    const r = this.s.residents.get(id);
    if (!r) fail('unauthorised', 'Please sign in again');
    return r as Resident;
  }

  /** A signed-in resident who has finished joining (consent given). */
  protected member(id: Id): Resident {
    const r = this.actor(id);
    if (!r.onboarded) fail('forbidden', 'Finish joining JIRAN first');
    return r;
  }

  protected neighbourIn(me: Resident, id: Id): Resident {
    const r = this.s.residents.get(id);
    if (!r || r.isAdmin || !r.onboarded) fail('not_found', 'Neighbour not found');
    if (r!.precinctId !== me.precinctId) fail('forbidden', 'You can only see neighbours in your own precinct');
    return r as Resident;
  }

  protected award(residentId: Id, delta: number, reason: string): number {
    this.s.ledger.insert({ id: newId('pt'), residentId, delta, reason, at: this.now() });
    this.emit({ type: 'points', precinctId: null, to: [residentId], message: `+${delta} points: ${reason}` });
    return delta;
  }

  protected awardOnce(residentId: Id, delta: number, reason: string): number {
    if (this.s.ledger.all().some((l) => l.residentId === residentId && l.reason === reason)) return 0;
    return this.award(residentId, delta, reason);
  }

  pointsOf(residentId: Id): number {
    return this.s.ledger.all().reduce((sum, l) => (l.residentId === residentId ? sum + l.delta : sum), 0);
  }

  protected unitLabel(r: Resident | undefined): string {
    const u = r?.unitId ? this.s.units.get(r.unitId) : undefined;
    return u ? `No. ${u.no}, ${u.street}` : '';
  }

  protected street(r: Resident | undefined): string {
    const u = r?.unitId ? this.s.units.get(r.unitId) : undefined;
    return u?.street ?? '';
  }

  protected nameOf(id: Id | null | undefined): string {
    return (id && this.s.residents.get(id)?.firstName) || '';
  }

  // ------------------------------------------------------------ connections
  protected connectionBetween(a: Id, b: Id): Connection | undefined {
    return this.s.connections.all().find((c) =>
      (c.status === 'pending' || c.status === 'accepted') && ((c.from === a && c.to === b) || (c.from === b && c.to === a)));
  }

  connState(a: Id, b: Id): ConnState {
    const c = this.connectionBetween(a, b);
    if (!c) return 'none';
    if (c.status === 'accepted') return 'connected';
    return c.from === a ? 'outgoing' : 'incoming';
  }

  connectionsOf(id: Id): Id[] {
    return this.s.connections.all().filter((c) => c.status === 'accepted' && (c.from === id || c.to === id))
      .map((c) => (c.from === id ? c.to : c.from));
  }

  protected isNew(r: Resident): boolean {
    return this.nowMs() - new Date(r.joinedAt).getTime() < 30 * DAY_MS;
  }

  /** Why two neighbours might get on: shared interests, activities, languages, Move-in Circle. */
  protected commonGround(a: Resident, b: Resident) {
    const tags = [...new Set([...a.interests, ...a.activities].filter((t) => b.privacy.showInterests && (b.interests.includes(t) || b.activities.includes(t))))];
    const langs = a.languages.filter((l) => b.languages.includes(l) && l !== 'English' && l !== 'Bahasa Malaysia');
    const reasons: string[] = [];
    if (tags.length) reasons.push(`You both like ${tags.slice(0, 3).join(', ')}`);
    if (a.circle === b.circle && a.id !== b.id && a.circle) reasons.push('Same Move-in Circle: keys in the same month');
    if (langs.length) reasons.push(`You both speak ${langs.join(' and ')}`);
    if (this.street(a) && this.street(a) === this.street(b)) reasons.push(`Same street: ${this.street(a)}`);
    const score = tags.length * 3 + (a.circle === b.circle ? 2 : 0) + langs.length + (this.street(a) === this.street(b) ? 1 : 0);
    return { tags, reasons, score };
  }

  protected activeAlertFor(precinctId: Id): FloodAlert | null {
    return this.s.floodAlerts.all().find((a) => !a.endedAt && a.precinctIds.includes(precinctId)) ?? null;
  }

  /** What a neighbour sees of a resident. Private fields never leave this function. */
  protected summary(r: Resident, viewer: Resident) {
    const showTags = r.privacy.showInterests || r.id === viewer.id;
    const cg = this.commonGround(viewer, r);
    return {
      id: r.id,
      firstName: r.firstName,
      avatar: r.avatar,
      photo: r.photo,
      houseColor: r.houseColor,
      unit: this.unitLabel(r),
      street: this.street(r),
      movedIn: r.movedIn,
      isNew: this.isNew(r),
      isYou: r.id === viewer.id,
      openToMeet: r.openToMeet,
      isBuddy: r.isBuddy,
      interests: showTags ? r.interests : [],
      activities: showTags ? r.activities : [],
      skills: r.skills,
      languages: r.languages,
      sharedTags: r.id === viewer.id ? [] : cg.tags,
      reasons: r.id === viewer.id ? [] : cg.reasons,
      connection: r.id === viewer.id ? ('none' as ConnState) : this.connState(viewer.id, r.id),
    };
  }
}
