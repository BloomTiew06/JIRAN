import { useEffect, useState } from 'react';
import type { HelpCategory } from '@jiran/core';
import type { Connections, HelpBoard, HelpView, Safety } from '../api.ts';
import { Icon } from '../icons.tsx';
import { Avatar, Chips, Empty, Header, Segmented, Sheet, ago, dayPlus, fmtDay, fmtWhen, useAction, useApp, useData } from '../ui.tsx';

type Seg = 'requests' | 'mine' | 'offers' | 'safety';
const CATS: { id: HelpCategory | ''; label: string }[] = [
  { id: '', label: 'All' }, { id: 'carry', label: 'Carrying' }, { id: 'pets', label: 'Pet care' }, { id: 'computer', label: 'Computer' },
  { id: 'repairs', label: 'Small repairs' }, { id: 'errands', label: 'Errands' }, { id: 'other', label: 'Other' },
];
const catLabel = (c: string) => CATS.find((x) => x.id === c)?.label ?? c;
const STATUS_CLS: Record<string, string> = { open: 's-requested', responded: 's-accepted', confirmed: 's-handed_over', completed: 's-returned', cancelled: '' };

export function HelpScreen() {
  const { section, me, open, t } = useApp();
  const [seg, setSeg] = useState<Seg>('requests');
  const [asking, setAsking] = useState(false);
  const [cat, setCat] = useState<HelpCategory | ''>('');
  useEffect(() => {
    if (section && ['requests', 'mine', 'offers', 'safety'].includes(section)) setSeg(section as Seg);
    else if (section) setSeg('mine');
  }, [section]);
  const { data } = useData<HelpBoard>(`/api/help${cat ? `?category=${cat}` : ''}`);
  const waiting = data?.mine.filter((h) => h.mine && h.statusKey === 'responded').length ?? 0;
  return (
    <div className="screen">
      <Header kicker={`${me.precinct.name} neighbours`} title={t('title.help')}
        right={<button className="btn small primary" onClick={() => setAsking(true)}><Icon name="plus" /> Ask</button>} />
      <div className="seg-scroll">
        <Segmented label="Help sections" value={seg} onChange={setSeg} options={[
          { id: 'requests', label: 'Requests' }, { id: 'mine', label: 'Mine', count: waiting }, { id: 'offers', label: 'Offers' }, { id: 'safety', label: 'Safety' },
        ]} />
      </div>
      <div className="screen-body">
        {me.floodAlert && <button className="flood-banner" onClick={() => open({ kind: 'flood' })}><Icon name="drop" /> Flood {me.floodAlert.level}: check in</button>}
        {(seg === 'requests' || seg === 'offers') && <Chips label="Category" value={cat} options={CATS} onChange={setCat} />}
        {seg === 'requests' && (data ? (data.requests.length ? <div className="list">{data.requests.map((h) => <HelpCard key={h.id} h={h} />)}</div>
          : <Empty icon="heart" title="All quiet" text="No one needs a hand right now." />) : <p className="muted">Loading…</p>)}
        {seg === 'mine' && (data ? (data.mine.length ? <div className="list">{data.mine.map((h) => <HelpCard key={h.id} h={h} />)}</div>
          : <Empty icon="heart" title="Nothing yet" text="Ask for help or offer it. Requests you post or help with show here." action={<button className="btn primary" onClick={() => setAsking(true)}>Ask for help</button>} />) : null)}
        {seg === 'offers' && <Offers board={data} />}
        {seg === 'safety' && <SafetyView />}
      </div>
      {asking && <AskSheet onClose={() => setAsking(false)} />}
    </div>
  );
}

function HelpCard({ h }: { h: HelpView }) {
  const { run, busy } = useAction();
  const [reply, setReply] = useState('');
  const [replying, setReplying] = useState(false);
  return (
    <div className={`card stack8${h.status === 'cancelled' ? ' dead' : ''}`}>
      <div className="row gap8"><span className="tag-soft">{catLabel(h.category)}</span><span className="grow muted small">{h.mine ? 'You' : h.requester} · {ago(h.createdAt)}</span>
        <span className={`status ${STATUS_CLS[h.statusKey]}`}>{h.statusLabel}</span></div>
      <strong>{h.title}</strong>
      {h.description && <p className="small">{h.description}</p>}
      <div className="muted small">{h.preferredAt ? `Preferred: ${fmtWhen(h.preferredAt)}` : 'Any time'}{h.resources ? ` · Needs: ${h.resources}` : ''}</div>
      {h.helper && <div className="why">{h.imHelping ? 'You are helping' : `${h.helper} is helping`}</div>}

      {!h.mine && h.status === 'open' && !h.iResponded && (replying ? (
        <form className="row gap8" onSubmit={async (e) => { e.preventDefault(); if (await run('POST', `/api/help/${h.id}/respond`, { message: reply }, `Told ${h.requester} you can help`)) setReplying(false); }}>
          <label className="sr-only" htmlFor={`r-${h.id}`}>Your reply</label>
          <input id={`r-${h.id}`} className="input grow" value={reply} maxLength={200} onChange={(e) => setReply(e.target.value)} placeholder="e.g. I can come Saturday 10am" />
          <button className="btn primary" disabled={busy}>Send</button>
        </form>
      ) : <button className="btn primary small" onClick={() => setReplying(true)}>I can help</button>)}
      {!h.mine && h.iResponded && h.status === 'open' && <p className="muted small">You offered. {h.requester} will confirm.</p>}

      {h.mine && h.status === 'open' && h.responses.length > 0 && (
        <div className="stack8">
          <div className="field-label">Responses</div>
          {h.responses.map((r) => (
            <div key={r.residentId} className="response">
              <div className="grow"><strong>{r.name}</strong><div className="small">“{r.message}”</div></div>
              <button className="btn small primary" disabled={busy} onClick={() => run('POST', `/api/help/${h.id}/confirm`, { helperId: r.residentId }, `${r.name} confirmed`)}>Choose</button>
            </div>
          ))}
        </div>
      )}
      {h.mine && h.status === 'confirmed' && <button className="btn primary small" disabled={busy} onClick={() => run('POST', `/api/help/${h.id}/complete`, undefined, `Thanked ${h.helper}. They earn points`)}>Done, say thanks</button>}
      {h.mine && (h.status === 'open' || h.status === 'confirmed') && <button className="link-btn" disabled={busy} onClick={() => run('POST', `/api/help/${h.id}/cancel`, undefined, 'Request cancelled')}>Cancel request</button>}
    </div>
  );
}

function AskSheet({ onClose }: { onClose: () => void }) {
  const { run, busy } = useAction();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<HelpCategory>('carry');
  const [description, setDescription] = useState('');
  const [when, setWhen] = useState(`${dayPlus(1)}T10:00`);
  const [resources, setResources] = useState('');
  return (
    <Sheet onClose={onClose} label="Ask for help">
      <h2>Ask your neighbours</h2>
      <label className="field-label" htmlFor="h-title">What do you need?</label>
      <input id="h-title" className="input" value={title} maxLength={70} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Feed my cat this weekend" />
      <div className="field-label">Category</div>
      <Chips wrap label="Category" value={category} options={CATS.filter((c) => c.id) as { id: HelpCategory; label: string }[]} onChange={setCategory} />
      <label className="field-label" htmlFor="h-desc">Details</label>
      <textarea id="h-desc" className="input" rows={3} maxLength={400} value={description} onChange={(e) => setDescription(e.target.value)} />
      <div className="grid2">
        <div className="stack4"><label className="field-label" htmlFor="h-when">Preferred date and time</label><input id="h-when" className="input" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></div>
        <div className="stack4"><label className="field-label" htmlFor="h-res">Anything needed?</label><input id="h-res" className="input" value={resources} maxLength={120} onChange={(e) => setResources(e.target.value)} placeholder="e.g. a trolley" /></div>
      </div>
      <p className="muted small">Help is free and friendly, never a paid job.</p>
      <button className="btn primary" disabled={busy || !title.trim()} onClick={async () => {
        if (await run('POST', '/api/help', { title, category, description, preferredAt: `${when}:00+08:00`, resources }, 'Posted to your precinct')) onClose();
      }}>Post request</button>
    </Sheet>
  );
}

function Offers({ board }: { board: HelpBoard | null }) {
  const { run, busy } = useAction();
  const { open } = useApp();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<HelpCategory>('carry');
  const [availability, setAvailability] = useState('');
  return (
    <>
      <div className="card form">
        <label className="field-label" htmlFor="o-title">Offer a hand</label>
        <input id="o-title" className="input" value={title} maxLength={70} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Walk your dog with mine" />
        <Chips wrap label="Category" value={category} options={CATS.filter((c) => c.id) as { id: HelpCategory; label: string }[]} onChange={setCategory} />
        <label className="sr-only" htmlFor="o-when">When</label>
        <input id="o-when" className="input" value={availability} maxLength={60} onChange={(e) => setAvailability(e.target.value)} placeholder="When, e.g. weekday mornings" />
        <button className="btn primary" disabled={busy || !title.trim()} onClick={async () => { if (await run('POST', '/api/help-offers', { title, category, availability }, 'Your offer is up')) { setTitle(''); setAvailability(''); } }}>Publish offer</button>
      </div>
      <div className="list">
        {board?.offers.map((o) => (
          <div key={o.id} className="card item-row">
            <span className="cat-icon cat-sports"><Icon name="heart" /></span>
            <div className="grow"><strong>{o.title}</strong><div className="muted small">{o.mine ? 'You' : o.owner} · {o.availability || 'Any time'}</div></div>
            {o.mine
              ? <button className="btn small" disabled={busy} onClick={() => run('PATCH', `/api/help-offers/${o.id}`, { active: false }, 'Offer removed')}>Remove</button>
              : <button className="btn small primary" onClick={() => open({ kind: 'neighbour', id: o.ownerId })}>Contact</button>}
          </div>
        ))}
      </div>
    </>
  );
}

function SafetyView() {
  const { data } = useData<Safety>('/api/safety');
  const { run, busy } = useAction();
  const { t } = useApp();
  const [asking, setAsking] = useState(false);
  if (!data) return <p className="muted">Loading…</p>;
  return (
    <>
      {data.alertsForMe.map((a) => <div key={a.id} className="card urgent strong" role="alert"><Icon name="siren" /> {a.from} at {a.unit} raised an alert {ago(a.at)}. Call 999 if it is an emergency.</div>)}
      <div className="card urgent stack8">
        <div className="row"><strong className="grow">Something urgent?</strong><span className="strong pink-ink small">Call {data.emergencyNumber} first</span></div>
        <div className="grid2">
          <a className="btn dark" href={`tel:${data.emergencyNumber}`}><Icon name="phone" /> {t('call999')}</a>
          {data.sos ? <button className="btn ok" disabled={busy} onClick={() => run('DELETE', '/api/sos', undefined, 'Alert cancelled. Glad you’re OK')}>Alert sent · cancel</button>
            : <button className="btn sos" disabled={busy} onClick={() => run<{ notified: string[] }>('POST', '/api/sos', undefined, (r) => `Alert sent to ${r.notified.length} neighbour contacts`)}><Icon name="siren" /> Alert neighbours</button>}
        </div>
        <p className="muted small">Police and ambulance {data.emergencyNumber} · Fire and rescue {data.fireNumber}. If the call button does nothing on your device, dial the number directly.</p>
      </div>

      <section className="stack8">
        <h2 className="section-title">Neighbour contacts</h2>
        <p className="muted small">They get your alert. They never see your location history.</p>
        <div className="contact-row">
          {data.contacts.map((c) => (
            <div key={c.id} className="contact">
              <Avatar name={c.firstName} color={c.avatar} photo={c.photo} size={46} />
              <span className="small strong">{c.firstName}</span>
              {c.incoming ? <button className="btn small primary" disabled={busy} onClick={() => run('POST', `/api/contacts/${c.id}/respond`, { accept: true }, `+5 points · you’re ${c.firstName}’s contact`)}>Accept</button>
                : c.status === 'pending' ? <span className="pill-muted">Asked</span> : <span className="pill-ok">Contact</span>}
            </div>
          ))}
        </div>
        {data.contacts.length === 0 && <p className="muted small">Add contacts from a connected neighbour’s profile.</p>}
      </section>

      <section className="stack8">
        <div className="row"><h2 className="section-title grow">Watch my house</h2><button className="btn small" onClick={() => setAsking(true)}><Icon name="plus" /> Ask</button></div>
        {data.watches.length === 0 && <p className="muted small">Going away? Ask a trusted, connected neighbour to keep an eye out.</p>}
        {data.watches.map((w) => (
          <div key={w.id} className="card stack8">
            <div className="row gap8"><strong className="grow">{w.asWatcher ? `${w.owner}’s house · ${w.ownerUnit}` : `${w.watcher} is watching your house`}</strong>
              <span className={`status ${w.status === 'accepted' ? 's-accepted' : w.status === 'done' ? 's-returned' : 's-requested'}`}>{w.status === 'pending' ? 'Waiting' : w.status === 'accepted' ? 'Agreed' : w.status === 'done' ? 'Done' : 'Declined'}</span></div>
            <div className="muted small">{fmtDay(w.from)} to {fmtDay(w.to)}{w.note ? ` · “${w.note}”` : ''}</div>
            {w.asWatcher && w.status === 'pending' && <div className="row gap8">
              <button className="btn small grow" disabled={busy} onClick={() => run('POST', `/api/watches/${w.id}/respond`, { accept: false }, 'Declined')}>Can’t this time</button>
              <button className="btn small primary grow" disabled={busy} onClick={() => run('POST', `/api/watches/${w.id}/respond`, { accept: true }, `You’ll watch ${w.owner}’s house`)}>Yes, I’ll watch</button></div>}
            {!w.asWatcher && w.status === 'accepted' && <button className="btn small primary" disabled={busy} onClick={() => run('POST', `/api/watches/${w.id}/done`, undefined, `Thanked ${w.watcher}`)}>I’m home, thank you</button>}
          </div>
        ))}
      </section>
      {asking && <WatchSheet onClose={() => setAsking(false)} />}
    </>
  );
}

export function WatchSheet({ watcher, onClose }: { watcher?: { id: string; firstName: string }; onClose: () => void }) {
  const { data: conns } = useData<Connections>('/api/connections');
  const { run, busy } = useAction();
  const [who, setWho] = useState(watcher?.id ?? '');
  const [from, setFrom] = useState(dayPlus(3));
  const [to, setTo] = useState(dayPlus(5));
  const [note, setNote] = useState('');
  const options = watcher ? [watcher] : conns?.connected.map((c) => ({ id: c.person.id, firstName: c.person.firstName })) ?? [];
  return (
    <Sheet onClose={onClose} label="Watch my house">
      <h2>Ask someone to watch your house</h2>
      {options.length === 0 ? <p className="muted">Only connected neighbours can watch your house. Connect with someone first.</p> : <>
        <label className="field-label" htmlFor="w-who">Neighbour</label>
        <select id="w-who" className="input" value={who} onChange={(e) => setWho(e.target.value)}>
          <option value="" disabled>Choose a connected neighbour</option>
          {options.map((o) => <option key={o.id} value={o.id}>{o.firstName}</option>)}
        </select>
        <div className="grid2">
          <div className="stack4"><label className="field-label" htmlFor="w-from">From</label><input id="w-from" className="input" type="date" min={dayPlus(0)} value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="stack4"><label className="field-label" htmlFor="w-to">To</label><input id="w-to" className="input" type="date" min={from} value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </div>
        <label className="field-label" htmlFor="w-note">Anything to check?</label>
        <textarea id="w-note" className="input" rows={2} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Parcels, plants, the gate" />
        <button className="btn primary" disabled={busy || !who} onClick={async () => { if (await run('POST', '/api/watches', { watcherId: who, from, to, note }, 'Request sent')) onClose(); }}>Send request</button>
      </>}
    </Sheet>
  );
}
