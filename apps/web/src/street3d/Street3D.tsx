import { useCallback, useEffect, useRef, useState } from 'react';
import type { Site } from '../api.ts';
import { BADGE_STYLE, FLOOD_STYLE } from '../house.tsx';
import { Icon } from '../icons.tsx';
import { Coin, Sheet, useApp, useData } from '../ui.tsx';
import { createStreetScene, hasWebGL, type Lot, type StreetScene } from './scene.ts';

const LOT_LABEL = { intermediate: 'Intermediate lot, 20 ft × 75 ft', end: 'End lot, 22 ft × 75 ft', corner: 'Corner lot, 22 ft × 75 ft' };

/** The nearest map level: your house and your street's neighbours in 3D. */
export function Street3D({ onFloorPlan, onTownship }: { onFloorPlan: () => void; onTownship: () => void }) {
  const { data } = useData<Site>('/api/site');
  if (!hasWebGL()) return <NoWebGL onFloorPlan={onFloorPlan} />;
  if (!data) return <div className="map-loading">Building your street in 3D…</div>;
  return <StreetCanvas data={data} onFloorPlan={onFloorPlan} onTownship={onTownship} />;
}

function NoWebGL({ onFloorPlan }: { onFloorPlan: () => void }) {
  return (
    <div className="map-loading stack12">
      <p>This device can’t show the 3D street view.</p>
      <button className="btn primary" onClick={onFloorPlan}>Open the floor plan</button>
    </div>
  );
}

function StreetCanvas({ data, onFloorPlan, onTownship }: { data: Site; onFloorPlan: () => void; onTownship: () => void }) {
  const { me, open, go } = useApp();
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<StreetScene | null>(null);
  const [failed, setFailed] = useState(false);
  const [, setTick] = useState(0);
  const [sel, setSel] = useState<Lot | null>(null);
  const queued = useRef(false);
  const press = useRef<{ x: number; y: number; t: number } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<number | null>(null);
  const outPushes = useRef(0);

  const onChange = useCallback(() => {
    if (queued.current) return;
    queued.current = true;
    requestAnimationFrame(() => { queued.current = false; setTick((t) => t + 1); });
  }, []);

  useEffect(() => {
    if (!host.current) return;
    if (scene.current) { scene.current.rebuild(data); return; }
    try {
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
      const s = createStreetScene(host.current, data, onChange, reduced);
      if (!s) { setFailed(true); return; }
      scene.current = s;
      s.resize(host.current.clientWidth, host.current.clientHeight);
    } catch {
      setFailed(true);
    }
  }, [data, onChange]);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const ro = new ResizeObserver(() => scene.current?.resize(el.clientWidth, el.clientHeight));
    ro.observe(el);
    return () => { ro.disconnect(); scene.current?.dispose(); scene.current = null; };
  }, []);

  if (failed) return <NoWebGL onFloorPlan={onFloorPlan} />;

  const s = scene.current;
  const model = s?.model;
  const tapLot = (id: string | null) => {
    if (!id || !model) return;
    const l = model.lots.find((x) => x.id === id);
    if (!l) return;
    if (l.resident && !l.resident.isYou) open({ kind: 'neighbour', id: l.resident.id });
    else setSel(l);
  };

  // Zooming out past the furthest 3D view opens the floor plan.
  const pushOut = () => {
    if (!scene.current?.atMaxDistance()) { outPushes.current = 0; return; }
    outPushes.current += 1;
    if (outPushes.current >= 3) onFloorPlan();
  };

  const onJiran = model?.lots.filter((l) => l.resident).length ?? 0;
  const friends = model?.lots.filter((l) => l.resident?.connection === 'connected').length ?? 0;

  return (
    <div className="township street3d">
      <div className="map-box" ref={host}
        onPointerDown={(e) => {
          pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          press.current = pointers.current.size === 1 ? { x: e.clientX, y: e.clientY, t: performance.now() } : null;
          if (pointers.current.size === 2) {
            const [a, b] = [...pointers.current.values()];
            pinch.current = Math.hypot(a.x - b.x, a.y - b.y);
          }
        }}
        onPointerMove={(e) => {
          if (!pointers.current.has(e.pointerId)) return;
          pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (pointers.current.size === 2 && pinch.current) {
            const [a, b] = [...pointers.current.values()];
            const d = Math.hypot(a.x - b.x, a.y - b.y);
            if (d < pinch.current - 40) { pinch.current = d; pushOut(); }
          }
        }}
        onPointerUp={(e) => {
          pointers.current.delete(e.pointerId);
          if (pointers.current.size < 2) pinch.current = null;
          const p = press.current;
          press.current = null;
          if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) < 6 && performance.now() - p.t < 500) tapLot(scene.current?.pick(e.clientX, e.clientY) ?? null);
        }}
        onPointerCancel={(e) => { pointers.current.delete(e.pointerId); pinch.current = null; press.current = null; }}
        onWheel={(e) => { if (e.deltaY > 0) pushOut(); else outPushes.current = 0; }}
        role="application" aria-label={`3D view of ${model?.street ?? 'your street'}. Drag to look around, pinch to zoom. Zoom out further for the floor plan.`}>

        {s && model && (
          <div className="labels3d" aria-hidden={false}>
            {model.lots.filter((l) => l.resident).map((l) => {
              const r = l.resident!;
              const north = l.faces === 'north';
              const front = north ? l.y + 18 : l.y + 57;
              const p = s.project(l.x + l.w / 2, r.isYou ? 36 : 32, front + (north ? 2 : -2));
              if (!p.visible) return null;
              return (
                <button key={l.id} className={`label3d${r.isYou ? ' you' : ''}`} style={{ left: p.x, top: p.y }}
                  onClick={() => (r.isYou ? setSel(l) : open({ kind: 'neighbour', id: r.id }))}
                  aria-label={r.isYou ? 'Your house' : `${r.firstName}, No. ${l.no}`}>
                  <span className="l-avatar" style={{ background: r.avatar }}>{r.isYou ? '★' : r.firstName.charAt(0)}</span>
                  <span className="l-name">{r.isYou ? 'You' : r.firstName}</span>
                  {r.connection === 'connected' && <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" fill="#FF7FA3" stroke="#2B2340" strokeWidth="2.4" /></svg>}
                  {r.badge && r.badge !== 'new' && <span className="l-dot" style={{ background: BADGE_STYLE[r.badge as keyof typeof BADGE_STYLE].color }} />}
                  {r.isNew && <span className="l-new">New</span>}
                  {l.flood && <span className="l-flood" style={{ background: FLOOD_STYLE[l.flood].color }}>{FLOOD_STYLE[l.flood].label}</span>}
                </button>
              );
            })}
          </div>
        )}

        <div className="map-top">
          <div className="map-title">
            <div className="kicker">Your street · {model?.lots.length ?? 0} homes · {onJiran} on JIRAN · {friends} connected</div>
            <strong>{model?.street ?? 'My street'}</strong>
          </div>
          <button className="points-pill" onClick={() => go('me')} aria-label={`${me.points} JIRAN points`}><Coin /> {me.points}</button>
        </div>
        <div className="map-tools">
          <button className="round-btn" onClick={onTownship} aria-label="Whole township map"><Icon name="map" /></button>
          <button className="round-btn" onClick={onFloorPlan} aria-label="Adira floor plan"><Icon name="grid" /></button>
          <button className="round-btn" onClick={() => scene.current?.home(true)} aria-label="Back to my house"><Icon name="locate" /></button>
        </div>
        {data.floodAlert && <button className="flood-banner floating" onClick={() => open({ kind: 'flood' })}><Icon name="drop" /> Flood {data.floodAlert.level}: check in</button>}
        <div className="hint-pill" aria-hidden="true">Drag to look around · pinch out for the floor plan</div>
      </div>

      {sel && (
        <Sheet onClose={() => setSel(null)} label={`No. ${sel.no}, ${sel.street}`}>
          <div className="kicker">{LOT_LABEL[sel.type]}</div>
          <h2>{sel.resident?.isYou ? 'Your house' : `No. ${sel.no}, ${sel.street}`}</h2>
          {sel.resident?.isYou ? (
            <>
              <p className="muted">No. {sel.no}, {sel.street}. Neighbours see your roof colour and the decorations you switch on.</p>
              <div className="grid2">
                <button className="btn primary" onClick={() => { setSel(null); go('me'); }}><Icon name="sparkle" /> Decorate</button>
                <button className="btn" onClick={() => { setSel(null); go('me:profile'); }}><Icon name="home" /> House colour</button>
              </div>
            </>
          ) : (
            <p className="muted">{sel.occupied ? 'The owners have not joined JIRAN yet, or keep their profile private.' : 'Keys for this home have not been handed over yet. When the owner collects them, a ribbon appears on the gate.'}</p>
          )}
        </Sheet>
      )}
    </div>
  );
}
