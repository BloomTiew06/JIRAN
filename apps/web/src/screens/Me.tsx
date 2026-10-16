import { useEffect, useState } from 'react';
import { DEMO_PERSONAS } from '@jiran/core';
import type { Buddies, Checklist, Dashboard, Guide, Me, Progress } from '../api.ts';
import { HouseArt } from '../house.tsx';
import { Icon, type IconName } from '../icons.tsx';
import { Avatar, Coin, Header, Page, Sheet, ago, fmtDay, fmtWhen, useAction, useApp, useData } from '../ui.tsx';
import { BasicsFields, InterestFields, SettingsFields, useDraft } from './Profile.tsx';

const BADGE_ICON: Record<string, IconName> = {
  first_friend: 'hand', connector: 'users', kind_lender: 'wrench', good_borrower: 'star', skill_sharer: 'book', host: 'calendar', helper: 'heart', buddy: 'shield', flood_buddy: 'drop',
};

export function MeScreen() {
  const { me, api, section, t, open } = useApp();
  const { data } = useData<Progress>('/api/progress');
  const { data: checklist } = useData<Checklist>('/api/checklist');
  const { run, busy } = useAction();
  const [editing, setEditing] = useState<null | 'basics' | 'interests' | 'settings'>(null);
  useEffect(() => { if (section === 'profile') setEditing('basics'); if (section === 'guide') open({ kind: 'guide' }); }, [section]); // eslint-disable-line react-hooks/exhaustive-deps
  if (me.isAdmin) return <AdminScreen />;

  return (
    <div className="screen">
      <Header kicker={me.unit} title={t('title.me')} right={<span className="points-pill static"><Coin /> {me.points}</span>} />
      <div className="screen-body">
        <div className="card profile-card">
          <div className="row gap12">
            <Avatar name={me.firstName} color={me.avatar} photo={me.photo} size={64} />
            <div className="grow">
              <h2>{me.firstName}</h2>
              <div className="muted small strong">{me.precinct.name} · Lv {me.level.n} {me.level.name}</div>
              <div className="muted small">{me.connections} connections</div>
            </div>
            <button className="btn small" onClick={() => setEditing('basics')}>Edit</button>
          </div>
          {me.bio ? <p className="small">{me.bio}</p> : <button className="link-btn" onClick={() => setEditing('basics')}>Add a short introduction</button>}
          <div className="tags">{me.interests.map((i) => <span key={i} className="tag-soft">{i}</span>)}</div>
          <div className="row gap8 wrap">
            <button className="btn small" onClick={() => setEditing('interests')}>Interests and times</button>
            <button className="btn small" onClick={() => setEditing('settings')}>Privacy and language</button>
            <button className="btn small" onClick={() => open({ kind: 'neighbour', id: me.id })}>See as a neighbour</button>
          </div>
        </div>

        {checklist && checklist.done < checklist.total && <ChecklistCard c={checklist} />}

        <div className="grid2">
          <button className="card tile link" onClick={() => open({ kind: 'guide' })}><Icon name="book" size={26} /><strong>Welcome guide</strong><span className="muted small">Facilities, rules, waste, contacts</span></button>
          <button className="card tile link" onClick={() => open({ kind: 'intro' })}><Icon name="hand" size={26} /><strong>Introduce yourself</strong><span className="muted small">Say hi to the precinct</span></button>
        </div>

        <BuddyCard />

        {data && (
          <>
            <div className="card my-house">
              <div className="house-stage">
                <svg className="sun" width="40" height="40" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="14" fill="#FFE08A" stroke="#2B2340" strokeWidth="2" /></svg>
                <HouseArt wall="#FFF8EE" roof={data.houseColor} decor={Object.fromEntries(data.decor.map((d) => [d.key, d.on]))} w={190} h={178} />
                <span className="level-pill">Lv {data.level.n} {data.level.name}</span>
              </div>
              <div className="pad-x">
                <div className="row small strong"><span className="grow">My house</span>
                  <span className="muted">{data.next ? `${data.next.min - data.points} pts to Lv ${data.next.n} ${data.next.name}` : 'Top level!'}</span></div>
                <div className="bar purple"><div style={{ width: `${Math.round(data.progress * 100)}%` }} /></div>
                <div className="grid-decor">
                  {data.decor.map((d) => (
                    <button key={d.key} className={`decor${d.on ? ' on' : ''}${d.seasonal ? ' seasonal' : ''}`} aria-pressed={d.on} disabled={!d.unlocked || busy}
                      onClick={() => run('PUT', `/api/decor/${d.key}`, { on: !d.on })}>
                      <span>{d.label}</span>
                      <small>{d.unlocked ? (d.on ? 'On' : 'Off') : d.seasonal ? 'In season' : `Lv ${d.unlockLevel}`}</small>
                    </button>
                  ))}
                </div>
                {data.season ? <p className="muted small">{data.season.name} decorations are up across the precinct until {fmtDay(data.season.to)}.</p>
                  : data.upcomingSeasons[0] && <p className="muted small">Next festive decorations: {data.upcomingSeasons[0].name}, from {fmtDay(data.upcomingSeasons[0].from)}.</p>}
              </div>
            </div>

            <h2 className="section-title">Badges</h2>
            <div className="badges">
              {data.badges.map((b) => (
                <div key={b.id} className={`badge${b.earned ? '' : ' locked'}`} title={b.hint}>
                  <span className="badge-circle"><Icon name={BADGE_ICON[b.id] ?? 'star'} /></span>
                  <span>{b.name}</span>
                </div>
              ))}
            </div>
            <p className="muted small">Points are just for fun and pride. They decorate your house and light up your precinct. They are never money or vouchers.</p>
            <h2 className="section-title">Recent points</h2>
            <div className="card list-flat">
              {data.recent.map((l) => (
                <div key={l.id} className="ledger"><span className="grow">{l.reason.replace(/ \((flood|20\d\d)[^)]*\)/, '')}</span><span className="muted small">{fmtDay(l.at)}</span><strong>+{l.delta}</strong></div>
              ))}
            </div>
          </>
        )}
        {api.mode === 'demo' && <DemoSwitcher />}
      </div>
      {editing && <EditProfile which={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function ChecklistCard({ c }: { c: Checklist }) {
  const { go } = useApp();
  return (
    <div className="card checklist">
      <div className="row"><strong className="grow">New resident checklist</strong><span className="muted small">{c.done} of {c.total}</span></div>
      <div className="bar"><div style={{ width: `${(c.done / c.total) * 100}%` }} /></div>
      <ul>
        {c.steps.map((s) => (
          <li key={s.id}>
            <button className={`check-step${s.done ? ' done' : ''}`} onClick={() => go(s.link)} disabled={s.done}>
              <span className="tick" aria-hidden="true">{s.done ? <Icon name="check" size={14} /> : null}</span>
              <span className="grow">{s.label}</span>{!s.done && <Icon name="chevron" size={16} />}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BuddyCard() {
  const { me, open } = useApp();
  const { data } = useData<Buddies>('/api/buddies');
  const { run, busy } = useAction();
  const [choosing, setChoosing] = useState(false);
  if (!data) return null;
  const mine = data.links.find((l) => !l.iAmBuddy);
  const guiding = data.links.filter((l) => l.iAmBuddy);
  return (
    <div className="card stack8">
      <div className="row gap8"><Icon name="shield" /><strong className="grow">Community buddy programme</strong></div>
      {mine ? (
        <div className="row gap8">
          <span className="grow small">{mine.status === 'active' ? <>Your buddy is <strong>{mine.buddy}</strong>.</> : <>Waiting for <strong>{mine.buddy}</strong> to say yes.</>}</span>
          {mine.status === 'active' && <button className="btn small" onClick={() => open({ kind: 'chat', id: mine.buddyId })}>Chat</button>}
          {mine.status === 'active' && <button className="btn small" disabled={busy} onClick={() => run('POST', `/api/buddies/${mine.id}/end`, undefined, 'Buddy connection ended')}>End</button>}
        </div>
      ) : me.isNew ? (
        <>
          <p className="small">New here? A buddy who lives nearby can show you the facilities, groups and activities.</p>
          <button className="btn primary small" onClick={() => setChoosing(true)}>Find a buddy</button>
        </>
      ) : null}
      {guiding.map((l) => (
        <div key={l.id} className="row gap8">
          <span className="grow small">{l.status === 'pending' ? <><strong>{l.newcomer}</strong> asked you to be their buddy.</> : <>You are guiding <strong>{l.newcomer}</strong>.</>}</span>
          {l.status === 'pending' ? <>
            <button className="btn small" disabled={busy} onClick={() => run('POST', `/api/buddies/${l.id}/respond`, { accept: false }, 'Declined')}>Not now</button>
            <button className="btn small primary" disabled={busy} onClick={() => run('POST', `/api/buddies/${l.id}/respond`, { accept: true }, `+15 points · you are ${l.newcomer}’s buddy`)}>Accept</button>
          </> : <>
            <button className="btn small" onClick={() => open({ kind: 'chat', id: l.newcomerId })}>Chat</button>
            <button className="btn small" disabled={busy} onClick={() => run('POST', `/api/buddies/${l.id}/end`, undefined, 'Buddy connection ended')}>End</button>
          </>}
        </div>
      ))}
      <label className="toggle" htmlFor="buddy-vol">
        <span className="grow small">Volunteer as a buddy for newcomers</span>
        <input id="buddy-vol" type="checkbox" checked={data.volunteering} disabled={busy} onChange={(e) => run('PUT', '/api/buddies/volunteer', { on: e.target.checked }, e.target.checked ? 'Thanks for volunteering!' : 'You are no longer listed as a buddy')} />
        <span className="switch" aria-hidden="true" />
      </label>
      {choosing && (
        <Sheet onClose={() => setChoosing(false)} label="Choose a buddy">
          <h2>Choose a community buddy</h2>
          <div className="list">{data.volunteers.map((v) => (
            <div key={v.id} className="card item-row">
              <Avatar name={v.firstName} color={v.avatar} photo={v.photo} size={44} />
              <div className="grow"><strong>{v.firstName}</strong><div className="muted small">{v.street}{v.reasons[0] ? ` · ${v.reasons[0]}` : ''}</div></div>
              <button className="btn small primary" disabled={busy} onClick={async () => { if (await run('POST', '/api/buddies', { buddyId: v.id }, `Asked ${v.firstName}`)) setChoosing(false); }}>Ask</button>
            </div>
          ))}</div>
        </Sheet>
      )}
    </div>
  );
}

function EditProfile({ which, onClose }: { which: 'basics' | 'interests' | 'settings'; onClose: () => void }) {
  const { me } = useApp();
  const { d, set } = useDraft(me);
  const { run, busy } = useAction();
  const title = which === 'basics' ? 'Edit profile' : which === 'interests' ? 'Interests and free times' : 'Privacy and language';
  return (
    <Sheet onClose={onClose} label={title}>
      <h2>{title}</h2>
      {which === 'basics' && <BasicsFields d={d} set={set} />}
      {which === 'interests' && <InterestFields d={d} set={set} />}
      {which === 'settings' && <SettingsFields d={d} set={set} />}
      <button className="btn primary" disabled={busy || !d.firstName.trim()} onClick={async () => { if (await run<Me>('PATCH', '/api/me', d, 'Profile saved')) onClose(); }}>Save</button>
    </Sheet>
  );
}

export function GuidePage() {
  const { data } = useData<Guide>('/api/guide');
  const { run } = useAction();
  const { open } = useApp();
  useEffect(() => { run('POST', '/api/guide/seen'); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!data) return <Page title="Welcome guide"><p className="muted">Loading…</p></Page>;
  return (
    <Page title="Welcome guide" kicker={`Living in ${data.precinct}`}>
      <section className="card stack8"><h2 className="section-title">Facilities and shared spaces</h2>
        {data.facilities.map((f) => <div key={f.name}><strong>{f.name}</strong><p className="small">{f.detail}</p></div>)}
        <div className="field-label">Using shared spaces</div>
        <ul className="bullets">{data.booking.map((b) => <li key={b}>{b}</li>)}</ul>
      </section>
      <section className="card stack8"><h2 className="section-title">Community rules</h2><ul className="bullets">{data.rules.map((r) => <li key={r}>{r}</li>)}</ul></section>
      <section className="card stack8"><h2 className="section-title">Waste and recycling</h2><ul className="bullets">{data.waste.map((r) => <li key={r}>{r}</li>)}</ul></section>
      <section className="card stack8"><h2 className="section-title">Contacts</h2>
        {data.contacts.map((c) => <div key={c.label} className="row gap8"><span className="grow">{c.label}</span><strong className="selectable">{c.value}</strong></div>)}
        {data.myContacts.length > 0 && <div className="muted small">Your neighbour contacts: {data.myContacts.map((c) => c.firstName).join(', ')}</div>}
      </section>
      <section className="stack8"><h2 className="section-title">Coming up</h2>
        {data.upcoming.map((a) => <button key={a.id} className="card item-row link" onClick={() => open({ kind: 'activity', id: a.id })}><Icon name="calendar" /><span className="grow"><strong>{a.title}</strong><span className="muted small block">{fmtWhen(a.startsAt)} · {a.place}</span></span></button>)}
      </section>
      <p className="muted small">Items in [square brackets] are filled in by the management office.</p>
    </Page>
  );
}

export function IntroPage() {
  const { me } = useApp();
  const { data: guide } = useData<Guide>('/api/guide');
  const { run, busy } = useAction();
  const [text, setText] = useState('');
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (loaded || !guide) return;
    setText(guide.introTemplate.replace('[name]', me.firstName).replace('[house number and street]', me.unit));
    setLoaded(true);
  }, [guide, loaded, me]);
  return (
    <Page title="Introduce yourself" kicker="New resident introduction">
      <div className="card stack8">
        <p className="small">Fill in the template, edit it until it sounds like you, then publish. It shows in “New neighbours” so people can welcome you.</p>
        <label className="field-label" htmlFor="intro-text">Your introduction</label>
        <textarea id="intro-text" className="input" rows={7} maxLength={500} value={text} onChange={(e) => setText(e.target.value)} />
        <div className="muted tiny">{text.length}/500 · replace every [bracket]</div>
        <div className="row gap8">
          <button className="btn grow" disabled={busy || !text.trim()} onClick={() => run('PUT', '/api/intro', { text, publish: false }, 'Draft saved')}>Save draft</button>
          <button className="btn primary grow" disabled={busy || !text.trim()} onClick={() => run('PUT', '/api/intro', { text, publish: true }, 'Published. Neighbours can welcome you now')}>Publish</button>
        </div>
      </div>
    </Page>
  );
}

function DemoSwitcher() {
  const { me, switchTo, signOut, api } = useApp();
  const [sure, setSure] = useState(false);
  return (
    <div className="card demo-switch">
      <strong>Demo: be someone else</strong>
      <p className="muted small">Switch residents to see both sides of a request, a loan or a flood alert.</p>
      <div className="list">
        {DEMO_PERSONAS.filter((p) => p.residentId !== me.id).map((p) => (
          <button key={p.code} className="btn small" onClick={() => switchTo(p.code)}>{p.label} <span className="muted">· {p.note}</span></button>
        ))}
      </div>
      <p className="muted small">Your demo changes are saved in this browser and stay after you reload or the app is updated.</p>
      <div className="grid2">
        <button className="btn small" onClick={signOut}><Icon name="logout" /> Sign out</button>
        <button className="btn small" onClick={() => { if (!sure) { setSure(true); return; } api.resetDemo?.(); location.reload(); }}>
          {sure ? 'Tap again to reset' : 'Reset demo data'}
        </button>
      </div>
    </div>
  );
}

function AdminScreen() {
  const { api } = useApp();
  const { data } = useData<Dashboard>('/api/admin/dashboard');
  const { run, busy } = useAction();
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  return (
    <div className="screen">
      <Header kicker="SDP Community Team" title="Township pulse" />
      <div className="screen-body">
        <div className="card stack8">
          <strong>Flood alerts</strong>
          <p className="muted small">In production this listens to the public JPS and MetMalaysia warning feeds. Here you can simulate one.</p>
          {data?.floodAlert
            ? <button className="btn" disabled={busy} onClick={() => run('DELETE', '/api/admin/flood-alerts', undefined, 'Flood alert ended')}>End the alert</button>
            : <button className="btn sos" disabled={busy} onClick={() => run('POST', '/api/admin/flood-alerts', { level: 'warning', title: 'Heavy rain and rising water expected tonight' }, 'Flood warning sent to every precinct')}><Icon name="drop" /> Simulate a flood warning</button>}
        </div>
        <h2 className="section-title">Precincts (anonymised)</h2>
        <div className="table-wrap card">
          <table className="dash">
            <thead><tr><th scope="col">Precinct</th><th scope="col">On JIRAN</th><th scope="col">Know 3+</th><th scope="col">Groups</th><th scope="col">Activities</th><th scope="col">Loans out</th><th scope="col">Flood: need help</th></tr></thead>
            <tbody>{data?.precincts.map((p) => (
              <tr key={p.id}><th scope="row">{p.name}</th><td>{pct(p.joinedPct)}</td><td>{pct(p.knowThreePlusPct)}</td><td>{p.groups}</td><td>{p.upcomingActivities}</td><td>{p.activeLoans}</td><td>{data.floodAlert ? `${p.floodNeedHelp} of ${p.floodCheckedIn}` : '–'}</td></tr>
            ))}</tbody>
          </table>
        </div>
        <p className="muted small">“Know 3+” is the share of residents connected with three or more neighbours. No names leave the precinct. Post announcements from Neighbours › Board. Updated {data ? ago(data.generatedAt) : ''}.</p>
        {api.mode === 'demo' && <DemoSwitcher />}
      </div>
    </div>
  );
}
