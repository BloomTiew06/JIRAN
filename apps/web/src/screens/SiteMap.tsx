import { useMemo, useState } from 'react';
import type { Site } from '../api.ts';
import { BADGE_STYLE, FLOOD_STYLE } from '../house.tsx';
import { Icon } from '../icons.tsx';
import { usePanZoom } from '../panzoom.ts';
import { Coin, Sheet, fmtWhen, useApp, useData } from '../ui.tsx';

type Lot = Site['lots'][number];
type Filter = 'all' | 'lend' | 'help' | 'open_house' | 'new' | 'connected';

const FILTERS: { id: Filter; label: string; dot: string }[] = [
  { id: 'all', label: 'All homes', dot: '#5DBB72' },
  { id: 'connected', label: 'My connections', dot: '#FF7FA3' },
  { id: 'new', label: 'New', dot: BADGE_STYLE.new.color },
  { id: 'lend', label: 'Lend', dot: BADGE_STYLE.lend.color },
  { id: 'help', label: 'Help', dot: BADGE_STYLE.help.color },
  { id: 'open_house', label: 'Open house', dot: BADGE_STYLE.open_house.color },
];

const LOT_LABEL = { intermediate: 'Intermediate lot, 20 ft × 75 ft', end: 'End lot, 22 ft × 75 ft', corner: 'Corner lot, 22 ft × 75 ft' };
const CAT_COLOR: Record<string, string> = { sport: '#2F6FEB', cleanup: '#1E9E72', open_house: '#8B5CF6', class: '#E8771A', social: '#D6336C', games: '#0E8A8A', kids: '#C2410C', study: '#5B6EE1' };

/** The real Adira Series 1 layout: 12 terrace rows, 109 lots, garden and linear park. */
export function SiteMap({ onTownship, onStreet }: { onTownship: () => void; onStreet: () => void }) {
  const { me, go, open } = useApp();
  const { data } = useData<Site>('/api/site');
  if (!data) return <div className="map-loading">Laying out Adira’s 109 homes…</div>;
  return <SiteCanvas data={data} onTownship={onTownship} onStreet={onStreet} me={me} go={go} open={open} />;
}

function SiteCanvas({ data, onTownship, onStreet, me, go, open }: { data: Site; onTownship: () => void; onStreet: () => void } & Pick<ReturnType<typeof useApp>, 'me' | 'go' | 'open'>) {
  const myLot = data.lots.find((l) => l.id === data.myUnitId);
  const pz = usePanZoom({ x: -10, y: 0, w: data.size.w + 20, h: data.size.h }, {
    cx: myLot ? myLot.x + myLot.w / 2 : 240, cy: myLot ? myLot.y + myLot.h / 2 : 300, scale: 1.25,
  }, { min: 0.5, max: 4 }, { pastMax: myLot ? onStreet : undefined, pastMin: onTownship });
  const [filter, setFilter] = useState<Filter>('all');
  const [sel, setSel] = useState<{ kind: 'lot'; lot: Lot } | { kind: 'amenity'; code: string } | null>(null);
  const ui = 1 / pz.view.scale;
  const showNames = pz.view.scale >= 2.3;

  const match = (l: Lot) => {
    const r = l.resident;
    if (filter === 'all' || r?.isYou) return true;
    if (!r) return false;
    if (filter === 'connected') return r.connection === 'connected';
    if (filter === 'new') return r.isNew;
    return r.badge === filter;
  };

  const trees = useMemo(() => {
    const out: [number, number, number][] = [];
    for (let y = 70; y < 590; y += 34) out.push([13, y, 9]);
    for (let x = 16; x < 620; x += 46) out.push([x, 650, 8]);
    for (const [x, y] of [[512, 60], [620, 80], [512, 160], [624, 230], [612, 300], [508, 400], [620, 480], [512, 540], [624, 600]]) out.push([x, y, 11]);
    // Street trees on the walkways of Jalan Adira 1 to 4.
    for (const y of [20, 210, 400, 590]) for (let x = 52; x < 480; x += 40) { if (x > 214 && x < 270) continue; out.push([x, y + (x % 80 === 12 ? 4 : 36), 4.2]); }
    return out;
  }, []);

  return (
    <div className="township">
      <div className="map-box" ref={pz.box}>
        <svg className="map-svg" viewBox={pz.viewBox} width={pz.size.w} height={pz.size.h} {...pz.handlers}
          role="application" aria-label="Site plan of Adira Series 1. Drag to explore, pinch or use the buttons to zoom.">
          <defs>
            <pattern id="flood-site" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
              <rect width="8" height="8" fill="#2F6FEB" opacity=".16" /><line x1="0" y1="0" x2="0" y2="8" stroke="#2F6FEB" strokeWidth="2" opacity=".45" />
            </pattern>
          </defs>
          <rect x="-200" y="-200" width={data.size.w + 400} height={data.size.h + 400} fill="#C9E7BC" />

          {data.areas.map((a) => (
            <g key={a.id}>
              <rect x={a.x} y={a.y} width={a.w} height={a.h} rx={a.kind === 'lake' ? 0 : 14}
                fill={a.kind === 'lake' ? '#9ED9F1' : a.kind === 'buffer' ? '#B5DBA8' : '#A9DA97'} stroke="#2B2340" strokeWidth={a.kind === 'buffer' ? 0 : 1.2} />
              {a.kind === 'garden' && <path d={`M${a.x + 30} ${a.y + 30} C ${a.x + 120} ${a.y + 140}, ${a.x + 20} ${a.y + 300}, ${a.x + 110} ${a.y + 420} S ${a.x + 40} ${a.y + 560}, ${a.x + 70} ${a.y + a.h - 10}`} fill="none" stroke="#F6EEDF" strokeWidth="8" strokeLinecap="round" />}
              {a.kind === 'linear' && <>
                <path d={`M10 ${a.y + 36} H${a.w - 10}`} stroke="#F6EEDF" strokeWidth="9" strokeLinecap="round" />
                <path d={`M10 ${a.y + 76} H${a.w - 10}`} stroke="#E8D9BE" strokeWidth="7" strokeDasharray="14 8" strokeLinecap="round" />
              </>}
              {a.kind !== 'buffer' && pz.view.scale > 0.9 && (
                <text x={a.kind === 'garden' ? a.x + a.w / 2 : a.x + 14} y={a.kind === 'garden' ? a.y + 22 : a.y + 18} textAnchor={a.kind === 'garden' ? 'middle' : 'start'}
                  className="site-label" fontSize={10 * ui}>{a.name}</text>
              )}
            </g>
          ))}
          {trees.map(([x, y, r], i) => (
            <g key={i} aria-hidden="true"><circle cx={x} cy={y} r={r} fill={i % 2 ? '#4FAE66' : '#5DBB72'} stroke="#2B2340" strokeWidth="1" /><circle cx={x - r / 3} cy={y - r / 3} r={r / 3.2} fill="#8FD69B" /></g>
          ))}

          {data.roads.map((r) => (
            <g key={r.name}>
              <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="#ABA5B8" />
              {r.vertical ? <>
                <rect x={r.x} y={r.y} width={5} height={r.h} fill="#EFE8DA" />
                <rect x={r.x + r.w - 5} y={r.y} width={5} height={r.h} fill="#EFE8DA" />
                <line x1={r.x + r.w / 2} x2={r.x + r.w / 2} y1={r.y + 4} y2={r.y + r.h - 4} stroke="#fff" strokeWidth="1.2" strokeDasharray="7 6" />
              </> : <>
                <rect x={r.x} y={r.y} width={r.w} height={5} fill="#EFE8DA" />
                <rect x={r.x} y={r.y + r.h - 5} width={r.w} height={5} fill="#EFE8DA" />
                <line x1={r.x + 4} x2={r.x + r.w - 4} y1={r.y + r.h / 2} y2={r.y + r.h / 2} stroke="#fff" strokeWidth="1.2" strokeDasharray="7 6" />
              </>}
              <text x={r.vertical ? r.label[0] : r.label[0] + 4} y={r.vertical ? r.label[1] : r.y + r.h / 2 - 3} className="road-label light" fontSize={Math.min(10, 9 * ui * 1.6)}
                transform={r.vertical ? `rotate(-90 ${r.label[0]} ${r.label[1]})` : undefined}>{r.name.toUpperCase()}</text>
            </g>
          ))}
          {[[60, 25], [180, 405], [330, 215], [440, 595], [120, 595], [380, 25]].map(([x, y], i) => (
            <g key={`lamp-${i}`} aria-hidden="true"><circle cx={x} cy={y} r="2.4" fill="#FFE08A" stroke="#4B4458" strokeWidth="0.8" /></g>
          ))}
          <g transform={`translate(${data.entrance.at[0]} ${data.entrance.at[1]})`} aria-hidden="true">
            <rect x="-6" y="-14" width="12" height="28" rx="3" fill="#E8452C" stroke="#2B2340" strokeWidth="1.2" />
            {pz.view.scale > 1 && <text x="12" y="-18" className="site-label" fontSize={9 * ui}>{data.entrance.name}</text>}
          </g>

          {data.lots.map((l) => <LotShape key={l.id} l={l} dim={!match(l)} ui={ui} showNames={showNames}
            onTap={pz.tap(() => (l.resident && !l.resident.isYou ? open({ kind: 'neighbour', id: l.resident.id }) : setSel({ kind: 'lot', lot: l })))} />)}

          {data.amenities.map((a) => (
            <g key={a.code} className="map-pin" role="button" tabIndex={0} aria-label={`${a.code}: ${a.name}`}
              transform={`translate(${a.at[0]} ${a.at[1]})`} onClick={pz.tap(() => setSel({ kind: 'amenity', code: a.code }))}
              onKeyDown={(e) => { if (e.key === 'Enter') setSel({ kind: 'amenity', code: a.code }); }}>
              <circle r={Math.max(8, 11 * ui)} fill="#fff" stroke="#2B2340" strokeWidth="1.4" />
              <text y={Math.max(8, 11 * ui) * 0.38} textAnchor="middle" className="amenity-code" fontSize={Math.max(9, 12 * ui)}>{a.code}</text>
              {pz.view.scale >= 1.8 && <text x={Math.max(8, 11 * ui) + 3} y="3" className="site-label" fontSize={9 * ui}>{a.name}</text>}
            </g>
          ))}

          {(data.pins as { id: string; title: string; category: string; at: [number, number]; startsAt: string }[]).map((p, i, all) => {
            const same = all.filter((o, j) => j < i && o.at[0] === p.at[0] && o.at[1] === p.at[1]).length;
            return (
              <g key={p.id} className="map-pin" role="button" tabIndex={0} aria-label={`${p.title}, ${fmtWhen(p.startsAt)}`}
                transform={`translate(${p.at[0] + 16 * ui + same * 26 * ui} ${p.at[1] - 16 * ui}) scale(${ui})`}
                onClick={pz.tap(() => open({ kind: 'activity', id: p.id }))} onKeyDown={(e) => { if (e.key === 'Enter') open({ kind: 'activity', id: p.id }); }}>
                <path d="M0 12 C -12 0, -12 -14, 0 -14 C 12 -14, 12 0, 0 12 Z" fill={CAT_COLOR[p.category] ?? '#D6336C'} stroke="#2B2340" strokeWidth="2" />
                <circle cy="-3" r="4" fill="#fff" />
              </g>
            );
          })}
          {data.floodAlert && <rect x="-200" y="-200" width={data.size.w + 400} height={data.size.h + 400} fill="url(#flood-site)" pointerEvents="none" />}
        </svg>

        <div className="map-top">
          <div className="map-title">
            <div className="kicker">{data.phase} · {data.stats.homes} homes · {data.stats.onJiran} on JIRAN</div>
            <strong>{data.name}</strong>
          </div>
          <button className="points-pill" onClick={() => go('me')} aria-label={`${me.points} JIRAN points`}><Coin /> {me.points}</button>
        </div>
        <div className="chips map-chips" role="toolbar" aria-label="Show homes">
          {FILTERS.map((f) => (
            <button key={f.id} className={filter === f.id ? 'chip on' : 'chip'} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
              <span className="dot" style={{ background: f.dot }} />{f.label}
            </button>
          ))}
        </div>
        <div className="map-tools">
          {myLot && <button className="round-btn accent" onClick={onStreet} aria-label="My street in 3D"><Icon name="cube" /></button>}
          <button className="round-btn" onClick={onTownship} aria-label="Whole township map"><Icon name="map" /></button>
          <button className="round-btn" onClick={() => go('neighbours:board')} aria-label={`Noticeboard, ${data.noticeCount} notices`}><Icon name="book" /></button>
          <button className="round-btn" onClick={() => pz.zoom(1.3)} aria-label="Zoom in"><Icon name="zoomIn" /></button>
          <button className="round-btn" onClick={() => pz.zoom(0.77)} aria-label="Zoom out"><Icon name="zoomOut" /></button>
          {myLot && <button className="round-btn" onClick={() => pz.centre(myLot.x + myLot.w / 2, myLot.y + myLot.h / 2, 2.6)} aria-label="Go to my house"><Icon name="locate" /></button>}
        </div>
        {data.floodAlert && <button className="flood-banner floating" onClick={() => open({ kind: 'flood' })}><Icon name="drop" /> Flood {data.floodAlert.level}: check in</button>}
        {data.season && <div className="season-pill" aria-label={`${data.season.name} decorations are up`}><Icon name="sparkle" size={16} /> {data.season.name} season</div>}
      </div>

      {sel?.kind === 'lot' && (
        <Sheet onClose={() => setSel(null)} label={`No. ${sel.lot.no}, ${sel.lot.street}`}>
          <div className="kicker">{LOT_LABEL[sel.lot.type]}</div>
          <h2>No. {sel.lot.no}, {sel.lot.street}</h2>
          {sel.lot.resident?.isYou ? (
            <>
              <p className="muted">This is your home. Change your house colour and decorations in your profile.</p>
              <button className="btn primary" onClick={() => { setSel(null); go('me'); }}><Icon name="home" /> My house</button>
            </>
          ) : (
            <p className="muted">{sel.lot.occupied ? 'The owners have not joined JIRAN yet, or keep their profile private.' : 'Keys for this home have not been handed over yet. When the owner collects them, their house appears here with a ribbon.'}</p>
          )}
        </Sheet>
      )}
      {sel?.kind === 'amenity' && (() => {
        const a = data.amenities.find((x) => x.code === sel.code)!;
        return (
          <Sheet onClose={() => setSel(null)} label={a.name}>
            <div className="kicker">Amenity {a.code} · {a.area === 'garden' ? 'Taman Adira neighbourhood garden' : 'Adira linear park'}</div>
            <h2>{a.name}</h2>
            <p className="muted small">From SDP’s Adira amenity plan. The spot on this map is approximate.</p>
            <button className="btn primary" onClick={() => { setSel(null); go('activities:new'); }}><Icon name="calendar" /> Host an activity</button>
          </Sheet>
        );
      })()}
    </div>
  );
}

/** Lighten (amt > 0) or darken (amt < 0) a hex colour. */
function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.round(amt >= 0 ? c + (255 - c) * amt : c * (1 + amt)));
  return `#${ch.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

const CARS = ['#5B6EE1', '#E8452C', '#9AA0AE', '#F7F7F7', '#2B2340', '#2FA59A'];

/** One terrace lot seen from above: porch with car, canopy, gable roof, backyard. */
function LotShape({ l, dim, ui, showNames, onTap }: { l: Lot; dim: boolean; ui: number; showNames: boolean; onTap: () => void }) {
  const r = l.resident;
  const north = l.faces === 'north';
  const body0 = north ? l.y + 18 : l.y + 8;
  const depth = 49;
  const half = depth / 2;
  const porch0 = north ? l.y : l.y + l.h - 18;
  const yard0 = north ? l.y + 67 : l.y;
  const base = r ? r.houseColor : l.occupied ? '#B9AA99' : '#D9D2C7';
  const frontSlope = shade(base, 0.2);
  const backSlope = shade(base, -0.14);
  const frontY = north ? body0 : body0 + half;
  const backY = north ? body0 + half : body0;
  const canopyY = north ? body0 - 8 : body0 + depth;
  const gateY = north ? l.y + 0.6 : l.y + l.h - 0.6;
  const cx = l.x + l.w / 2;
  const cy = body0 + half;
  const seed = l.no * 7 + l.x;
  const car = l.occupied && seed % 3 !== 0 ? CARS[seed % CARS.length] : null;
  const carY = porch0 + 2.5;
  const label = r ? (r.isYou ? 'Your house' : `${r.firstName}’s house`) : 'Home not on JIRAN yet';
  return (
    <g className={`lot${dim ? ' dim' : ''}${r?.isYou ? ' mine' : ''}`} role="button" tabIndex={0} aria-label={`${label}, No. ${l.no} ${l.street}`}
      onClick={onTap} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onTap(); }}>
      <rect x={l.x} y={l.y} width={l.w} height={l.h} fill="#EFE9DD" />
      <rect x={l.x + 0.4} y={yard0} width={l.w - 0.8} height={8} fill="#B9DFA9" />
      {seed % 4 === 0 && <circle cx={l.x + l.w / 2} cy={yard0 + 4} r="3" fill="#6DC27F" stroke="#2B2340" strokeWidth="0.5" />}
      <rect x={l.x + 0.4} y={porch0} width={l.w - 0.8} height={18} fill="#E2DACB" />
      <line x1={l.x + 0.4} x2={l.x + l.w - 0.4} y1={porch0 + 9} y2={porch0 + 9} stroke="#D4CBBB" strokeWidth="0.4" />
      {car && (
        <g pointerEvents="none">
          <rect x={cx - 3.3} y={carY} width={6.6} height={13} rx={2.2} fill={car} stroke="#2B2340" strokeWidth="0.6" />
          <rect x={cx - 2.6} y={north ? carY + 8 : carY + 2} width={5.2} height={3} rx={1} fill="#BFE3F5" />
          <rect x={cx - 2.6} y={north ? carY + 1.4 : carY + 9.6} width={5.2} height={1.8} rx={0.8} fill="#BFE3F5" />
        </g>
      )}
      <rect x={l.x + 0.5} y={canopyY} width={l.w - 1} height={8} fill="#FBF7F0" opacity="0.82" stroke="#B8AE9E" strokeWidth="0.4" />
      <rect x={l.x + 0.2} y={frontY} width={l.w - 0.4} height={half} fill={frontSlope} />
      <rect x={l.x + 0.2} y={backY} width={l.w - 0.4} height={half} fill={backSlope} />
      <line x1={l.x + 0.2} x2={l.x + l.w - 0.2} y1={cy} y2={cy} stroke={shade(base, -0.4)} strokeWidth="0.9" />
      {[0.25, 0.5, 0.75].map((t) => (
        <line key={t} x1={l.x + 1} x2={l.x + l.w - 1} y1={frontY + half * t} y2={frontY + half * t} stroke={shade(base, -0.05)} strokeWidth="0.35" />
      ))}
      <rect x={l.x + 0.2} y={body0} width={l.w - 0.4} height={depth} fill="none" stroke="#2B2340" strokeWidth={r?.isYou ? 1.6 : 0.7} />
      <line x1={l.x + 1} x2={l.x + l.w - 1} y1={gateY} y2={gateY} stroke="#4B4458" strokeWidth="0.9" strokeDasharray={`${l.w - 9} 6`} />
      {r?.decor.plants && <g pointerEvents="none"><circle cx={l.x + 2} cy={north ? body0 - 1.8 : body0 + depth + 1.8} r="1.6" fill="#4FAE66" /><circle cx={l.x + l.w - 2} cy={north ? body0 - 1.8 : body0 + depth + 1.8} r="1.6" fill="#4FAE66" /></g>}
      {r?.decor.festive && [0.2, 0.4, 0.6, 0.8].map((t) => <circle key={t} cx={l.x + l.w * t} cy={gateY + (north ? 1.4 : -1.4)} r="0.9" fill="#FFB020" className="twinkle" pointerEvents="none" />)}
      {r?.isNew && <path d={`M${l.x + 0.2} ${body0 + 8} L${l.x + 8} ${body0} H${l.x + 13} L${l.x + 0.2} ${body0 + 13} Z`} fill="#FFC94A" stroke="#2B2340" strokeWidth="0.5" pointerEvents="none" />}
      {r?.isYou && <rect className="mine-ring" x={l.x - 2.5} y={l.y - 2.5} width={l.w + 5} height={l.h + 5} rx="4" fill="none" stroke="#E8452C" strokeWidth="2.6" strokeDasharray="5 3" />}
      {r && (
        <g pointerEvents="none">
          <circle cx={cx} cy={cy} r="6.2" fill={r.avatar} stroke="#2B2340" strokeWidth="1" />
          <text x={cx} y={cy + 2.6} textAnchor="middle" className="lot-initial">{r.isYou ? '★' : r.firstName.charAt(0)}</text>
        </g>
      )}
      {r?.connection === 'connected' && <path d={`M${cx + 7} ${cy - 9} c -2 -3, -6 -1, -4 2 l 4 3 4 -3 c 2 -3, -2 -5, -4 -2z`} fill="#FF7FA3" stroke="#2B2340" strokeWidth="0.6" pointerEvents="none" />}
      {r?.badge && r.badge !== 'new' && <circle cx={cx - 7} cy={cy - 8} r="3.4" fill={BADGE_STYLE[r.badge as keyof typeof BADGE_STYLE].color} stroke="#fff" strokeWidth="0.8" pointerEvents="none" />}
      {l.flood && <rect x={l.x + 0.5} y={body0 - 1} width={l.w - 1} height={depth + 2} fill="none" stroke={FLOOD_STYLE[l.flood].color} strokeWidth="2.6" className={l.flood === 'need_help' ? 'blink' : undefined} />}
      {showNames && r && (
        <text x={cx} y={north ? body0 + depth + 6 : body0 - 2.4} textAnchor="middle" className="lot-name" fontSize={Math.min(6.5, 10 * ui)} pointerEvents="none">
          {r.isYou ? 'You' : r.firstName}
        </text>
      )}
    </g>
  );
}
