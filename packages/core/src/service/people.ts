import {
  ACTIVITIES, APP_LANGS, AVATAR_COLORS, EMERGENCY_NUMBER, HOUSE_COLORS, INTERESTS, LANGUAGES, POINTS, TIME_SLOTS,
  cleanList, cleanText, fail, levelFor, seasonFor,
} from '../rules.ts';
import type { Id, Lang, Resident, TimeSlot } from '../types.ts';
import { Base, newId } from './base.ts';

const SLOT_IDS = TIME_SLOTS.map((t) => t.id);
const LANG_IDS = APP_LANGS.map((l) => l.id);
const MAX_PHOTO = 180_000;

export interface ProfileInput {
  firstName?: unknown; avatar?: unknown; houseColor?: unknown; photo?: unknown; bio?: unknown;
  interests?: unknown; activities?: unknown; skills?: unknown; languages?: unknown; availability?: unknown;
  openToMeet?: unknown; isBuddy?: unknown; lang?: unknown; privacy?: { directory?: unknown; showInterests?: unknown };
}

/** Meet Your Neighbours and Common Ground. */
export class People extends Base {
  // ------------------------------------------------------------ identity
  signIn(handoverCode: unknown): Resident {
    const code = cleanText(handoverCode, 'Handover code', 32).toUpperCase();
    const r = this.s.residents.all().find((x) => x.handoverCode === code);
    if (!r) fail('unauthorised', 'That handover code is not on SDP’s purchaser records');
    return r as Resident;
  }

  me(actorId: Id) {
    const r = this.actor(actorId);
    const precinct = this.s.precincts.get(r.precinctId)!;
    const points = this.pointsOf(r.id);
    const lv = levelFor(points);
    const unread = this.s.notifications.all().filter((n) => n.residentId === r.id && !n.readAt).length;
    const pending = this.s.connections.all().filter((c) => c.to === r.id && c.status === 'pending').length;
    return {
      id: r.id, firstName: r.firstName, avatar: r.avatar, photo: r.photo, houseColor: r.houseColor, bio: r.bio,
      interests: r.interests, activities: r.activities, skills: r.skills, languages: r.languages,
      availability: r.availability, openToMeet: r.openToMeet, isBuddy: r.isBuddy, privacy: r.privacy, lang: r.lang,
      isAdmin: !!r.isAdmin, onboarded: r.onboarded, guideSeen: r.guideSeen, isNew: this.isNew(r),
      unit: this.unitLabel(r), unitId: r.unitId, precinct: { id: precinct.id, name: precinct.name },
      circle: r.circle, movedIn: r.movedIn, points, level: lv.level, next: lv.next, progress: lv.progress,
      connections: this.connectionsOf(r.id).length, pendingRequests: pending, unread,
      floodAlert: this.activeAlertFor(r.precinctId), season: seasonFor(this.today()),
      emergencyNumber: EMERGENCY_NUMBER,
    };
  }

  private applyProfile(r: Resident, input: ProfileInput, requireName: boolean): Partial<Resident> {
    const patch: Partial<Resident> = {};
    if (input.firstName !== undefined || requireName) patch.firstName = cleanText(input.firstName ?? r.firstName, 'Display name', 24);
    if (input.avatar !== undefined) patch.avatar = AVATAR_COLORS.includes(String(input.avatar)) ? String(input.avatar) : fail('invalid', 'Pick one of the avatar colours');
    if (input.houseColor !== undefined) patch.houseColor = HOUSE_COLORS.includes(String(input.houseColor)) ? String(input.houseColor) : fail('invalid', 'Pick one of the house colours');
    if (input.photo !== undefined) {
      if (input.photo === null || input.photo === '') patch.photo = null;
      else {
        const p = String(input.photo);
        if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(p)) fail('invalid', 'Photo must be a PNG, JPEG or WebP image');
        if (p.length > MAX_PHOTO) fail('invalid', 'Photo is too large, try a smaller one');
        patch.photo = p;
      }
    }
    if (input.bio !== undefined) patch.bio = cleanText(input.bio, 'Introduction', 280, false);
    if (input.interests !== undefined) patch.interests = cleanList(input.interests, INTERESTS, 8, 'Interests');
    if (input.activities !== undefined) patch.activities = cleanList(input.activities, ACTIVITIES, 6, 'Activities');
    if (input.skills !== undefined) patch.skills = cleanList(input.skills, null, 6, 'Skills');
    if (input.languages !== undefined) patch.languages = cleanList(input.languages, LANGUAGES, 6, 'Languages');
    if (input.availability !== undefined) patch.availability = cleanList(input.availability, SLOT_IDS, 4, 'Times') as TimeSlot[];
    if (input.openToMeet !== undefined) patch.openToMeet = !!input.openToMeet;
    if (input.isBuddy !== undefined) patch.isBuddy = !!input.isBuddy;
    if (input.lang !== undefined) patch.lang = LANG_IDS.includes(input.lang as Lang) ? (input.lang as Lang) : fail('invalid', 'Unknown language');
    if (input.privacy) {
      patch.privacy = {
        directory: input.privacy.directory === undefined ? r.privacy.directory : !!input.privacy.directory,
        showInterests: input.privacy.showInterests === undefined ? r.privacy.showInterests : !!input.privacy.showInterests,
      };
    }
    return patch;
  }

  private maybeProfileComplete(r: Resident) {
    if (r.bio && r.interests.length >= 2 && r.activities.length >= 1 && r.languages.length >= 1) {
      this.awardOnce(r.id, POINTS.profileComplete, 'Completed your profile');
    }
  }

  /** J: Join. Verified at key handover; this records consent and the first profile. */
  onboard(actorId: Id, input: ProfileInput & { consent?: unknown; adult?: unknown }) {
    const r = this.actor(actorId);
    if (r.onboarded) fail('conflict', 'You have already joined');
    if (input.adult !== true) fail('invalid', 'JIRAN is for residents aged 18 and over');
    if (input.consent !== true) fail('invalid', 'Please agree to share your first name and street with your precinct (PDPA consent)');
    const patch = this.applyProfile(r, input, true);
    const next = this.s.residents.update(r.id, { ...patch, onboarded: true, consentAt: this.now(), joinedAt: this.now() });
    this.award(r.id, POINTS.joined, 'Joined JIRAN at key handover');
    this.maybeProfileComplete(next);
    this.emit({ type: 'new_neighbour', precinctId: r.precinctId, message: `${next.firstName} just moved in at ${this.unitLabel(next)}` });
    return this.me(r.id);
  }

  updateProfile(actorId: Id, input: ProfileInput) {
    const r = this.member(actorId);
    const next = this.s.residents.update(r.id, this.applyProfile(r, input, false));
    this.maybeProfileComplete(next);
    return this.me(r.id);
  }

  // ------------------------------------------------------------ directory
  directory(actorId: Id, q: { q?: string; interest?: string; skill?: string; activity?: string; language?: string } = {}) {
    const me = this.member(actorId);
    const text = (q.q ?? '').trim().toLowerCase();
    return this.s.residents.all()
      .filter((r) => r.precinctId === me.precinctId && r.onboarded && !r.isAdmin && r.id !== me.id && r.privacy.directory)
      .map((r) => this.summary(r, me))
      .filter((p) => {
        if (q.interest && !p.interests.includes(q.interest)) return false;
        if (q.activity && !p.activities.includes(q.activity)) return false;
        if (q.language && !p.languages.includes(q.language)) return false;
        if (q.skill && !p.skills.some((s) => s.toLowerCase().includes(q.skill!.toLowerCase()))) return false;
        if (text) {
          const hay = [p.firstName, p.street, ...p.interests, ...p.activities, ...p.skills].join(' ').toLowerCase();
          if (!hay.includes(text)) return false;
        }
        return true;
      })
      .sort((a, b) => b.sharedTags.length - a.sharedTags.length || a.firstName.localeCompare(b.firstName));
  }

  neighbour(actorId: Id, residentId: Id) {
    const me = this.member(actorId);
    const r = residentId === me.id ? me : this.neighbourIn(me, residentId);
    const now = this.now();
    const conn = this.connectionBetween(me.id, r.id);
    const myGroups = new Set(this.s.groups.all().filter((g) => g.memberIds.includes(me.id)).map((g) => g.id));
    return {
      ...this.summary(r, me),
      bio: r.bio,
      availability: r.availability.map((s) => TIME_SLOTS.find((t) => t.id === s)?.label ?? s),
      connectionId: conn?.id ?? null,
      connectionMessage: conn?.status === 'pending' ? conn.message : '',
      shelf: this.s.items.all().filter((i) => i.ownerId === r.id)
        .map((i) => ({ id: i.id, title: i.title, category: i.category, available: i.available, note: i.note })),
      skillListings: this.s.skills.all().filter((s) => s.ownerId === r.id && s.active)
        .map((s) => ({ id: s.id, title: s.title, arrangement: s.arrangement, swapFor: s.swapFor })),
      hosting: this.s.activities.all().filter((a) => a.hostId === r.id && a.status === 'active' && a.endsAt > now)
        .map((a) => ({ id: a.id, title: a.title, startsAt: a.startsAt })),
      groupsInCommon: this.s.groups.all().filter((g) => myGroups.has(g.id) && g.memberIds.includes(r.id)).map((g) => g.name),
      mutual: this.connectionsOf(r.id).filter((id) => this.connectionsOf(me.id).includes(id)).length,
      intro: r.intro?.publishedAt ? r.intro.text : '',
    };
  }

  // ------------------------------------------------------------ connections and chat
  requestConnection(actorId: Id, toId: Id, message: unknown) {
    const me = this.member(actorId);
    if (toId === me.id) fail('invalid', 'That is you');
    const them = this.neighbourIn(me, toId);
    const existing = this.connectionBetween(me.id, them.id);
    if (existing?.status === 'accepted') fail('conflict', `You and ${them.firstName} are already connected`);
    if (existing && existing.from === me.id) fail('conflict', `You already asked ${them.firstName}`);
    if (existing && existing.from === them.id) return this.respondConnection(me.id, existing.id, true);
    const text = cleanText(message, 'Message', 200, false);
    const c = { id: newId('conn'), from: me.id, to: them.id, message: text, status: 'pending' as const, at: this.now(), respondedAt: null };
    this.s.connections.insert(c);
    this.notify([them.id], `${me.firstName} would like to connect${text ? `: “${text}”` : ''}`, 'neighbours:connections', me.precinctId);
    return { ...c, state: 'outgoing' };
  }

  respondConnection(actorId: Id, connectionId: Id, accept: boolean) {
    const me = this.member(actorId);
    const c = this.s.connections.get(connectionId);
    if (!c || c.to !== me.id || c.status !== 'pending') fail('not_found', 'Request not found');
    const next = this.s.connections.update(c!.id, { status: accept ? 'accepted' : 'declined', respondedAt: this.now() });
    if (accept) {
      this.award(me.id, POINTS.connectionMade, `Connected with ${this.nameOf(c!.from)}`);
      this.award(c!.from, POINTS.connectionMade, `Connected with ${me.firstName}`);
      this.notify([c!.from], `${me.firstName} accepted. You can chat now!`, `chat:${me.id}`, me.precinctId);
    }
    return { ...next, state: accept ? 'connected' : 'none' };
  }

  cancelConnection(actorId: Id, connectionId: Id) {
    const me = this.member(actorId);
    const c = this.s.connections.get(connectionId);
    if (!c || c.from !== me.id || c.status !== 'pending') fail('not_found', 'Request not found');
    return this.s.connections.update(c!.id, { status: 'cancelled', respondedAt: this.now() });
  }

  connections(actorId: Id) {
    const me = this.member(actorId);
    const mine = this.s.connections.all().filter((c) => c.from === me.id || c.to === me.id);
    const person = (id: Id) => {
      const r = this.s.residents.get(id)!;
      return this.summary(r, me);
    };
    const lastMessage = (cid: Id) => this.s.messages.all().filter((m) => m.connectionId === cid).sort((a, b) => b.at.localeCompare(a.at))[0] ?? null;
    return {
      incoming: mine.filter((c) => c.status === 'pending' && c.to === me.id).map((c) => ({ id: c.id, message: c.message, at: c.at, person: person(c.from) })),
      outgoing: mine.filter((c) => c.status === 'pending' && c.from === me.id).map((c) => ({ id: c.id, message: c.message, at: c.at, person: person(c.to) })),
      connected: mine.filter((c) => c.status === 'accepted').map((c) => {
        const otherId = c.from === me.id ? c.to : c.from;
        const last = lastMessage(c.id);
        return { id: c.id, person: person(otherId), last: last ? { text: last.text, at: last.at, mine: last.from === me.id } : null };
      }).sort((a, b) => (b.last?.at ?? '').localeCompare(a.last?.at ?? '')),
    };
  }

  thread(actorId: Id, otherId: Id) {
    const me = this.member(actorId);
    const them = this.neighbourIn(me, otherId);
    const c = this.connectionBetween(me.id, them.id);
    if (!c || c.status !== 'accepted') fail('forbidden', `Chat opens once you and ${them.firstName} are connected`);
    return {
      with: this.summary(them, me),
      messages: this.s.messages.all().filter((m) => m.connectionId === c!.id).sort((a, b) => a.at.localeCompare(b.at))
        .map((m) => ({ id: m.id, text: m.text, at: m.at, mine: m.from === me.id })),
    };
  }

  sendMessage(actorId: Id, otherId: Id, text: unknown) {
    const me = this.member(actorId);
    const them = this.neighbourIn(me, otherId);
    const c = this.connectionBetween(me.id, them.id);
    if (!c || c.status !== 'accepted') fail('forbidden', `Chat opens once you and ${them.firstName} are connected`);
    const body = cleanText(text, 'Message', 1000);
    const m = { id: newId('msg'), connectionId: c!.id, from: me.id, to: them.id, text: body, at: this.now() };
    this.s.messages.insert(m);
    this.notify([them.id], `${me.firstName}: ${body.slice(0, 60)}`, `chat:${me.id}`, me.precinctId);
    return { id: m.id, text: m.text, at: m.at, mine: true };
  }

  // ------------------------------------------------------------ suggestions and common ground
  private candidates(me: Resident) {
    const dismissed = new Set(this.s.dismissals.all().filter((d) => d.residentId === me.id).map((d) => d.targetId));
    return this.s.residents.all().filter((r) => r.precinctId === me.precinctId && r.onboarded && !r.isAdmin && r.id !== me.id
      && r.privacy.directory && !dismissed.has(r.id) && this.connState(me.id, r.id) === 'none');
  }

  suggestions(actorId: Id) {
    const me = this.member(actorId);
    const pool = this.candidates(me);
    const scored = pool.map((r) => ({ r, cg: this.commonGround(me, r) }));
    return {
      newcomers: pool.filter((r) => this.isNew(r)).sort((a, b) => b.joinedAt.localeCompare(a.joinedAt)).slice(0, 8).map((r) => this.summary(r, me)),
      similar: scored.filter((x) => x.cg.tags.length > 0).sort((a, b) => b.cg.score - a.cg.score).slice(0, 10).map((x) => this.summary(x.r, me)),
      openToMeet: pool.filter((r) => r.openToMeet).sort((a, b) => this.commonGround(me, b).score - this.commonGround(me, a).score).slice(0, 8).map((r) => this.summary(r, me)),
    };
  }

  dismiss(actorId: Id, targetId: Id) {
    const me = this.member(actorId);
    this.neighbourIn(me, targetId);
    if (!this.s.dismissals.all().some((d) => d.residentId === me.id && d.targetId === targetId)) {
      this.s.dismissals.insert({ id: newId('dis'), residentId: me.id, targetId });
    }
    return { dismissed: targetId };
  }

  /** Find neighbours who want to do the same activity at the same time. */
  partners(actorId: Id, q: { activity?: string; slot?: string }) {
    const me = this.member(actorId);
    const activity = String(q.activity ?? '');
    if (!ACTIVITIES.includes(activity as (typeof ACTIVITIES)[number])) fail('invalid', 'Pick an activity');
    const slot = q.slot && SLOT_IDS.includes(q.slot as TimeSlot) ? (q.slot as TimeSlot) : null;
    return this.s.residents.all()
      .filter((r) => r.precinctId === me.precinctId && r.onboarded && !r.isAdmin && r.id !== me.id && r.privacy.directory && r.privacy.showInterests)
      .filter((r) => r.activities.includes(activity) && (!slot || r.availability.includes(slot)))
      .map((r) => ({ ...this.summary(r, me), slots: r.availability.map((s) => TIME_SLOTS.find((t) => t.id === s)?.label ?? s) }))
      .sort((a, b) => b.sharedTags.length - a.sharedTags.length);
  }
}
