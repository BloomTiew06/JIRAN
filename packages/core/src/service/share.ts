import { POINTS, assertMoneyFree, cleanText, daysBetween, fail, isoDay } from '../rules.ts';
import type { Id, Item, ItemCategory, ItemCondition, Loan, Resident, Skill, SkillCategory, SkillRequest } from '../types.ts';
import { newId } from './base.ts';
import { Groups } from './groups.ts';

const ITEM_CATEGORIES: ItemCategory[] = ['tools', 'home', 'kitchen', 'festive', 'kids', 'sports'];
const CONDITIONS: ItemCondition[] = ['like_new', 'good', 'well_used'];
const SKILL_CATEGORIES: SkillCategory[] = ['tutoring', 'computer', 'cooking', 'gardening', 'language', 'repairs', 'other'];

export const LOAN_LABEL: Record<Loan['status'], string> = {
  requested: 'Pending approval', accepted: 'Approved', declined: 'Declined', handed_over: 'Borrowed', returned: 'Returned', cancelled: 'Cancelled',
};

/** Borrow and lend, give-aways and skills exchange. All free. */
export class Share extends Groups {
  // ------------------------------------------------------------ items
  private itemView(i: Item, me: Resident) {
    const owner = this.s.residents.get(i.ownerId);
    const open = this.s.loans.all().find((l) => l.itemId === i.id && l.borrowerId === me.id && ['requested', 'accepted', 'handed_over'].includes(l.status));
    const lent = this.s.loans.all().filter((l) => l.itemId === i.id && l.status === 'returned');
    const stars = lent.filter((l) => l.stars).map((l) => l.stars!);
    return {
      ...i, mine: i.ownerId === me.id,
      owner: { id: i.ownerId, firstName: owner?.firstName ?? '', unit: this.unitLabel(owner), avatar: owner?.avatar ?? '#eee' },
      status: i.available ? 'Available' : 'Unavailable',
      myLoan: open ? { id: open.id, status: open.status, label: LOAN_LABEL[open.status] } : null,
      timesLent: lent.length,
      rating: stars.length ? Math.round((stars.reduce((a, b) => a + b, 0) / stars.length) * 10) / 10 : null,
    };
  }

  items(actorId: Id, q: { q?: string; category?: string; available?: string; days?: string } = {}) {
    const me = this.member(actorId);
    const text = (q.q ?? '').toLowerCase();
    const days = q.days ? Number(q.days) : 0;
    return this.s.items.all().filter((i) => i.precinctId === me.precinctId)
      .filter((i) => !q.category || i.category === q.category)
      .filter((i) => q.available !== 'true' || i.available)
      .filter((i) => !days || i.maxDays >= days)
      .filter((i) => !text || `${i.title} ${i.note}`.toLowerCase().includes(text))
      .map((i) => this.itemView(i, me))
      .sort((a, b) => Number(a.mine) - Number(b.mine) || Number(b.available) - Number(a.available) || a.title.localeCompare(b.title));
  }

  item(actorId: Id, id: Id) {
    const me = this.member(actorId);
    const i = this.s.items.get(id);
    if (!i || i.precinctId !== me.precinctId) fail('not_found', 'Item not found');
    return this.itemView(i!, me);
  }

  private parseItem(input: Record<string, unknown>, current?: Item): Partial<Item> {
    const p: Partial<Item> = {};
    if (!current || input.title !== undefined) p.title = cleanText(input.title, 'Item name', 60);
    if (!current || input.note !== undefined) p.note = cleanText(input.note, 'Description', 200, false);
    if (!current || input.conditions !== undefined) p.conditions = cleanText(input.conditions, 'Borrowing conditions', 200, false);
    assertMoneyFree(p.title, p.note, p.conditions);
    if (!current || input.category !== undefined) p.category = ITEM_CATEGORIES.includes(input.category as ItemCategory) ? (input.category as ItemCategory) : 'home';
    if (!current || input.condition !== undefined) p.condition = CONDITIONS.includes(input.condition as ItemCondition) ? (input.condition as ItemCondition) : 'good';
    if (!current || input.maxDays !== undefined) {
      const n = Number(input.maxDays ?? 3);
      if (!Number.isInteger(n) || n < 1 || n > 14) fail('invalid', 'Borrowing period must be 1 to 14 days');
      p.maxDays = n;
    }
    if (input.available !== undefined) p.available = !!input.available;
    return p;
  }

  addItem(actorId: Id, input: Record<string, unknown>) {
    const me = this.member(actorId);
    const p = this.parseItem(input);
    const it: Item = { ...(p as Omit<Item, 'id' | 'ownerId' | 'precinctId' | 'createdAt' | 'available'>), id: newId('item'), ownerId: me.id, precinctId: me.precinctId, available: true, createdAt: this.now() };
    this.s.items.insert(it);
    this.emit({ type: 'item', precinctId: me.precinctId, message: `${me.firstName} added ${it.title} to their shelf` });
    return this.itemView(it, me);
  }

  updateItem(actorId: Id, id: Id, input: Record<string, unknown>) {
    const me = this.member(actorId);
    const it = this.s.items.get(id);
    if (!it || it.ownerId !== me.id) fail('not_found', 'Item not found on your shelf');
    if (input.available === true && this.s.loans.all().some((l) => l.itemId === id && l.status === 'handed_over')) fail('conflict', 'This item is out on loan');
    return this.itemView(this.s.items.update(id, this.parseItem(input, it)), me);
  }

  removeItem(actorId: Id, id: Id) {
    const me = this.member(actorId);
    const it = this.s.items.get(id);
    if (!it || it.ownerId !== me.id) fail('not_found', 'Item not found on your shelf');
    if (this.s.loans.all().some((l) => l.itemId === id && ['requested', 'accepted', 'handed_over'].includes(l.status))) fail('conflict', 'Finish or decline open requests first');
    this.s.items.remove(id);
    return { removed: id };
  }

  // ------------------------------------------------------------ loans
  protected loanView(l: Loan, viewerId: Id) {
    const item = this.s.items.get(l.itemId);
    const otherId = l.lenderId === viewerId ? l.borrowerId : l.lenderId;
    const today = this.today();
    return {
      id: l.id, itemId: l.itemId, itemTitle: item?.title ?? 'Item', role: l.lenderId === viewerId ? 'lender' as const : 'borrower' as const,
      other: { id: otherId, firstName: this.nameOf(otherId) }, status: l.status, statusLabel: LOAN_LABEL[l.status],
      startDate: l.startDate, endDate: l.endDate, days: daysBetween(l.startDate, l.endDate) + 1, note: l.note,
      conditionPhoto: l.conditionPhoto, stars: l.stars,
      dueSoon: l.status === 'handed_over' && daysBetween(today, l.endDate) <= 1,
      overdue: l.status === 'handed_over' && l.endDate < today,
      // Only the borrower sees the code; the lender scans it at the door.
      handoverCode: l.borrowerId === viewerId ? l.handoverCode : null,
    };
  }

  loans(actorId: Id) {
    const me = this.member(actorId);
    const mine = this.s.loans.all().filter((l) => l.lenderId === me.id || l.borrowerId === me.id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const active = mine.filter((l) => ['requested', 'accepted', 'handed_over'].includes(l.status) || (l.status === 'returned' && !l.stars && l.borrowerId === me.id));
    return {
      active: active.map((l) => this.loanView(l, me.id)),
      history: mine.filter((l) => !active.includes(l)).map((l) => this.loanView(l, me.id)),
    };
  }

  requestLoan(actorId: Id, itemId: Id, input: { startDate?: unknown; endDate?: unknown; note?: unknown }) {
    const me = this.member(actorId);
    const it = this.s.items.get(itemId);
    if (!it || it.precinctId !== me.precinctId) fail('not_found', 'Item not found');
    if (it!.ownerId === me.id) fail('invalid', 'That is your own item');
    if (!it!.available) fail('conflict', 'This item is not available right now');
    if (this.s.loans.all().some((l) => l.itemId === itemId && l.borrowerId === me.id && ['requested', 'accepted', 'handed_over'].includes(l.status))) fail('conflict', 'You already have a request for this item');
    const startDate = isoDay(input.startDate, 'Start date');
    const endDate = isoDay(input.endDate, 'Return date');
    if (startDate < this.today()) fail('invalid', 'Pick a start date from today');
    const days = daysBetween(startDate, endDate) + 1;
    if (days < 1) fail('invalid', 'The return date must be on or after the start date');
    if (days > it!.maxDays) fail('invalid', `${this.nameOf(it!.ownerId)} lends this for up to ${it!.maxDays} days`);
    const note = cleanText(input.note, 'Note', 200, false);
    assertMoneyFree(note);
    const now = this.now();
    const loan: Loan = {
      id: newId('loan'), itemId, lenderId: it!.ownerId, borrowerId: me.id, precinctId: me.precinctId, status: 'requested',
      startDate, endDate, note, handoverCode: String(100000 + Math.floor(Math.random() * 900000)),
      conditionPhoto: false, stars: null, createdAt: now, updatedAt: now,
    };
    this.s.loans.insert(loan);
    this.notify([it!.ownerId], `${me.firstName} would like to borrow your ${it!.title} (${days} day${days > 1 ? 's' : ''})`, 'share:loans', me.precinctId);
    return this.loanView(loan, me.id);
  }

  private myLoan(actorId: Id, loanId: Id, role: 'lender' | 'borrower' | 'either'): Loan {
    const l = this.s.loans.get(loanId);
    const ok = l && ((role !== 'borrower' && l.lenderId === actorId) || (role !== 'lender' && l.borrowerId === actorId));
    if (!ok) fail('not_found', 'Loan not found');
    return l as Loan;
  }

  respondLoan(actorId: Id, loanId: Id, accept: boolean) {
    const me = this.member(actorId);
    const l = this.myLoan(me.id, loanId, 'lender');
    if (l.status !== 'requested') fail('conflict', 'This request was already answered');
    const next = this.s.loans.update(l.id, { status: accept ? 'accepted' : 'declined', updatedAt: this.now() });
    const title = this.s.items.get(l.itemId)?.title ?? 'item';
    this.notify([l.borrowerId], accept ? `${me.firstName} approved your request for the ${title}` : `${me.firstName} can’t lend the ${title} this time`, 'share:loans', me.precinctId);
    return this.loanView(next, me.id);
  }

  handover(actorId: Id, loanId: Id, code: unknown) {
    const me = this.member(actorId);
    const l = this.myLoan(me.id, loanId, 'lender');
    if (l.status !== 'accepted') fail('conflict', 'Approve the request before handing over');
    if (String(code ?? '').trim() !== l.handoverCode) fail('invalid', 'That handover code does not match');
    const next = this.s.loans.update(l.id, { status: 'handed_over', updatedAt: this.now() });
    this.s.items.update(l.itemId, { available: false });
    this.notify([l.borrowerId], `Handover done. Please return it by ${l.endDate}`, 'share:loans', me.precinctId);
    return this.loanView(next, me.id);
  }

  conditionPhoto(actorId: Id, loanId: Id) {
    const l = this.myLoan(actorId, loanId, 'either');
    if (!['accepted', 'handed_over'].includes(l.status)) fail('conflict', 'Photos are taken at handover');
    return this.loanView(this.s.loans.update(l.id, { conditionPhoto: true, updatedAt: this.now() }), actorId);
  }

  confirmReturn(actorId: Id, loanId: Id) {
    const me = this.member(actorId);
    const l = this.myLoan(me.id, loanId, 'lender');
    if (l.status !== 'handed_over') fail('conflict', 'This item is not out on loan');
    const next = this.s.loans.update(l.id, { status: 'returned', updatedAt: this.now() });
    this.s.items.update(l.itemId, { available: true });
    const title = this.s.items.get(l.itemId)?.title ?? 'an item';
    this.award(me.id, POINTS.lendReturned, `Lent ${title}`);
    this.notify([l.borrowerId], `${me.firstName} got the ${title} back. Rate the loan to earn points`, 'share:loans', me.precinctId);
    return this.loanView(next, me.id);
  }

  rateLoan(actorId: Id, loanId: Id, stars: unknown) {
    const me = this.member(actorId);
    const l = this.myLoan(me.id, loanId, 'borrower');
    if (l.status !== 'returned') fail('conflict', 'Rate after returning');
    if (l.stars) fail('conflict', 'Already rated');
    const n = Number(stars);
    if (!Number.isInteger(n) || n < 1 || n > 5) fail('invalid', 'Stars must be 1 to 5');
    const next = this.s.loans.update(l.id, { stars: n, updatedAt: this.now() });
    const earned = this.award(me.id, POINTS.borrowRated, `Returned and rated ${this.s.items.get(l.itemId)?.title ?? 'a loan'}`);
    return { ...this.loanView(next, me.id), earned };
  }

  cancelLoan(actorId: Id, loanId: Id) {
    const l = this.myLoan(actorId, loanId, 'borrower');
    if (!['requested', 'accepted'].includes(l.status)) fail('conflict', 'This loan can no longer be cancelled');
    this.notify([l.lenderId], `${this.nameOf(actorId)} cancelled their request`, 'share:loans');
    return this.loanView(this.s.loans.update(l.id, { status: 'cancelled', updatedAt: this.now() }), actorId);
  }

  // ------------------------------------------------------------ give-aways
  giveaways(actorId: Id) {
    const me = this.member(actorId);
    return this.s.giveaways.all().filter((g) => g.precinctId === me.precinctId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((g) => ({ ...g, owner: this.nameOf(g.ownerId), ownerUnit: this.unitLabel(this.s.residents.get(g.ownerId)), mine: g.ownerId === me.id, claimedByMe: g.claimedBy === me.id }));
  }

  addGiveaway(actorId: Id, input: { title?: unknown; note?: unknown }) {
    const me = this.member(actorId);
    const title = cleanText(input.title, 'What are you giving away', 60);
    const note = cleanText(input.note, 'Note', 200, false);
    assertMoneyFree(title, note);
    const g = { id: newId('give'), ownerId: me.id, precinctId: me.precinctId, title, note, claimedBy: null, createdAt: this.now() };
    this.s.giveaways.insert(g);
    this.emit({ type: 'giveaway', precinctId: me.precinctId, message: `${me.firstName} is giving away ${title}` });
    return g;
  }

  claimGiveaway(actorId: Id, id: Id) {
    const me = this.member(actorId);
    const g = this.s.giveaways.get(id);
    if (!g || g.precinctId !== me.precinctId) fail('not_found', 'Give-away not found');
    if (g!.ownerId === me.id) fail('invalid', 'That is your own give-away');
    if (g!.claimedBy) fail('conflict', 'Someone already claimed this');
    const next = this.s.giveaways.update(g!.id, { claimedBy: me.id });
    this.award(g!.ownerId, POINTS.giveawayClaimed, `Gave away ${g!.title}`);
    this.notify([g!.ownerId], `${me.firstName} will collect your ${g!.title}`, 'share:give', me.precinctId);
    return next;
  }

  // ------------------------------------------------------------ skills exchange
  private skillView(s: Skill, me: Resident) {
    const owner = this.s.residents.get(s.ownerId);
    const done = this.s.skillRequests.all().filter((r) => r.skillId === s.id && r.status === 'completed');
    const stars = done.filter((r) => r.stars).map((r) => r.stars!);
    return {
      ...s, mine: s.ownerId === me.id, owner: { id: s.ownerId, firstName: owner?.firstName ?? '', unit: this.unitLabel(owner), avatar: owner?.avatar ?? '#eee' },
      exchanges: done.length, rating: stars.length ? Math.round((stars.reduce((a, b) => a + b, 0) / stars.length) * 10) / 10 : null,
      reviews: done.filter((r) => r.feedback).map((r) => ({ by: this.nameOf(r.requesterId), stars: r.stars, text: r.feedback })).slice(0, 3),
    };
  }

  skills(actorId: Id, q: { q?: string; category?: string } = {}) {
    const me = this.member(actorId);
    const text = (q.q ?? '').toLowerCase();
    return this.s.skills.all().filter((s) => s.precinctId === me.precinctId && s.active)
      .filter((s) => !q.category || s.category === q.category)
      .filter((s) => !text || `${s.title} ${s.description} ${s.category}`.toLowerCase().includes(text))
      .map((s) => this.skillView(s, me))
      .sort((a, b) => Number(a.mine) - Number(b.mine) || a.title.localeCompare(b.title));
  }

  addSkill(actorId: Id, input: Record<string, unknown>) {
    const me = this.member(actorId);
    if (input.arrangement === 'paid' || input.arrangement === 'payment') fail('money_free', 'Skills on JIRAN are shared for free or swapped for another skill, never for payment.');
    const title = cleanText(input.title, 'Skill', 60);
    const description = cleanText(input.description, 'Description', 300, false);
    const availability = cleanText(input.availability, 'Availability', 60, false);
    const swapFor = input.arrangement === 'swap' ? cleanText(input.swapFor, 'What you would like in return', 60) : '';
    assertMoneyFree(title, description, availability, swapFor);
    const s: Skill = {
      id: newId('skill'), ownerId: me.id, precinctId: me.precinctId, title, description,
      category: SKILL_CATEGORIES.includes(input.category as SkillCategory) ? (input.category as SkillCategory) : 'other',
      availability, arrangement: input.arrangement === 'swap' ? 'swap' : 'free', swapFor, active: true, createdAt: this.now(),
    };
    this.s.skills.insert(s);
    if (!me.skills.includes(title)) this.s.residents.update(me.id, { skills: [...me.skills, title].slice(0, 6) });
    return this.skillView(s, me);
  }

  setSkillActive(actorId: Id, id: Id, active: boolean) {
    const me = this.member(actorId);
    const s = this.s.skills.get(id);
    if (!s || s.ownerId !== me.id) fail('not_found', 'Skill not found');
    return this.skillView(this.s.skills.update(id, { active }), me);
  }

  skillRequests(actorId: Id) {
    const me = this.member(actorId);
    const view = (r: SkillRequest) => ({
      ...r, skill: this.s.skills.get(r.skillId)?.title ?? 'Skill', owner: this.nameOf(r.ownerId), requester: this.nameOf(r.requesterId),
      incoming: r.ownerId === me.id,
    });
    const all = this.s.skillRequests.all().filter((r) => r.ownerId === me.id || r.requesterId === me.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return all.map(view);
  }

  requestSkill(actorId: Id, skillId: Id, input: { date?: unknown; note?: unknown }) {
    const me = this.member(actorId);
    const s = this.s.skills.get(skillId);
    if (!s || s.precinctId !== me.precinctId || !s.active) fail('not_found', 'Skill not found');
    if (s!.ownerId === me.id) fail('invalid', 'That is your own skill');
    const date = isoDay(input.date, 'Date');
    if (date < this.today()) fail('invalid', 'Pick a date from today');
    const note = cleanText(input.note, 'Note', 200, false);
    assertMoneyFree(note);
    if (this.s.skillRequests.all().some((r) => r.skillId === skillId && r.requesterId === me.id && ['requested', 'accepted'].includes(r.status))) fail('conflict', 'You already asked for this');
    const r = { id: newId('sreq'), skillId, ownerId: s!.ownerId, requesterId: me.id, date, note, status: 'requested' as const, stars: null, feedback: '', createdAt: this.now() };
    this.s.skillRequests.insert(r);
    this.notify([s!.ownerId], `${me.firstName} asked for “${s!.title}” on ${date}`, 'share:skills', me.precinctId);
    return r;
  }

  respondSkill(actorId: Id, id: Id, accept: boolean) {
    const me = this.member(actorId);
    const r = this.s.skillRequests.get(id);
    if (!r || r.ownerId !== me.id || r.status !== 'requested') fail('not_found', 'Request not found');
    const next = this.s.skillRequests.update(id, { status: accept ? 'accepted' : 'declined' });
    this.notify([r!.requesterId], accept ? `${me.firstName} said yes for ${r!.date}` : `${me.firstName} can’t do that date`, 'share:skills', me.precinctId);
    return next;
  }

  completeSkill(actorId: Id, id: Id, input: { stars?: unknown; feedback?: unknown }) {
    const me = this.member(actorId);
    const r = this.s.skillRequests.get(id);
    if (!r || r.requesterId !== me.id) fail('not_found', 'Request not found');
    if (r!.status !== 'accepted') fail('conflict', 'This exchange is not confirmed yet');
    const stars = Number(input.stars ?? 5);
    if (!Number.isInteger(stars) || stars < 1 || stars > 5) fail('invalid', 'Stars must be 1 to 5');
    const feedback = cleanText(input.feedback, 'Feedback', 300, false);
    const next = this.s.skillRequests.update(id, { status: 'completed', stars, feedback });
    const skill = this.s.skills.get(r!.skillId);
    this.award(r!.ownerId, POINTS.skillShared, `Shared a skill: ${skill?.title ?? ''}`);
    this.notify([r!.ownerId], `${me.firstName} says thanks for “${skill?.title}”${feedback ? `: ${feedback}` : ''}`, 'share:skills', me.precinctId);
    return next;
  }

  cancelSkill(actorId: Id, id: Id) {
    const r = this.s.skillRequests.get(id);
    if (!r || r.requesterId !== actorId || !['requested', 'accepted'].includes(r.status)) fail('not_found', 'Request not found');
    return this.s.skillRequests.update(id, { status: 'cancelled' });
  }
}
