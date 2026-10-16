import { EMERGENCY_NUMBER, POINTS, assertMoneyFree, cleanText, fail, isoDay, isoTime } from '../rules.ts';
import type { CheckinStatus, FloodAlert, FloodLevel, HelpCategory, HelpRequest, Id, Resident } from '../types.ts';
import { newId } from './base.ts';
import { Share } from './share.ts';

const HELP_CATS: HelpCategory[] = ['carry', 'pets', 'computer', 'repairs', 'errands', 'other'];
const FLOOD_LEVELS: FloodLevel[] = ['watch', 'warning', 'danger'];
const CHECKIN: CheckinStatus[] = ['safe', 'need_help', 'can_help'];

export const HELP_STATUS_LABEL = {
  open: 'Open', responded: 'Response received', confirmed: 'Assistance confirmed', completed: 'Completed', cancelled: 'Cancelled',
} as const;

/** Ask for help, offer help, neighbour contacts, SOS, watch my house and flood check-in. */
export class Assist extends Share {
  // ------------------------------------------------------------ help requests and offers
  private helpView(h: HelpRequest, me: Resident) {
    const statusKey = h.status === 'open' && h.responses.length ? 'responded' : h.status;
    return {
      ...h,
      statusKey, statusLabel: HELP_STATUS_LABEL[statusKey],
      requester: this.nameOf(h.requesterId), requesterUnit: this.unitLabel(this.s.residents.get(h.requesterId)),
      helper: h.helperId ? this.nameOf(h.helperId) : null,
      mine: h.requesterId === me.id, imHelping: h.helperId === me.id,
      iResponded: h.responses.some((r) => r.residentId === me.id),
      responses: h.requesterId === me.id
        ? h.responses.map((r) => ({ ...r, name: this.nameOf(r.residentId) }))
        : h.responses.filter((r) => r.residentId === me.id).map((r) => ({ ...r, name: 'You' })),
      responseCount: h.responses.length,
    };
  }

  helpBoard(actorId: Id, q: { q?: string; category?: string } = {}) {
    const me = this.member(actorId);
    const text = (q.q ?? '').toLowerCase();
    const all = this.s.help.all().filter((h) => h.precinctId === me.precinctId)
      .filter((h) => !q.category || h.category === q.category)
      .filter((h) => !text || `${h.title} ${h.description}`.toLowerCase().includes(text))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const offers = this.s.helpOffers.all().filter((o) => o.precinctId === me.precinctId && o.active)
      .filter((o) => !q.category || o.category === q.category)
      .map((o) => ({ ...o, owner: this.nameOf(o.ownerId), ownerUnit: this.unitLabel(this.s.residents.get(o.ownerId)), mine: o.ownerId === me.id }));
    return {
      requests: all.filter((h) => h.status === 'open' || h.status === 'confirmed').filter((h) => h.requesterId !== me.id).map((h) => this.helpView(h, me)),
      mine: all.filter((h) => h.requesterId === me.id || h.helperId === me.id).map((h) => this.helpView(h, me)),
      offers,
    };
  }

  askHelp(actorId: Id, input: Record<string, unknown>) {
    const me = this.member(actorId);
    const title = cleanText(input.title, 'Title', 70);
    const description = cleanText(input.description, 'Description', 400, false);
    const resources = cleanText(input.resources, 'What is needed', 120, false);
    assertMoneyFree(title, description, resources);
    const preferredAt = input.preferredAt ? isoTime(input.preferredAt, 'Preferred time') : '';
    const h: HelpRequest = {
      id: newId('help'), requesterId: me.id, precinctId: me.precinctId, title,
      category: HELP_CATS.includes(input.category as HelpCategory) ? (input.category as HelpCategory) : 'other',
      description, preferredAt, resources, responses: [], helperId: null, status: 'open', createdAt: this.now(),
    };
    this.s.help.insert(h);
    if (input.helperId) {
      const who = this.neighbourIn(me, String(input.helperId));
      this.notify([who.id], `${me.firstName} asked you for help: ${title}`, `help:${h.id}`, me.precinctId);
    }
    this.emit({ type: 'help', precinctId: me.precinctId, message: `${me.firstName} needs a hand: ${title}` });
    return this.helpView(h, me);
  }

  respondHelp(actorId: Id, id: Id, message: unknown) {
    const me = this.member(actorId);
    const h = this.s.help.get(id);
    if (!h || h.precinctId !== me.precinctId) fail('not_found', 'Request not found');
    if (h!.requesterId === me.id) fail('invalid', 'That is your own request');
    if (h!.status !== 'open') fail('conflict', 'This request already has a helper');
    if (h!.responses.some((r) => r.residentId === me.id)) fail('conflict', 'You already offered');
    const text = cleanText(message, 'Message', 200, false) || 'I can help!';
    assertMoneyFree(text);
    const next = this.s.help.update(h!.id, { responses: [...h!.responses, { residentId: me.id, message: text, at: this.now() }] });
    this.notify([h!.requesterId], `${me.firstName} can help with “${h!.title}”`, `help:${h!.id}`, me.precinctId);
    return this.helpView(next, me);
  }

  confirmHelper(actorId: Id, id: Id, helperId: Id) {
    const me = this.member(actorId);
    const h = this.s.help.get(id);
    if (!h || h.requesterId !== me.id) fail('not_found', 'Request not found');
    if (h!.status !== 'open') fail('conflict', 'A helper is already confirmed');
    if (!h!.responses.some((r) => r.residentId === helperId)) fail('invalid', 'Pick someone who offered to help');
    const next = this.s.help.update(h!.id, { helperId, status: 'confirmed' });
    this.notify([helperId], `${me.firstName} confirmed you for “${h!.title}”. Thank you!`, `help:${h!.id}`, me.precinctId);
    return this.helpView(next, me);
  }

  completeHelp(actorId: Id, id: Id) {
    const me = this.member(actorId);
    const h = this.s.help.get(id);
    if (!h || h.requesterId !== me.id) fail('not_found', 'Request not found');
    if (h!.status !== 'confirmed' || !h!.helperId) fail('conflict', 'Confirm a helper first');
    const next = this.s.help.update(h!.id, { status: 'completed' });
    this.award(h!.helperId!, POINTS.helpDone, `Helped ${me.firstName}: ${h!.title}`);
    this.notify([h!.helperId!], `${me.firstName} says thank you for helping!`, `help:${h!.id}`, me.precinctId);
    return this.helpView(next, me);
  }

  cancelHelp(actorId: Id, id: Id) {
    const me = this.member(actorId);
    const h = this.s.help.get(id);
    if (!h || h.requesterId !== me.id || !['open', 'confirmed'].includes(h.status)) fail('not_found', 'Request not found');
    const next = this.s.help.update(h!.id, { status: 'cancelled' });
    if (h!.helperId) this.notify([h!.helperId], `${me.firstName} no longer needs help with “${h!.title}”`, `help:${h!.id}`);
    return this.helpView(next, me);
  }

  addHelpOffer(actorId: Id, input: Record<string, unknown>) {
    const me = this.member(actorId);
    const title = cleanText(input.title, 'What you can help with', 70);
    const description = cleanText(input.description, 'Description', 300, false);
    const availability = cleanText(input.availability, 'When', 60, false);
    assertMoneyFree(title, description, availability);
    const o = {
      id: newId('offer'), ownerId: me.id, precinctId: me.precinctId, title, description, availability, active: true, createdAt: this.now(),
      category: HELP_CATS.includes(input.category as HelpCategory) ? (input.category as HelpCategory) : 'other',
    };
    this.s.helpOffers.insert(o);
    return o;
  }

  setOfferActive(actorId: Id, id: Id, active: boolean) {
    const o = this.s.helpOffers.get(id);
    if (!o || o.ownerId !== actorId) fail('not_found', 'Offer not found');
    return this.s.helpOffers.update(id, { active });
  }

  // ------------------------------------------------------------ neighbour contacts and SOS
  safety(actorId: Id) {
    const me = this.member(actorId);
    const contacts = this.s.contacts.all().filter((c) => c.ownerId === me.id || c.contactId === me.id).map((c) => {
      const otherId = c.ownerId === me.id ? c.contactId : c.ownerId;
      const o = this.s.residents.get(otherId);
      return { id: c.id, residentId: otherId, firstName: o?.firstName ?? '', avatar: o?.avatar ?? '#ddd', photo: o?.photo ?? null, status: c.status, incoming: c.contactId === me.id && c.status === 'pending' };
    });
    const sos = this.s.sos.all().find((x) => x.residentId === me.id && !x.cancelledAt) ?? null;
    const alertsForMe = this.s.sos.all().filter((x) => !x.cancelledAt && x.notified.includes(me.id))
      .map((x) => ({ id: x.id, from: this.nameOf(x.residentId), unit: this.unitLabel(this.s.residents.get(x.residentId)), at: x.at }));
    const watches = this.s.watches.all().filter((w) => w.ownerId === me.id || w.watcherId === me.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((w) => ({ ...w, owner: this.nameOf(w.ownerId), ownerUnit: this.unitLabel(this.s.residents.get(w.ownerId)), watcher: this.nameOf(w.watcherId), asWatcher: w.watcherId === me.id }));
    return { contacts, sos, alertsForMe, watches, emergencyNumber: EMERGENCY_NUMBER, fireNumber: '994' };
  }

  requestContact(actorId: Id, residentId: Id) {
    const me = this.member(actorId);
    const them = this.neighbourIn(me, residentId);
    if (them.id === me.id) fail('invalid', 'Pick a neighbour');
    if (this.connState(me.id, them.id) !== 'connected') fail('forbidden', `Connect with ${them.firstName} first`);
    if (this.s.contacts.all().some((c) => (c.ownerId === me.id && c.contactId === them.id) || (c.ownerId === them.id && c.contactId === me.id))) fail('conflict', `${them.firstName} is already in your contacts`);
    const c = { id: newId('contact'), ownerId: me.id, contactId: them.id, status: 'pending' as const };
    this.s.contacts.insert(c);
    this.notify([them.id], `${me.firstName} asked you to be an emergency neighbour contact`, 'help:safety', me.precinctId);
    return c;
  }

  respondContact(actorId: Id, contactRowId: Id, accept: boolean) {
    const me = this.member(actorId);
    const c = this.s.contacts.get(contactRowId);
    if (!c || c.contactId !== me.id || c.status !== 'pending') fail('not_found', 'Request not found');
    if (!accept) { this.s.contacts.remove(c!.id); return { removed: true }; }
    const next = this.s.contacts.update(c!.id, { status: 'accepted' });
    this.award(me.id, POINTS.contactAccepted, `Became ${this.nameOf(c!.ownerId)}’s neighbour contact`);
    this.notify([c!.ownerId], `${me.firstName} is now your neighbour contact`, 'help:safety', me.precinctId);
    return next;
  }

  sos(actorId: Id) {
    const me = this.member(actorId);
    const notified = this.s.contacts.all().filter((c) => c.status === 'accepted' && (c.ownerId === me.id || c.contactId === me.id))
      .map((c) => (c.ownerId === me.id ? c.contactId : c.ownerId));
    if (!notified.length) fail('invalid', 'Add a neighbour contact first. In an emergency, call 999.');
    const alert = { id: newId('sos'), residentId: me.id, precinctId: me.precinctId, notified, at: this.now(), cancelledAt: null };
    this.s.sos.insert(alert);
    this.notify(notified, `${me.firstName} at ${this.unitLabel(me)} needs help now. Call 999 if it is an emergency.`, 'help:safety', me.precinctId);
    return alert;
  }

  cancelSos(actorId: Id) {
    const me = this.member(actorId);
    const open = this.s.sos.all().filter((x) => x.residentId === me.id && !x.cancelledAt);
    for (const o of open) this.s.sos.update(o.id, { cancelledAt: this.now() });
    if (open.length) this.notify(open.flatMap((o) => o.notified), `${me.firstName} is OK now. Alert cancelled.`, 'help:safety', me.precinctId);
    return { cancelled: open.length };
  }

  // ------------------------------------------------------------ watch my house
  requestWatch(actorId: Id, input: { watcherId?: unknown; from?: unknown; to?: unknown; note?: unknown }) {
    const me = this.member(actorId);
    const watcher = this.neighbourIn(me, String(input.watcherId ?? ''));
    if (watcher.id === me.id) fail('invalid', 'Pick a neighbour');
    if (this.connState(me.id, watcher.id) !== 'connected') fail('forbidden', `Only connected neighbours can watch your house. Connect with ${watcher.firstName} first`);
    const from = isoDay(input.from, 'From');
    const to = isoDay(input.to, 'To');
    if (to < from) fail('invalid', 'The end date must be after the start');
    if (from < this.today()) fail('invalid', 'Pick dates from today');
    const note = cleanText(input.note, 'Note', 200, false);
    assertMoneyFree(note);
    const w = { id: newId('watch'), ownerId: me.id, watcherId: watcher.id, precinctId: me.precinctId, from, to, note, status: 'pending' as const, createdAt: this.now() };
    this.s.watches.insert(w);
    this.notify([watcher.id], `${me.firstName} asked you to watch their house ${from} to ${to}`, 'help:safety', me.precinctId);
    return w;
  }

  respondWatch(actorId: Id, id: Id, accept: boolean) {
    const me = this.member(actorId);
    const w = this.s.watches.get(id);
    if (!w || w.watcherId !== me.id || w.status !== 'pending') fail('not_found', 'Request not found');
    const next = this.s.watches.update(id, { status: accept ? 'accepted' : 'declined' });
    this.notify([w!.ownerId], accept ? `${me.firstName} will keep an eye on your house` : `${me.firstName} can’t watch your house this time`, 'help:safety', me.precinctId);
    return next;
  }

  completeWatch(actorId: Id, id: Id) {
    const me = this.member(actorId);
    const w = this.s.watches.get(id);
    if (!w || w.ownerId !== me.id || w.status !== 'accepted') fail('not_found', 'Request not found');
    const next = this.s.watches.update(id, { status: 'done' });
    this.award(w!.watcherId, POINTS.watchDone, `Watched ${me.firstName}’s house`);
    this.notify([w!.watcherId], `${me.firstName} is home. Thanks for watching!`, 'help:safety', me.precinctId);
    return next;
  }

  // ------------------------------------------------------------ flood check-in
  issueFloodAlert(actorId: Id, input: { level?: unknown; title?: unknown; source?: unknown; precinctIds?: unknown }) {
    const me = this.actor(actorId);
    if (!me.isAdmin) fail('forbidden', 'Only the SDP community team can post flood alerts');
    const level = FLOOD_LEVELS.includes(input.level as FloodLevel) ? (input.level as FloodLevel) : 'warning';
    const title = cleanText(input.title ?? 'Heavy rain and rising water expected tonight', 'Title', 100);
    const source = cleanText(input.source ?? 'Public flood warning feed (JPS / MetMalaysia)', 'Source', 100);
    const all = this.s.precincts.all().filter((p) => p.status === 'occupied').map((p) => p.id);
    const ids = Array.isArray(input.precinctIds) && input.precinctIds.length ? input.precinctIds.map(String).filter((id) => all.includes(id)) : all;
    for (const a of this.s.floodAlerts.all()) if (!a.endedAt) this.s.floodAlerts.update(a.id, { endedAt: this.now() });
    const alert: FloodAlert = { id: newId('flood'), level, title, source, precinctIds: ids, issuedAt: this.now(), endedAt: null };
    this.s.floodAlerts.insert(alert);
    for (const p of ids) this.emit({ type: 'flood_alert', precinctId: p, message: `Flood ${level}: ${title}. Tap to check in.` });
    return alert;
  }

  endFloodAlert(actorId: Id) {
    const me = this.actor(actorId);
    if (!me.isAdmin) fail('forbidden', 'Only the SDP community team can end flood alerts');
    let ended = 0;
    for (const a of this.s.floodAlerts.all()) if (!a.endedAt) { this.s.floodAlerts.update(a.id, { endedAt: this.now() }); ended++; }
    if (ended) this.emit({ type: 'flood_end', precinctId: null, message: 'The flood alert has ended. Thank you for looking out for each other.' });
    return { ended };
  }

  floodBoard(actorId: Id) {
    const me = this.member(actorId);
    const alert = this.activeAlertFor(me.precinctId);
    if (!alert) return { alert: null, counts: { safe: 0, need_help: 0, can_help: 0, unknown: 0 }, neighbours: [], mine: null };
    const checkins = this.s.floodCheckins.all().filter((c) => c.alertId === alert.id && c.precinctId === me.precinctId);
    const connected = new Set(this.connectionsOf(me.id));
    const neighbours = this.s.residents.all().filter((r) => r.precinctId === me.precinctId && r.unitId && r.onboarded).map((r) => {
      const c = checkins.find((x) => x.residentId === r.id);
      return { id: r.id, firstName: r.firstName, unit: this.unitLabel(r), status: c?.status ?? null, note: c?.note ?? '', isYou: r.id === me.id, connected: connected.has(r.id) };
    });
    const order: Record<string, number> = { need_help: 0, can_help: 2, safe: 3, null: 1 };
    neighbours.sort((a, b) => order[String(a.status)] - order[String(b.status)] || Number(b.connected) - Number(a.connected));
    const counts = {
      safe: neighbours.filter((n) => n.status === 'safe').length,
      need_help: neighbours.filter((n) => n.status === 'need_help').length,
      can_help: neighbours.filter((n) => n.status === 'can_help').length,
      unknown: neighbours.filter((n) => !n.status).length,
    };
    return { alert, counts, neighbours, mine: checkins.find((c) => c.residentId === me.id) ?? null };
  }

  floodCheckin(actorId: Id, input: { status?: unknown; note?: unknown }) {
    const me = this.member(actorId);
    const alert = this.activeAlertFor(me.precinctId);
    if (!alert) fail('conflict', 'There is no flood alert right now');
    const status = input.status as CheckinStatus;
    if (!CHECKIN.includes(status)) fail('invalid', 'Choose safe, need help or can help');
    const note = cleanText(input.note, 'Note', 140, false);
    assertMoneyFree(note);
    const existing = this.s.floodCheckins.all().find((c) => c.alertId === alert!.id && c.residentId === me.id);
    const row = existing
      ? this.s.floodCheckins.update(existing.id, { status, note, at: this.now() })
      : this.s.floodCheckins.insert({ id: newId('chk'), alertId: alert!.id, residentId: me.id, precinctId: me.precinctId, status, note, at: this.now() });
    let earned = this.awardOnce(me.id, POINTS.floodCheckin, `Flood check-in (${alert!.id})`);
    if (status === 'can_help') earned += this.awardOnce(me.id, POINTS.floodHelpOffer, `Offered flood help (${alert!.id})`);
    const msg = status === 'need_help' ? `${me.firstName} at ${this.unitLabel(me)} needs help${note ? `: ${note}` : ''}`
      : status === 'can_help' ? `${me.firstName} can help${note ? `: ${note}` : ''}` : `${me.firstName} is safe`;
    if (status === 'need_help') {
      const helpers = this.s.floodCheckins.all().filter((c) => c.alertId === alert!.id && c.status === 'can_help' && c.precinctId === me.precinctId).map((c) => c.residentId);
      this.notify([...new Set([...helpers, ...this.connectionsOf(me.id)])].filter((x) => x !== me.id), msg, 'flood', me.precinctId);
    } else {
      this.emit({ type: 'flood_checkin', precinctId: me.precinctId, message: msg });
    }
    return { ...row, earned };
  }
}
