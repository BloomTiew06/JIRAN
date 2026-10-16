import { useEffect, useMemo, useRef, useState, type PointerEvent as RPE } from 'react';
import { pointInPolygon, type Pt } from '@jiran/core';
import type { Township } from '../api.ts';
import { Icon } from '../icons.tsx';
import { Coin, fmtWhen, useApp, useData } from '../ui.tsx';

type P = Township['precincts'][number];

const TREE_ZONES: Pt[][] = [
  [[300, 60], [1050, 60], [1050, 525], [565, 525], [545, 420], [300, 215]],
  [[575, 548], [900, 548], [1020, 620], [960, 700], [575, 684]],
];
const AVOID: Pt[][] = [
  [[596, 588], [716, 588], [716, 672], [596, 672]], // fields
  [[904, 580], [992, 580], [992, 640], [904, 640]], // park lake
];

function rand(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

function useTrees() {
  return useMemo(() => {
    const r = rand(7);
    const out: { x: number; y: number; s: number; c: string; faint: boolean }[] = [];
    for (const zone of TREE_ZONES) {
      for (let y = 50; y < 720; y += 26) {
        for (let x = 280; x < 1060; x += 26) {
          const p: Pt = [x + (r() - 0.5) * 16, y + (r() - 0.5) * 16];
          if (!pointInPolygon(p, zone) || AVOID.some((a) => pointInPolygon(p, a))) continue;
          const industrial = zone === TREE_ZONES[0];
          // The industrial side is a quiet backdrop: sparse, pale trees. The park gets proper ones.
          if (r() > (industrial ? 0.3 : 0.45)) continue;
          out.push(industrial
            ? { x: p[0], y: p[1], s: 6 + r() * 4, c: r() > 0.5 ? '#B5DBA8' : '#A9D49B', faint: true }
            : { x: p[0], y: p[1], s: 7 + r() * 5, c: r() > 0.5 ? '#5DBB72' : '#4FAE66', faint: false });
        }
      }
    }
    return out;
  }, []);
}

/** Fill a precinct polygon with tiny houses; lit windows show how connected it is. */
function miniHouses(poly: Pt[], lit: number) {
  const xs = poly.map((p) => p[0]);
  const ys = poly.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const spots: Pt[] = [];
  for (let y = y0 + 10; y <= y1 - 6; y += 14) {
    for (let x = x0 + 4; x <= x1 - 12; x += 14) {
      if (pointInPolygon([x, y], poly) && pointInPolygon([x + 10, y + 6], poly) && pointInPolygon([x + 5, y - 5], poly)) spots.push([x, y]);
    }
  }
  const nLit = Math.round(spots.length * lit);
  let walls = '';
  let roofs = '';
  let windows = '';
  spots.forEach(([x, y], i) => {
    walls += `M${x} ${y}h10v7h-10z`;
    roofs += `M${x - 1.5} ${y + 0.5}L${x + 5} ${y - 5}L${x + 11.5} ${y + 0.5}z`;
    // spread lit homes evenly through the precinct
    if (nLit && Math.floor(((i + 1) * nLit) / spots.length) !== Math.floor((i * nLit) / spots.length)) windows += `M${x + 3.5} ${y + 2}h3v3h-3z`;
  });
  return { walls, roofs, windows, count: spots.length };
}

const KIND_COLOR: Record<string, string> = { sport: '#2F6FEB', cleanup: '#1E9E72', open_house: '#8B5CF6', class: '#E8771A', social: '#D6336C', games: '#0E8A8A', kids: '#C2410C', study: '#5B6EE1' };
const KIND_ICON: Record<string, string> = {
  sport: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7l4 3-1.5 4.5h-5L8 10z',
  cleanup: 'M14 4l-5 9M6 13h6l3 7H3z',
  open_house: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  class: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 5v16',
  meetup: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6',
  social: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6',
  games: 'M6 9h12a3 3 0 0 1 3 3v3a3 3 0 0 1-5 2l-1-1H9l-1 1a3 3 0 0 1-5-2v-3a3 3 0 0 1 3-3zM8 11v3M6.5 12.5h3',
  kids: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z',
  study: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 5v16',
};

export function TownshipScreen({ onOpenStreet }: { onOpenStreet: () => void }) {
  const { me, go, open } = useApp();
  const { data } = useData<Township>('/api/township');
  const trees = useTrees();
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 390, h: 700 });
  const [view, setView] = useState({ cx: 470, cy: 560, scale: 0.95 });
  const [sel, setSel] = useState<{ kind: 'precinct' | 'pin'; id: string } | null>({ kind: 'precinct', id: me.precinct.id });
  const drag = useRef<{ x: number; y: number; cx: number; cy: number; moved: boolean; id: number } | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const houses = useMemo(() => {
    const m = new Map<string, ReturnType<typeof miniHouses>>();
    for (const p of data?.precincts ?? []) m.set(p.id, miniHouses(p.polygon, p.status === 'occupied' ? Math.max(0.06, p.glow) : 0));
    return m;
  }, [data]);

  const clamp = (v: { cx: number; cy: number; scale: number }) => {
    const scale = Math.min(2.4, Math.max(0.42, v.scale));
    const hw = size.w / 2 / scale;
    const hh = size.h / 2 / scale;
    const cx = hw * 2 >= 1000 ? 560 : Math.min(1060 - hw, Math.max(60 + hw, v.cx));
    const cy = hh * 2 >= 790 ? 435 : Math.min(830 - hh, Math.max(40 + hh, v.cy));
    return { cx, cy, scale };
  };
  const v = clamp(view);
  const vb = `${v.cx - size.w / 2 / v.scale} ${v.cy - size.h / 2 / v.scale} ${size.w / v.scale} ${size.h / v.scale}`;
  const ui = 1 / v.scale; // size of one screen pixel in plan units

  const onDown = (e: RPE) => {
    drag.current = { x: e.clientX, y: e.clientY, cx: v.cx, cy: v.cy, moved: false, id: e.pointerId };
  };
  const onMove = (e: RPE) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) > 6) {
      d.moved = true;
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    }
    if (d.moved) setView(clamp({ cx: d.cx - dx / v.scale, cy: d.cy - dy / v.scale, scale: v.scale }));
  };
  const onUp = () => { setTimeout(() => { drag.current = null; }, 0); };
  const tap = (fn: () => void) => () => { if (!drag.current?.moved) fn(); };
  const pushIn = useRef(0);
  const zoom = (k: number) => {
    // Keep zooming in at the closest township view to open your precinct's floor plan.
    if (k > 1 && v.scale >= 2.3) { if (++pushIn.current >= 2 && home?.hasStreetView) { pushIn.current = 0; onOpenStreet(); return; } }
    else pushIn.current = 0;
    setView(clamp({ ...v, scale: v.scale * k }));
  };
  const home = data?.precincts.find((p) => p.isHome);
  const locate = () => { if (home) setView(clamp({ cx: home.label[0], cy: home.label[1], scale: 1.1 })); };

  const selP = sel?.kind === 'precinct' ? data?.precincts.find((p) => p.id === sel.id) : undefined;
  const selPin = sel?.kind === 'pin' ? data?.pins.find((p) => p.id === sel.id) : undefined;

  return (
    <div className="township">
      <div className="map-box" ref={box}>
        {!data ? <div className="map-loading">Drawing Bandar Bukit Raja 2…</div> : (
          <svg className="map-svg" viewBox={vb} width={size.w} height={size.h}
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
            onWheel={(e) => zoom(e.deltaY < 0 ? 1.12 : 0.89)} role="application" aria-label="Map of Bandar Bukit Raja 2. Drag to explore.">
            <rect x="0" y="0" width="1200" height="900" fill="#BFE6B1" />
            {data.features.filter((f) => f.kind === 'treeline').map((f) => (
              <g key={f.id}>
                <path d={f.d} fill="#D5ECCB" />
              </g>
            ))}
            {data.features.filter((f) => f.kind === 'park').map((f) => <path key={f.id} d={f.d} fill="#A3D78F" stroke="#2B2340" strokeWidth={1.5} />)}
            {data.features.filter((f) => f.kind === 'field').map((f) => <path key={f.id} d={f.d} fill="#8FD07C" stroke="#fff" strokeWidth={2} />)}
            {data.features.filter((f) => f.kind === 'water').map((f) => <path key={f.id} d={f.d} fill="#9ED9F1" stroke="#2B2340" strokeWidth={1.5} />)}
            <g aria-hidden="true">
              {trees.map((t, i) => (
                t.faint
                  ? <circle key={i} cx={t.x} cy={t.y} r={t.s} fill={t.c} stroke="#8DB882" strokeWidth={1} />
                  : <g key={i}><circle cx={t.x} cy={t.y} r={t.s} fill={t.c} stroke="#2B2340" strokeWidth={1.2} /><circle cx={t.x - t.s / 3} cy={t.y - t.s / 3} r={t.s / 3.5} fill="#8FD69B" /></g>
              ))}
            </g>
            {data.features.filter((f) => f.kind === 'treeline' && f.labelAt).map((f) => (
              <g key={`${f.id}-label`} transform={`translate(${f.labelAt![0]} ${f.labelAt![1]})`} pointerEvents="none">
                <rect x={-120 * ui} y={-14 * ui} width={240 * ui} height={24 * ui} rx={12 * ui} fill="#F4FAF0" stroke="#8DB882" strokeWidth={ui} />
                <text y={3 * ui} textAnchor="middle" className="map-faint" fontSize={11.5 * ui}>{f.label}</text>
              </g>
            ))}
            {data.roads.filter((r) => !r.highway).map((r) => (
              <g key={r.id}>
                <path d={r.d} stroke="#2B2340" strokeWidth={r.width + 3} fill="none" strokeLinecap="round" />
                <path d={r.d} stroke="#F6EEDF" strokeWidth={r.width} fill="none" strokeLinecap="round" />
              </g>
            ))}
            {data.roads.filter((r) => r.highway).map((r) => (
              <g key={r.id}>
                <path d={r.d} stroke="#2B2340" strokeWidth={r.width + 4} fill="none" />
                <path id={`road-${r.id}`} d={r.d} stroke="#CFC8DC" strokeWidth={r.width} fill="none" />
                <path d={r.d} stroke="#fff" strokeWidth={2} strokeDasharray="12 12" fill="none" />
                <rect x="-7" y="-4" width="14" height="8" rx="3" fill="#E8452C" stroke="#2B2340" strokeWidth="1.2">
                  <animateMotion dur="22s" repeatCount="indefinite" rotate="auto"><mpath href={`#road-${r.id}`} /></animateMotion>
                </rect>
                <rect x="-7" y="-4" width="14" height="8" rx="3" fill="#2F6FEB" stroke="#2B2340" strokeWidth="1.2">
                  <animateMotion dur="30s" begin="-11s" repeatCount="indefinite" rotate="auto"><mpath href={`#road-${r.id}`} /></animateMotion>
                </rect>
              </g>
            ))}
            {data.roads.filter((r) => r.name && r.labelAt).map((r) => (
              <text key={`${r.id}-l`} x={r.labelAt![0]} y={r.labelAt![1]} className="map-faint" fontSize={10 * ui}
                transform={r.labelAngle ? `rotate(${r.labelAngle} ${r.labelAt![0]} ${r.labelAt![1]})` : undefined}>{r.name}</text>
            ))}

            {data.precincts.map((p) => {
              const h = houses.get(p.id);
              const up = p.status === 'upcoming';
              const isSel = selP?.id === p.id;
              return (
                <g key={p.id} className="precinct" role="button" tabIndex={0}
                  aria-label={up ? `${p.name}, future phase` : `${p.name}, ${p.joined} neighbours on JIRAN${p.isHome ? ', your precinct' : ''}`}
                  onClick={tap(() => setSel({ kind: 'precinct', id: p.id }))}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSel({ kind: 'precinct', id: p.id }); }}>
                  {!up && p.glow > 0 && <polygon points={p.polygon.join(' ')} fill="none" stroke="#FFC94A" strokeOpacity={0.25 + p.glow} strokeWidth={6 + p.glow * 14} strokeLinejoin="round" className="glow" />}
                  <polygon points={p.polygon.join(' ')} fill={up ? '#EDE7D9' : p.tint} fillOpacity={up ? 0.8 : 0.55}
                    stroke={p.isHome ? '#E8452C' : '#2B2340'} strokeWidth={p.isHome || isSel ? 3 : 1.5} strokeDasharray={up ? '6 5' : p.isHome ? '8 5' : undefined} strokeLinejoin="round" />
                  {h && (
                    <g aria-hidden="true">
                      <path d={h.walls} fill={up ? '#F7F4EE' : '#FFFDF8'} stroke="#2B2340" strokeWidth={0.9} />
                      <path d={h.roofs} fill={up ? '#CFC8DC' : p.isHome ? '#E8452C' : '#8A7FA6'} stroke="#2B2340" strokeWidth={0.9} strokeLinejoin="round" />
                      <path d={h.windows} fill="#FFC94A" />
                    </g>
                  )}
                  {p.flood && <polygon points={p.polygon.join(' ')} fill="url(#flood)" pointerEvents="none" />}
                </g>
              );
            })}
            <defs>
              <pattern id="flood" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
                <rect width="10" height="10" fill="#2F6FEB" opacity=".18" /><line x1="0" y1="0" x2="0" y2="10" stroke="#2F6FEB" strokeWidth="3" opacity=".5" />
              </pattern>
            </defs>

            {data.precincts.map((p) => {
              const fs = (p.isHome ? 13 : 11) * ui;
              const w = (p.name.length * 0.62 + 1.6) * fs;
              return (
                <g key={`${p.id}-label`} pointerEvents="none" transform={`translate(${p.label[0]} ${p.label[1]})`}>
                  <rect x={-w / 2} y={-fs * 0.9} width={w} height={fs * 1.6} rx={fs * 0.8}
                    fill={p.isHome ? '#E8452C' : p.status === 'upcoming' ? '#F7F4EE' : '#fff'} stroke="#2B2340" strokeWidth={1.5 * ui} />
                  <text y={fs * 0.32} textAnchor="middle" className="map-label" fontSize={fs} fill={p.isHome ? '#fff' : p.status === 'upcoming' ? '#6B6380' : '#2B2340'}>{p.name}</text>
                </g>
              );
            })}

            {home && (
              <g transform={`translate(${home.label[0]} ${home.label[1] - 26 * ui})`} pointerEvents="none">
                <g className="bob" transform={`scale(${ui})`}>
                  <path d="M0 0 C -14 -16, -14 -34, 0 -34 C 14 -34, 14 -16, 0 0 Z" fill="#E8452C" stroke="#2B2340" strokeWidth="2" />
                  <path d="M-6 -22 L0 -28 L6 -22 V-15 H-6 Z" fill="#fff" />
                </g>
              </g>
            )}

            {data.pins.map((g, i) => {
              // Spread pins that share a spot so each stays tappable.
              const same = data.pins.filter((o, j) => j < i && o.pin[0] === g.pin[0] && o.pin[1] === g.pin[1]).length;
              const px = g.pin[0] + same * 30 * ui;
              return (
              <g key={g.id} className="map-pin" role="button" tabIndex={0} aria-label={`${g.title}, ${fmtWhen(g.startsAt)}`}
                transform={`translate(${px} ${g.pin[1]}) scale(${ui})`}
                onClick={tap(() => setSel({ kind: 'pin', id: g.id }))}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSel({ kind: 'pin', id: g.id }); }}>
                <circle r="16" fill={KIND_COLOR[g.category] ?? '#D6336C'} stroke="#2B2340" strokeWidth="2" />
                <g transform="translate(-9 -9) scale(0.75)">
                  <path d={KIND_ICON[g.category] ?? KIND_ICON.meetup} fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                </g>
                {sel?.id === g.id && <circle r="21" fill="none" stroke="#2B2340" strokeWidth="2" strokeDasharray="4 3" />}
              </g>
              );
            })}
          </svg>
        )}

        <div className="map-top">
          <div className="map-title">
            <div className="kicker">Your township</div>
            <strong>Bandar Bukit Raja 2</strong>
          </div>
          <button className="points-pill" onClick={() => go('me')} aria-label={`${me.points} JIRAN points, open My house`}>
            <Coin /> {me.points}
          </button>
        </div>

        <div className="map-tools">
          <button className="round-btn" onClick={() => zoom(1.25)} aria-label="Zoom in"><Icon name="zoomIn" /></button>
          <button className="round-btn" onClick={() => zoom(0.8)} aria-label="Zoom out"><Icon name="zoomOut" /></button>
          <button className="round-btn" onClick={locate} aria-label="Go to my precinct"><Icon name="locate" /></button>
        </div>
      </div>

      {selP && (
        <div className="map-card card">
          <div className="row">
            <div className="grow">
              <div className="kicker">{selP.isHome ? 'Your precinct' : selP.status === 'upcoming' ? 'Future phase' : 'Precinct'}</div>
              <h2>{selP.name}</h2>
            </div>
            <button className="round-btn" onClick={() => setSel(null)} aria-label="Close"><Icon name="close" /></button>
          </div>
          {selP.status === 'upcoming' ? (
            <p className="muted">Homes here are still being built. When owners collect their keys, they join their Move-in Circle automatically.</p>
          ) : (
            <>
              <div className="glow-row">
                <span>Precinct lights</span>
                <div className="bar"><div style={{ width: `${Math.round(selP.glow * 100)}%` }} /></div>
                <strong>{Math.round(selP.glow * 100)}%</strong>
              </div>
              <p className="muted small">{selP.joined} of {selP.homes} homes on JIRAN. A window lights up for every home that has connected with a neighbour.</p>
              {selP.isHome ? (
                <button className="btn primary" onClick={onOpenStreet}><Icon name="home" /> Open the Adira site plan</button>
              ) : (
                <p className="muted small"><Icon name="shield" size={16} /> Households are private to each precinct. You can still join their public gatherings.</p>
              )}
            </>
          )}
        </div>
      )}
      {selPin && (
        <div className="map-card card">
          <div className="row">
            <div className="grow">
              <div className="kicker">{fmtWhen(selPin.startsAt)} · {selPin.place}</div>
              <h2>{selPin.title}</h2>
            </div>
            <button className="round-btn" onClick={() => setSel(null)} aria-label="Close"><Icon name="close" /></button>
          </div>
          <p className="muted small">{selPin.going} going · {selPin.place}</p>
          <button className="btn primary" onClick={() => open({ kind: 'activity', id: selPin.id })}><Icon name="calendar" /> See activity</button>
        </div>
      )}
    </div>
  );
}

export type { P as PrecinctView };
