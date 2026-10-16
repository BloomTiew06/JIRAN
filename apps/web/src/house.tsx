import type { DecorKey } from '@jiran/core';

export const BADGE_STYLE = {
  lend: { color: '#2F6FEB', label: 'Lends things', icon: 'M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z' },
  help: { color: '#D6336C', label: 'Can help', icon: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z' },
  open_house: { color: '#8B5CF6', label: 'Open house soon', icon: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z' },
  new: { color: '#1E9E72', label: 'Just moved in', icon: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z' },
} as const;

export const FLOOD_STYLE = {
  safe: { color: '#1E9E72', label: 'Safe' },
  need_help: { color: '#D6336C', label: 'Needs help' },
  can_help: { color: '#2F6FEB', label: 'Can help' },
} as const;

export function HouseArt({ wall, roof, decor, w = 66, h = 62, empty = false, bob = false }: {
  wall: string; roof: string; decor?: Partial<Record<DecorKey, boolean>>; w?: number; h?: number; empty?: boolean; bob?: boolean;
}) {
  const ink = '#2B2340';
  return (
    <svg className={bob ? 'bob' : undefined} width={w} height={h} viewBox="0 0 66 62" aria-hidden="true">
      <ellipse cx="33" cy="58" rx="26" ry="3.5" fill={ink} opacity=".14" />
      <rect x="10" y="26" width="46" height="31" rx="4" fill={empty ? '#F1EEF6' : wall} stroke={ink} strokeWidth="2" />
      <path d="M5 29 L33 7 L61 29 Z" fill={empty ? '#CFC8DC' : roof} stroke={ink} strokeWidth="2.2" strokeLinejoin="round" />
      <rect x="27.5" y="40" width="11" height="17" rx="3" fill="#fff" stroke={ink} strokeWidth="2" />
      <rect x="15" y="34" width="9" height="9" rx="2" fill={empty ? '#E4E0EC' : '#D7F0FF'} stroke={ink} strokeWidth="1.8" />
      <rect x="42" y="34" width="9" height="9" rx="2" fill={empty ? '#E4E0EC' : '#D7F0FF'} stroke={ink} strokeWidth="1.8" />
      {decor?.lights && (
        <g stroke={ink} strokeWidth="1">
          <path d="M8 29 Q33 38 58 29" fill="none" />
          <circle className="twinkle" cx="16" cy="32" r="2.2" fill="#FFC94A" />
          <circle className="twinkle2" cx="26" cy="34.5" r="2.2" fill="#FF7FA3" />
          <circle className="twinkle" cx="40" cy="34.5" r="2.2" fill="#9ED9F1" />
          <circle className="twinkle2" cx="50" cy="32" r="2.2" fill="#FFC94A" />
        </g>
      )}
      {decor?.bunting && (
        <g stroke={ink} strokeWidth="1" strokeLinejoin="round">
          <path d="M14 18 L52 18" fill="none" />
          <path d="M17 18 l5 0 -2.5 5z" fill="#E8452C" /><path d="M26 18 l5 0 -2.5 5z" fill="#FFC94A" />
          <path d="M35 18 l5 0 -2.5 5z" fill="#2FA59A" /><path d="M44 18 l5 0 -2.5 5z" fill="#8B5CF6" />
        </g>
      )}
      {decor?.plants && (
        <g stroke={ink} strokeWidth="1.4">
          <path d="M3 51 h7 l-1 6 h-5z" fill="#C98A55" /><circle cx="6.5" cy="48" r="4" fill="#5DBB72" />
          <path d="M56 51 h7 l-1 6 h-5z" fill="#C98A55" /><circle cx="59.5" cy="48" r="4" fill="#4FAE66" />
        </g>
      )}
      {decor?.porchCat && (
        <g stroke={ink} strokeWidth="1.2" strokeLinejoin="round">
          <path d="M41 57 C41 51, 49 51, 49 57 Z" fill="#F29A38" />
          <circle cx="45" cy="50" r="3.5" fill="#F29A38" />
          <path d="M42.2 47.6 L42.6 44.6 L44.6 46.6 M45.4 46.6 L47.4 44.6 L47.8 47.6" fill="#F29A38" />
        </g>
      )}
    </svg>
  );
}

export function BadgeDot({ kind, size = 24 }: { kind: keyof typeof BADGE_STYLE; size?: number }) {
  const b = BADGE_STYLE[kind];
  return (
    <span className="badge-dot" style={{ width: size, height: size, background: b.color }} title={b.label}>
      <svg width={size * 0.56} height={size * 0.56} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={b.icon} />
      </svg>
    </span>
  );
}
