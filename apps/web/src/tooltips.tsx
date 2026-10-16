import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

type Place = 'left' | 'above' | 'below';
interface Tip { text: string; x: number; y: number; place: Place }

const TARGET = 'button, a[href], [role="button"], [data-tip]';
const HOVER_DELAY = 300;
const LONG_PRESS = 450;

/** What a control is for: `data-tip`, or its aria-label when the visible text doesn't already say it. */
function tipText(el: HTMLElement): string | null {
  if (el.dataset.tip === '') return null;
  if (el.dataset.tip) return el.dataset.tip;
  const label = el.getAttribute('aria-label')?.trim();
  if (!label) return null;
  const visible = (el.innerText || '').replace(/\s+/g, ' ').trim();
  if (visible.toLowerCase() === label.toLowerCase()) return null;
  if (visible.length > 16) return null; // a full text label already explains it
  return label;
}

function targetOf(e: Event): HTMLElement | null {
  return ((e.target as Element | null)?.closest?.(TARGET) as HTMLElement | null) ?? null;
}

/**
 * One tooltip for the whole app. Shows what an icon button is for:
 * hover with a mouse, focus with the keyboard, or press and hold on a phone
 * (holding shows the label without pressing the button).
 */
export function Tooltips() {
  const [tip, setTip] = useState<Tip | null>(null);

  useEffect(() => {
    let current: HTMLElement | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let hideTimer: ReturnType<typeof setTimeout> | null = null;
    let press: { x: number; y: number } | null = null;
    let held = false;
    let lastPointer = 0;

    const clear = () => {
      if (timer) { clearTimeout(timer); timer = null; }
      if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    };
    const hide = () => { clear(); current = null; setTip(null); };

    const show = (el: HTMLElement) => {
      const text = tipText(el);
      if (!text || !el.isConnected) return false;
      const r = el.getBoundingClientRect();
      const frame = (el.closest('.phone') ?? document.documentElement).getBoundingClientRect();
      let place: Place = 'above';
      if (r.right > frame.right - 90 && r.width < 90) place = 'left';
      else if (r.top - frame.top < 64) place = 'below';
      const margin = 84;
      const cx = Math.min(frame.right - margin, Math.max(frame.left + margin, r.left + r.width / 2));
      if (place === 'left') setTip({ text, place, x: r.left - 10, y: r.top + r.height / 2 });
      else if (place === 'below') setTip({ text, place, x: cx, y: r.bottom + 10 });
      else setTip({ text, place, x: cx, y: r.top - 10 });
      return true;
    };

    const onOver = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      const el = targetOf(e);
      if (el === current) return;
      hide();
      if (!el || !tipText(el)) return;
      current = el;
      timer = setTimeout(() => show(el), HOVER_DELAY);
    };
    const onOut = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || !current) return;
      const to = e.relatedTarget as Node | null;
      if (to && current.contains(to)) return;
      hide();
    };
    const onDown = (e: PointerEvent) => {
      lastPointer = performance.now();
      if (e.pointerType === 'mouse') { hide(); return; }
      hide();
      held = false;
      const el = targetOf(e);
      if (!el || !tipText(el)) return;
      current = el;
      press = { x: e.clientX, y: e.clientY };
      timer = setTimeout(() => {
        if (show(el)) { held = true; navigator.vibrate?.(8); }
      }, LONG_PRESS);
    };
    const onMove = (e: PointerEvent) => {
      if (!press || e.pointerType === 'mouse') return;
      if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > 10) { press = null; if (!held) hide(); }
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') return;
      press = null;
      if (timer) { clearTimeout(timer); timer = null; }
      if (held) hideTimer = setTimeout(hide, 1600);
    };
    // A press and hold only shows the label; it doesn't also press the button.
    const onClick = (e: MouseEvent) => {
      if (!held) return;
      held = false;
      e.preventDefault();
      e.stopPropagation();
    };
    const onMenu = (e: Event) => { if (current || held) e.preventDefault(); };
    const onFocus = (e: FocusEvent) => {
      const el = targetOf(e);
      if (!el) return;
      let keyboard = false;
      try { keyboard = el.matches(':focus-visible'); } catch { keyboard = false; }
      // Focus labels are for keyboard users; a tap or click also moves focus.
      if (!keyboard || performance.now() - lastPointer < 1000) return;
      clear();
      current = el;
      show(el);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') hide(); };

    const opts = { capture: true } as const;
    document.addEventListener('pointerover', onOver, opts);
    document.addEventListener('pointerout', onOut, opts);
    document.addEventListener('pointerdown', onDown, opts);
    document.addEventListener('pointermove', onMove, opts);
    document.addEventListener('pointerup', onUp, opts);
    document.addEventListener('pointercancel', onUp, opts);
    document.addEventListener('click', onClick, opts);
    document.addEventListener('contextmenu', onMenu, opts);
    document.addEventListener('focusin', onFocus, opts);
    document.addEventListener('focusout', hide, opts);
    document.addEventListener('keydown', onKey, opts);
    document.addEventListener('scroll', hide, opts);
    document.addEventListener('wheel', hide, { capture: true, passive: true });
    return () => {
      clear();
      document.removeEventListener('pointerover', onOver, opts);
      document.removeEventListener('pointerout', onOut, opts);
      document.removeEventListener('pointerdown', onDown, opts);
      document.removeEventListener('pointermove', onMove, opts);
      document.removeEventListener('pointerup', onUp, opts);
      document.removeEventListener('pointercancel', onUp, opts);
      document.removeEventListener('click', onClick, opts);
      document.removeEventListener('contextmenu', onMenu, opts);
      document.removeEventListener('focusin', onFocus, opts);
      document.removeEventListener('focusout', hide, opts);
      document.removeEventListener('keydown', onKey, opts);
      document.removeEventListener('scroll', hide, opts);
      document.removeEventListener('wheel', hide, { capture: true });
    };
  }, []);

  if (!tip) return null;
  return createPortal(
    <div className={`hover-tip ${tip.place}`} style={{ left: tip.x, top: tip.y }} aria-hidden="true">{tip.text}</div>,
    document.body,
  );
}
