import { buildAdiraSite, FEATURES, PLACES, ROADS, TOWNSHIP } from '../geo.ts';
import {
  BADGES, DECOR_LABEL, DECOR_UNLOCK, POINTS, SEASONS, assertMoneyFree, cleanText, daysBetween, fail, levelFor, seasonFor,
} from '../rules.ts';
import type { DecorKey, Id, Notice } from '../types.ts';
import { Assist } from './assist.ts';
import { newId } from './base.ts';

/** Welcome guide content for Adira. Bracketed items are for SDP's management office to fill in. */
export const WELCOME_GUIDE = {
  facilities: [
    { name: 'Taman Adira neighbourhood garden', detail: 'Pavilion, community lawn, playground, multipurpose court, EPDM court, fitness station, relaxing shelter and picnic area.' },
    { name: 'Adira linear park', detail: 'Jogging path, brisk walk walkway, kid’s track, bike, roller blade and skateboard tracks, outdoor exercise area.' },
    { name: 'Bandar Bukit Raja Town Park', detail: 'The township’s main park, with lakes and fields for weekend activities.' },
  ],
  booking: [
    'The pavilion and courts are shared by all Adira residents. Post your activity in JIRAN so neighbours know the space is in use.',
    'Formal bookings for private events: [booking process from the management office].',
  ],
  rules: [
    'Keep noise down after 10pm, especially at the courts and pavilion.',
    'Park inside your own porch. Keep the road and your neighbour’s gate clear.',
    'Pets on a leash in the garden and linear park, and please pick up after them.',
    'Renovation works only on [permitted days and hours, from the management office].',
    'Be kind on JIRAN: no selling, no renting, no money. Lend, share and help for free.',
  ],
  waste: [
    'Household waste: tie bags and put them in your bin on collection days, [collection days from the local council].',
    'Recycling: separate paper, plastic and cans. [Recycling collection day or drop-off point].',
    'Bulky items and renovation debris are not collected with household waste. [Bulky waste arrangement].',
    'Garden cuttings: bundle them, or share compost tips in the Garden Growers group.',
  ],
  contacts: [
    { label: 'Police and ambulance', value: '999' },
    { label: 'Fire and rescue (Bomba)', value: '994' },
    { label: 'Defects in your home', value: 'Report a defect in the Sime Darby Property app' },
    { label: 'Management office', value: '[phone number and hours]' },
  ],
  introTemplate: 'Hi Adira! I’m [name] at [house number and street]. I moved in [month] with [who you live with]. I enjoy [hobbies] and I’m happy to help with [something you are good at]. Say hi if you see me at [favourite spot]!',
};

const ITEM_FOR_INTEREST: Record<string, string[]> = {
  Gardening: ['home'], Baking: ['kitchen'], Kuih: ['kitchen'], Cooking: ['kitchen', 'festive'], DIY: ['tools'], 'Car care': ['tools'],
  'Kids in kindergarten': ['kids'], 'Kids in Standard 2': ['kids'], Badminton: ['sports'], Futsal: ['sports'], 'Board games': ['kids'],
};

/** The whole JIRAN service: welcome, buddies, noticeboard, notifications, points and maps. */
export class Jiran extends Assist {
  // ------------------------------------------------------------ welcome
  guide(actorId: Id) {
    const me = this.member(actorId);
    const upcoming = this.activities(me.id).slice(0, 3);
    const contacts = this.safety(me.id).contacts.filter((c) => c.status === 'accepted');
    return { precinct: this.s.precincts.get(me.precinctId)?.name ?? '', ...WELCOME_GUIDE, upcoming, myContacts: contacts };
  }

  markGuideSeen(actorId: Id) {
    const me = this.member(actorId);
    this.s.residents.update(me.id, { guideSeen: true });
    return { guideSeen: true };
  }

  saveIntro(actorId: Id, input: { text?: unknown; publish?: unknown }) {
    const me = this.member(actorId);
    const text = cleanText(input.text, 'Introduction', 500);
    assertMoneyFree(text);
    if (text.includes('[')) fail('invalid', 'Fill in the parts in [square brackets] first');
    const publish = !!input.publish;
    const wasPublished = !!me.intro?.publishedAt;
    const intro = { text, publishedAt: publish ? (me.intro?.publishedAt ?? this.now()) : null, welcomedBy: me.intro?.welcomedBy ?? [] };
    this.s.residents.update(me.id, { intro });
    if (publish && !wasPublished) {
      this.awardOnce(me.id, POINTS.introPublished, 'Introduced yourself');
      this.emit({ type: 'intro', precinctId: me.precinctId, message: `${me.firstName} introduced themselves. Say welcome!` });
    }
    return intro;
  }

  newcomers(actorId: Id) {
    const me = this.member(actorId);
    return this.s.residents.all()
      .filter((r) => r.precinctId === me.precinctId && r.intro?.publishedAt && r.privacy.directory)
      .sort((a, b) => b.intro!.publishedAt!.localeCompare(a.intro!.publishedAt!))
      .slice(0, 20)
      .map((r) => ({
        ...this.summary(r, me), intro: r.intro!.text, publishedAt: r.intro!.publishedAt,
        welcomes: r.intro!.welcomedBy.length, welcomedByMe: r.intro!.welcomedBy.includes(me.id),
      }));
  }

  welcome(actorId: Id, residentId: Id) {
    const me = this.member(actorId);
    const r = this.neighbourIn(me, residentId);
    if (r.id === me.id) fail('invalid', 'That is you');
    const intro = r.intro;
    if (!intro?.publishedAt) return fail('not_found', 'No introduction to welcome');
    if (intro.welcomedBy.includes(me.id)) fail('conflict', `You already welcomed ${r.firstName}`);
    this.s.residents.update(r.id, { intro: { ...intro, welcomedBy: [...intro.welcomedBy, me.id] } });
    const earned = this.awardOnce(me.id, POINTS.welcomeNewcomer, `Welcomed ${r.firstName}`);
    this.notify([r.id], `${me.firstName} welcomed you to ${this.s.precincts.get(me.precinctId)?.name ?? 'the neighbourhood'}!`, `neighbour:${me.id}`, me.precinctId);
    return { welcomed: true, earned };
  }

  // ------------------------------------------------------------ community buddies
  buddies(actorId: Id) {
    const me = this.member(actorId);
    const links = this.s.buddies.all().filter((b) => (b.newcomerId === me.id || b.buddyId === me.id) && b.status !== 'declined' && b.status !== 'ended');
    const view = (b: (typeof links)[number]) => ({ ...b, newcomer: this.nameOf(b.newcomerId), buddy: this.nameOf(b.buddyId), iAmBuddy: b.buddyId === me.id });
    return {
      volunteering: me.isBuddy,
      volunteers: this.s.residents.all().filter((r) => r.precinctId === me.precinctId && r.isBuddy && r.id !== me.id && r.onboarded)
        .map((r) => ({ ...this.summary(r, me), guiding: this.s.buddies.all().filter((b) => b.buddyId === r.id && b.status === 'active').length })),
      links: links.map(view),
    };
  }

  setBuddy(actorId: Id, on: boolean) {
    const me = this.member(actorId);
    this.s.residents.update(me.id, { isBuddy: on });
    return { volunteering: on };
  }

  requestBuddy(actorId: Id, buddyId: Id) {
    const me = this.member(actorId);
    const b = this.neighbourIn(me, buddyId);
    if (!b.isBuddy) fail('invalid', `${b.firstName} is not volunteering as a buddy right now`);
    if (this.s.buddies.all().some((x) => x.newcomerId === me.id && (x.status === 'pending' || x.status === 'active'))) fail('conflict', 'You already have a buddy or a pending request');
    const link = { id: newId('buddy'), newcomerId: me.id, buddyId: b.id, precinctId: me.precinctId, status: 'pending' as const, at: this.now() };
    this.s.buddies.insert(link);
    this.notify([b.id], `${me.firstName} (${this.unitLabel(me)}) would like you as their community buddy`, 'me:buddy', me.precinctId);
    return link;
  }

  respondBuddy(actorId: Id, id: Id, accept: boolean) {
    const me = this.member(actorId);
    const link = this.s.buddies.get(id);
    if (!link || link.buddyId !== me.id || link.status !== 'pending') fail('not_found', 'Request not found');
    const next = this.s.buddies.update(id, { status: accept ? 'active' : 'declined' });
    if (accept) {
      this.awardOnce(me.id, POINTS.buddy, `Became ${this.nameOf(link!.newcomerId)}’s buddy`);
      // Buddies can chat straight away.
      if (this.connState(me.id, link!.newcomerId) !== 'connected') {
        const pending = this.connectionBetween(me.id, link!.newcomerId);
        if (pending) this.s.connections.update(pending.id, { status: 'accepted', respondedAt: this.now() });
        else this.s.connections.insert({ id: newId('conn'), from: me.id, to: link!.newcomerId, message: 'Your community buddy', status: 'accepted', at: this.now(), respondedAt: this.now() });
      }
    }
    this.notify([link!.newcomerId], accept ? `${me.firstName} is your community buddy! Say hi in chat.` : `${me.firstName} can’t be a buddy right now. Try another volunteer.`, accept ? `chat:${me.id}` : 'me:buddy', me.precinctId);
    return next;
  }

  endBuddy(actorId: Id, id: Id) {
    const link = this.s.buddies.get(id);
    if (!link || (link.buddyId !== actorId && link.newcomerId !== actorId) || link.status !== 'active') fail('not_found', 'Buddy link not found');
    const other = link!.buddyId === actorId ? link!.newcomerId : link!.buddyId;
    this.notify([other], `${this.nameOf(actorId)} ended the buddy connection. You can still chat as neighbours.`, 'me:buddy');
    return this.s.buddies.update(id, { status: 'ended' });
  }

  // ------------------------------------------------------------ recommendations and checklist
  recommendations(actorId: Id) {
    const me = this.member(actorId);
    const tags = [...me.interests, ...me.activities];
    const cats = new Set(tags.flatMap((t) => ITEM_FOR_INTEREST[t] ?? []));
    const tips: string[] = [];
    if (tags.some((t) => t.startsWith('Kids'))) tips.push('The playground is in Taman Adira, next to the community lawn.');
    if (tags.some((t) => ['Jogging', 'Cycling'].includes(t))) tips.push('The linear park has a jogging path and bike track along the lake.');
    if (tags.some((t) => ['Badminton', 'Basketball', 'Futsal'].includes(t))) tips.push('The multipurpose and EPDM courts are in Taman Adira.');
    if (tags.includes('Gardening')) tips.push('Garden cuttings: bundle them, or ask the Garden Growers about composting.');
    return {
      residents: this.suggestions(me.id).similar.slice(0, 5),
      groups: this.groups(me.id).filter((g) => !g.joined && g.matchesYou).slice(0, 4),
      activities: this.suggestedActivities(me.id).slice(0, 4),
      items: this.items(me.id, { available: 'true' }).filter((i) => !i.mine && cats.has(i.category)).slice(0, 4),
      tips,
    };
  }

  checklist(actorId: Id) {
    const me = this.member(actorId);
    const steps = [
      { id: 'profile', label: 'Complete your profile', done: !!me.bio && me.interests.length >= 2 && me.languages.length >= 1, link: 'me:profile' },
      { id: 'guide', label: 'Explore the welcome guide', done: me.guideSeen, link: 'me:guide' },
      { id: 'interests', label: 'Pick interests and activities', done: me.interests.length > 0 && me.activities.length > 0, link: 'me:profile' },
      { id: 'connect', label: 'Connect with a neighbour', done: this.connectionsOf(me.id).length > 0, link: 'neighbours:discover' },
      { id: 'group', label: 'Join an interest group', done: this.s.groups.all().some((g) => g.memberIds.includes(me.id)), link: 'neighbours:groups' },
      { id: 'activity', label: 'Register for your first activity', done: this.s.activities.all().some((a) => a.participants.includes(me.id) || a.hostId === me.id), link: 'activities' },
    ];
    return { steps, done: steps.filter((s) => s.done).length, total: steps.length };
  }

  // ------------------------------------------------------------ noticeboard
  notices(actorId: Id) {
    const me = this.member(actorId);
    return this.s.notices.all().filter((n) => n.precinctId === me.precinctId)
      .sort((a, b) => Number(a.resolved) - Number(b.resolved) || Number(b.kind === 'announcement') - Number(a.kind === 'announcement') || b.at.localeCompare(a.at))
      .map((n) => ({ ...n, author: this.nameOf(n.authorId), mine: n.authorId === me.id, canResolve: n.authorId === me.id || !!me.isAdmin }));
  }

  postNotice(actorId: Id, input: { kind?: unknown; title?: unknown; body?: unknown }) {
    const me = this.member(actorId);
    const kind = (['announcement', 'lost', 'found', 'general'] as const).find((k) => k === input.kind) ?? 'general';
    if (kind === 'announcement' && !me.isAdmin) fail('forbidden', 'Announcements come from the SDP community team. Post a general notice instead.');
    const title = cleanText(input.title, 'Title', 80);
    const body = cleanText(input.body, 'Details', 400, false);
    assertMoneyFree(title, body);
    const n: Notice = { id: newId('notice'), precinctId: me.precinctId, authorId: me.id, kind, title, body, resolved: false, at: this.now() };
    this.s.notices.insert(n);
    this.emit({ type: 'notice', precinctId: me.precinctId, message: `${kind === 'lost' ? 'Lost' : kind === 'found' ? 'Found' : 'Notice'}: ${title}` });
    return n;
  }

  resolveNotice(actorId: Id, id: Id) {
    const me = this.member(actorId);
    const n = this.s.notices.get(id);
    if (!n || n.precinctId !== me.precinctId || (n.authorId !== me.id && !me.isAdmin)) fail('not_found', 'Notice not found');
    return this.s.notices.update(id, { resolved: true });
  }

  // ------------------------------------------------------------ notifications and reminders
  notifications(actorId: Id) {
    const me = this.actor(actorId);
    const stored = this.s.notifications.all().filter((n) => n.residentId === me.id).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 40);
    const reminders: { id: string; text: string; link: string; at: string }[] = [];
    const now = this.nowMs();
    for (const a of this.s.activities.all()) {
      if (a.status !== 'active' || !(a.participants.includes(me.id) || a.hostId === me.id)) continue;
      const t = new Date(a.startsAt).getTime();
      if (t > now && t - now < 36 * 3600000) reminders.push({ id: `rem-${a.id}`, text: `Coming up: ${a.title} at ${a.place}`, link: `activity:${a.id}`, at: a.startsAt });
    }
    for (const l of this.s.loans.all()) {
      if (l.borrowerId === me.id && l.status === 'handed_over' && daysBetween(this.today(), l.endDate) <= 1) {
        reminders.push({ id: `rem-${l.id}`, text: `Return the ${this.s.items.get(l.itemId)?.title ?? 'item'} to ${this.nameOf(l.lenderId)} by ${l.endDate}`, link: 'share:loans', at: l.endDate });
      }
    }
    for (const w of this.s.watches.all()) {
      if (w.watcherId === me.id && w.status === 'accepted' && w.from <= this.today() && w.to >= this.today()) {
        reminders.push({ id: `rem-${w.id}`, text: `You are watching ${this.nameOf(w.ownerId)}’s house until ${w.to}`, link: 'help:safety', at: w.from });
      }
    }
    return { reminders, items: stored, unread: stored.filter((n) => !n.readAt).length };
  }

  markNotificationsRead(actorId: Id) {
    const me = this.actor(actorId);
    for (const n of this.s.notifications.all()) if (n.residentId === me.id && !n.readAt) this.s.notifications.update(n.id, { readAt: this.now() });
    return { unread: 0 };
  }

  // ------------------------------------------------------------ points, badges, decorations
  progress(actorId: Id) {
    const me = this.member(actorId);
    const points = this.pointsOf(me.id);
    const lv = levelFor(points);
    const loans = this.s.loans.all();
    const earned: Record<string, boolean> = {
      first_friend: this.connectionsOf(me.id).length >= 1,
      connector: this.connectionsOf(me.id).length >= 5,
      kind_lender: loans.some((l) => l.lenderId === me.id && l.status === 'returned'),
      good_borrower: loans.some((l) => l.borrowerId === me.id && !!l.stars),
      skill_sharer: this.s.skillRequests.all().some((r) => (r.ownerId === me.id || r.requesterId === me.id) && r.status === 'completed'),
      host: this.s.activities.all().some((a) => a.hostId === me.id),
      helper: this.s.help.all().some((h) => h.helperId === me.id && h.status === 'completed'),
      buddy: this.s.buddies.all().some((b) => b.buddyId === me.id && (b.status === 'active' || b.status === 'ended')),
      flood_buddy: this.s.floodCheckins.all().some((c) => c.residentId === me.id && c.status === 'can_help'),
    };
    const season = seasonFor(this.today());
    const decor = (Object.keys(DECOR_LABEL) as DecorKey[]).map((k) => {
      if (k === 'festive') return { key: k, label: season ? season.decor : DECOR_LABEL.festive, unlockLevel: 0, unlocked: !!season, on: !!season && me.decor.festive !== false, seasonal: true };
      return { key: k, label: DECOR_LABEL[k], unlockLevel: DECOR_UNLOCK[k], unlocked: lv.level.n >= DECOR_UNLOCK[k], on: !!me.decor[k], seasonal: false };
    });
    const recent = this.s.ledger.all().filter((l) => l.residentId === me.id).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 10);
    return {
      points, level: lv.level, next: lv.next, progress: lv.progress, houseColor: me.houseColor,
      badges: BADGES.map((b) => ({ ...b, earned: earned[b.id] })),
      decor, season, upcomingSeasons: SEASONS.filter((s) => s.to >= this.today()).slice(0, 3),
      recent, connections: this.connectionsOf(me.id).length,
    };
  }

  setDecor(actorId: Id, key: unknown, on: boolean) {
    const me = this.member(actorId);
    if (!(String(key) in DECOR_LABEL)) fail('invalid', 'Unknown decoration');
    const k = key as DecorKey;
    if (k === 'festive') {
      if (!seasonFor(this.today())) fail('forbidden', 'Festive decorations appear in season');
    } else if (levelFor(this.pointsOf(me.id)).level.n < DECOR_UNLOCK[k]) fail('forbidden', `Unlocks at level ${DECOR_UNLOCK[k]}`);
    return this.s.residents.update(me.id, { decor: { ...me.decor, [k]: on } }).decor;
  }

  // ------------------------------------------------------------ maps
  township(actorId: Id) {
    const me = this.actor(actorId);
    const residents = this.s.residents.all().filter((r) => !r.isAdmin && r.onboarded);
    const precincts = this.s.precincts.all().map((p) => {
      const inP = residents.filter((r) => r.precinctId === p.id);
      const connected = inP.filter((r) => this.connectionsOf(r.id).length > 0).length;
      const isHome = p.id === me.precinctId;
      return {
        id: p.id, name: p.name, polygon: p.polygon, label: p.label, tint: p.tint, status: p.status, homes: p.homes,
        joined: inP.length, glow: p.homes ? Math.min(1, connected / p.homes) : 0, isHome,
        hasStreetView: p.hasStreetView && isHome, flood: !!this.activeAlertFor(p.id),
      };
    });
    const now = this.now();
    const pins = this.s.activities.all()
      .filter((a) => a.status === 'active' && a.endsAt > now && (a.scope === 'township' || a.precinctId === me.precinctId))
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .map((a) => {
        const place = PLACES.find((p) => p.id === a.placeId);
        return { id: a.id, title: a.title, category: a.category, place: a.place, pin: place?.pin ?? ([475, 560] as [number, number]), startsAt: a.startsAt, going: a.participants.length + 1 };
      });
    return { township: TOWNSHIP, features: FEATURES, roads: ROADS, places: PLACES, precincts, pins, homePrecinctId: me.precinctId };
  }

  /** The Adira site plan with every lot, who lives there (first names only) and what is happening. */
  site(actorId: Id) {
    const me = this.member(actorId);
    if (me.precinctId !== 'adira') fail('not_found', 'This precinct has no site plan yet');
    const plan = buildAdiraSite();
    const alert = this.activeAlertFor('adira');
    const checkins = alert ? this.s.floodCheckins.all().filter((c) => c.alertId === alert.id) : [];
    const byUnit = new Map(this.s.residents.all().filter((r) => r.unitId).map((r) => [r.unitId!, r]));
    const now = this.now();
    const hosting = new Set(this.s.activities.all().filter((a) => a.category === 'open_house' && a.status === 'active' && a.endsAt > now).map((a) => a.hostId));
    const lenders = new Set(this.s.items.all().filter((i) => i.available).map((i) => i.ownerId));
    const helpers = new Set([...this.s.skills.all().filter((s) => s.active).map((s) => s.ownerId), ...this.s.helpOffers.all().filter((o) => o.active).map((o) => o.ownerId)]);
    const season = seasonFor(this.today());
    const lots = this.s.units.all().filter((u) => u.precinctId === 'adira').map((u) => {
      const r = byUnit.get(u.id);
      const visible = r && r.onboarded && (r.privacy.directory || r.id === me.id);
      const badge = !visible ? null : hosting.has(r!.id) ? 'open_house' : this.isNew(r!) ? 'new' : helpers.has(r!.id) ? 'help' : lenders.has(r!.id) ? 'lend' : null;
      return {
        ...u,
        resident: visible ? {
          id: r!.id, firstName: r!.firstName, houseColor: r!.houseColor, avatar: r!.avatar, isYou: r!.id === me.id,
          connection: r!.id === me.id ? 'none' : this.connState(me.id, r!.id), isNew: this.isNew(r!), badge,
          decor: { ...r!.decor, festive: !!season && r!.decor.festive !== false },
        } : null,
        occupied: !!r,
        flood: r ? (checkins.find((c) => c.residentId === r.id)?.status ?? null) : null,
      };
    });
    const pins = this.s.activities.all().filter((a) => a.status === 'active' && a.endsAt > now && (a.precinctId === 'adira' || a.scope === 'township'))
      .map((a) => {
        const place = PLACES.find((p) => p.id === a.placeId);
        const host = a.placeId === 'home' ? this.s.units.get(this.s.residents.get(a.hostId)?.unitId ?? '') : undefined;
        const at = place?.site ?? (host ? [host.x + host.w / 2, host.y + host.h / 2] : null);
        return at ? { id: a.id, title: a.title, category: a.category, at, startsAt: a.startsAt } : null;
      }).filter(Boolean);
    const unread = this.s.notices.all().filter((n) => n.precinctId === 'adira' && !n.resolved).length;
    return {
      ...plan, lots, pins, floodAlert: alert, season, noticeCount: unread, myUnitId: me.unitId,
      stats: { homes: lots.length, onJiran: lots.filter((l) => l.resident).length, connected: this.connectionsOf(me.id).length },
    };
  }

  // ------------------------------------------------------------ SDP dashboard (anonymised)
  dashboard(actorId: Id) {
    const me = this.actor(actorId);
    if (!me.isAdmin) fail('forbidden', 'SDP staff only');
    const residents = this.s.residents.all().filter((r) => !r.isAdmin && r.onboarded);
    const alert = this.s.floodAlerts.all().find((a) => !a.endedAt) ?? null;
    const rows = this.s.precincts.all().filter((p) => p.status === 'occupied').map((p) => {
      const inP = residents.filter((r) => r.precinctId === p.id);
      const conn = inP.map((r) => this.connectionsOf(r.id).length);
      const checked = alert ? this.s.floodCheckins.all().filter((c) => c.alertId === alert.id && c.precinctId === p.id) : [];
      return {
        id: p.id, name: p.name, homes: p.homes, joined: inP.length,
        joinedPct: p.homes ? inP.length / p.homes : 0,
        knowThreePlusPct: inP.length ? conn.filter((n) => n >= 3).length / inP.length : 0,
        avgConnections: inP.length ? conn.reduce((a, b) => a + b, 0) / inP.length : 0,
        activeLoans: this.s.loans.all().filter((l) => l.precinctId === p.id && l.status === 'handed_over').length,
        groups: this.s.groups.all().filter((g) => g.precinctId === p.id).length,
        upcomingActivities: this.s.activities.all().filter((a) => a.precinctId === p.id && a.status === 'active' && a.endsAt > this.now()).length,
        floodNeedHelp: checked.filter((c) => c.status === 'need_help').length,
        floodCheckedIn: checked.length,
      };
    });
    return { generatedAt: this.now(), floodAlert: alert, precincts: rows };
  }
}
