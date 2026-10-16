import { useEffect, useState } from 'react';
import type { ItemCategory, SkillCategory } from '@jiran/core';
import type { Giveaways, ItemView, LoanView, Loans, SkillRequests, SkillView } from '../api.ts';
import { Icon, type IconName } from '../icons.tsx';
import { Avatar, Chips, Empty, Header, Segmented, Sheet, Stars, dayPlus, fmtDay, useAction, useApp, useData } from '../ui.tsx';

type Seg = 'borrow' | 'skills' | 'loans' | 'give' | 'mine';

const CATS: { id: ItemCategory | ''; label: string }[] = [
  { id: '', label: 'All' }, { id: 'tools', label: 'Tools' }, { id: 'festive', label: 'Festive' }, { id: 'kitchen', label: 'Kitchen' },
  { id: 'sports', label: 'Sports' }, { id: 'kids', label: 'Kids' }, { id: 'home', label: 'Home' },
];
const CAT_ICON: Record<string, IconName> = { tools: 'wrench', festive: 'lamp', kitchen: 'heart', sports: 'ball', kids: 'star', home: 'home' };
const CONDITION = { like_new: 'Like new', good: 'Good', well_used: 'Well used' } as const;
const SKILL_CATS: { id: SkillCategory | ''; label: string }[] = [
  { id: '', label: 'All' }, { id: 'tutoring', label: 'Tutoring' }, { id: 'computer', label: 'Computer help' }, { id: 'cooking', label: 'Cooking' },
  { id: 'gardening', label: 'Gardening' }, { id: 'language', label: 'Languages' }, { id: 'repairs', label: 'Repairs' }, { id: 'other', label: 'Other' },
];

export function ShareScreen() {
  const { section, t } = useApp();
  const [seg, setSeg] = useState<Seg>('borrow');
  const { data: loans } = useData<Loans>('/api/loans');
  useEffect(() => { if (section && ['borrow', 'skills', 'loans', 'give', 'mine'].includes(section)) setSeg(section as Seg); }, [section]);
  const waiting = loans?.active.filter((l) => (l.role === 'lender' && l.status !== 'returned') || (l.role === 'borrower' && (l.status === 'accepted' || (l.status === 'returned' && !l.stars)))).length ?? 0;
  return (
    <div className="screen">
      <Header kicker="No rent, no deposits, no selling" title={t('title.share')} />
      <div className="seg-scroll">
        <Segmented label="Share sections" value={seg} onChange={setSeg} options={[
          { id: 'borrow', label: 'Borrow' }, { id: 'skills', label: 'Skills' }, { id: 'loans', label: 'My loans', count: waiting },
          { id: 'give', label: 'Give away' }, { id: 'mine', label: 'My shelf' },
        ]} />
      </div>
      <div className="screen-body">
        {seg === 'borrow' && <Browse />}
        {seg === 'skills' && <Skills />}
        {seg === 'loans' && <LoansView />}
        {seg === 'give' && <Give />}
        {seg === 'mine' && <Mine />}
      </div>
    </div>
  );
}

function Browse() {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<ItemCategory | ''>('');
  const [onlyAvailable, setOnlyAvailable] = useState(true);
  const [days, setDays] = useState('');
  const params = new URLSearchParams();
  if (q.trim()) params.set('q', q.trim());
  if (cat) params.set('category', cat);
  if (onlyAvailable) params.set('available', 'true');
  if (days) params.set('days', days);
  const { data } = useData<ItemView[]>(`/api/items?${params}`);
  const [pick, setPick] = useState<string | null>(null);
  const items = data?.filter((i) => !i.mine) ?? [];
  return (
    <>
      <div className="card stack8">
        <label className="sr-only" htmlFor="item-q">Search items</label>
        <input id="item-q" className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search, e.g. ladder, canopy, mixer" />
        <Chips label="Category" value={cat} options={CATS} onChange={setCat} />
        <div className="row gap8 wrap">
          <Chips label="Availability" value={onlyAvailable ? 'yes' : 'no'} options={[{ id: 'yes', label: 'Available now' }, { id: 'no', label: 'Show all' }]} onChange={(v) => setOnlyAvailable(v === 'yes')} />
          <label className="sr-only" htmlFor="item-days">Borrowing period</label>
          <select id="item-days" className="input compact" value={days} onChange={(e) => setDays(e.target.value)}>
            <option value="">Any period</option>{[1, 2, 3, 5, 7].map((d) => <option key={d} value={d}>{d}+ days</option>)}
          </select>
        </div>
      </div>
      {!data ? <p className="muted">Opening the shelves…</p> : items.length === 0
        ? <Empty icon="box" title="Nothing found" text="Ask in the noticeboard, someone usually has one." />
        : <div className="list">{items.map((i) => (
          <button key={i.id} className="card item-row link" onClick={() => setPick(i.id)} aria-label={`${i.title} from ${i.owner.firstName}`}>
            <span className={`cat-icon cat-${i.category}`}><Icon name={CAT_ICON[i.category] ?? 'box'} /></span>
            <div className="grow">
              <strong>{i.title}</strong>
              <div className="muted small">{i.owner.firstName} · {i.owner.unit}</div>
              <div className="muted tiny">{CONDITION[i.condition]} · up to {i.maxDays} day{i.maxDays > 1 ? 's' : ''}{i.rating ? ` · ★ ${i.rating}` : ''}</div>
            </div>
            {i.myLoan ? <span className="status s-accepted">{i.myLoan.label}</span> : i.available ? <span className="pill-ok">Available</span> : <span className="pill-muted">On loan</span>}
          </button>
        ))}</div>}
      {pick && <BorrowSheet itemId={pick} onClose={() => setPick(null)} />}
    </>
  );
}

export function BorrowSheet({ itemId, onClose }: { itemId: string; onClose: () => void }) {
  const { go } = useApp();
  const { data: i } = useData<ItemView>(`/api/items/${itemId}`);
  const { run, busy } = useAction();
  const [start, setStart] = useState(dayPlus(1));
  const [end, setEnd] = useState(dayPlus(2));
  const [note, setNote] = useState('');
  if (!i) return <Sheet onClose={onClose} label="Item"><p className="muted">Loading…</p></Sheet>;
  const days = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1;
  const tooLong = days > i.maxDays;
  return (
    <Sheet onClose={onClose} label={i.title}>
      <div className="kicker">{i.owner.firstName} · {i.owner.unit}</div>
      <h2>{i.title}</h2>
      {i.note && <p className="small">{i.note}</p>}
      <div className="tags">
        <span className="tag-soft">Condition: {CONDITION[i.condition]}</span>
        <span className="tag-soft">Up to {i.maxDays} day{i.maxDays > 1 ? 's' : ''}</span>
        {i.timesLent > 0 && <span className="tag-soft gold">Lent {i.timesLent} time{i.timesLent > 1 ? 's' : ''}{i.rating ? ` · ★ ${i.rating}` : ''}</span>}
      </div>
      {i.conditions && <p className="small"><strong>Borrowing conditions:</strong> {i.conditions}</p>}
      {i.myLoan ? (
        <><p className="muted">Your request: <strong>{i.myLoan.label}</strong></p><button className="btn" onClick={() => { onClose(); go('share:loans'); }}>See my loans</button></>
      ) : !i.available ? <p className="muted">This is out on loan right now.</p> : (
        <>
          <div className="grid2">
            <div className="stack4"><label className="field-label" htmlFor="b-start">Pick up</label><input id="b-start" className="input" type="date" min={dayPlus(0)} value={start} onChange={(e) => { setStart(e.target.value); if (e.target.value > end) setEnd(e.target.value); }} /></div>
            <div className="stack4"><label className="field-label" htmlFor="b-end">Return by</label><input id="b-end" className="input" type="date" min={start} value={end} onChange={(e) => setEnd(e.target.value)} /></div>
          </div>
          <p className={tooLong ? 'error' : 'muted small'}>{days} day{days > 1 ? 's' : ''}{tooLong ? `: ${i.owner.firstName} lends this for up to ${i.maxDays}` : ''}</p>
          <label className="field-label" htmlFor="b-note">Note for {i.owner.firstName} (optional)</label>
          <input id="b-note" className="input" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="What it is for" />
          <p className="muted small row gap6"><Icon name="shield" size={16} /> Free between neighbours. No rent, no deposit.</p>
          <button className="btn primary" disabled={busy || tooLong || days < 1} onClick={async () => {
            if (await run('POST', `/api/items/${i.id}/loans`, { startDate: start, endDate: end, note }, `Request sent to ${i.owner.firstName}`)) { onClose(); go('share:loans'); }
          }}>Request to borrow</button>
        </>
      )}
    </Sheet>
  );
}

function FakeQr({ code }: { code: string }) {
  const cells: string[] = [];
  let seed = Number(code) || 1;
  const next = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let y = 0; y < 21; y++) for (let x = 0; x < 21; x++) {
    if ((x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13)) continue;
    if (next() > 0.52) cells.push(`M${x} ${y}h1v1h-1z`);
  }
  const finder = (x: number, y: number) => `M${x} ${y}h7v7h-7zM${x + 1} ${y + 1}v5h5v-5zM${x + 2} ${y + 2}h3v3h-3z`;
  return (
    <svg width="132" height="132" viewBox="-1 -1 23 23" shapeRendering="crispEdges" role="img" aria-label={`Handover code ${code}`}>
      <rect x="-1" y="-1" width="23" height="23" fill="#fff" />
      <path d={finder(0, 0) + finder(14, 0) + finder(0, 14)} fill="#2B2340" fillRule="evenodd" />
      <path d={cells.join('')} fill="#2B2340" />
    </svg>
  );
}

function LoansView() {
  const { data } = useData<Loans>('/api/loans');
  if (!data) return <p className="muted">Loading…</p>;
  return (
    <>
      {data.active.length === 0 ? <Empty icon="box" title="No active loans" text="Borrow something from the Borrow tab or a neighbour’s profile." /> : <div className="list">{data.active.map((l) => <LoanCard key={l.id} l={l} />)}</div>}
      {data.history.length > 0 && <><h2 className="section-title">History</h2><div className="list">{data.history.map((l) => <LoanCard key={l.id} l={l} />)}</div></>}
    </>
  );
}

function LoanCard({ l }: { l: LoanView }) {
  const { run, busy } = useAction();
  const [code, setCode] = useState('');
  const base = `/api/loans/${l.id}`;
  const lender = l.role === 'lender';
  const steps = ['requested', 'accepted', 'handed_over', 'returned'];
  const at = Math.max(0, steps.indexOf(l.status));
  const dead = l.status === 'declined' || l.status === 'cancelled';
  return (
    <div className={`card loan${dead ? ' dead' : ''}`}>
      <div className="row gap12">
        <Avatar name={l.other.firstName} color={lender ? '#CFE3FF' : '#FFD9C2'} size={40} />
        <div className="grow">
          <strong>{l.itemTitle}</strong>
          <div className="muted small">{lender ? `Lending to ${l.other.firstName}` : `Borrowing from ${l.other.firstName}`}</div>
          <div className="muted tiny">{fmtDay(l.startDate)} to {fmtDay(l.endDate)} · {l.days} day{l.days > 1 ? 's' : ''}</div>
        </div>
        <span className={`status s-${l.status}`}>{l.statusLabel}</span>
      </div>
      {l.note && <p className="quote">“{l.note}”</p>}
      {!dead && <ol className="steps" aria-label="Loan progress">{['Pending', 'Approved', 'Borrowed', 'Returned'].map((s, i) => <li key={s} className={i < at || (i === at && l.status === 'returned') ? 'done' : i === at ? 'now' : ''}>{s}</li>)}</ol>}
      {l.overdue && <p className="error">Past the return date</p>}
      {!l.overdue && l.dueSoon && <p className="warn-text">Due back soon</p>}

      {lender && l.status === 'requested' && (
        <div className="row gap8">
          <button className="btn grow" disabled={busy} onClick={() => run('POST', `${base}/respond`, { accept: false }, 'Declined kindly')}>Decline</button>
          <button className="btn primary grow" disabled={busy} onClick={() => run('POST', `${base}/respond`, { accept: true }, `Approved for ${l.other.firstName}`)}>Approve</button>
        </div>
      )}
      {lender && l.status === 'accepted' && (
        <div className="stack8">
          <label className="field-label" htmlFor={`code-${l.id}`}>Scan or type {l.other.firstName}’s handover code</label>
          <div className="row gap8">
            <input id={`code-${l.id}`} className="input grow" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="6 digits" />
            <button className="btn primary" disabled={busy || code.length !== 6} onClick={() => run('POST', `${base}/handover`, { code }, 'Handover logged')}><Icon name="qr" /> Hand over</button>
          </div>
        </div>
      )}
      {lender && l.status === 'handed_over' && <button className="btn primary" disabled={busy} onClick={() => run('POST', `${base}/return`, undefined, `+15 points · ${l.itemTitle} is back home`)}><Icon name="check" /> I got it back</button>}
      {!lender && l.status === 'requested' && <button className="btn" disabled={busy} onClick={() => run('POST', `${base}/cancel`, undefined, 'Request cancelled')}>Cancel request</button>}
      {!lender && l.status === 'accepted' && l.handoverCode && (
        <div className="handover">
          <FakeQr code={l.handoverCode} />
          <div className="grow stack8">
            <div className="muted small">Show this at {l.other.firstName}’s door on {fmtDay(l.startDate)}, or read out the code:</div>
            <div className="code">{l.handoverCode.replace(/(\d{3})(\d{3})/, '$1 $2')}</div>
            <button className={`btn small${l.conditionPhoto ? ' ok' : ''}`} disabled={busy || l.conditionPhoto} onClick={() => run('POST', `${base}/photo`, undefined, 'Condition photo saved for both of you')}>
              <Icon name={l.conditionPhoto ? 'check' : 'camera'} /> {l.conditionPhoto ? 'Photo saved' : 'Condition photo'}
            </button>
            <button className="link-btn" disabled={busy} onClick={() => run('POST', `${base}/cancel`, undefined, 'Request cancelled')}>Cancel</button>
          </div>
        </div>
      )}
      {!lender && l.status === 'handed_over' && <p className="muted small">Return by {fmtDay(l.endDate)}. {l.other.firstName} confirms when it is back.</p>}
      {!lender && l.status === 'returned' && !l.stars && (
        <div className="stack8"><div className="field-label">How was borrowing from {l.other.firstName}?</div>
          <Stars value={0} disabled={busy} onPick={(n) => run<{ earned: number }>('POST', `${base}/rate`, { stars: n }, (r) => `+${r.earned} points · thanks for rating`)} /></div>
      )}
      {l.stars ? <Stars value={l.stars} size={18} /> : null}
    </div>
  );
}

function Skills() {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<SkillCategory | ''>('');
  const params = new URLSearchParams();
  if (q.trim()) params.set('q', q.trim());
  if (cat) params.set('category', cat);
  const { data } = useData<SkillView[]>(`/api/skills?${params}`);
  const { data: reqs } = useData<SkillRequests>('/api/skill-requests');
  const [ask, setAsk] = useState<string | null>(null);
  const [offering, setOffering] = useState(false);
  const { open } = useApp();
  return (
    <>
      <div className="card stack8">
        <label className="sr-only" htmlFor="skill-q">Search skills</label>
        <input id="skill-q" className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search, e.g. maths, wifi, Tamil" />
        <Chips label="Skill category" value={cat} options={SKILL_CATS} onChange={setCat} />
        <button className="btn" onClick={() => setOffering(true)}><Icon name="plus" /> Offer a skill</button>
      </div>
      {reqs && reqs.length > 0 && <SkillRequestsList reqs={reqs} />}
      <h2 className="section-title">Neighbours can teach</h2>
      {!data ? <p className="muted">Loading…</p> : data.length === 0 ? <Empty icon="book" title="No skills found" text="Offer one of yours, it counts for points." /> : (
        <div className="list">{data.map((s) => (
          <div key={s.id} className="card stack8">
            <div className="row gap12">
              <Avatar name={s.owner.firstName} color={s.owner.avatar} size={40} />
              <div className="grow">
                <strong>{s.title}</strong>
                <button className="link-plain muted small block" onClick={() => open({ kind: 'neighbour', id: s.owner.id })}>{s.mine ? 'You' : s.owner.firstName} · {s.owner.unit}</button>
              </div>
              <span className={`tag-soft ${s.arrangement === 'swap' ? 'blue' : 'gold'}`}>{s.arrangement === 'swap' ? 'Swap' : 'Free'}</span>
            </div>
            {s.description && <p className="small">{s.description}</p>}
            <div className="muted small">{s.availability}{s.arrangement === 'swap' ? ` · in return: ${s.swapFor}` : ''}{s.rating ? ` · ★ ${s.rating} from ${s.exchanges}` : ''}</div>
            {s.reviews[0] && <p className="quote">“{s.reviews[0].text}” · {s.reviews[0].by}</p>}
            {!s.mine && <button className="btn small primary" onClick={() => setAsk(s.id)}>Ask {s.owner.firstName}</button>}
          </div>
        ))}</div>
      )}
      {ask && <SkillRequestSheet skillId={ask} onClose={() => setAsk(null)} />}
      {offering && <OfferSkill onClose={() => setOffering(false)} />}
    </>
  );
}

function SkillRequestsList({ reqs }: { reqs: SkillRequests }) {
  const { run, busy } = useAction();
  const [rate, setRate] = useState<{ id: string; stars: number; feedback: string } | null>(null);
  const label = { requested: 'Waiting', accepted: 'Confirmed', declined: 'Declined', completed: 'Done', cancelled: 'Cancelled' } as const;
  return (
    <section className="stack8">
      <h2 className="section-title">Your exchanges</h2>
      {reqs.slice(0, 6).map((r) => (
        <div key={r.id} className={`card stack8${r.status === 'declined' || r.status === 'cancelled' ? ' dead' : ''}`}>
          <div className="row gap8"><strong className="grow">{r.skill}</strong><span className={`status s-${r.status === 'completed' ? 'returned' : r.status === 'accepted' ? 'accepted' : 'requested'}`}>{label[r.status]}</span></div>
          <div className="muted small">{r.incoming ? `${r.requester} asked you` : `With ${r.owner}`} · {fmtDay(r.date)}{r.note ? ` · ${r.note}` : ''}</div>
          {r.incoming && r.status === 'requested' && <div className="row gap8">
            <button className="btn small grow" disabled={busy} onClick={() => run('POST', `/api/skill-requests/${r.id}/respond`, { accept: false }, 'Declined')}>Can’t do it</button>
            <button className="btn small primary grow" disabled={busy} onClick={() => run('POST', `/api/skill-requests/${r.id}/respond`, { accept: true }, `Confirmed with ${r.requester}`)}>Yes, let’s do it</button></div>}
          {!r.incoming && r.status === 'accepted' && <button className="btn small primary" onClick={() => setRate({ id: r.id, stars: 5, feedback: '' })}>Mark done and say thanks</button>}
          {r.status === 'completed' && r.stars && <Stars value={r.stars} size={16} />}
        </div>
      ))}
      {rate && (
        <Sheet onClose={() => setRate(null)} label="Feedback">
          <h2>How did it go?</h2>
          <Stars value={rate.stars} onPick={(n) => setRate({ ...rate, stars: n })} />
          <label className="field-label" htmlFor="sk-fb">A short thank-you (optional)</label>
          <textarea id="sk-fb" className="input" rows={2} maxLength={300} value={rate.feedback} onChange={(e) => setRate({ ...rate, feedback: e.target.value })} />
          <button className="btn primary" disabled={busy} onClick={async () => { if (await run('POST', `/api/skill-requests/${rate.id}/complete`, { stars: rate.stars, feedback: rate.feedback }, 'Thanks sent. They earn points')) setRate(null); }}>Send</button>
        </Sheet>
      )}
    </section>
  );
}

export function SkillRequestSheet({ skillId, onClose }: { skillId: string; onClose: () => void }) {
  const { data } = useData<SkillView[]>('/api/skills');
  const { run, busy } = useAction();
  const [date, setDate] = useState(dayPlus(2));
  const [note, setNote] = useState('');
  const s = data?.find((x) => x.id === skillId);
  if (!s) return <Sheet onClose={onClose} label="Skill"><p className="muted">Loading…</p></Sheet>;
  return (
    <Sheet onClose={onClose} label={`Ask ${s.owner.firstName}`}>
      <div className="kicker">{s.owner.firstName} · {s.availability}</div>
      <h2>{s.title}</h2>
      <p className="small">{s.arrangement === 'swap' ? `${s.owner.firstName} would like help with “${s.swapFor}” in return.` : 'Shared for free, in kindness and points.'}</p>
      <label className="field-label" htmlFor="sk-date">Preferred date</label>
      <input id="sk-date" className="input" type="date" min={dayPlus(0)} value={date} onChange={(e) => setDate(e.target.value)} />
      <label className="field-label" htmlFor="sk-note">What do you need?</label>
      <textarea id="sk-note" className="input" rows={2} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
      <button className="btn primary" disabled={busy} onClick={async () => { if (await run('POST', `/api/skills/${s.id}/requests`, { date, note }, `Asked ${s.owner.firstName}`)) onClose(); }}>Send request</button>
    </Sheet>
  );
}

function OfferSkill({ onClose }: { onClose: () => void }) {
  const { run, busy } = useAction();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<SkillCategory>('tutoring');
  const [availability, setAvailability] = useState('Weekend mornings');
  const [arrangement, setArrangement] = useState<'free' | 'swap'>('free');
  const [swapFor, setSwapFor] = useState('');
  return (
    <Sheet onClose={onClose} label="Offer a skill">
      <h2>Offer a skill</h2>
      <label className="field-label" htmlFor="os-title">What can you teach or do?</label>
      <input id="os-title" className="input" value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Basic Excel for parents" />
      <div className="field-label">Category</div>
      <Chips wrap label="Category" value={category} options={SKILL_CATS.filter((c) => c.id) as { id: SkillCategory; label: string }[]} onChange={setCategory} />
      <label className="field-label" htmlFor="os-desc">Details</label>
      <textarea id="os-desc" className="input" rows={2} maxLength={300} value={description} onChange={(e) => setDescription(e.target.value)} />
      <label className="field-label" htmlFor="os-when">When you are free</label>
      <input id="os-when" className="input" value={availability} maxLength={60} onChange={(e) => setAvailability(e.target.value)} />
      <div className="field-label">Arrangement</div>
      <div className="grid2">
        <button className={arrangement === 'free' ? 'choice on' : 'choice'} aria-pressed={arrangement === 'free'} onClick={() => setArrangement('free')}>Free</button>
        <button className={arrangement === 'swap' ? 'choice on' : 'choice'} aria-pressed={arrangement === 'swap'} onClick={() => setArrangement('swap')}>Swap for a skill</button>
      </div>
      {arrangement === 'swap' && <><label className="field-label" htmlFor="os-swap">What would you like in return?</label>
        <input id="os-swap" className="input" value={swapFor} maxLength={60} onChange={(e) => setSwapFor(e.target.value)} placeholder="e.g. Help with my garden" /></>}
      <p className="muted small">Skills are never for payment on JIRAN.</p>
      <button className="btn primary" disabled={busy || !title.trim() || (arrangement === 'swap' && !swapFor.trim())} onClick={async () => {
        if (await run('POST', '/api/skills', { title, description, category, availability, arrangement, swapFor }, 'Your skill is listed')) onClose();
      }}>List my skill</button>
    </Sheet>
  );
}

function Give() {
  const { data } = useData<Giveaways>('/api/giveaways');
  const { run, busy } = useAction();
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  return (
    <>
      <div className="card form">
        <label className="field-label" htmlFor="give-title">Moving leftovers? Give them to a neighbour</label>
        <input id="give-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Spare curtain rails" maxLength={60} />
        <label className="sr-only" htmlFor="give-note">Note</label>
        <input id="give-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Where to collect (optional)" maxLength={200} />
        <button className="btn primary" disabled={busy || !title.trim()} onClick={async () => { if (await run('POST', '/api/giveaways', { title, note }, 'Posted to your precinct')) { setTitle(''); setNote(''); } }}><Icon name="gift" /> Give it away</button>
      </div>
      <div className="list">
        {data?.map((g) => (
          <div key={g.id} className={`card item-row${g.claimedBy ? ' dead' : ''}`}>
            <span className="cat-icon cat-festive"><Icon name="gift" /></span>
            <div className="grow"><strong>{g.title}</strong><div className="muted small">{g.mine ? 'You' : g.owner} · {g.ownerUnit}{g.note ? ` · ${g.note}` : ''}</div></div>
            {g.claimedBy ? <span className="pill-muted">{g.claimedByMe ? 'Yours!' : 'Claimed'}</span>
              : !g.mine && <button className="btn small primary" disabled={busy} onClick={() => run('POST', `/api/giveaways/${g.id}/claim`, undefined, `Tell ${g.owner} when you’ll collect`)}>I’ll take it</button>}
          </div>
        ))}
      </div>
    </>
  );
}

function Mine() {
  const { data } = useData<ItemView[]>('/api/items');
  const { run, busy } = useAction();
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [conditions, setConditions] = useState('');
  const [category, setCategory] = useState<ItemCategory>('tools');
  const [condition, setCondition] = useState<'like_new' | 'good' | 'well_used'>('good');
  const [maxDays, setMaxDays] = useState(3);
  const mine = data?.filter((i) => i.mine) ?? [];
  const add = async () => {
    if (await run('POST', '/api/items', { title, note, conditions, category, condition, maxDays }, `${title} is on your shelf`)) { setTitle(''); setNote(''); setConditions(''); }
  };
  return (
    <>
      <div className="card form">
        <label className="field-label" htmlFor="item-title">Something you’re happy to lend</label>
        <input id="item-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Extension cord 10m" maxLength={60} />
        <label className="sr-only" htmlFor="item-note">Description</label>
        <input id="item-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Description (optional)" maxLength={200} />
        <Chips wrap label="Category" value={category} options={CATS.filter((c) => c.id) as { id: ItemCategory; label: string }[]} onChange={setCategory} />
        <Chips wrap label="Condition" value={condition} options={[{ id: 'like_new', label: 'Like new' }, { id: 'good', label: 'Good' }, { id: 'well_used', label: 'Well used' }]} onChange={setCondition} />
        <label className="field-label" htmlFor="item-days">Lend for up to</label>
        <select id="item-days" className="input" value={maxDays} onChange={(e) => setMaxDays(Number(e.target.value))}>{[1, 2, 3, 5, 7, 14].map((d) => <option key={d} value={d}>{d} day{d > 1 ? 's' : ''}</option>)}</select>
        <label className="sr-only" htmlFor="item-cond">Borrowing conditions</label>
        <input id="item-cond" className="input" value={conditions} onChange={(e) => setConditions(e.target.value)} placeholder="Borrowing conditions, e.g. return it charged" maxLength={200} />
        <button className="btn primary" disabled={busy || !title.trim()} onClick={add}><Icon name="plus" /> Add to my shelf</button>
      </div>
      {mine.length === 0 ? <Empty icon="box" title="Your shelf is empty" text="Add one thing. Lenders get invited to more open houses." /> : (
        <div className="list">{mine.map((i) => (
          <div key={i.id} className="card item-row">
            <div className="grow"><strong>{i.title}</strong><div className="muted small">{i.available ? 'Available' : 'Hidden or on loan'} · up to {i.maxDays} days · lent {i.timesLent} times</div></div>
            <button className="btn small" disabled={busy} onClick={() => run('PATCH', `/api/items/${i.id}`, { available: !i.available }, i.available ? 'Hidden from neighbours' : 'Back on the shelf')}>{i.available ? 'Hide' : 'Show'}</button>
            <button className="btn small" disabled={busy} aria-label={`Remove ${i.title}`} onClick={() => run('DELETE', `/api/items/${i.id}`, undefined, 'Removed from your shelf')}><Icon name="close" /></button>
          </div>
        ))}</div>
      )}
    </>
  );
}
