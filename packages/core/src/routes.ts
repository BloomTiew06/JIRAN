import type { Jiran } from './service/jiran.ts';
import { DEMO_PERSONAS } from './seed.ts';
import { ACTIVITIES, APP_LANGS, AVATAR_COLORS, HOUSE_COLORS, INTERESTS, LANGUAGES, TIME_SLOTS } from './rules.ts';
import { ACTIVITY_CATEGORIES } from './service/groups.ts';

/**
 * One route table for the whole API. The Fastify server registers these, and
 * the web app's offline demo runs the very same table in the browser.
 */

export type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export interface RouteCtx {
  svc: Jiran;
  actorId: string;
  params: Record<string, string>;
  query: Record<string, string>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any;
}

export interface RouteDef {
  method: Method;
  path: string;
  /** 'public' needs no sign-in; 'signin' returns a resident to issue a token for */
  access: 'public' | 'signin' | 'resident';
  run: (ctx: RouteCtx) => unknown;
}

const r = (method: Method, path: string, run: RouteDef['run'], access: RouteDef['access'] = 'resident'): RouteDef => ({ method, path, access, run });

export const ROUTES: RouteDef[] = [
  r('GET', '/api/health', () => ({ ok: true, service: 'jiran' }), 'public'),
  r('GET', '/api/auth/personas', () => DEMO_PERSONAS, 'public'),
  r('GET', '/api/options', () => ({ interests: INTERESTS, activities: ACTIVITIES, languages: LANGUAGES, timeSlots: TIME_SLOTS, appLangs: APP_LANGS, avatarColors: AVATAR_COLORS, houseColors: HOUSE_COLORS, activityCategories: ACTIVITY_CATEGORIES }), 'public'),
  r('POST', '/api/auth/handover', ({ svc, body }) => svc.signIn(body?.code), 'signin'),

  // Join and profile
  r('GET', '/api/me', ({ svc, actorId }) => svc.me(actorId)),
  r('POST', '/api/onboarding', ({ svc, actorId, body }) => svc.onboard(actorId, body ?? {})),
  r('PATCH', '/api/me', ({ svc, actorId, body }) => svc.updateProfile(actorId, body ?? {})),

  // Maps
  r('GET', '/api/township', ({ svc, actorId }) => svc.township(actorId)),
  r('GET', '/api/site', ({ svc, actorId }) => svc.site(actorId)),

  // Meet your neighbours
  r('GET', '/api/residents', ({ svc, actorId, query }) => svc.directory(actorId, query)),
  r('GET', '/api/residents/:id', ({ svc, actorId, params }) => svc.neighbour(actorId, params.id)),
  r('POST', '/api/residents/:id/dismiss', ({ svc, actorId, params }) => svc.dismiss(actorId, params.id)),
  r('GET', '/api/suggestions', ({ svc, actorId }) => svc.suggestions(actorId)),
  r('GET', '/api/partners', ({ svc, actorId, query }) => svc.partners(actorId, query)),
  r('GET', '/api/connections', ({ svc, actorId }) => svc.connections(actorId)),
  r('POST', '/api/connections', ({ svc, actorId, body }) => svc.requestConnection(actorId, String(body?.to ?? ''), body?.message)),
  r('POST', '/api/connections/:id/respond', ({ svc, actorId, params, body }) => svc.respondConnection(actorId, params.id, !!body?.accept)),
  r('POST', '/api/connections/:id/cancel', ({ svc, actorId, params }) => svc.cancelConnection(actorId, params.id)),
  r('GET', '/api/chats/:id', ({ svc, actorId, params }) => svc.thread(actorId, params.id)),
  r('POST', '/api/chats/:id', ({ svc, actorId, params, body }) => svc.sendMessage(actorId, params.id, body?.text)),

  // Groups
  r('GET', '/api/groups', ({ svc, actorId, query }) => svc.groups(actorId, query)),
  r('POST', '/api/groups', ({ svc, actorId, body }) => svc.createGroup(actorId, body ?? {})),
  r('GET', '/api/groups/:id', ({ svc, actorId, params }) => svc.group(actorId, params.id)),
  r('PATCH', '/api/groups/:id', ({ svc, actorId, params, body }) => svc.updateGroup(actorId, params.id, body ?? {})),
  r('POST', '/api/groups/:id/join', ({ svc, actorId, params }) => svc.joinGroup(actorId, params.id)),
  r('POST', '/api/groups/:id/leave', ({ svc, actorId, params }) => svc.leaveGroup(actorId, params.id)),
  r('POST', '/api/groups/:id/posts', ({ svc, actorId, params, body }) => svc.postToGroup(actorId, params.id, body?.text)),
  r('POST', '/api/groups/:id/members/:member', ({ svc, actorId, params, body }) => svc.manageMember(actorId, params.id, params.member, body?.action)),

  // Activities
  r('GET', '/api/activities', ({ svc, actorId, query }) => svc.activities(actorId, query)),
  r('GET', '/api/activities/mine', ({ svc, actorId }) => svc.myActivities(actorId)),
  r('GET', '/api/activities/suggested', ({ svc, actorId }) => svc.suggestedActivities(actorId)),
  r('POST', '/api/activities', ({ svc, actorId, body }) => svc.createActivity(actorId, body ?? {})),
  r('GET', '/api/activities/:id', ({ svc, actorId, params }) => svc.activity(actorId, params.id)),
  r('PATCH', '/api/activities/:id', ({ svc, actorId, params, body }) => svc.updateActivity(actorId, params.id, body ?? {})),
  r('POST', '/api/activities/:id/cancel', ({ svc, actorId, params }) => svc.cancelActivity(actorId, params.id)),
  r('POST', '/api/activities/:id/join', ({ svc, actorId, params }) => svc.joinActivity(actorId, params.id)),
  r('POST', '/api/activities/:id/leave', ({ svc, actorId, params }) => svc.leaveActivity(actorId, params.id)),

  // Borrow and lend, give-aways, skills
  r('GET', '/api/items', ({ svc, actorId, query }) => svc.items(actorId, query)),
  r('POST', '/api/items', ({ svc, actorId, body }) => svc.addItem(actorId, body ?? {})),
  r('GET', '/api/items/:id', ({ svc, actorId, params }) => svc.item(actorId, params.id)),
  r('PATCH', '/api/items/:id', ({ svc, actorId, params, body }) => svc.updateItem(actorId, params.id, body ?? {})),
  r('DELETE', '/api/items/:id', ({ svc, actorId, params }) => svc.removeItem(actorId, params.id)),
  r('POST', '/api/items/:id/loans', ({ svc, actorId, params, body }) => svc.requestLoan(actorId, params.id, body ?? {})),
  r('GET', '/api/loans', ({ svc, actorId }) => svc.loans(actorId)),
  r('POST', '/api/loans/:id/respond', ({ svc, actorId, params, body }) => svc.respondLoan(actorId, params.id, !!body?.accept)),
  r('POST', '/api/loans/:id/handover', ({ svc, actorId, params, body }) => svc.handover(actorId, params.id, body?.code)),
  r('POST', '/api/loans/:id/photo', ({ svc, actorId, params }) => svc.conditionPhoto(actorId, params.id)),
  r('POST', '/api/loans/:id/return', ({ svc, actorId, params }) => svc.confirmReturn(actorId, params.id)),
  r('POST', '/api/loans/:id/rate', ({ svc, actorId, params, body }) => svc.rateLoan(actorId, params.id, body?.stars)),
  r('POST', '/api/loans/:id/cancel', ({ svc, actorId, params }) => svc.cancelLoan(actorId, params.id)),
  r('GET', '/api/giveaways', ({ svc, actorId }) => svc.giveaways(actorId)),
  r('POST', '/api/giveaways', ({ svc, actorId, body }) => svc.addGiveaway(actorId, body ?? {})),
  r('POST', '/api/giveaways/:id/claim', ({ svc, actorId, params }) => svc.claimGiveaway(actorId, params.id)),
  r('GET', '/api/skills', ({ svc, actorId, query }) => svc.skills(actorId, query)),
  r('POST', '/api/skills', ({ svc, actorId, body }) => svc.addSkill(actorId, body ?? {})),
  r('PATCH', '/api/skills/:id', ({ svc, actorId, params, body }) => svc.setSkillActive(actorId, params.id, !!body?.active)),
  r('POST', '/api/skills/:id/requests', ({ svc, actorId, params, body }) => svc.requestSkill(actorId, params.id, body ?? {})),
  r('GET', '/api/skill-requests', ({ svc, actorId }) => svc.skillRequests(actorId)),
  r('POST', '/api/skill-requests/:id/respond', ({ svc, actorId, params, body }) => svc.respondSkill(actorId, params.id, !!body?.accept)),
  r('POST', '/api/skill-requests/:id/complete', ({ svc, actorId, params, body }) => svc.completeSkill(actorId, params.id, body ?? {})),
  r('POST', '/api/skill-requests/:id/cancel', ({ svc, actorId, params }) => svc.cancelSkill(actorId, params.id)),

  // Help, safety, watch my house, flood
  r('GET', '/api/help', ({ svc, actorId, query }) => svc.helpBoard(actorId, query)),
  r('POST', '/api/help', ({ svc, actorId, body }) => svc.askHelp(actorId, body ?? {})),
  r('POST', '/api/help/:id/respond', ({ svc, actorId, params, body }) => svc.respondHelp(actorId, params.id, body?.message)),
  r('POST', '/api/help/:id/confirm', ({ svc, actorId, params, body }) => svc.confirmHelper(actorId, params.id, String(body?.helperId ?? ''))),
  r('POST', '/api/help/:id/complete', ({ svc, actorId, params }) => svc.completeHelp(actorId, params.id)),
  r('POST', '/api/help/:id/cancel', ({ svc, actorId, params }) => svc.cancelHelp(actorId, params.id)),
  r('POST', '/api/help-offers', ({ svc, actorId, body }) => svc.addHelpOffer(actorId, body ?? {})),
  r('PATCH', '/api/help-offers/:id', ({ svc, actorId, params, body }) => svc.setOfferActive(actorId, params.id, !!body?.active)),
  r('GET', '/api/safety', ({ svc, actorId }) => svc.safety(actorId)),
  r('POST', '/api/contacts', ({ svc, actorId, body }) => svc.requestContact(actorId, String(body?.residentId ?? ''))),
  r('POST', '/api/contacts/:id/respond', ({ svc, actorId, params, body }) => svc.respondContact(actorId, params.id, !!body?.accept)),
  r('POST', '/api/sos', ({ svc, actorId }) => svc.sos(actorId)),
  r('DELETE', '/api/sos', ({ svc, actorId }) => svc.cancelSos(actorId)),
  r('POST', '/api/watches', ({ svc, actorId, body }) => svc.requestWatch(actorId, body ?? {})),
  r('POST', '/api/watches/:id/respond', ({ svc, actorId, params, body }) => svc.respondWatch(actorId, params.id, !!body?.accept)),
  r('POST', '/api/watches/:id/done', ({ svc, actorId, params }) => svc.completeWatch(actorId, params.id)),
  r('GET', '/api/flood', ({ svc, actorId }) => svc.floodBoard(actorId)),
  r('POST', '/api/flood/checkin', ({ svc, actorId, body }) => svc.floodCheckin(actorId, body ?? {})),

  // New neighbour welcome
  r('GET', '/api/guide', ({ svc, actorId }) => svc.guide(actorId)),
  r('POST', '/api/guide/seen', ({ svc, actorId }) => svc.markGuideSeen(actorId)),
  r('PUT', '/api/intro', ({ svc, actorId, body }) => svc.saveIntro(actorId, body ?? {})),
  r('GET', '/api/newcomers', ({ svc, actorId }) => svc.newcomers(actorId)),
  r('POST', '/api/newcomers/:id/welcome', ({ svc, actorId, params }) => svc.welcome(actorId, params.id)),
  r('GET', '/api/buddies', ({ svc, actorId }) => svc.buddies(actorId)),
  r('PUT', '/api/buddies/volunteer', ({ svc, actorId, body }) => svc.setBuddy(actorId, !!body?.on)),
  r('POST', '/api/buddies', ({ svc, actorId, body }) => svc.requestBuddy(actorId, String(body?.buddyId ?? ''))),
  r('POST', '/api/buddies/:id/respond', ({ svc, actorId, params, body }) => svc.respondBuddy(actorId, params.id, !!body?.accept)),
  r('POST', '/api/buddies/:id/end', ({ svc, actorId, params }) => svc.endBuddy(actorId, params.id)),
  r('GET', '/api/recommendations', ({ svc, actorId }) => svc.recommendations(actorId)),
  r('GET', '/api/checklist', ({ svc, actorId }) => svc.checklist(actorId)),

  // Noticeboard, notifications, points
  r('GET', '/api/notices', ({ svc, actorId }) => svc.notices(actorId)),
  r('POST', '/api/notices', ({ svc, actorId, body }) => svc.postNotice(actorId, body ?? {})),
  r('POST', '/api/notices/:id/resolve', ({ svc, actorId, params }) => svc.resolveNotice(actorId, params.id)),
  r('GET', '/api/notifications', ({ svc, actorId }) => svc.notifications(actorId)),
  r('POST', '/api/notifications/read', ({ svc, actorId }) => svc.markNotificationsRead(actorId)),
  r('GET', '/api/progress', ({ svc, actorId }) => svc.progress(actorId)),
  r('PUT', '/api/decor/:key', ({ svc, actorId, params, body }) => svc.setDecor(actorId, params.key, !!body?.on)),

  // SDP community team
  r('GET', '/api/admin/dashboard', ({ svc, actorId }) => svc.dashboard(actorId)),
  r('POST', '/api/admin/flood-alerts', ({ svc, actorId, body }) => svc.issueFloodAlert(actorId, body ?? {})),
  r('DELETE', '/api/admin/flood-alerts', ({ svc, actorId }) => svc.endFloodAlert(actorId)),
];

export function matchRoute(method: string, path: string): { route: RouteDef; params: Record<string, string>; query: Record<string, string> } | null {
  const [rawPath, rawQuery = ''] = path.split('?');
  const clean = rawPath.replace(/\/+$/, '');
  const query: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(rawQuery)) query[k] = v;
  for (const route of ROUTES) {
    if (route.method !== method.toUpperCase()) continue;
    const a = route.path.split('/');
    const b = clean.split('/');
    if (a.length !== b.length) continue;
    const params: Record<string, string> = {};
    let ok = true;
    for (let i = 0; i < a.length; i++) {
      if (a[i].startsWith(':')) params[a[i].slice(1)] = decodeURIComponent(b[i]);
      else if (a[i] !== b[i]) { ok = false; break; }
    }
    if (ok) return { route, params, query };
  }
  return null;
}

export const HTTP_STATUS: Record<string, number> = {
  invalid: 400, money_free: 422, unauthorised: 401, forbidden: 403, not_found: 404, conflict: 409,
};
