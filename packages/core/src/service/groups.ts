import { placeById } from '../geo.ts';
import { INTEREST_TO_CATEGORY, POINTS, assertMoneyFree, cleanText, fail, isoTime } from '../rules.ts';
import type { Activity, ActivityCategory, Group, Id, Resident } from '../types.ts';
import { newId } from './base.ts';
import { People } from './people.ts';

export const ACTIVITY_CATEGORIES: { id: ActivityCategory; label: string }[] = [
  { id: 'sport', label: 'Sport' }, { id: 'social', label: 'Social' }, { id: 'games', label: 'Games' },
  { id: 'class', label: 'Class' }, { id: 'kids', label: 'Kids' }, { id: 'study', label: 'Study' },
  { id: 'cleanup', label: 'Gotong-royong' }, { id: 'open_house', label: 'Open house' },
];
const CAT_IDS = ACTIVITY_CATEGORIES.map((c) => c.id);

export interface ActivityInput {
  title?: unknown; description?: unknown; category?: unknown; placeId?: unknown; startsAt?: unknown; endsAt?: unknown;
  capacity?: unknown; scope?: unknown; groupId?: unknown;
}

/** Interest groups and community activities. */
export class Groups extends People {
  // ------------------------------------------------------------ groups
  private groupFor(me: Resident, id: Id): Group {
    const g = this.s.groups.get(id);
    if (!g || g.precinctId !== me.precinctId) fail('not_found', 'Group not found');
    return g as Group;
  }

  private nextActivity(groupId: Id) {
    const now = this.now();
    return this.s.activities.all().filter((a) => a.groupId === groupId && a.status === 'active' && a.endsAt > now)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0] ?? null;
  }

  groups(actorId: Id, q: { q?: string; category?: string } = {}) {
    const me = this.member(actorId);
    const text = (q.q ?? '').toLowerCase();
    const mine = [...me.interests, ...me.activities];
    return this.s.groups.all().filter((g) => g.precinctId === me.precinctId)
      .filter((g) => (!q.category || g.category === q.category) && (!text || `${g.name} ${g.description} ${g.category}`.toLowerCase().includes(text)))
      .map((g) => {
        const next = this.nextActivity(g.id);
        return {
          id: g.id, name: g.name, description: g.description, category: g.category, members: g.memberIds.length,
          joined: g.memberIds.includes(me.id), isAdmin: g.adminIds.includes(me.id), organiser: this.nameOf(g.organiserId),
          matchesYou: mine.includes(g.category),
          next: next ? { id: next.id, title: next.title, startsAt: next.startsAt } : null,
        };
      })
      .sort((a, b) => Number(b.joined) - Number(a.joined) || Number(b.matchesYou) - Number(a.matchesYou) || b.members - a.members);
  }

  group(actorId: Id, id: Id) {
    const me = this.member(actorId);
    const g = this.groupFor(me, id);
    const now = this.now();
    const joined = g.memberIds.includes(me.id);
    return {
      id: g.id, name: g.name, description: g.description, category: g.category, organiserId: g.organiserId,
      joined, isAdmin: g.adminIds.includes(me.id), isOrganiser: g.organiserId === me.id,
      members: g.memberIds.map((mid) => {
        const r = this.s.residents.get(mid);
        return { id: mid, firstName: r?.firstName ?? '', avatar: r?.avatar ?? '#eee', photo: r?.photo ?? null, isAdmin: g.adminIds.includes(mid), isYou: mid === me.id };
      }),
      // Discussions are for members only.
      posts: joined ? this.s.groupPosts.all().filter((p) => p.groupId === g.id).sort((a, b) => b.at.localeCompare(a.at))
        .map((p) => ({ id: p.id, text: p.text, at: p.at, author: this.nameOf(p.authorId), mine: p.authorId === me.id })) : [],
      activities: this.s.activities.all().filter((a) => a.groupId === g.id && a.status === 'active' && a.endsAt > now)
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt)).map((a) => this.activityCard(a, me)),
    };
  }

  createGroup(actorId: Id, input: { name?: unknown; description?: unknown; category?: unknown }) {
    const me = this.member(actorId);
    const name = cleanText(input.name, 'Group name', 50);
    const description = cleanText(input.description, 'Description', 300, false);
    const category = cleanText(input.category, 'Category', 40);
    assertMoneyFree(name, description);
    if (this.s.groups.all().some((g) => g.precinctId === me.precinctId && g.name.toLowerCase() === name.toLowerCase())) fail('conflict', 'A group with that name already exists');
    const g: Group = { id: newId('grp'), precinctId: me.precinctId, name, description, category, organiserId: me.id, adminIds: [me.id], memberIds: [me.id], createdAt: this.now() };
    this.s.groups.insert(g);
    this.emit({ type: 'group', precinctId: me.precinctId, message: `${me.firstName} started ${name}` });
    return this.group(me.id, g.id);
  }

  updateGroup(actorId: Id, id: Id, input: { name?: unknown; description?: unknown; category?: unknown }) {
    const me = this.member(actorId);
    const g = this.groupFor(me, id);
    if (!g.adminIds.includes(me.id)) fail('forbidden', 'Only group admins can edit the group');
    const patch: Partial<Group> = {};
    if (input.name !== undefined) patch.name = cleanText(input.name, 'Group name', 50);
    if (input.description !== undefined) patch.description = cleanText(input.description, 'Description', 300, false);
    if (input.category !== undefined) patch.category = cleanText(input.category, 'Category', 40);
    assertMoneyFree(patch.name, patch.description);
    this.s.groups.update(g.id, patch);
    return this.group(me.id, g.id);
  }

  joinGroup(actorId: Id, id: Id) {
    const me = this.member(actorId);
    const g = this.groupFor(me, id);
    if (g.memberIds.includes(me.id)) fail('conflict', 'You are already in this group');
    this.s.groups.update(g.id, { memberIds: [...g.memberIds, me.id] });
    const earned = this.awardOnce(me.id, POINTS.joinGroup, `Joined ${g.name}`);
    this.notify(g.adminIds, `${me.firstName} joined ${g.name}`, `group:${g.id}`, me.precinctId);
    return { joined: true, earned };
  }

  leaveGroup(actorId: Id, id: Id) {
    const me = this.member(actorId);
    const g = this.groupFor(me, id);
    if (!g.memberIds.includes(me.id)) fail('conflict', 'You are not in this group');
    if (g.organiserId === me.id && g.memberIds.length > 1) fail('conflict', 'Hand the group to another admin before leaving');
    this.s.groups.update(g.id, { memberIds: g.memberIds.filter((x) => x !== me.id), adminIds: g.adminIds.filter((x) => x !== me.id) });
    return { joined: false };
  }

  postToGroup(actorId: Id, id: Id, text: unknown) {
    const me = this.member(actorId);
    const g = this.groupFor(me, id);
    if (!g.memberIds.includes(me.id)) fail('forbidden', 'Join the group to post');
    const body = cleanText(text, 'Post', 500);
    assertMoneyFree(body);
    const p = { id: newId('post'), groupId: g.id, authorId: me.id, text: body, at: this.now() };
    this.s.groupPosts.insert(p);
    this.emit({ type: 'group_post', precinctId: me.precinctId, to: g.memberIds.filter((x) => x !== me.id), message: `${me.firstName} in ${g.name}: ${body.slice(0, 50)}` });
    return { id: p.id, text: p.text, at: p.at, author: me.firstName, mine: true };
  }

  manageMember(actorId: Id, id: Id, memberId: Id, action: unknown) {
    const me = this.member(actorId);
    const g = this.groupFor(me, id);
    if (!g.adminIds.includes(me.id)) fail('forbidden', 'Only group admins can manage members');
    if (!g.memberIds.includes(memberId)) fail('not_found', 'Not a member');
    if (memberId === g.organiserId) fail('forbidden', 'The organiser cannot be changed here');
    if (action === 'remove') this.s.groups.update(g.id, { memberIds: g.memberIds.filter((x) => x !== memberId), adminIds: g.adminIds.filter((x) => x !== memberId) });
    else if (action === 'make_admin') this.s.groups.update(g.id, { adminIds: [...new Set([...g.adminIds, memberId])] });
    else if (action === 'remove_admin') this.s.groups.update(g.id, { adminIds: g.adminIds.filter((x) => x !== memberId) });
    else fail('invalid', 'Unknown action');
    return this.group(me.id, g.id);
  }

  // ------------------------------------------------------------ activities
  protected activityCard(a: Activity, me: Resident) {
    const host = this.s.residents.get(a.hostId);
    const count = a.participants.length + 1;
    return {
      id: a.id, title: a.title, description: a.description, category: a.category, scope: a.scope, place: a.place,
      placeId: a.placeId, startsAt: a.startsAt, endsAt: a.endsAt, status: a.status, capacity: a.capacity,
      going: count, spotsLeft: a.capacity ? Math.max(0, a.capacity - count) : null,
      imIn: a.participants.includes(me.id), mine: a.hostId === me.id,
      host: host?.firstName ?? '', hostUnit: host?.precinctId === me.precinctId ? this.unitLabel(host) : '',
      groupId: a.groupId, group: a.groupId ? this.s.groups.get(a.groupId)?.name ?? '' : '',
      past: a.endsAt <= this.now(),
    };
  }

  private visible(a: Activity, me: Resident) {
    return a.scope === 'township' || a.precinctId === me.precinctId;
  }

  activities(actorId: Id, q: { q?: string; category?: string; from?: string; to?: string; scope?: string } = {}) {
    const me = this.member(actorId);
    const now = this.now();
    const text = (q.q ?? '').toLowerCase();
    return this.s.activities.all()
      .filter((a) => this.visible(a, me) && a.status === 'active' && a.endsAt > now)
      .filter((a) => !q.category || a.category === q.category)
      .filter((a) => !q.scope || a.scope === q.scope)
      .filter((a) => !q.from || a.startsAt.slice(0, 10) >= q.from)
      .filter((a) => !q.to || a.startsAt.slice(0, 10) <= q.to)
      .filter((a) => !text || a.title.toLowerCase().includes(text))
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .map((a) => this.activityCard(a, me));
  }

  activity(actorId: Id, id: Id) {
    const me = this.member(actorId);
    const a = this.s.activities.get(id);
    if (!a || !this.visible(a, me)) fail('not_found', 'Activity not found');
    const people = [a!.hostId, ...a!.participants].map((pid) => this.s.residents.get(pid)).filter(Boolean) as Resident[];
    // Names are only shown for people in your own precinct.
    const local = people.filter((p) => p.precinctId === me.precinctId);
    return {
      ...this.activityCard(a!, me),
      participants: local.map((p) => ({ id: p.id, firstName: p.firstName, avatar: p.avatar, photo: p.photo, isHost: p.id === a!.hostId, isYou: p.id === me.id })),
      othersFromElsewhere: people.length - local.length,
    };
  }

  private parseActivity(me: Resident, input: ActivityInput, current?: Activity): Partial<Activity> {
    const patch: Partial<Activity> = {};
    if (!current || input.title !== undefined) patch.title = cleanText(input.title, 'Activity name', 70);
    if (!current || input.description !== undefined) patch.description = cleanText(input.description, 'Description', 400, false);
    assertMoneyFree(patch.title, patch.description);
    if (!current || input.category !== undefined) patch.category = CAT_IDS.includes(input.category as ActivityCategory) ? (input.category as ActivityCategory) : 'social';
    if (!current || input.placeId !== undefined) {
      const pid = String(input.placeId ?? '');
      if (pid === 'home') { patch.placeId = 'home'; patch.place = this.unitLabel(me) || 'Host’s home'; }
      else {
        const place = placeById(pid);
        if (!place) fail('invalid', 'Pick a venue');
        patch.placeId = place!.id; patch.place = place!.name;
      }
    }
    if (!current || input.startsAt !== undefined) {
      patch.startsAt = isoTime(input.startsAt, 'Start time');
      if (patch.startsAt <= this.now()) fail('invalid', 'Pick a start time in the future');
    }
    const start = patch.startsAt ?? current!.startsAt;
    if (!current || input.endsAt !== undefined || patch.startsAt) {
      patch.endsAt = input.endsAt ? isoTime(input.endsAt, 'End time') : new Date(new Date(start).getTime() + 2 * 3600000).toISOString();
      if (patch.endsAt <= start) fail('invalid', 'The end time must be after the start');
    }
    if (!current || input.capacity !== undefined) {
      if (input.capacity === null || input.capacity === '' || input.capacity === undefined) patch.capacity = null;
      else {
        const n = Number(input.capacity);
        if (!Number.isInteger(n) || n < 2 || n > 500) fail('invalid', 'Participant limit must be 2 to 500');
        if (current && n < current.participants.length + 1) fail('invalid', `${current.participants.length + 1} people are already going`);
        patch.capacity = n;
      }
    }
    if (!current) {
      patch.scope = input.scope === 'township' ? 'township' : 'precinct';
      if (input.groupId) {
        const g = this.s.groups.get(String(input.groupId));
        if (!g || !g.memberIds.includes(me.id)) fail('invalid', 'You can only post activities for groups you are in');
        patch.groupId = g!.id;
      } else patch.groupId = null;
    }
    return patch;
  }

  createActivity(actorId: Id, input: ActivityInput) {
    const me = this.member(actorId);
    const p = this.parseActivity(me, input);
    const a: Activity = {
      id: newId('act'), hostId: me.id, precinctId: me.precinctId, scope: p.scope!, category: p.category!, title: p.title!,
      description: p.description!, placeId: p.placeId!, place: p.place!, startsAt: p.startsAt!, endsAt: p.endsAt!,
      capacity: p.capacity ?? null, participants: [], groupId: p.groupId ?? null, status: 'active', createdAt: this.now(),
    };
    this.s.activities.insert(a);
    const earned = this.awardOnce(me.id, POINTS.hostActivity, `Hosted: ${a.title}`);
    if (a.groupId) {
      const g = this.s.groups.get(a.groupId)!;
      this.notify(g.memberIds.filter((x) => x !== me.id), `New in ${g.name}: ${a.title}`, `activity:${a.id}`, me.precinctId);
    }
    this.emit({ type: 'activity', precinctId: a.scope === 'township' ? null : me.precinctId, message: `${me.firstName} is hosting ${a.title}` });
    return { ...this.activityCard(a, me), earned };
  }

  updateActivity(actorId: Id, id: Id, input: ActivityInput) {
    const me = this.member(actorId);
    const a = this.s.activities.get(id);
    if (!a || a.hostId !== me.id) fail('not_found', 'You can only edit activities you host');
    if (a!.status === 'cancelled') fail('conflict', 'This activity was cancelled');
    const next = this.s.activities.update(a!.id, this.parseActivity(me, input, a!));
    this.notify(next.participants, `${next.title} was updated. Check the new details`, `activity:${next.id}`, me.precinctId);
    return this.activityCard(next, me);
  }

  cancelActivity(actorId: Id, id: Id) {
    const me = this.member(actorId);
    const a = this.s.activities.get(id);
    if (!a || a.hostId !== me.id) fail('not_found', 'You can only cancel activities you host');
    const next = this.s.activities.update(a!.id, { status: 'cancelled' });
    this.notify(a!.participants, `${a!.title} has been cancelled by ${me.firstName}`, `activity:${a!.id}`, me.precinctId);
    return this.activityCard(next, me);
  }

  joinActivity(actorId: Id, id: Id) {
    const me = this.member(actorId);
    const a = this.s.activities.get(id);
    if (!a || !this.visible(a, me)) fail('not_found', 'Activity not found');
    if (a!.hostId === me.id) fail('invalid', 'You are the host');
    if (a!.status === 'cancelled') fail('conflict', 'This activity was cancelled');
    if (a!.endsAt <= this.now()) fail('conflict', 'This activity has finished');
    if (a!.participants.includes(me.id)) fail('conflict', 'You have already joined');
    if (a!.capacity && a!.participants.length + 1 >= a!.capacity) fail('conflict', 'This activity is full');
    const next = this.s.activities.update(a!.id, { participants: [...a!.participants, me.id] });
    const earned = this.awardOnce(me.id, POINTS.joinActivity, `Joined: ${a!.title}`);
    this.notify([a!.hostId], `${me.firstName} is coming to ${a!.title}`, `activity:${a!.id}`, me.precinctId);
    return { ...this.activityCard(next, me), earned };
  }

  leaveActivity(actorId: Id, id: Id) {
    const me = this.member(actorId);
    const a = this.s.activities.get(id);
    if (!a || !a.participants.includes(me.id)) fail('not_found', 'You have not joined this activity');
    const next = this.s.activities.update(a!.id, { participants: a!.participants.filter((x) => x !== me.id) });
    return this.activityCard(next, me);
  }

  myActivities(actorId: Id) {
    const me = this.member(actorId);
    const all = this.s.activities.all().sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    return {
      joined: all.filter((a) => a.participants.includes(me.id)).map((a) => this.activityCard(a, me)),
      created: all.filter((a) => a.hostId === me.id).map((a) => this.activityCard(a, me)),
    };
  }

  suggestedActivities(actorId: Id) {
    const me = this.member(actorId);
    const cats = new Set([...me.interests, ...me.activities].flatMap((i) => INTEREST_TO_CATEGORY[i] ?? []));
    const myGroups = new Set(this.s.groups.all().filter((g) => g.memberIds.includes(me.id)).map((g) => g.id));
    return this.activities(me.id)
      .filter((a) => !a.imIn && !a.mine && a.spotsLeft !== 0)
      .map((a) => {
        const why: string[] = [];
        if (a.groupId && myGroups.has(a.groupId)) why.push(`From your group ${a.group}`);
        if (cats.has(a.category)) why.push('Matches your interests');
        return { ...a, why };
      })
      .filter((a) => a.why.length)
      .slice(0, 8);
  }
}
