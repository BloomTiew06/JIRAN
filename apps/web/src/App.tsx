import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createApi, storage, UI_KEY, type Api, type Me, type Options } from './api.ts';
import { translator } from './i18n.ts';
import { Icon, type IconName } from './icons.tsx';
import { ActivitiesScreen } from './screens/Activities.tsx';
import { FloodScreen } from './screens/Flood.tsx';
import { HelpScreen } from './screens/Help.tsx';
import { GuidePage, IntroPage, MeScreen } from './screens/Me.tsx';
import { NeighboursScreen } from './screens/Neighbours.tsx';
import { Onboarding } from './screens/Onboarding.tsx';
import { ActivityPage, ChatPage, GroupPage, NeighbourPage, NotificationsPage } from './screens/Overlays.tsx';
import { ShareScreen } from './screens/Share.tsx';
import { SignIn } from './screens/SignIn.tsx';
import { SiteMap } from './screens/SiteMap.tsx';
import { TownshipScreen } from './screens/Township.tsx';
import { Street3D } from './street3d/Street3D.tsx';
import { hasWebGL } from './street3d/scene.ts';
import { Tooltips } from './tooltips.tsx';
import { Avatar, Ctx, type AppCtx, type Overlay, type Tab } from './ui.tsx';

interface Toast { id: number; msg: string; tone: 'ok' | 'warn' | 'points' }

const TABS: { id: Tab; key: string; icon: IconName }[] = [
  { id: 'map', key: 'tab.map', icon: 'map' },
  { id: 'neighbours', key: 'tab.neighbours', icon: 'users' },
  { id: 'share', key: 'tab.share', icon: 'box' },
  { id: 'activities', key: 'tab.activities', icon: 'calendar' },
  { id: 'help', key: 'tab.help', icon: 'heart' },
];

type MapLevel = 'street' | 'site' | 'township';
/** The tab and map level you were last on, so a reload or app update carries on where you left off. */
function savedUi(): { tab?: Tab; mapLevel?: MapLevel } {
  try { return JSON.parse(storage.get(UI_KEY) ?? '{}') ?? {}; } catch { return {}; }
}

const OVERLAYS = ['neighbour', 'chat', 'group', 'activity', 'guide', 'notifications', 'flood', 'intro'];

export function App() {
  const [api, setApi] = useState<Api | null>(null);
  const [options, setOptions] = useState<Options | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [onboarding, setOnboarding] = useState(false);
  const [tab, setTab] = useState<Tab>(() => savedUi().tab ?? 'map');
  const [section, setSection] = useState<string | null>(null);
  const [mapLevel, setMapLevel] = useState<MapLevel>(() => {
    const saved = savedUi().mapLevel;
    if (saved === 'street') return hasWebGL() ? 'street' : 'site';
    return saved ?? (hasWebGL() ? 'street' : 'site');
  });
  useEffect(() => { storage.set(UI_KEY, JSON.stringify({ tab, mapLevel })); }, [tab, mapLevel]);
  const nearLevel = () => (hasWebGL() ? 'street' : 'site') as 'street' | 'site';
  const [overlays, setOverlays] = useState<Overlay[]>([]);
  const [bump, setBump] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const tid = useRef(0);

  const toast = useCallback((msg: string, tone: Toast['tone'] = 'ok') => {
    const id = ++tid.current;
    setToasts((t) => [...t.slice(-2), { id, msg, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3400);
  }, []);

  useEffect(() => {
    createApi().then(async (a) => {
      setOptions(await a.get<Options>('/api/options'));
      const saved = storage.get(`jiran-token-${a.mode}`);
      if (saved) a.setToken(saved);
      setApi(a);
      if (saved) {
        a.get<Me>('/api/me').then((m) => { setMe(m); setOnboarding(!m.onboarded); })
          .catch(() => { a.setToken(null); storage.set(`jiran-token-${a.mode}`, null); });
      }
    });
  }, []);

  const signInWith = useCallback(async (code: string) => {
    if (!api) return;
    setBusy(true);
    setAuthError(null);
    try {
      const r = await api.send<{ token: string; me: Me }>('POST', '/api/auth/handover', { code });
      api.setToken(r.token);
      storage.set(`jiran-token-${api.mode}`, r.token);
      setMe(r.me);
      setOnboarding(!r.me.onboarded);
      setTab('map');
      setSection(null);
      setOverlays([]);
      setMapLevel(r.me.isAdmin ? 'township' : nearLevel());
    } catch (e) {
      setAuthError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [api]);

  // Refresh "me" (points, unread, flood alert) whenever anything changes.
  useEffect(() => {
    if (!api || !me) return;
    api.get<Me>('/api/me').then(setMe).catch(() => {});
  }, [bump]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live updates from the backend (or the in-browser demo backend).
  useEffect(() => {
    if (!api || !me) return;
    return api.subscribe((e) => {
      if ((e.personal && e.type !== 'points') || e.type === 'flood_alert') toast(e.message, e.type === 'flood_alert' ? 'warn' : 'ok');
      if (e.type === 'flood_alert' && !me.isAdmin) setOverlays((o) => [...o, { kind: 'flood' }]);
      setBump((b) => b + 1);
    });
  }, [api, me?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = useCallback((link: string) => {
    const [head, ...rest] = link.split(':');
    const tail = rest.join(':') || null;
    if (OVERLAYS.includes(head)) {
      setOverlays((o) => [...o, { kind: head as Overlay['kind'], id: tail ?? undefined }]);
      return;
    }
    if (head === 'me' && tail === 'guide') { setOverlays((o) => [...o, { kind: 'guide' }]); return; }
    setOverlays([]);
    const t = (['map', 'neighbours', 'share', 'activities', 'help', 'me'] as Tab[]).includes(head as Tab) ? (head as Tab) : 'map';
    setTab(t);
    setSection(tail ? `${tail}` : null);
    // Re-trigger the same section if asked twice.
    if (tail) setTimeout(() => setSection(tail), 0);
  }, []);

  const ctx: AppCtx | null = useMemo(() => (api && me && options ? {
    api, me, options, bump, toast, go, tab, section, focus: section,
    refresh: () => setBump((b) => b + 1),
    open: (o: Overlay) => setOverlays((s) => [...s, o]),
    close: () => setOverlays((s) => s.slice(0, -1)),
    signOut: () => { api.setToken(null); storage.set(`jiran-token-${api.mode}`, null); setMe(null); setOverlays([]); },
    switchTo: (code: string) => { signInWith(code); },
    t: translator(me.lang),
  } : null), [api, me, options, bump, toast, go, tab, section, signInWith]);

  if (!api || !options) return <div className="phone"><div className="map-loading">Opening JIRAN…</div></div>;

  const top = overlays[overlays.length - 1];
  const t = ctx?.t ?? translator('en');

  return (
    <div className="phone">
      <div className="host-bar">
        <span className="sdp-mark" aria-hidden="true">SDP</span>
        <span className="grow">Sime Darby Property <span className="muted">› JIRAN</span></span>
        {api.mode === 'demo' && <span className="demo-pill">Demo data</span>}
        {ctx && !onboarding && (
          <>
            <button className="icon-btn" onClick={() => go('notifications')} aria-label={`${t('notifications')}${ctx.me.unread ? `, ${ctx.me.unread} unread` : ''}`}>
              <Icon name="bell" />{ctx.me.unread > 0 && <span className="dot-count">{ctx.me.unread > 9 ? '9+' : ctx.me.unread}</span>}
            </button>
            <button className="icon-btn" onClick={() => go('me')} aria-label={t('tab.me')}>
              <Avatar name={ctx.me.firstName} color={ctx.me.avatar} photo={ctx.me.photo} size={30} />
            </button>
          </>
        )}
      </div>
      {!ctx ? (
        <SignIn onCode={signInWith} error={authError} busy={busy} mode={api.mode}
          restored={!!api.restored} onReset={api.resetDemo ? () => { api.resetDemo?.(); location.reload(); } : undefined} />
      ) : (
        <Ctx.Provider value={ctx}>
          {onboarding ? (
            <Onboarding onDone={(m) => { setMe(m); setOnboarding(false); setTab('map'); setMapLevel(nearLevel()); }} />
          ) : (
            <>
              <main className="content">
                {tab === 'map' && (() => {
                  const hasSite = ctx.me.precinct.id === 'adira' && !ctx.me.isAdmin;
                  const level = hasSite ? mapLevel : 'township';
                  return (
                    <div className="map-level" key={level}>
                      {level === 'street' && ctx.me.unitId && <Street3D onFloorPlan={() => setMapLevel('site')} onTownship={() => setMapLevel('township')} />}
                      {(level === 'site' || (level === 'street' && !ctx.me.unitId)) && <SiteMap onStreet={() => setMapLevel('street')} onTownship={() => setMapLevel('township')} />}
                      {level === 'township' && <TownshipScreen onOpenStreet={() => setMapLevel('site')} />}
                    </div>
                  );
                })()}
                {tab === 'neighbours' && <NeighboursScreen />}
                {tab === 'share' && <ShareScreen />}
                {tab === 'activities' && <ActivitiesScreen />}
                {tab === 'help' && <HelpScreen />}
                {tab === 'me' && <MeScreen />}
                {top && (
                  <div className="overlay-layer" key={`${top.kind}-${top.id ?? ''}-${overlays.length}`}>
                    {top.kind === 'neighbour' && top.id && <NeighbourPage id={top.id} />}
                    {top.kind === 'chat' && top.id && <ChatPage id={top.id} />}
                    {top.kind === 'group' && top.id && <GroupPage id={top.id} />}
                    {top.kind === 'activity' && top.id && <ActivityPage id={top.id} />}
                    {top.kind === 'notifications' && <NotificationsPage />}
                    {top.kind === 'guide' && <GuidePage />}
                    {top.kind === 'intro' && <IntroPage />}
                    {top.kind === 'flood' && <div className="page"><FloodScreen onClose={ctx.close} /></div>}
                  </div>
                )}
              </main>
              {ctx.me.floodAlert && !ctx.me.isAdmin && top?.kind !== 'flood' && (
                <button className="flood-fab" onClick={() => go('flood')}><Icon name="drop" /> Flood check-in</button>
              )}
              <nav className="tabbar" aria-label="JIRAN">
                {(ctx.me.isAdmin ? [TABS[0], TABS[1], { id: 'me' as Tab, key: 'tab.me', icon: 'chart' as IconName }] : TABS).map((x) => (
                  <button key={x.id} className={tab === x.id && !top ? 'on' : ''} aria-current={tab === x.id && !top ? 'page' : undefined}
                    onClick={() => { setOverlays([]); setSection(null); setTab(x.id); }}>
                    <span className="tab-icon"><Icon name={x.icon} /></span>
                    {ctx.me.isAdmin && x.id === 'me' ? 'Dashboard' : t(x.key)}
                    {x.id === 'neighbours' && ctx.me.pendingRequests > 0 && <span className="dot-count tab-dot">{ctx.me.pendingRequests}</span>}
                  </button>
                ))}
              </nav>
            </>
          )}
        </Ctx.Provider>
      )}
      <Tooltips />
      <div className="toasts" aria-live="polite">
        {toasts.map((x) => <div key={x.id} className={`toast ${x.tone}`}>{x.msg}</div>)}
      </div>
    </div>
  );
}
