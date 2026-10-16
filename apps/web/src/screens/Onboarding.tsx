import { useState } from 'react';
import type { Me, Recommendations } from '../api.ts';
import { HouseArt } from '../house.tsx';
import { Icon } from '../icons.tsx';
import { Avatar, fmtWhen, useAction, useApp, useData } from '../ui.tsx';
import { BasicsFields, InterestFields, SettingsFields, useDraft } from './Profile.tsx';

/** J: Join. Verified at key handover, then consent, profile, interests, and first recommendations. */
export function Onboarding({ onDone }: { onDone: (me: Me) => void }) {
  const { me } = useApp();
  const { d, set } = useDraft(me);
  const { run, busy } = useAction();
  const [step, setStep] = useState(0);
  const [consent, setConsent] = useState(false);
  const [adult, setAdult] = useState(false);
  const [joined, setJoined] = useState<Me | null>(null);
  const steps = ['Welcome', 'About you', 'Interests', 'Settings'];

  const finish = async () => {
    const r = await run<Me>('POST', '/api/onboarding', { ...d, consent, adult }, '+50 points · welcome to JIRAN!');
    if (r) setJoined(r);
  };

  if (joined) return <FirstRecommendations onDone={() => onDone(joined)} />;

  return (
    <div className="screen onboarding">
      <div className="onb-progress" aria-label={`Step ${step + 1} of ${steps.length}`}>
        {steps.map((s, i) => <span key={s} className={i <= step ? 'on' : ''} />)}
      </div>
      <div className="screen-body">
        {step === 0 && (
          <>
            <div className="card hero-card">
              <div className="hero-houses" aria-hidden="true">
                <HouseArt wall="#FFD9C2" roof="#F26B5B" w={60} h={56} />
                <HouseArt wall="#FFF8EE" roof={d.houseColor} w={88} h={82} decor={{ bunting: true, plants: true }} bob />
                <HouseArt wall="#CFE3FF" roof="#5B6EE1" w={60} h={56} />
              </div>
              <div className="kicker center">Verified with Sime Darby Property’s purchaser records</div>
              <h1 className="center">Welcome home{me.firstName && me.firstName !== 'Neighbour' ? `, ${me.firstName}` : ''}!</h1>
              <p className="center">Your house at <strong>{me.unit}</strong> is already on the {me.precinct.name} map. Let’s set up how your neighbours meet you.</p>
            </div>
            <div className="card stack12">
              <label className="check" htmlFor="c-consent">
                <input id="c-consent" type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                <span>I agree to share my display name, street and the profile details I choose with residents of my precinct, under the PDPA. I can change or hide them any time.</span>
              </label>
              <label className="check" htmlFor="c-adult">
                <input id="c-adult" type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} />
                <span>I am 18 or older.</span>
              </label>
              <p className="muted small row gap6"><Icon name="shield" size={16} /> No money ever changes hands on JIRAN. No selling, renting or deposits.</p>
            </div>
          </>
        )}
        {step === 1 && <div className="card"><h2>About you</h2><BasicsFields d={d} set={set} /></div>}
        {step === 2 && <div className="card"><h2>What you enjoy</h2><p className="muted small">We use these to suggest neighbours, groups and activities.</p><InterestFields d={d} set={set} /></div>}
        {step === 3 && <div className="card"><h2>Settings</h2><SettingsFields d={d} set={set} /></div>}
      </div>
      <div className="onb-actions">
        {step > 0 && <button className="btn" onClick={() => setStep(step - 1)}>Back</button>}
        {step < 3 ? (
          <button className="btn primary grow" disabled={(step === 0 && (!consent || !adult)) || (step === 1 && !d.firstName.trim())} onClick={() => setStep(step + 1)}>Continue</button>
        ) : (
          <button className="btn primary grow" disabled={busy} onClick={finish}>Join my neighbourhood</button>
        )}
      </div>
    </div>
  );
}

function FirstRecommendations({ onDone }: { onDone: () => void }) {
  const { data } = useData<Recommendations>('/api/recommendations');
  return (
    <div className="screen">
      <div className="screen-body">
        <div className="kicker">Picked for you</div>
        <h1>Your first neighbours</h1>
        {!data ? <p className="muted">Finding people like you…</p> : (
          <>
            {data.residents.length > 0 && (
              <div className="list">
                {data.residents.map((p) => (
                  <div key={p.id} className="card item-row">
                    <Avatar name={p.firstName} color={p.avatar} photo={p.photo} size={44} />
                    <div className="grow"><strong>{p.firstName}</strong><div className="muted small">{p.reasons[0] ?? p.street}</div></div>
                  </div>
                ))}
              </div>
            )}
            {data.groups.length > 0 && <><h2 className="section-title">Groups you might like</h2>
              <div className="list">{data.groups.map((g) => <div key={g.id} className="card item-row"><Icon name="users" /><div className="grow"><strong>{g.name}</strong><div className="muted small">{g.members} members</div></div></div>)}</div></>}
            {data.activities.length > 0 && <><h2 className="section-title">Coming up</h2>
              <div className="list">{data.activities.map((a) => <div key={a.id} className="card item-row"><Icon name="calendar" /><div className="grow"><strong>{a.title}</strong><div className="muted small">{fmtWhen(a.startsAt)} · {a.place}</div></div></div>)}</div></>}
            {data.tips.map((t) => <p key={t} className="tip"><Icon name="sparkle" size={16} /> {t}</p>)}
          </>
        )}
      </div>
      <div className="onb-actions"><button className="btn primary grow" onClick={onDone}>Start exploring</button></div>
    </div>
  );
}
