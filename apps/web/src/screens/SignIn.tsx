import { useState } from 'react';
import { DEMO_PERSONAS } from '@jiran/core';
import { HouseArt } from '../house.tsx';
import { Icon } from '../icons.tsx';

export function SignIn({ onCode, error, busy, mode, restored, onReset }: {
  onCode: (code: string) => void; error: string | null; busy: boolean; mode: 'live' | 'demo'; restored?: boolean; onReset?: () => void;
}) {
  const [code, setCode] = useState('');
  const [sure, setSure] = useState(false);
  return (
    <div className="signin">
      <div className="signin-hero">
        <div className="hero-houses" aria-hidden="true">
          <HouseArt wall="#FFD9C2" roof="#F26B5B" w={70} h={66} />
          <HouseArt wall="#FFE3DE" roof="#E8452C" w={96} h={90} decor={{ plants: true, bunting: true }} />
          <HouseArt wall="#CFE3FF" roof="#5B6EE1" w={70} h={66} />
        </div>
        <h1 className="logo">JIRAN</h1>
        <p>Meet the neighbours you just moved in next to. Borrow, help and gather. Never any money.</p>
      </div>

      <div className="card form">
        <strong>Verify you live here</strong>
        <p className="muted small">Owners join with the code on their vacant-possession pack. Inside the Sime Darby Property app this happens automatically.</p>
        <label className="sr-only" htmlFor="code">Handover code</label>
        <div className="row gap8">
          <input id="code" className="input grow" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. ADIRA-212" autoCapitalize="characters" />
          <button className="btn primary" disabled={busy || !code.trim()} onClick={() => onCode(code)}>Join</button>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
      </div>

      <div className="card form">
        <strong>{mode === 'demo' ? 'Try the demo as' : 'Demo residents'}</strong>
        <div className="list">
          {DEMO_PERSONAS.map((p) => (
            <button key={p.code} className="persona" disabled={busy} onClick={() => onCode(p.code)}>
              <span className="grow"><strong>{p.label}</strong><span className="muted small"> · {p.note}</span></span>
              <Icon name="chevron" />
            </button>
          ))}
        </div>
        {mode === 'demo' && restored && onReset && (
          <div className="row gap8 saved-note">
            <span className="grow muted small">Your changes from last time are saved in this browser.</span>
            <button className="btn small" onClick={() => (sure ? onReset() : setSure(true))}>{sure ? 'Tap again to confirm' : 'Start fresh'}</button>
          </div>
        )}
      </div>
      <p className="muted small center">By joining you agree to share your first name and street with your precinct only (PDPA consent). 18 and over.</p>
    </div>
  );
}
