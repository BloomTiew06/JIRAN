import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { seedStore } from '@jiran/core';
import { buildApp } from '../src/app.ts';
import { openSqliteStore } from '../src/sqliteStore.ts';

const NOW = new Date('2026-10-16T02:00:00.000Z');

async function setup() {
  const { app } = buildApp({ store: seedStore(), secret: 'test-secret', now: () => NOW });
  await app.ready();
  const login = async (code: string) => {
    const res = await app.inject({ method: 'POST', url: '/api/auth/handover', payload: { code } });
    assert.equal(res.statusCode, 200, res.body);
    return res.json().token as string;
  };
  const call = async (token: string, method: string, url: string, payload?: unknown) => {
    const res = await app.inject({ method: method as 'GET', url, payload: payload as object, headers: { authorization: `Bearer ${token}` } });
    return { status: res.statusCode, body: res.body ? res.json() : null };
  };
  return { app, login, call };
}

test('Adira site plan has the 109 lots from SDP’s Series 1 facts', async () => {
  const { login, call } = await setup();
  const hana = await login('ADIRA-212');
  const site = await call(hana, 'GET', '/api/site');
  assert.equal(site.status, 200);
  const lots = site.body.lots as { type: string; w: number; h: number; resident: { firstName: string } | null }[];
  assert.equal(lots.length, 109);
  assert.equal(lots.filter((l) => l.type === 'intermediate').length, 85);
  assert.equal(lots.filter((l) => l.type === 'end').length, 14);
  assert.equal(lots.filter((l) => l.type === 'corner').length, 10);
  assert.ok(lots.filter((l) => l.type === 'intermediate').every((l) => l.w === 20 && l.h === 75));
  assert.equal(site.body.amenities.length, 16);
  assert.ok(lots.some((l) => l.resident?.firstName === 'Hana'));
});

test('the SDP team can open the Adira site plan, but sees homes only, never residents', async () => {
  const { login, call } = await setup();
  const sdp = await login('SDP-ADMIN');
  const site = await call(sdp, 'GET', '/api/site');
  assert.equal(site.status, 200);
  const lots = site.body.lots as { resident: unknown; joined: boolean | null; paint: string | null }[];
  assert.equal(lots.length, 109);
  assert.ok(lots.every((l) => l.resident === null));
  assert.ok(!JSON.stringify(site.body).includes('"firstName"'));
  const joined = lots.filter((l) => l.joined).length;
  assert.ok(joined > 0);
  assert.equal(site.body.stats.onJiran, joined);
  assert.equal(site.body.staff, true);
});

test('joining needs PDPA consent and 18+, then the profile is live', async () => {
  const { login, call } = await setup();
  const irfan = await login('ADIRA-120');
  assert.equal((await call(irfan, 'GET', '/api/residents')).status, 403, 'not joined yet');
  assert.equal((await call(irfan, 'POST', '/api/onboarding', { firstName: 'Irfan', adult: true })).status, 400);
  const ok = await call(irfan, 'POST', '/api/onboarding', {
    firstName: 'Irfan', adult: true, consent: true, avatar: '#CFE3FF', houseColor: '#2FA59A', bio: 'Just got my keys!',
    interests: ['Badminton', 'Gaming'], activities: ['Badminton'], languages: ['Bahasa Malaysia', 'English'], availability: ['weekday-evening'], lang: 'ms',
  });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(ok.body.points, 70, 'joined 50 + profile complete 20');
  assert.equal(ok.body.lang, 'ms');
  assert.equal((await call(irfan, 'POST', '/api/onboarding', { adult: true, consent: true })).status, 409);
  const bad = await call(irfan, 'PATCH', '/api/me', { interests: ['Skydiving'] });
  assert.equal(bad.status, 400);

  const hana = await login('ADIRA-212');
  const sug = await call(hana, 'GET', '/api/suggestions');
  assert.ok(sug.body.newcomers.some((p: { id: string }) => p.id === 'irfan'), 'new residents are suggested');
  const irfanCard = await call(hana, 'GET', '/api/residents/irfan');
  assert.ok(irfanCard.body.reasons.some((r: string) => r.includes('Badminton')), 'match explains why');
  assert.ok(sug.body.similar.every((p: { reasons: string[] }) => p.reasons.length > 0));
});

test('privacy: names stay in the precinct, and hidden profiles stay hidden', async () => {
  const { login, call } = await setup();
  const hana = await login('ADIRA-212');
  const town = await call(hana, 'GET', '/api/township');
  assert.equal(JSON.stringify(town.body.precincts).includes('firstName'), false);
  assert.equal((await call(hana, 'GET', '/api/residents/lyra-r0')).status, 403);
  const ravi = await login('ADIRA-211');
  await call(ravi, 'PATCH', '/api/me', { privacy: { directory: false } });
  const dir = await call(hana, 'GET', '/api/residents');
  assert.equal(dir.body.some((p: { id: string }) => p.id === 'ravi'), false);
});

test('directory search, filters and activity partners', async () => {
  const { login, call } = await setup();
  const hana = await login('ADIRA-212');
  const badminton = await call(hana, 'GET', '/api/residents?interest=Badminton');
  const ids = badminton.body.map((p: { id: string }) => p.id);
  assert.ok(ids.includes('jason') && ids.includes('farid'));
  const byName = await call(hana, 'GET', '/api/residents?q=ravi');
  assert.equal(byName.body[0].id, 'ravi');
  const bySkill = await call(hana, 'GET', '/api/residents?skill=wifi');
  assert.equal(bySkill.body[0].id, 'thanesh');
  const partners = await call(hana, 'GET', '/api/partners?activity=Badminton&slot=weekday-evening');
  assert.ok(partners.body.some((p: { id: string }) => p.id === 'jason'));
  assert.equal((await call(hana, 'GET', '/api/partners?activity=Skydiving')).status, 400);
});

test('connections: accept, chat only when connected, cancel', async () => {
  const { login, call } = await setup();
  const hana = await login('ADIRA-212');
  const conns = await call(hana, 'GET', '/api/connections');
  const fromAisyah = conns.body.incoming.find((c: { person: { id: string } }) => c.person.id === 'aisyah');
  assert.ok(fromAisyah.message.includes('two doors'));
  assert.equal((await call(hana, 'GET', '/api/chats/aisyah')).status, 403, 'chat locked before accepting');
  assert.equal((await call(hana, 'POST', `/api/connections/${fromAisyah.id}/respond`, { accept: true })).body.state, 'connected');
  assert.equal((await call(hana, 'POST', '/api/chats/aisyah', { text: 'Hi Aisyah! Playground Saturday?' })).status, 200);
  const aisyah = await login('ADIRA-208');
  const thread = await call(aisyah, 'GET', '/api/chats/hana');
  assert.equal(thread.body.messages.at(-1).text, 'Hi Aisyah! Playground Saturday?');
  const notes = await call(aisyah, 'GET', '/api/notifications');
  assert.ok(notes.body.items.some((n: { text: string }) => n.text.startsWith('Hana')));

  const req = await call(hana, 'POST', '/api/connections', { to: 'priya', message: 'Love your kolam!' });
  assert.equal(req.body.state, 'outgoing');
  assert.equal((await call(hana, 'POST', '/api/connections', { to: 'priya' })).status, 409);
  assert.equal((await call(hana, 'POST', `/api/connections/${req.body.id}/cancel`)).body.status, 'cancelled');
});

test('interest groups: join, discuss, manage, leave', async () => {
  const { login, call } = await setup();
  const hana = await login('ADIRA-212');
  const ravi = await login('ADIRA-211');
  assert.equal((await call(ravi, 'POST', '/api/groups/g-bakers/posts', { text: 'Hello' })).status, 403);
  assert.equal((await call(ravi, 'POST', '/api/groups/g-bakers/join')).body.joined, true);
  assert.equal((await call(ravi, 'POST', '/api/groups/g-bakers/posts', { text: 'Any eggless recipes?' })).status, 200);
  const g = await call(ravi, 'GET', '/api/groups/g-bakers');
  assert.equal(g.body.posts[0].text, 'Any eggless recipes?');
  assert.equal((await call(hana, 'POST', '/api/groups/g-bakers/members/ravi', { action: 'remove' })).status, 403, 'only admins manage');
  const meiling = await login('ADIRA-209');
  assert.equal((await call(meiling, 'POST', '/api/groups/g-bakers/members/ravi', { action: 'make_admin' })).body.members.find((m: { id: string }) => m.id === 'ravi').isAdmin, true);
  const mine = await call(hana, 'POST', '/api/groups', { name: 'Sunset Yoga', category: 'Yoga', description: 'Linear park, Fridays' });
  assert.equal(mine.body.isOrganiser, true);
  assert.equal((await call(ravi, 'POST', '/api/groups/g-bakers/leave')).body.joined, false);
});

test('activities: capacity, cancel, my activities and suggestions', async () => {
  const { login, call } = await setup();
  const hana = await login('ADIRA-212');
  const ravi = await login('ADIRA-211');
  const farid = await login('ADIRA-214');
  const made = await call(hana, 'POST', '/api/activities', { title: 'Plant swap', category: 'social', placeId: 'adira-pavilion', startsAt: '2026-10-20T10:00:00Z', capacity: 2 });
  assert.equal(made.status, 200, JSON.stringify(made.body));
  assert.equal(made.body.earned, 10);
  assert.equal((await call(ravi, 'POST', `/api/activities/${made.body.id}/join`)).body.going, 2);
  assert.equal((await call(farid, 'POST', `/api/activities/${made.body.id}/join`)).status, 409, 'full');
  const detail = await call(hana, 'GET', `/api/activities/${made.body.id}`);
  assert.deepEqual(detail.body.participants.map((p: { firstName: string }) => p.firstName), ['Hana', 'Ravi']);
  assert.equal((await call(hana, 'POST', `/api/activities/${made.body.id}/cancel`)).body.status, 'cancelled');
  assert.ok((await call(ravi, 'GET', '/api/notifications')).body.items.some((n: { text: string }) => n.text.includes('cancelled')));
  const search = await call(hana, 'GET', '/api/activities?q=badminton');
  assert.equal(search.body[0].id, 'a-badminton');
  const sport = await call(hana, 'GET', '/api/activities?category=sport&from=2026-10-20&to=2026-10-31');
  assert.ok(sport.body.every((a: { category: string }) => a.category === 'sport'));
  assert.ok((await call(hana, 'GET', '/api/activities/mine')).body.created.length >= 1);
  assert.ok((await call(hana, 'GET', '/api/activities/suggested')).body.some((a: { id: string }) => a.id === 'a-badminton'));
});

test('borrow and lend with dates, statuses and the money-free rule', async () => {
  const { login, call } = await setup();
  const hana = await login('ADIRA-212');
  const aisyah = await login('ADIRA-208');
  const found = await call(hana, 'GET', '/api/items?q=drill&available=true');
  assert.equal(found.body[0].id, 'i-drill');
  assert.equal((await call(hana, 'POST', '/api/items/i-drill/loans', { startDate: '2026-10-17', endDate: '2026-10-25' })).status, 400, 'longer than the owner allows');
  const req = await call(hana, 'POST', '/api/items/i-drill/loans', { startDate: '2026-10-17', endDate: '2026-10-18' });
  assert.equal(req.body.statusLabel, 'Pending approval');
  assert.equal((await call(aisyah, 'POST', `/api/loans/${req.body.id}/respond`, { accept: true })).body.statusLabel, 'Approved');
  assert.equal((await call(aisyah, 'POST', `/api/loans/${req.body.id}/handover`, { code: req.body.handoverCode })).body.statusLabel, 'Borrowed');
  assert.equal((await call(aisyah, 'POST', `/api/loans/${req.body.id}/return`)).body.statusLabel, 'Returned');
  assert.equal((await call(hana, 'POST', `/api/loans/${req.body.id}/rate`, { stars: 5 })).body.earned, 10);
  assert.ok((await call(hana, 'GET', '/api/loans')).body.history.some((l: { id: string }) => l.id === req.body.id));
  for (const title of ['Drill RM5 a day', 'Ladder for rent', 'Sewa khemah']) {
    assert.equal((await call(hana, 'POST', '/api/items', { title })).status, 422, title);
  }
  const siewhui = await login('ADIRA-207');
  const rem = await call(siewhui, 'GET', '/api/notifications');
  assert.ok(rem.body.reminders.some((r: { text: string }) => r.text.includes('ladder')), 'return reminder');
});

test('skills exchange is free or a swap, never paid', async () => {
  const { login, call } = await setup();
  const hana = await login('ADIRA-212');
  assert.equal((await call(hana, 'POST', '/api/skills', { title: 'Piano lessons', arrangement: 'paid' })).status, 422);
  const mine = await call(hana, 'POST', '/api/skills', { title: 'Sourdough starter', category: 'cooking', arrangement: 'swap', swapFor: 'Help with my laptop' });
  assert.equal(mine.body.arrangement, 'swap');
  const req = await call(hana, 'POST', '/api/skills/s-wifi/requests', { date: '2026-10-18', note: 'New router' });
  const thanesh = await login('ADIRA-217');
  const before = (await call(thanesh, 'GET', '/api/me')).body.points;
  await call(thanesh, 'POST', `/api/skill-requests/${req.body.id}/respond`, { accept: true });
  const done = await call(hana, 'POST', `/api/skill-requests/${req.body.id}/complete`, { stars: 5, feedback: 'Wifi is flying now' });
  assert.equal(done.body.status, 'completed');
  assert.equal((await call(thanesh, 'GET', '/api/me')).body.points - before, 15);
});

test('help requests move from open to response received to completed', async () => {
  const { login, call } = await setup();
  const hana = await login('ADIRA-212');
  const ravi = await login('ADIRA-211');
  const h = await call(hana, 'POST', '/api/help', { title: 'Carry a sofa upstairs', category: 'carry', description: '10 minutes', preferredAt: '2026-10-17T10:00:00Z', resources: 'Gloves' });
  assert.equal(h.body.statusLabel, 'Open');
  assert.equal((await call(ravi, 'POST', `/api/help/${h.body.id}/respond`, { message: 'On my way after lunch' })).status, 200);
  const mine = (await call(hana, 'GET', '/api/help')).body.mine.find((x: { id: string }) => x.id === h.body.id);
  assert.equal(mine.statusLabel, 'Response received');
  assert.equal(mine.responses[0].name, 'Ravi');
  assert.equal((await call(hana, 'POST', `/api/help/${h.body.id}/confirm`, { helperId: 'ravi' })).body.statusLabel, 'Assistance confirmed');
  assert.equal((await call(hana, 'POST', `/api/help/${h.body.id}/complete`)).body.statusLabel, 'Completed');
  assert.equal((await call(hana, 'POST', '/api/help', { title: 'Need help, will pay RM20' })).status, 422);
});

test('watch my house, neighbour contacts and SOS', async () => {
  const { login, call } = await setup();
  const hana = await login('ADIRA-212');
  const safety = await call(hana, 'GET', '/api/safety');
  const w = safety.body.watches.find((x: { asWatcher: boolean }) => x.asWatcher);
  assert.equal((await call(hana, 'POST', `/api/watches/${w.id}/respond`, { accept: true })).body.status, 'accepted');
  assert.equal((await call(hana, 'POST', '/api/watches', { watcherId: 'priya', from: '2026-10-20', to: '2026-10-22' })).status, 403, 'only connected neighbours');
  assert.equal((await call(hana, 'POST', '/api/watches', { watcherId: 'ravi', from: '2026-10-20', to: '2026-10-22', note: 'Back Thursday' })).status, 200);
  const sos = await call(hana, 'POST', '/api/sos');
  assert.deepEqual([...sos.body.notified].sort(), ['farid', 'ravi']);
  const ravi = await login('ADIRA-211');
  assert.equal((await call(ravi, 'GET', '/api/safety')).body.alertsForMe[0].from, 'Hana');
});

test('welcome: guide, introduction, buddy and checklist', async () => {
  const { login, call } = await setup();
  const irfan = await login('ADIRA-120');
  await call(irfan, 'POST', '/api/onboarding', { firstName: 'Irfan', adult: true, consent: true, interests: ['Gardening'], activities: ['Gardening'] });
  const guide = await call(irfan, 'GET', '/api/guide');
  assert.ok(guide.body.contacts.some((c: { value: string }) => c.value === '999'));
  assert.equal((await call(irfan, 'PUT', '/api/intro', { text: guide.body.introTemplate, publish: true })).status, 400, 'template placeholders must be filled');
  assert.ok((await call(irfan, 'PUT', '/api/intro', { text: 'Hi Adira! Irfan at No. 20, Jalan Adira 1.', publish: true })).body.publishedAt);
  await call(irfan, 'POST', '/api/guide/seen');
  const hana = await login('ADIRA-212');
  assert.equal((await call(hana, 'POST', '/api/newcomers/irfan/welcome')).body.earned, 5);
  const buddy = await call(irfan, 'POST', '/api/buddies', { buddyId: 'aminah' });
  const aminah = await login('ADIRA-210');
  await call(aminah, 'POST', `/api/buddies/${buddy.body.id}/respond`, { accept: true });
  assert.equal((await call(irfan, 'GET', '/api/chats/aminah')).status, 200, 'buddies can chat');
  const list = await call(irfan, 'GET', '/api/checklist');
  assert.equal(list.body.steps.find((s: { id: string }) => s.id === 'guide').done, true);
  assert.equal(list.body.steps.find((s: { id: string }) => s.id === 'connect').done, true);
  const recs = await call(irfan, 'GET', '/api/recommendations');
  assert.ok(recs.body.groups.some((g: { id: string }) => g.id === 'g-garden'));
});

test('noticeboard, flood check-in and the anonymised dashboard', async () => {
  const { login, call } = await setup();
  const hana = await login('ADIRA-212');
  const sdp = await login('SDP-ADMIN');
  assert.equal((await call(hana, 'POST', '/api/notices', { kind: 'announcement', title: 'Hi' })).status, 403);
  assert.equal((await call(hana, 'POST', '/api/notices', { kind: 'found', title: 'Found: house keys near the court' })).status, 200);
  await call(sdp, 'POST', '/api/admin/flood-alerts', { level: 'warning' });
  assert.equal((await call(hana, 'POST', '/api/flood/checkin', { status: 'need_help', note: 'Car needs moving' })).status, 200);
  const ravi = await login('ADIRA-211');
  assert.ok((await call(ravi, 'GET', '/api/notifications')).body.items.some((n: { text: string }) => n.text.includes('needs help')), 'connections hear about it');
  const site = await call(hana, 'GET', '/api/site');
  assert.equal(site.body.lots.find((l: { resident: { id: string } | null }) => l.resident?.id === 'hana').flood, 'need_help');
  const dash = await call(sdp, 'GET', '/api/admin/dashboard');
  const adira = dash.body.precincts.find((p: { id: string }) => p.id === 'adira');
  assert.equal(adira.floodNeedHelp, 1);
  assert.equal(JSON.stringify(dash.body).includes('Hana'), false);
});

test('festive decorations appear in season', async () => {
  const { login, call } = await setup();
  const hana = await login('ADIRA-212');
  const p = await call(hana, 'GET', '/api/progress');
  assert.equal(p.body.season.id, 'deepavali');
  assert.equal(p.body.decor.find((d: { key: string }) => d.key === 'festive').unlocked, true);
  assert.equal((await call(hana, 'PUT', '/api/decor/porchCat', { on: true })).status, 403);
});

test('SQLite store persists between restarts', () => {
  const file = join(mkdtempSync(join(tmpdir(), 'jiran-')), 'test.sqlite');
  const first = openSqliteStore(file);
  const count = first.residents.all().length;
  assert.ok(count > 100);
  first.notices.insert({ id: 'n-test', precinctId: 'adira', authorId: 'hana', kind: 'general', title: 'Test', body: '', resolved: false, at: NOW.toISOString() });
  const second = openSqliteStore(file);
  assert.equal(second.residents.all().length, count, 'seed only runs once');
  assert.equal(second.notices.get('n-test')?.title, 'Test');
});
