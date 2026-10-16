import { useState } from 'react';
import type { CheckinStatus } from '@jiran/core';
import type { FloodBoard } from '../api.ts';
import { FLOOD_STYLE } from '../house.tsx';
import { Icon } from '../icons.tsx';
import { Avatar, Header, fmtWhen, useAction, useApp, useData } from '../ui.tsx';

const OPTIONS: { id: CheckinStatus; title: string; sub: string; icon: 'check' | 'lifebuoy' | 'heart' }[] = [
  { id: 'safe', title: 'I’m safe', sub: 'Tell the street you are OK', icon: 'check' },
  { id: 'need_help', title: 'I need help', sub: 'Car to move, elderly parent, water coming in', icon: 'lifebuoy' },
  { id: 'can_help', title: 'I can help', sub: 'Spare room, 4x4, extra hands', icon: 'heart' },
];

export function FloodScreen({ onClose }: { onClose: () => void }) {
  const { me } = useApp();
  const { data } = useData<FloodBoard>('/api/flood');
  const { run, busy } = useAction();
  const [note, setNote] = useState('');

  const checkin = (status: CheckinStatus) =>
    run<{ earned: number }>('POST', '/api/flood/checkin', { status, note }, (r) =>
      r.earned ? `+${r.earned} points · your street can see your check-in` : 'Check-in updated');

  return (
    <div className="screen flood-screen">
      <Header kicker={`${me.precinct.name} · flood check-in`} title="Look out for each other" back={onClose} />
      <div className="screen-body">
        {!data ? <div className="muted pad">Checking alerts…</div> : !data.alert ? (
          <div className="card">
            <strong>No flood alert right now</strong>
            <p className="muted small">When the public flood warning feed (JPS and MetMalaysia) issues an alert for Bandar Bukit Raja, this screen opens for everyone in affected precincts.</p>
          </div>
        ) : (
          <>
            <div className={`card flood-alert lv-${data.alert.level}`}>
              <div className="row gap8"><Icon name="drop" /><strong className="grow">Flood {data.alert.level}</strong><span className="small">{fmtWhen(data.alert.issuedAt)}</span></div>
              <p>{data.alert.title}</p>
              <div className="small">Source: {data.alert.source}. In danger? Call 999 first.</div>
            </div>

            <h2 className="section-title">Your check-in</h2>
            <label className="sr-only" htmlFor="flood-note">Note for neighbours</label>
            <input id="flood-note" className="input" maxLength={140} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Short note (optional), e.g. water at the gate" />
            <div className="checkin-grid">
              {OPTIONS.map((o) => (
                <button key={o.id} className={`checkin c-${o.id}${data.mine?.status === o.id ? ' on' : ''}`} aria-pressed={data.mine?.status === o.id} disabled={busy} onClick={() => checkin(o.id)}>
                  <Icon name={o.icon} size={26} />
                  <strong>{o.title}</strong>
                  <span>{o.sub}</span>
                </button>
              ))}
            </div>

            <h2 className="section-title">Your street right now</h2>
            <div className="flood-counts">
              <div><strong>{data.counts.need_help}</strong><span>need help</span></div>
              <div><strong>{data.counts.can_help}</strong><span>can help</span></div>
              <div><strong>{data.counts.safe}</strong><span>safe</span></div>
              <div><strong>{data.counts.unknown}</strong><span>not yet</span></div>
            </div>
            <div className="list">
              {data.neighbours.map((n) => (
                <div key={n.id} className="card item-row">
                  <Avatar name={n.firstName} color={n.status ? FLOOD_STYLE[n.status].color : '#E4E0EC'} size={36} />
                  <div className="grow">
                    <strong>{n.isYou ? 'You' : n.firstName}</strong>
                    <div className="muted small">{n.unit}{n.note ? ` · ${n.note}` : ''}</div>
                  </div>
                  <span className="status" style={n.status ? { background: FLOOD_STYLE[n.status].color, color: '#fff' } : undefined}>
                    {n.status ? FLOOD_STYLE[n.status].label : 'Not checked in'}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
