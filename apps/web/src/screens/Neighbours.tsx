import { useEffect, useState } from 'react';
import type { Connections, GroupList, Newcomers, Notices, Partners, Person, Suggestions } from '../api.ts';
import { Icon } from '../icons.tsx';
import { Avatar, Chips, Empty, Header, Segmented, Sheet, ago, fmtWhen, useAction, useApp, useData } from '../ui.tsx';

type Seg = 'discover' | 'directory' | 'connections' | 'groups' | 'board';

export function NeighboursScreen() {
  const { section, me, t } = useApp();
  const [seg, setSeg] = useState<Seg>('discover');
  useEffect(() => { if (section && ['discover', 'directory', 'connections', 'groups', 'board'].includes(section)) setSeg(section as Seg); }, [section]);
  return (
    <div className="screen">
      <Header kicker={`${me.precinct.name} · ${me.connections} connections`} title={t('title.neighbours')} />
      <div className="seg-scroll">
        <Segmented label="Neighbour sections" value={seg} onChange={setSeg} options={[
          { id: 'discover', label: 'Discover' }, { id: 'directory', label: 'Directory' },
          { id: 'connections', label: 'Connections', count: me.pendingRequests }, { id: 'groups', label: 'Groups' }, { id: 'board', label: 'Board' },
        ]} />
      </div>
      <div className="screen-body">
        {seg === 'discover' && <Discover />}
        {seg === 'directory' && <Directory />}
        {seg === 'connections' && <ConnectionsList />}
        {seg === 'groups' && <GroupsList />}
        {seg === 'board' && <Board />}
      </div>
    </div>
  );
}

export function PersonRow({ p, children, onOpen }: { p: Person; children?: React.ReactNode; onOpen?: () => void }) {
  const { open } = useApp();
  return (
    <div className="card person">
      <button className="person-main" onClick={onOpen ?? (() => open({ kind: 'neighbour', id: p.id }))} aria-label={`Open ${p.firstName}’s profile`}>
        <Avatar name={p.firstName} color={p.avatar} photo={p.photo} size={48} />
        <div className="grow">
          <div className="row gap6"><strong>{p.firstName}</strong>{p.isNew && <span className="ribbon">New</span>}{p.isBuddy && <span className="tag-soft gold tiny">Buddy</span>}</div>
          <div className="muted small">{p.street}</div>
          {p.reasons.length > 0 && <div className="why">{p.reasons[0]}</div>}
          {p.sharedTags.length === 0 && p.interests.length > 0 && <div className="muted small">{p.interests.slice(0, 3).join(' · ')}</div>}
        </div>
      </button>
      {children}
    </div>
  );
}

export function ConnectButton({ p }: { p: Person }) {
  const [asking, setAsking] = useState(false);
  const { open } = useApp();
  if (p.connection === 'connected') return <button className="btn small" onClick={() => open({ kind: 'chat', id: p.id })}><Icon name="chat" /> Chat</button>;
  if (p.connection === 'outgoing') return <span className="pill-muted">Request sent</span>;
  if (p.connection === 'incoming') return <button className="btn small primary" onClick={() => open({ kind: 'neighbour', id: p.id })}>Respond</button>;
  return (
    <>
      <button className="btn small primary" onClick={() => setAsking(true)}><Icon name="hand" /> Connect</button>
      {asking && <ConnectSheet p={p} onClose={() => setAsking(false)} />}
    </>
  );
}

export function ConnectSheet({ p, onClose }: { p: { id: string; firstName: string; sharedTags: string[] }; onClose: () => void }) {
  const { run, busy } = useAction();
  const [msg, setMsg] = useState(p.sharedTags.length ? `Hi ${p.firstName}! I saw you like ${p.sharedTags[0].toLowerCase()} too.` : `Hi ${p.firstName}! I live nearby, nice to meet you.`);
  return (
    <Sheet onClose={onClose} label={`Connect with ${p.firstName}`}>
      <h2>Say hi to {p.firstName}</h2>
      <p className="muted small">Chat opens once {p.firstName} accepts.</p>
      <label className="field-label" htmlFor="intro-msg">Introductory message (optional)</label>
      <textarea id="intro-msg" className="input" rows={3} maxLength={200} value={msg} onChange={(e) => setMsg(e.target.value)} />
      <button className="btn primary" disabled={busy} onClick={async () => { if (await run('POST', '/api/connections', { to: p.id, message: msg }, `Request sent to ${p.firstName}`)) onClose(); }}>
        <Icon name="hand" /> Send request
      </button>
    </Sheet>
  );
}

function Discover() {
  const { options } = useApp();
  const { data } = useData<Suggestions>('/api/suggestions');
  const { data: newcomers } = useData<Newcomers>('/api/newcomers');
  const { run, busy } = useAction();
  const [activity, setActivity] = useState(options.activities[0]);
  const [slot, setSlot] = useState('');
  const { data: partners } = useData<Partners>(`/api/partners?activity=${encodeURIComponent(activity)}${slot ? `&slot=${slot}` : ''}`);
  const fresh = newcomers?.filter((n) => !n.isYou).slice(0, 6) ?? [];

  return (
    <>
      {fresh.length > 0 && (
        <section className="stack8">
          <h2 className="section-title">New neighbours</h2>
          <div className="h-scroll">
            {fresh.map((n) => (
              <div key={n.id} className="card intro-card">
                <div className="row gap8"><Avatar name={n.firstName} color={n.avatar} photo={n.photo} size={40} /><div className="grow"><strong>{n.firstName}</strong><div className="muted small">{n.street}</div></div></div>
                <p className="small clamp3">{n.intro}</p>
                <div className="row gap8">
                  <button className={n.welcomedByMe ? 'btn small ok grow' : 'btn small primary grow'} disabled={busy || n.welcomedByMe}
                    onClick={() => run<{ earned: number }>('POST', `/api/newcomers/${n.id}/welcome`, undefined, (r) => r.earned ? `+${r.earned} points · welcome sent` : 'Welcome sent')}>
                    {n.welcomedByMe ? 'Welcomed' : 'Welcome'}
                  </button>
                  <span className="muted small">{n.welcomes} welcomes</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="stack8">
        <h2 className="section-title">Recommended for you</h2>
        {!data ? <p className="muted">Finding common ground…</p> : data.similar.length === 0
          ? <Empty icon="users" title="No matches yet" text="Add interests to your profile to see neighbours like you." />
          : <div className="list">{data.similar.map((p) => (
            <PersonRow key={p.id} p={p}>
              <div className="row gap8 person-actions">
                <ConnectButton p={p} />
                <button className="btn small" disabled={busy} onClick={() => run('POST', `/api/residents/${p.id}/dismiss`, undefined, 'Hidden from suggestions')}>Not now</button>
              </div>
            </PersonRow>
          ))}</div>}
      </section>

      {data && data.openToMeet.length > 0 && (
        <section className="stack8">
          <h2 className="section-title">Open to meeting new people</h2>
          <div className="h-scroll">{data.openToMeet.map((p) => (
            <div key={p.id} className="card mini-person">
              <Avatar name={p.firstName} color={p.avatar} photo={p.photo} size={46} />
              <strong>{p.firstName}</strong>
              <span className="muted small center">{p.interests.slice(0, 2).join(', ')}</span>
              <ConnectButton p={p} />
            </div>
          ))}</div>
        </section>
      )}

      <section className="card stack8">
        <h2 className="section-title">Find an activity partner</h2>
        <Chips wrap label="Activity" value={activity} options={options.activities.map((a) => ({ id: a, label: a }))} onChange={setActivity} />
        <Chips wrap label="Time" value={slot} options={[{ id: '', label: 'Any time' }, ...options.timeSlots]} onChange={setSlot} />
        {partners && (partners.length === 0
          ? <p className="muted small">Nobody yet for {activity.toLowerCase()} at that time. Host one in Activities and they will come!</p>
          : <div className="list">{partners.slice(0, 6).map((p) => (
            <PersonRow key={p.id} p={p}><div className="row gap8 person-actions"><span className="muted small grow">{p.slots.join(', ')}</span><ConnectButton p={p} /></div></PersonRow>
          ))}</div>)}
      </section>
    </>
  );
}

function Directory() {
  const { options } = useApp();
  const [q, setQ] = useState('');
  const [interest, setInterest] = useState('');
  const [skillQ, setSkillQ] = useState('');
  const params = new URLSearchParams();
  if (q.trim()) params.set('q', q.trim());
  if (interest) params.set(options.activities.includes(interest) && !options.interests.includes(interest) ? 'activity' : 'interest', interest);
  if (skillQ.trim()) params.set('skill', skillQ.trim());
  const { data } = useData<Person[]>(`/api/residents?${params}`);
  return (
    <>
      <div className="card stack8">
        <label className="sr-only" htmlFor="dir-q">Search neighbours</label>
        <input id="dir-q" className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, street or interest" />
        <label className="sr-only" htmlFor="dir-skill">Search by skill</label>
        <input id="dir-skill" className="input" type="search" value={skillQ} onChange={(e) => setSkillQ(e.target.value)} placeholder="Has a skill, e.g. wifi, maths, taps" />
        <Chips label="Filter by hobby" value={interest} options={[{ id: '', label: 'Any hobby' }, ...[...new Set([...options.interests, ...options.activities])].map((x) => ({ id: x, label: x }))]} onChange={setInterest} />
      </div>
      {!data ? <p className="muted">Knocking on doors…</p> : (
        <>
          <p className="muted small">{data.length} neighbour{data.length === 1 ? '' : 's'}</p>
          <div className="list">{data.map((p) => <PersonRow key={p.id} p={p}><div className="row gap8 person-actions"><ConnectButton p={p} /></div></PersonRow>)}</div>
        </>
      )}
    </>
  );
}

function ConnectionsList() {
  const { open } = useApp();
  const { data } = useData<Connections>('/api/connections');
  const { run, busy } = useAction();
  if (!data) return <p className="muted">Loading…</p>;
  return (
    <>
      {data.incoming.length > 0 && <section className="stack8">
        <h2 className="section-title">Requests for you</h2>
        {data.incoming.map((c) => (
          <PersonRow key={c.id} p={c.person}>
            {c.message && <p className="quote">“{c.message}”</p>}
            <div className="row gap8 person-actions">
              <button className="btn small grow" disabled={busy} onClick={() => run('POST', `/api/connections/${c.id}/respond`, { accept: false }, 'Declined quietly')}>Decline</button>
              <button className="btn small primary grow" disabled={busy} onClick={() => run('POST', `/api/connections/${c.id}/respond`, { accept: true }, `+10 points · you and ${c.person.firstName} are connected`)}>Accept</button>
            </div>
          </PersonRow>
        ))}
      </section>}
      <section className="stack8">
        <h2 className="section-title">Chats</h2>
        {data.connected.length === 0 ? <Empty icon="chat" title="No connections yet" text="Say hi to someone in Discover. Chat opens when they accept." /> : (
          <div className="list">{data.connected.map((c) => (
            <button key={c.id} className="card item-row link" onClick={() => open({ kind: 'chat', id: c.person.id })} aria-label={`Chat with ${c.person.firstName}`}>
              <Avatar name={c.person.firstName} color={c.person.avatar} photo={c.person.photo} size={44} />
              <div className="grow"><strong>{c.person.firstName}</strong><div className="muted small clamp1">{c.last ? `${c.last.mine ? 'You: ' : ''}${c.last.text}` : 'Say hello'}</div></div>
              {c.last && <span className="muted tiny">{ago(c.last.at)}</span>}
            </button>
          ))}</div>
        )}
      </section>
      {data.outgoing.length > 0 && <section className="stack8">
        <h2 className="section-title">Waiting for a reply</h2>
        {data.outgoing.map((c) => (
          <PersonRow key={c.id} p={c.person}><div className="row gap8 person-actions"><span className="muted small grow">Sent {ago(c.at)}</span>
            <button className="btn small" disabled={busy} onClick={() => run('POST', `/api/connections/${c.id}/cancel`, undefined, 'Request cancelled')}>Cancel</button></div></PersonRow>
        ))}
      </section>}
    </>
  );
}

function GroupsList() {
  const { open } = useApp();
  const { data } = useData<GroupList>('/api/groups');
  const [creating, setCreating] = useState(false);
  const mine = data?.filter((g) => g.joined) ?? [];
  const others = data?.filter((g) => !g.joined) ?? [];
  const Row = ({ g }: { g: GroupList[number] }) => (
    <button className="card group-row link" onClick={() => open({ kind: 'group', id: g.id })} aria-label={`Open ${g.name}`}>
      <span className="group-icon" aria-hidden="true">{g.name.charAt(0)}</span>
      <div className="grow">
        <div className="row gap6"><strong>{g.name}</strong>{g.matchesYou && !g.joined && <span className="tag-soft gold tiny">For you</span>}</div>
        <div className="muted small">{g.category} · {g.members} members · by {g.organiser}</div>
        {g.next && <div className="why">Next: {g.next.title}, {fmtWhen(g.next.startsAt)}</div>}
      </div>
      <Icon name="chevron" />
    </button>
  );
  return (
    <>
      <button className="btn primary" onClick={() => setCreating(true)}><Icon name="plus" /> Start a group</button>
      {mine.length > 0 && <><h2 className="section-title">Your groups</h2><div className="list">{mine.map((g) => <Row key={g.id} g={g} />)}</div></>}
      <h2 className="section-title">Find a group</h2>
      <div className="list">{others.map((g) => <Row key={g.id} g={g} />)}</div>
      {creating && <CreateGroup onClose={() => setCreating(false)} />}
    </>
  );
}

function CreateGroup({ onClose }: { onClose: () => void }) {
  const { options, open } = useApp();
  const { run, busy } = useAction();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(options.interests[0]);
  return (
    <Sheet onClose={onClose} label="Start a group">
      <h2>Start an interest group</h2>
      <label className="field-label" htmlFor="g-name">Group name</label>
      <input id="g-name" className="input" value={name} maxLength={50} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sunset Yoga" />
      <label className="field-label" htmlFor="g-desc">What is it about?</label>
      <textarea id="g-desc" className="input" rows={3} maxLength={300} value={description} onChange={(e) => setDescription(e.target.value)} />
      <label className="field-label" htmlFor="g-cat">Category</label>
      <select id="g-cat" className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
        {[...new Set([...options.interests, ...options.activities])].map((x) => <option key={x}>{x}</option>)}
      </select>
      <button className="btn primary" disabled={busy || !name.trim()} onClick={async () => {
        const g = await run<{ id: string }>('POST', '/api/groups', { name, description, category }, 'Group created');
        if (g) { onClose(); open({ kind: 'group', id: g.id }); }
      }}>Create group</button>
    </Sheet>
  );
}

const NOTICE_KIND = { announcement: { label: 'From SDP', cls: 'blue' }, lost: { label: 'Lost', cls: 'pink' }, found: { label: 'Found', cls: 'gold' }, general: { label: 'Notice', cls: '' } } as const;

function Board() {
  const { me } = useApp();
  const { data } = useData<Notices>('/api/notices');
  const { run, busy } = useAction();
  const [kind, setKind] = useState<'general' | 'lost' | 'found' | 'announcement'>('general');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const post = async () => { if (await run('POST', '/api/notices', { kind, title, body }, 'Posted to the noticeboard')) { setTitle(''); setBody(''); } };
  const kinds = [{ id: 'general', label: 'Notice' }, { id: 'lost', label: 'Lost' }, { id: 'found', label: 'Found' }, ...(me.isAdmin ? [{ id: 'announcement', label: 'Announcement' }] : [])] as { id: typeof kind; label: string }[];
  return (
    <>
      <div className="card stack8">
        <h2 className="section-title">Precinct noticeboard</h2>
        <Chips label="Kind of notice" value={kind} options={kinds} onChange={setKind} />
        <label className="sr-only" htmlFor="n-title">Title</label>
        <input id="n-title" className="input" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder={kind === 'lost' ? 'e.g. Lost: black cat with a red collar' : kind === 'found' ? 'e.g. Found: parcel for No. 4' : 'Title'} />
        <label className="sr-only" htmlFor="n-body">Details</label>
        <textarea id="n-body" className="input" rows={2} maxLength={400} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Details (optional)" />
        <button className="btn primary" disabled={busy || !title.trim()} onClick={post}>Post</button>
      </div>
      <div className="list">
        {data?.map((n) => (
          <div key={n.id} className={`card${n.resolved ? ' dead' : ''}`}>
            <div className="row gap8"><span className={`tag-soft ${NOTICE_KIND[n.kind].cls}`}>{NOTICE_KIND[n.kind].label}</span><span className="muted small grow">{n.author} · {ago(n.at)}</span>{n.resolved && <span className="pill-ok">Resolved</span>}</div>
            <strong>{n.title}</strong>
            {n.body && <p className="small">{n.body}</p>}
            {n.canResolve && !n.resolved && <button className="btn small" disabled={busy} onClick={() => run('POST', `/api/notices/${n.id}/resolve`, undefined, 'Marked as resolved')}>Mark resolved</button>}
          </div>
        ))}
      </div>
    </>
  );
}
