import { useEffect, useState } from 'react';
import { PLACES } from '@jiran/core';
import type { ActivityCard, ActivityDetail, GroupList, MyActivities, SuggestedActivities } from '../api.ts';
import { Icon, type IconName } from '../icons.tsx';
import { Chips, Empty, Header, Segmented, Sheet, dayPlus, fmtWhen, useAction, useApp, useData } from '../ui.tsx';

const CAT_ICON: Record<string, IconName> = { sport: 'ball', social: 'users', games: 'star', class: 'book', kids: 'sparkle', study: 'book', cleanup: 'broom', open_house: 'lamp' };
const CAT_COLOR: Record<string, string> = { sport: '#2F6FEB', cleanup: '#1E9E72', open_house: '#8B5CF6', class: '#E8771A', social: '#D6336C', games: '#0E8A8A', kids: '#C2410C', study: '#5B6EE1' };

type Seg = 'feed' | 'mine' | 'foryou';
type When = 'any' | 'week' | 'weekend' | 'month';

export function ActivitiesScreen() {
  const { section, t, options } = useApp();
  const [seg, setSeg] = useState<Seg>('feed');
  const [creating, setCreating] = useState(false);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [when, setWhen] = useState<When>('any');
  useEffect(() => {
    if (section === 'new') setCreating(true);
    if (section === 'mine' || section === 'foryou') setSeg(section);
  }, [section]);

  const params = new URLSearchParams();
  if (q.trim()) params.set('q', q.trim());
  if (category) params.set('category', category);
  if (when !== 'any') {
    params.set('from', dayPlus(0));
    if (when === 'week') params.set('to', dayPlus(7));
    if (when === 'month') params.set('to', dayPlus(31));
    if (when === 'weekend') {
      const dow = new Date(Date.now() + 8 * 3600000).getUTCDay();
      const toSat = (6 - dow + 7) % 7;
      params.set('from', dayPlus(toSat)); params.set('to', dayPlus(toSat + 1));
    }
  }

  return (
    <div className="screen">
      <Header kicker="Taman Adira, the linear park and the Town Park" title={t('title.activities')}
        right={<button className="btn small primary" onClick={() => setCreating(true)}><Icon name="plus" /> Create</button>} />
      <Segmented label="Activity sections" value={seg} onChange={setSeg} options={[{ id: 'feed', label: 'All' }, { id: 'foryou', label: 'For you' }, { id: 'mine', label: 'My activities' }]} />
      <div className="screen-body">
        {seg === 'feed' && (
          <>
            <div className="card stack8">
              <label className="sr-only" htmlFor="a-q">Search activities</label>
              <input id="a-q" className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search activities by name" />
              <Chips label="When" value={when} options={[{ id: 'any', label: 'Any date' }, { id: 'week', label: 'Next 7 days' }, { id: 'weekend', label: 'This weekend' }, { id: 'month', label: 'This month' }]} onChange={setWhen} />
              <Chips label="Category" value={category} options={[{ id: '', label: 'All' }, ...options.activityCategories]} onChange={setCategory} />
            </div>
            <Feed path={`/api/activities?${params}`} />
          </>
        )}
        {seg === 'foryou' && <ForYou />}
        {seg === 'mine' && <Mine />}
      </div>
      {creating && <ActivityForm onClose={() => setCreating(false)} />}
    </div>
  );
}

function Feed({ path }: { path: string }) {
  const { data } = useData<ActivityCard[]>(path);
  if (!data) return <p className="muted">Checking the noticeboard…</p>;
  if (!data.length) return <Empty icon="calendar" title="Nothing matches" text="Try another date or category, or create the first one." />;
  return <div className="list">{data.map((a) => <ActivityRow key={a.id} a={a} />)}</div>;
}

function ForYou() {
  const { data } = useData<SuggestedActivities>('/api/activities/suggested');
  if (!data) return <p className="muted">Matching your interests…</p>;
  if (!data.length) return <Empty icon="sparkle" title="No suggestions yet" text="Add interests to your profile or join a group to get suggestions." />;
  return <div className="list">{data.map((a) => <ActivityRow key={a.id} a={a} why={a.why} />)}</div>;
}

function Mine() {
  const { data } = useData<MyActivities>('/api/activities/mine');
  if (!data) return <p className="muted">Loading…</p>;
  return (
    <>
      <h2 className="section-title">Joined</h2>
      {data.joined.length === 0 ? <p className="muted small">You have not joined anything yet.</p> : <div className="list">{data.joined.map((a) => <ActivityRow key={a.id} a={a} />)}</div>}
      <h2 className="section-title">Organised by you</h2>
      {data.created.length === 0 ? <p className="muted small">Host something small: a walk, a game night, a study hour.</p> : <div className="list">{data.created.map((a) => <ActivityRow key={a.id} a={a} />)}</div>}
    </>
  );
}

export function ActivityRow({ a, why }: { a: ActivityCard; why?: string[] }) {
  const { open } = useApp();
  const status = a.status === 'cancelled' ? 'Cancelled' : a.past ? 'Finished' : a.mine ? 'Hosting' : a.imIn ? 'Going' : a.spotsLeft === 0 ? 'Full' : null;
  return (
    <button className={`card activity-row link${a.status === 'cancelled' || a.past ? ' dead' : ''}`} onClick={() => open({ kind: 'activity', id: a.id })} aria-label={`${a.title}, ${fmtWhen(a.startsAt)}`}>
      <span className="kind-icon" style={{ background: CAT_COLOR[a.category] ?? '#D6336C' }}><Icon name={CAT_ICON[a.category] ?? 'users'} color="#fff" /></span>
      <div className="grow">
        <div className="kicker">{fmtWhen(a.startsAt)}</div>
        <strong className="g-title">{a.title}</strong>
        <div className="muted small">{a.place} · {a.going} going{a.capacity ? ` of ${a.capacity}` : ''}{a.group ? ` · ${a.group}` : ''}</div>
        {why?.length ? <div className="why">{why.join(' · ')}</div> : null}
      </div>
      {status && <span className={`status${status === 'Going' || status === 'Hosting' ? ' s-returned' : ''}`}>{status}</span>}
    </button>
  );
}

const toLocalInput = (iso: string) => {
  const d = new Date(new Date(iso).getTime() + 8 * 3600000);
  return d.toISOString().slice(0, 16);
};
const fromLocalInput = (v: string) => `${v}:00+08:00`;

export function ActivityForm({ onClose, existing, groupId }: { onClose: () => void; existing?: ActivityDetail; groupId?: string }) {
  const { options, open } = useApp();
  const { run, busy } = useAction();
  const { data: groups } = useData<GroupList>('/api/groups');
  const [title, setTitle] = useState(existing?.title ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [category, setCategory] = useState<string>(existing?.category ?? 'social');
  const [placeId, setPlaceId] = useState(existing?.placeId ?? PLACES[0].id);
  const [start, setStart] = useState(existing ? toLocalInput(existing.startsAt) : `${dayPlus(3)}T19:00`);
  const [hours, setHours] = useState(existing ? Math.max(1, Math.round((new Date(existing.endsAt).getTime() - new Date(existing.startsAt).getTime()) / 3600000)) : 2);
  const [capacity, setCapacity] = useState(existing?.capacity ? String(existing.capacity) : '');
  const [scope, setScope] = useState<'precinct' | 'township'>(existing?.scope ?? 'precinct');
  const [group, setGroup] = useState(existing?.groupId ?? groupId ?? '');

  const submit = async () => {
    const startsAt = fromLocalInput(start);
    const endsAt = new Date(new Date(startsAt).getTime() + hours * 3600000).toISOString();
    const body = { title, description, category, placeId, startsAt, endsAt, capacity: capacity ? Number(capacity) : null, scope, groupId: group || null };
    if (existing) {
      if (await run('PATCH', `/api/activities/${existing.id}`, body, 'Activity updated')) onClose();
    } else {
      const r = await run<{ id: string; earned: number }>('POST', '/api/activities', body, (x) => x.earned ? `+${x.earned} points · you’re hosting!` : 'Activity posted');
      if (r) { onClose(); open({ kind: 'activity', id: r.id }); }
    }
  };

  return (
    <Sheet onClose={onClose} label={existing ? 'Edit activity' : 'Create an activity'}>
      <h2>{existing ? 'Edit activity' : 'Create an activity'}</h2>
      <label className="field-label" htmlFor="af-title">Name</label>
      <input id="af-title" className="input" value={title} maxLength={70} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Evening walk round the linear park" />
      <div className="field-label">Category</div>
      <Chips wrap label="Category" value={category} options={options.activityCategories} onChange={setCategory} />
      <label className="field-label" htmlFor="af-place">Venue (shows on the map)</label>
      <select id="af-place" className="input" value={placeId} onChange={(e) => setPlaceId(e.target.value)}>
        {PLACES.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        <option value="home">My house</option>
      </select>
      <div className="grid2">
        <div className="stack4"><label className="field-label" htmlFor="af-start">Starts</label>
          <input id="af-start" className="input" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} /></div>
        <div className="stack4"><label className="field-label" htmlFor="af-hours">Hours</label>
          <select id="af-hours" className="input" value={hours} onChange={(e) => setHours(Number(e.target.value))}>{[1, 2, 3, 4, 5, 6].map((h) => <option key={h} value={h}>{h}</option>)}</select></div>
      </div>
      <label className="field-label" htmlFor="af-cap">Participant limit (blank for no limit)</label>
      <input id="af-cap" className="input" inputMode="numeric" value={capacity} onChange={(e) => setCapacity(e.target.value.replace(/\D/g, ''))} placeholder="e.g. 8" />
      {!existing && <>
        <div className="field-label">Who can see it</div>
        <div className="grid2">
          <button className={scope === 'precinct' ? 'choice on' : 'choice'} aria-pressed={scope === 'precinct'} onClick={() => setScope('precinct')}>My precinct</button>
          <button className={scope === 'township' ? 'choice on' : 'choice'} aria-pressed={scope === 'township'} onClick={() => setScope('township')}>Whole township</button>
        </div>
        {groups && groups.some((g) => g.joined) && <>
          <label className="field-label" htmlFor="af-group">For a group (optional)</label>
          <select id="af-group" className="input" value={group} onChange={(e) => setGroup(e.target.value)}>
            <option value="">No group</option>
            {groups.filter((g) => g.joined).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </>}
      </>}
      <label className="field-label" htmlFor="af-desc">Details</label>
      <textarea id="af-desc" className="input" rows={3} maxLength={400} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What to bring, who it suits" />
      <button className="btn primary" disabled={busy || !title.trim()} onClick={submit}><Icon name="calendar" /> {existing ? 'Save changes' : 'Publish'}</button>
    </Sheet>
  );
}
