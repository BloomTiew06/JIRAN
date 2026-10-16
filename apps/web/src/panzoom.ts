import { useEffect, useRef, useState, type PointerEvent as RPE } from 'react';

/**
 * Drag to pan, wheel or buttons to zoom, two-finger pinch on phones.
 * `bounds` is the drawable area in map units; `scale` is screen px per map unit.
 */
export function usePanZoom(
  bounds: { x: number; y: number; w: number; h: number },
  initial: { cx: number; cy: number; scale: number },
  limits = { min: 0.3, max: 3 },
  /** called when the user keeps zooming past a limit, to move to the next map level */
  edges: { pastMax?: () => void; pastMin?: () => void } = {},
) {
  const pushes = useRef({ max: 0, min: 0 });
  const edge = (want: number, current: number) => {
    if (want > limits.max && current >= limits.max * 0.98) { if (++pushes.current.max >= 2) { pushes.current.max = 0; edges.pastMax?.(); } }
    else if (want < limits.min && current <= limits.min * 1.02) { if (++pushes.current.min >= 2) { pushes.current.min = 0; edges.pastMin?.(); } }
    else pushes.current = { max: 0, min: 0 };
  };
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 390, h: 640 });
  const [view, setView] = useState(initial);
  const drag = useRef<{ x: number; y: number; cx: number; cy: number; moved: boolean } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; scale: number } | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const clamp = (v: { cx: number; cy: number; scale: number }) => {
    const scale = Math.min(limits.max, Math.max(limits.min, v.scale));
    const hw = size.w / 2 / scale;
    const hh = size.h / 2 / scale;
    const cx = hw * 2 >= bounds.w ? bounds.x + bounds.w / 2 : Math.min(bounds.x + bounds.w - hw, Math.max(bounds.x + hw, v.cx));
    const cy = hh * 2 >= bounds.h ? bounds.y + bounds.h / 2 : Math.min(bounds.y + bounds.h - hh, Math.max(bounds.y + hh, v.cy));
    return { cx, cy, scale };
  };
  const v = clamp(view);
  const viewBox = `${v.cx - size.w / 2 / v.scale} ${v.cy - size.h / 2 / v.scale} ${size.w / v.scale} ${size.h / v.scale}`;

  const handlers = {
    onPointerDown: (e: RPE) => {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.current.size === 2) {
        const [a, b] = [...pointers.current.values()];
        pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), scale: v.scale };
      } else {
        drag.current = { x: e.clientX, y: e.clientY, cx: v.cx, cy: v.cy, moved: false };
      }
    },
    onPointerMove: (e: RPE) => {
      if (!pointers.current.has(e.pointerId)) return;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch.current && pointers.current.size === 2) {
        const [a, b] = [...pointers.current.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const want = pinch.current.scale * (d / pinch.current.d);
        if (want > limits.max * 1.25 || want < limits.min * 0.8) { edge(want, v.scale); pinch.current = { d, scale: v.scale }; }
        setView(clamp({ ...v, scale: want }));
        if (drag.current) drag.current.moved = true;
        return;
      }
      const d = drag.current;
      if (!d) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (!d.moved && Math.hypot(dx, dy) > 6) {
        d.moved = true;
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
      }
      if (d.moved) setView(clamp({ cx: d.cx - dx / v.scale, cy: d.cy - dy / v.scale, scale: v.scale }));
    },
    onPointerUp: (e: RPE) => {
      pointers.current.delete(e.pointerId);
      if (pointers.current.size < 2) pinch.current = null;
      setTimeout(() => { if (pointers.current.size === 0) drag.current = null; }, 0);
    },
    onPointerCancel: (e: RPE) => { pointers.current.delete(e.pointerId); pinch.current = null; drag.current = null; },
    onWheel: (e: React.WheelEvent) => {
      const want = v.scale * (e.deltaY < 0 ? 1.12 : 0.89);
      edge(want, v.scale);
      setView(clamp({ ...v, scale: want }));
    },
  };

  return {
    box, size, view: v, viewBox, handlers,
    /** wrap a click handler so it does not fire at the end of a drag */
    tap: (fn: () => void) => () => { if (!drag.current?.moved) fn(); },
    zoom: (k: number) => { edge(v.scale * k, v.scale); setView(clamp({ ...v, scale: v.scale * k })); },
    centre: (cx: number, cy: number, scale = v.scale) => setView(clamp({ cx, cy, scale })),
  };
}
