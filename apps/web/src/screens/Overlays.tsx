import { useEffect, useRef, useState } from 'react';
import type { ActivityDetail, GroupDetail, NeighbourCard, Notifications, Thread } from '../api.ts';
import { Icon } from '../icons.tsx';
import { Avatar, Page, Sheet, ago, fmtTime, fmtWhen, monthName, useAction, useApp, useData } from '../ui.tsx';
import { ActivityForm, ActivityRow } from './Activities.tsx';
import { ConnectSheet } from './Neighbours.tsx';
import { BorrowSheet, SkillRequestSheet } from './Share.tsx';
import { WatchSheet } from './Help.tsx';

export function NeighbourPage({ id }: { id: string }) {
  const { open, me } = useApp();
  const { data: n } = useData<NeighbourCard>(`/api/residents/${id}`);
  const { run, busy } = useAction();
  const [sheet, setSheet] = useState<null | 'connect' | 'watch' | { borrow: string } | { skill: string }>(null);
  if (!n) return <Page title="Neighbour"><p className="muted">Knocking on the door…</p></Page>;
  return (
    <Page title={n.isYou ? 'Your profile' : n.firstName} kicker={n.unit}>
      <div className="card profile-card">
        <div className="row gap12">
          <Avatar name={n.firstName} color={n.avatar} photo={n.photo} size={72} />
          <div className="grow">
            <div className="row gap6 wrap"><h2>{n.firstName}</h2>{n.isNew && <span className="ribbon">New</span>}{n.isBuddy && <span className="tag-soft gold tiny">Community buddy</span>}</div>
            <div className="muted small strong">{n.street} · moved in {monthName(n.movedIn)}</div>
            {n.mutual > 0 && <div className="muted small">{n.mutual} mutual connection{n.mutual > 1 ? 's' : ''}</div>}
          </div>
        </div>
        {n.bio && <p>{n.bio}</p>}
        {n.reasons.length > 0 && <div className="why-box">{n.reasons.map((r) => <div key={r} className="row gap6"><Icon name="sparkle" size={16} /> {r}</div>)}</div>}
        {!n.isYou && (
          <div className="row gap8 wrap">
            {n.connection === 'none' && <button className="btn primary grow" onClick={() => setSheet('connect')}><Icon name="hand" /> Connect</button>}
            {n.connection === 'outgoing' && <button className="btn grow" disabled={busy} onClick={() => run('POST', `/api/connections/${n.connectionId}/cancel`, undefined, 'Request cancelled')}>Request sent · cancel</button>}
            {n.connection === 'incoming' && <>
              {n.connectionMessage && <p className="quote full">“{n.connectionMessage}”</p>}
              <button className="btn grow" disabled={busy} onClick={() => run('POST', `/api/connections/${n.connectionId}/respond`, { accept: false }, 'Declined')}>Decline</button>
              <button className="btn primary grow" disabled={busy} onClick={() => run('POST', `/api/connections/${n.connectionId}/respond`, { accept: true }, `+10 points · connected with ${n.firstName}`)}>Accept</button>
            </>}
            {n.connection === 'connected' && <>
              <button className="btn primary grow" onClick={() => open({ kind: 'chat', id: n.id })}><Icon name="chat" /> Chat</button>
              <button className="btn grow" onClick={() => setSheet('watch')}><Icon name="home" /> Watch my house</button>
              <button className="btn grow" disabled={busy} onClick={() => run('POST', '/api/contacts', { residentId: n.id }, `Asked ${n.firstName} to be an emergency contact`)}><Icon name="shield" /> Emergency contact</button>
            </>}
          </div>
        )}
      </div>
      {n.intro && <div className="card"><div className="field-label">Their introduction</div><p className="small">{n.intro}</p></div>}
      {(n.interests.length > 0 || n.languages.length > 0) && (
        <div className="card stack8">
          {n.interests.length > 0 && <><div className="field-label">Interests</div><div className="tags">{n.interests.map((i) => <span key={i} className={`tag-soft${n.sharedTags.includes(i) ? ' gold' : ''}`}>{i}</span>)}</div></>}
          {n.activities.length > 0 && <><div className="field-label">Likes to do</div><div className="tags">{n.activities.map((i) => <span key={i} className={`tag-soft${n.sharedTags.includes(i) ? ' gold' : ''}`}>{i}</span>)}</div></>}
          {n.languages.length > 0 && <><div className="field-label">Speaks</div><div className="tags">{n.languages.map((i) => <span key={i} className="tag-soft blue">{i}</span>)}</div></>}
          {n.availability.length > 0 && <div className="muted small">Usually free: {n.availability.join(', ')}</div>}
          {n.groupsInCommon.length > 0 && <div className="muted small">Groups in common: {n.groupsInCommon.join(', ')}</div>}
        </div>
      )}
      {n.shelf.length > 0 && (
        <div className="card stack8">
          <div className="field-label">{n.isYou ? 'Your shelf' : 'Happy to lend'}</div>
          {n.shelf.map((i) => (
            <div key={i.id} className="shelf-row">
              <span className="grow"><strong>{i.title}</strong>{i.note && <span className="muted small"> · {i.note}</span>}</span>
              {!n.isYou && (i.available ? <button className="btn small primary" onClick={() => setSheet({ borrow: i.id })}>Borrow</button> : <span className="muted small">On loan</span>)}
            </div>
          ))}
        </div>
      )}
      {n.skillListings.length > 0 && (
        <div className="card stack8">
          <div className="field-label">Skills to share</div>
          {n.skillListings.map((s) => (
            <div key={s.id} className="shelf-row">
              <span className="grow"><strong>{s.title}</strong><span className="muted small"> · {s.arrangement === 'swap' ? `swap for ${s.swapFor}` : 'free'}</span></span>
              {!n.isYou && <button className="btn small primary" onClick={() => setSheet({ skill: s.id })}>Ask</button>}
            </div>
          ))}
        </div>
      )}
      {n.hosting.length > 0 && (
        <div className="card stack8">
          <div className="field-label">Hosting</div>
          {n.hosting.map((a) => (
            <button key={a.id} className="shelf-row link" onClick={() => open({ kind: 'activity', id: a.id })}>
              <span className="grow"><strong>{a.title}</strong><span className="muted small"> · {fmtWhen(a.startsAt)}</span></span><Icon name="chevron" />
            </button>
          ))}
        </div>
      )}
      {n.isYou && <p className="muted small">This is how neighbours see you. Edit it in Me.</p>}
      {me.id !== n.id && <p className="muted small center">Only residents of {me.precinct.name} can see this profile.</p>}
      {sheet === 'connect' && <ConnectSheet p={n} onClose={() => setSheet(null)} />}
      {sheet === 'watch' && <WatchSheet watcher={{ id: n.id, firstName: n.firstName }} onClose={() => setSheet(null)} />}
      {sheet && typeof sheet === 'object' && 'borrow' in sheet && <BorrowSheet itemId={sheet.borrow} onClose={() => setSheet(null)} />}
      {sheet && typeof sheet === 'object' && 'skill' in sheet && <SkillRequestSheet skillId={sheet.skill} onClose={() => setSheet(null)} />}
    </Page>
  );
}

export function ChatPage({ id }: { id: string }) {
  const { data, error } = useData<Thread>(`/api/chats/${id}`);
  const { run, busy } = useAction();
  const [text, setText] = useState('');
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [data?.messages.length]);
  if (error) return <Page title="Chat"><p className="muted">{error}</p></Page>;
  if (!data) return <Page title="Chat"><p className="muted">Opening chat…</p></Page>;
  const send = async () => { if (!text.trim()) return; if (await run('POST', `/api/chats/${id}`, { text })) setText(''); };
  return (
    <div className="page chat" role="dialog" aria-label={`Chat with ${data.with.firstName}`}>
      <ChatHeader name={data.with.firstName} street={data.with.street} avatar={data.with.avatar} photo={data.with.photo} id={id} />
      <div className="chat-body" aria-live="polite">
        {data.messages.length === 0 && <p className="muted center small">You are connected. Say hello!</p>}
        {data.messages.map((m) => (
          <div key={m.id} className={`bubble${m.mine ? ' mine' : ''}`}><span>{m.text}</span><time className="tiny">{fmtTime(m.at)}</time></div>
        ))}
        <div ref={end} />
      </div>
      <form className="chat-input" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <label className="sr-only" htmlFor="chat-text">Message</label>
        <input id="chat-text" className="input grow" value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} placeholder={`Message ${data.with.firstName}`} autoComplete="off" />
        <button className="btn primary" disabled={busy || !text.trim()} aria-label="Send">Send</button>
      </form>
    </div>
  );
}

function ChatHeader({ name, street, avatar, photo, id }: { name: string; street: string; avatar: string; photo: string | null; id: string }) {
  const { close, open } = useApp();
  return (
    <header className="screen-head">
      <button className="round-btn" onClick={close} aria-label="Back"><Icon name="back" /></button>
      <button className="row gap8 grow link-plain" onClick={() => open({ kind: 'neighbour', id })} aria-label={`Open ${name}’s profile`}>
        <Avatar name={name} color={avatar} photo={photo} size={40} />
        <span className="grow"><strong className="h-name">{name}</strong><span className="muted small block">{street}</span></span>
      </button>
    </header>
  );
}

export function GroupPage({ id }: { id: string }) {
  const { data: g } = useData<GroupDetail>(`/api/groups/${id}`);
  const { run, busy } = useAction();
  const { open } = useApp();
  const [post, setPost] = useState('');
  const [planning, setPlanning] = useState(false);
  const [managing, setManaging] = useState<string | null>(null);
  if (!g) return <Page title="Group"><p className="muted">Loading…</p></Page>;
  return (
    <Page title={g.name} kicker={`${g.category} · ${g.members.length} members`}>
      <div className="card stack8">
        <p>{g.description || 'No description yet.'}</p>
        <div className="row gap8">
          {g.joined
            ? <button className="btn grow" disabled={busy || (g.isOrganiser && g.members.length > 1)} onClick={() => run('POST', `/api/groups/${g.id}/leave`, undefined, `Left ${g.name}`)}>{g.isOrganiser && g.members.length > 1 ? 'You organise this group' : 'Leave group'}</button>
            : <button className="btn primary grow" disabled={busy} onClick={() => run<{ earned: number }>('POST', `/api/groups/${g.id}/join`, undefined, (r) => r.earned ? `+${r.earned} points · welcome to ${g.name}` : `Joined ${g.name}`)}>Join group</button>}
          {g.joined && <button className="btn" onClick={() => setPlanning(true)}><Icon name="plus" /> Plan activity</button>}
        </div>
      </div>
      <section className="stack8">
        <h2 className="section-title">Upcoming</h2>
        {g.activities.length === 0 ? <p className="muted small">Nothing planned yet.</p> : <div className="list">{g.activities.map((a) => <ActivityRow key={a.id} a={a} />)}</div>}
      </section>
      <section className="stack8">
        <h2 className="section-title">Discussion</h2>
        {!g.joined ? <p className="muted small">Join the group to read and post.</p> : (
          <>
            <form className="row gap8" onSubmit={async (e) => { e.preventDefault(); if (post.trim() && await run('POST', `/api/groups/${g.id}/posts`, { text: post })) setPost(''); }}>
              <label className="sr-only" htmlFor="g-post">Write a post</label>
              <input id="g-post" className="input grow" value={post} maxLength={500} onChange={(e) => setPost(e.target.value)} placeholder="Share something with the group" />
              <button className="btn primary" disabled={busy || !post.trim()}>Post</button>
            </form>
            {g.posts.map((p) => (
              <div key={p.id} className="card post"><div className="row gap6"><strong>{p.mine ? 'You' : p.author}</strong><span className="muted tiny">{ago(p.at)}</span></div><p className="small">{p.text}</p></div>
            ))}
          </>
        )}
      </section>
      <section className="stack8">
        <h2 className="section-title">Members</h2>
        <div className="member-grid">
          {g.members.map((m) => (
            <button key={m.id} className="member" onClick={() => (g.isAdmin && !m.isYou && m.id !== g.organiserId ? setManaging(m.id) : open({ kind: 'neighbour', id: m.id }))} aria-label={m.firstName}>
              <Avatar name={m.firstName} color={m.avatar} photo={m.photo} size={44} />
              <span className="small strong">{m.isYou ? 'You' : m.firstName}</span>
              {m.isAdmin && <span className="tiny muted">{m.id === g.organiserId ? 'Organiser' : 'Admin'}</span>}
            </button>
          ))}
        </div>
      </section>
      {managing && (() => {
        const m = g.members.find((x) => x.id === managing)!;
        return (
          <Sheet onClose={() => setManaging(null)} label={`Manage ${m.firstName}`}>
            <h2>{m.firstName}</h2>
            <button className="btn" onClick={() => { setManaging(null); open({ kind: 'neighbour', id: m.id }); }}>View profile</button>
            <button className="btn" disabled={busy} onClick={async () => { await run('POST', `/api/groups/${g.id}/members/${m.id}`, { action: m.isAdmin ? 'remove_admin' : 'make_admin' }, m.isAdmin ? 'No longer an admin' : `${m.firstName} is now an admin`); setManaging(null); }}>{m.isAdmin ? 'Remove admin role' : 'Make admin'}</button>
            <button className="btn danger" disabled={busy} onClick={async () => { await run('POST', `/api/groups/${g.id}/members/${m.id}`, { action: 'remove' }, `Removed ${m.firstName}`); setManaging(null); }}>Remove from group</button>
          </Sheet>
        );
      })()}
      {planning && <ActivityForm groupId={g.id} onClose={() => setPlanning(false)} />}
    </Page>
  );
}

export function ActivityPage({ id }: { id: string }) {
  const { data: a } = useData<ActivityDetail>(`/api/activities/${id}`);
  const { run, busy } = useAction();
  const { open } = useApp();
  const [editing, setEditing] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  if (!a) return <Page title="Activity"><p className="muted">Loading…</p></Page>;
  const full = a.spotsLeft === 0 && !a.imIn;
  return (
    <Page title={a.title} kicker={a.status === 'cancelled' ? 'Cancelled' : fmtWhen(a.startsAt)}>
      <div className="card stack8">
        <div className="row gap8"><Icon name="calendar" /><span>{fmtWhen(a.startsAt)} to {fmtTime(a.endsAt)}</span></div>
        <div className="row gap8"><Icon name="pin" /><span>{a.place}</span></div>
        <div className="row gap8"><Icon name="user" /><span>Organised by {a.mine ? 'you' : a.host}{a.hostUnit ? ` · ${a.hostUnit}` : ''}</span></div>
        {a.group && <button className="row gap8 link-plain" onClick={() => a.groupId && open({ kind: 'group', id: a.groupId })}><Icon name="users" /><span className="link-text">{a.group}</span></button>}
        <div className="tags"><span className={`tag-soft${a.scope === 'township' ? ' blue' : ''}`}>{a.scope === 'township' ? 'Whole township' : 'Precinct only'}</span>
          <span className="tag-soft">{a.going} going{a.capacity ? ` of ${a.capacity}` : ''}</span>{a.spotsLeft !== null && a.spotsLeft <= 3 && a.spotsLeft > 0 && <span className="tag-soft pink">{a.spotsLeft} spots left</span>}</div>
        {a.description && <p>{a.description}</p>}
        {a.status === 'cancelled' ? <p className="error">This activity was cancelled.</p> : a.mine ? (
          <div className="row gap8">
            <button className="btn grow" onClick={() => setEditing(true)}>Edit details</button>
            <button className="btn danger grow" onClick={() => setConfirmCancel(true)}>Cancel activity</button>
          </div>
        ) : a.imIn ? (
          <button className="btn ok" disabled={busy} onClick={() => run('POST', `/api/activities/${a.id}/leave`, undefined, 'You left the activity')}><Icon name="check" /> You’re going · leave</button>
        ) : (
          <button className="btn primary" disabled={busy || full || a.past} onClick={() => run<{ earned: number }>('POST', `/api/activities/${a.id}/join`, undefined, (r) => r.earned ? `+${r.earned} points · see you there!` : 'See you there!')}>{full ? 'Full' : 'Join activity'}</button>
        )}
      </div>
      <section className="stack8">
        <h2 className="section-title">Who’s going</h2>
        <div className="member-grid">
          {a.participants.map((p) => (
            <button key={p.id} className="member" onClick={() => open({ kind: 'neighbour', id: p.id })}>
              <Avatar name={p.firstName} color={p.avatar} photo={p.photo} size={44} />
              <span className="small strong">{p.isYou ? 'You' : p.firstName}</span>{p.isHost && <span className="tiny muted">Host</span>}
            </button>
          ))}
        </div>
        {a.othersFromElsewhere > 0 && <p className="muted small">Plus {a.othersFromElsewhere} from other precincts.</p>}
      </section>
      {editing && <ActivityForm existing={a} onClose={() => setEditing(false)} />}
      {confirmCancel && (
        <Sheet onClose={() => setConfirmCancel(false)} label="Cancel activity">
          <h2>Cancel {a.title}?</h2>
          <p className="muted">Everyone who joined gets a notification.</p>
          <div className="row gap8">
            <button className="btn grow" onClick={() => setConfirmCancel(false)}>Keep it</button>
            <button className="btn danger grow" disabled={busy} onClick={async () => { await run('POST', `/api/activities/${a.id}/cancel`, undefined, 'Activity cancelled'); setConfirmCancel(false); }}>Cancel activity</button>
          </div>
        </Sheet>
      )}
    </Page>
  );
}

export function NotificationsPage() {
  const { go, t } = useApp();
  const { data } = useData<Notifications>('/api/notifications');
  const { run } = useAction();
  useEffect(() => { if (data && data.unread > 0) run('POST', '/api/notifications/read'); }, [data?.unread]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Page title={t('notifications')}>
      {data?.reminders.length ? (
        <section className="stack8">
          <h2 className="section-title">Reminders</h2>
          {data.reminders.map((r) => (
            <button key={r.id} className="card item-row link reminder" onClick={() => go(r.link)}><Icon name="calendar" /><span className="grow">{r.text}</span><Icon name="chevron" /></button>
          ))}
        </section>
      ) : null}
      <section className="stack8">
        <h2 className="section-title">Recent</h2>
        {data?.items.length === 0 && <p className="muted">Nothing yet. Activity from your neighbours shows up here.</p>}
        {data?.items.map((n) => (
          <button key={n.id} className={`card item-row link${n.readAt ? '' : ' unread'}`} onClick={() => go(n.link)}>
            <span className="grow">{n.text}</span><span className="muted tiny">{ago(n.at)}</span>
          </button>
        ))}
      </section>
    </Page>
  );
}
