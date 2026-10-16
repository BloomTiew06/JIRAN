import type { DecorKey, Lang, TimeSlot } from './types.ts';

export type ErrorCode = 'forbidden' | 'not_found' | 'invalid' | 'money_free' | 'conflict' | 'unauthorised';

export class JiranError extends Error {
  constructor(public code: ErrorCode, message: string) {
    super(message);
    this.name = 'JiranError';
  }
}

export const fail = (code: ErrorCode, message: string): never => {
  throw new JiranError(code, message);
};

/**
 * JIRAN is money-free. Listings, notes, activities and help posts may not
 * mention prices, rent, deposits, sales or payment, in English or Bahasa Malaysia.
 * Private chat between connected neighbours is not filtered.
 */
const MONEY_PATTERNS: RegExp[] = [
  /\b(rm|myr)\s?\d/i,
  /\d+(\.\d+)?\s?(rm|ringgit|myr|sen)\b/i,
  /\$\s?\d/,
  /\b(for sale|selling|sell|sold|buy|rent|rental|renting|deposit|price|cost|fee|fees|payment|pay me|paid|cash|transfer|duit|harga|jual|beli|sewa|bayar|yuran)\b/i,
  /\b(duitnow|tng|touch\s?n\s?go|ewallet|e-wallet|grabpay|boost)\b/i,
];

export const isMoneyText = (text: string) => MONEY_PATTERNS.some((re) => re.test(text));

export function assertMoneyFree(...texts: (string | undefined)[]): void {
  for (const t of texts) {
    if (t && isMoneyText(t)) {
      fail('money_free', 'JIRAN is money-free: no prices, rent, deposits, sales or payments. Share, lend and help for free.');
    }
  }
}

export function cleanText(input: unknown, field: string, max: number, required = true): string {
  const s = typeof input === 'string' ? input.trim().replace(/[ \t]+/g, ' ') : '';
  if (required && !s) fail('invalid', `${field} is required`);
  if (s.length > max) fail('invalid', `${field} must be ${max} characters or fewer`);
  return s;
}

export function cleanList(input: unknown, allowed: readonly string[] | null, max: number, field: string): string[] {
  if (input === undefined) return [];
  if (!Array.isArray(input)) fail('invalid', `${field} must be a list`);
  const out = [...new Set((input as unknown[]).map((x) => String(x).trim()).filter(Boolean))];
  if (out.length > max) fail('invalid', `Pick up to ${max} ${field.toLowerCase()}`);
  for (const x of out) {
    if (x.length > 40) fail('invalid', `${field}: “${x.slice(0, 20)}…” is too long`);
    if (allowed && !allowed.includes(x)) fail('invalid', `${field}: “${x}” is not an option`);
  }
  return out;
}

export function isoDay(input: unknown, field: string): string {
  const s = String(input ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(new Date(`${s}T00:00:00Z`).getTime())) fail('invalid', `${field} must be a date`);
  return s;
}

export function isoTime(input: unknown, field: string): string {
  const d = new Date(String(input ?? ''));
  if (Number.isNaN(d.getTime())) fail('invalid', `${field} must be a date and time`);
  return d.toISOString();
}

export const daysBetween = (a: string, b: string) =>
  Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86400000);

// ---------------------------------------------------------------- catalogues

export const INTERESTS = [
  'Badminton', 'Futsal', 'Basketball', 'Jogging', 'Cycling', 'Hiking', 'Yoga', 'Board games', 'Gaming',
  'Baking', 'Cooking', 'Kuih', 'Gardening', 'Reading', 'Photography', 'Fishing', 'Karaoke', 'Cats', 'Dogs',
  'Kids in kindergarten', 'Kids in Standard 2', 'Teens', 'Studying', 'Language exchange', 'Car care', 'DIY',
] as const;

export const ACTIVITIES = [
  'Badminton', 'Basketball', 'Futsal', 'Jogging', 'Cycling', 'Board games', 'Gaming', 'Studying',
  'Gardening', 'Baking', 'Yoga', 'Playdates',
] as const;

export const LANGUAGES = ['Bahasa Malaysia', 'English', 'Mandarin', 'Cantonese', 'Hokkien', 'Tamil'] as const;

export const TIME_SLOTS: { id: TimeSlot; label: string }[] = [
  { id: 'weekday-morning', label: 'Weekday mornings' },
  { id: 'weekday-evening', label: 'Weekday evenings' },
  { id: 'weekend-morning', label: 'Weekend mornings' },
  { id: 'weekend-evening', label: 'Weekend evenings' },
];

export const APP_LANGS: { id: Lang; label: string }[] = [
  { id: 'en', label: 'English' }, { id: 'ms', label: 'Bahasa Malaysia' }, { id: 'zh', label: '中文' }, { id: 'ta', label: 'தமிழ்' },
];

export const HOUSE_COLORS = ['#F26B5B', '#2FA59A', '#5B6EE1', '#9B6BD6', '#F29A38', '#D6336C', '#3E8E5A', '#C98A55'];
export const AVATAR_COLORS = ['#FFD9C2', '#CDEFD8', '#CFE3FF', '#E6DAFF', '#FFF0B3', '#FFE3EC', '#D9F2F0', '#F3E3D3'];

/** Which activity categories suit which interests, for suggestions. */
export const INTEREST_TO_CATEGORY: Record<string, string[]> = {
  Badminton: ['sport'], Futsal: ['sport'], Basketball: ['sport'], Jogging: ['sport'], Cycling: ['sport'], Hiking: ['sport'], Yoga: ['sport', 'class'],
  'Board games': ['games', 'social'], Gaming: ['games'], Baking: ['class', 'social'], Cooking: ['class', 'open_house'], Kuih: ['class', 'open_house'],
  Gardening: ['cleanup', 'class'], Reading: ['study', 'social'], Studying: ['study'], 'Language exchange': ['study', 'social'],
  'Kids in kindergarten': ['kids'], 'Kids in Standard 2': ['kids', 'study'], Teens: ['sport', 'study'], Karaoke: ['social'], DIY: ['class'],
};

// ---------------------------------------------------------------- levels, points, badges

export interface Level { n: number; name: string; min: number }

export const LEVELS: Level[] = [
  { n: 1, name: 'New Jiran', min: 0 },
  { n: 2, name: 'Friendly Jiran', min: 100 },
  { n: 3, name: 'Good Jiran', min: 200 },
  { n: 4, name: 'Street Hero', min: 300 },
  { n: 5, name: 'Precinct Legend', min: 500 },
];

export function levelFor(points: number) {
  let level = LEVELS[0];
  for (const l of LEVELS) if (points >= l.min) level = l;
  const next = LEVELS.find((l) => l.min > points) ?? null;
  const progress = next ? (points - level.min) / (next.min - level.min) : 1;
  return { level, next, progress };
}

export const DECOR_UNLOCK: Record<Exclude<DecorKey, 'festive'>, number> = { plants: 1, lights: 2, bunting: 3, porchCat: 4 };
export const DECOR_LABEL: Record<DecorKey, string> = {
  plants: 'Pot plants', lights: 'Fairy lights', bunting: 'Bunting', porchCat: 'Porch cat', festive: 'Festive decor',
};

/** Festive decorations appear in season for everyone (dates are approximate). */
export const SEASONS = [
  { id: 'deepavali', name: 'Deepavali', decor: 'Kolam and pelita lamps', from: '2026-10-15', to: '2026-11-22' },
  { id: 'christmas', name: 'Christmas', decor: 'Star and wreath', from: '2026-12-01', to: '2026-12-31' },
  { id: 'cny', name: 'Chinese New Year', decor: 'Red lanterns', from: '2027-01-23', to: '2027-02-21' },
  { id: 'raya', name: 'Hari Raya Aidilfitri', decor: 'Ketupat and pelita', from: '2027-02-28', to: '2027-04-08' },
] as const;

export const seasonFor = (isoDate: string) => SEASONS.find((s) => isoDate.slice(0, 10) >= s.from && isoDate.slice(0, 10) <= s.to) ?? null;

/** Points are recognition only. They unlock decorations and badges, never money or vouchers. */
export const POINTS = {
  joined: 50,
  profileComplete: 20,
  connectionMade: 10,
  welcomeNewcomer: 5,
  introPublished: 10,
  lendReturned: 15,
  borrowRated: 10,
  giveawayClaimed: 10,
  skillShared: 15,
  hostActivity: 10,
  joinActivity: 5,
  joinGroup: 5,
  helpDone: 15,
  buddy: 15,
  watchDone: 10,
  floodCheckin: 5,
  floodHelpOffer: 15,
  contactAccepted: 5,
} as const;

export const BADGES = [
  { id: 'first_friend', name: 'First friend', hint: 'Make your first neighbour connection' },
  { id: 'connector', name: 'Connector', hint: 'Connect with 5 neighbours' },
  { id: 'kind_lender', name: 'Kind lender', hint: 'Lend something that comes back' },
  { id: 'good_borrower', name: 'Good borrower', hint: 'Return and rate a loan' },
  { id: 'skill_sharer', name: 'Skill sharer', hint: 'Complete a skills exchange' },
  { id: 'host', name: 'Host', hint: 'Host an activity' },
  { id: 'helper', name: 'Helper', hint: 'Finish a help request' },
  { id: 'buddy', name: 'Community buddy', hint: 'Guide a new neighbour' },
  { id: 'flood_buddy', name: 'Flood buddy', hint: 'Offer help during a flood alert' },
] as const;

export const EMERGENCY_NUMBER = '999';
