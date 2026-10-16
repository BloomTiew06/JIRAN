import type { Pt } from './types.ts';

/**
 * Township geometry for Bandar Bukit Raja 2, traced loosely from SDP's
 * published township plan (pixel space of the plan image, about 1500 x 855).
 * Only the residential side is drawn.
 * The Adira site plan (bottom of this file) follows SDP's published facts for
 * Adira Series 1 (Phase R6A): 109 double-storey terraces, 85 intermediate lots
 * of 20' x 75', 14 end and 10 corner lots of 22' x 75', and the 16 garden
 * amenities A to P from the brochure. Street names and exact positions are
 * approximations until SDP shares its CAD site plan. The industrial lots are replaced by a
 * treeline, because JIRAN is for homes.
 */

export const TOWNSHIP = {
  name: 'Bandar Bukit Raja 2',
  viewBox: [60, 40, 1000, 790] as [number, number, number, number],
};

export interface PrecinctShape {
  id: string;
  name: string;
  polygon: Pt[];
  label: Pt;
  tint: string;
  status: 'occupied' | 'upcoming';
  hasStreetView: boolean;
}

export const PRECINCT_SHAPES: PrecinctShape[] = [
  { id: 'kyra-1', name: 'Kyra 1', polygon: [[80, 176], [150, 176], [150, 345], [80, 345]], label: [115, 262], tint: '#FFD9C2', status: 'occupied', hasStreetView: false },
  { id: 'r-13', name: 'R-13', polygon: [[160, 150], [265, 150], [265, 238], [160, 238]], label: [212, 196], tint: '#EDE7D9', status: 'upcoming', hasStreetView: false },
  { id: 'lumira', name: 'Lumira', polygon: [[162, 248], [262, 248], [262, 345], [162, 345]], label: [212, 298], tint: '#CDEFD8', status: 'occupied', hasStreetView: false },
  { id: 'kyra-2', name: 'Kyra 2', polygon: [[80, 378], [150, 378], [150, 505], [80, 505]], label: [115, 442], tint: '#CFE3FF', status: 'occupied', hasStreetView: false },
  { id: 'lyra', name: 'Lyra', polygon: [[162, 370], [240, 370], [240, 545], [162, 545]], label: [201, 458], tint: '#E6DAFF', status: 'occupied', hasStreetView: false },
  { id: 'r-1', name: 'R-1', polygon: [[252, 372], [392, 372], [392, 545], [252, 545]], label: [322, 462], tint: '#EDE7D9', status: 'upcoming', hasStreetView: false },
  { id: 'r-2', name: 'R-2', polygon: [[268, 330], [294, 306], [474, 444], [456, 480], [398, 446], [300, 366]], label: [366, 398], tint: '#EDE7D9', status: 'upcoming', hasStreetView: false },
  { id: 'casira-1', name: 'Casira 1', polygon: [[80, 522], [150, 522], [150, 562], [80, 562]], label: [115, 542], tint: '#FFF0B3', status: 'occupied', hasStreetView: false },
  { id: 'casira-2', name: 'Casira 2', polygon: [[80, 570], [205, 570], [205, 630], [80, 630]], label: [142, 600], tint: '#FFE3EC', status: 'occupied', hasStreetView: false },
  { id: 'r-5', name: 'R-5', polygon: [[210, 548], [262, 520], [334, 590], [286, 636], [226, 618]], label: [268, 584], tint: '#EDE7D9', status: 'upcoming', hasStreetView: false },
  { id: 'r-8', name: 'R-8', polygon: [[338, 600], [392, 600], [392, 646], [338, 646]], label: [365, 623], tint: '#EDE7D9', status: 'upcoming', hasStreetView: false },
  { id: 'r-10', name: 'R-10', polygon: [[80, 644], [305, 644], [305, 732], [80, 732]], label: [192, 688], tint: '#EDE7D9', status: 'upcoming', hasStreetView: false },
  { id: 'adira', name: 'Adira', polygon: [[402, 488], [548, 488], [548, 612], [402, 612]], label: [475, 598], tint: '#FFE3DE', status: 'occupied', hasStreetView: true },
  { id: 'persada', name: 'Persada', polygon: [[446, 692], [536, 692], [536, 804], [446, 804]], label: [491, 748], tint: '#CDEFD8', status: 'occupied', hasStreetView: false },
  { id: 'athira', name: 'Athira', polygon: [[562, 692], [672, 692], [672, 758], [562, 758]], label: [617, 725], tint: '#FFF0B3', status: 'occupied', hasStreetView: false },
  { id: 'azira', name: 'Azira', polygon: [[562, 766], [748, 766], [748, 808], [562, 808]], label: [655, 787], tint: '#CFE3FF', status: 'occupied', hasStreetView: false },
  { id: 'ayra', name: 'Ayra', polygon: [[790, 722], [952, 722], [952, 802], [790, 802]], label: [871, 762], tint: '#E6DAFF', status: 'occupied', hasStreetView: false },
];

export interface Feature {
  id: string;
  kind: 'water' | 'park' | 'field' | 'treeline';
  /** SVG path in plan space */
  d: string;
  label?: string;
  labelAt?: Pt;
}

export const FEATURES: Feature[] = [
  { id: 'treeline', kind: 'treeline', d: 'M282 40 H1060 V536 H556 L540 426 C 470 372, 380 290, 282 196 Z', label: 'Industrial area (not part of JIRAN)', labelAt: [700, 300] },
  { id: 'town-park', kind: 'park', d: 'M562 540 H906 C 960 548, 1010 572, 1034 626 C 1046 668, 1010 702, 960 708 L 760 714 C 680 714, 600 706, 562 690 Z', label: '125-acre Town Park', labelAt: [820, 668] },
  { id: 'town-park-east', kind: 'park', d: 'M1010 548 H1060 V714 H1010 Z' },
  { id: 'field-1', kind: 'field', d: 'M630 592 a28 38 0 1 0 0.1 0 Z' },
  { id: 'field-2', kind: 'field', d: 'M686 590 a26 36 0 1 0 0.1 0 Z' },
  { id: 'lake-park', kind: 'water', d: 'M912 604 c 10 -22, 60 -24, 72 -4 c 10 18, -8 34, -36 34 c -26 0, -44 -12, -36 -30 Z' },
  { id: 'lake-nw-1', kind: 'water', d: 'M84 84 c 0 -26, 44 -34, 54 -10 c 8 22, -10 40, -30 38 c -16 -2, -24 -12, -24 -28 Z' },
  { id: 'lake-nw-2', kind: 'water', d: 'M186 120 c 6 -30, 64 -36, 72 -6 c 6 26, -12 46, -40 44 c -24 -2, -36 -18, -32 -38 Z' },
  { id: 'lake-r8', kind: 'water', d: 'M402 650 c 10 -22, 110 -26, 124 0 c 8 18, -30 32, -64 32 c -36 0, -68 -12, -60 -32 Z', label: 'Lakeside path', labelAt: [462, 692] },
  { id: 'canal-sw', kind: 'water', d: 'M76 748 H300 c 12 0, 16 30, 0 34 H76 Z' },
  { id: 'canal-diag', kind: 'water', d: 'M560 806 L1060 590 L1060 602 L566 816 Z' },
];

export interface Road { id: string; d: string; width: number; name?: string; labelAt?: Pt; labelAngle?: number; highway?: boolean }

export const ROADS: Road[] = [
  { id: 'wce', d: 'M96 40 C 200 150, 400 330, 540 426 L 1060 706', width: 22, highway: true, name: 'West Coast Expressway', labelAt: [800, 548], labelAngle: 28 },
  { id: 'sg-puloh', d: 'M40 816 H1060', width: 12, name: 'Jalan Sungai Puloh', labelAt: [250, 828] },
  { id: 'spine-west', d: 'M156 146 V760', width: 8 },
  { id: 'cross-1', d: 'M78 362 H252', width: 7 },
  { id: 'cross-2', d: 'M78 514 H252', width: 7 },
  { id: 'cross-3', d: 'M78 638 H336', width: 7 },
  { id: 'ring-r1', d: 'M246 362 V640', width: 7 },
  { id: 'adira-north', d: 'M396 482 H552', width: 8 },
  { id: 'adira-west', d: 'M396 482 V650', width: 7 },
  { id: 'adira-east', d: 'M552 430 V816', width: 9 },
  { id: 'south-row', d: 'M300 684 H1000', width: 8 },
  { id: 'persada-west', d: 'M440 684 V816', width: 7 },
  { id: 'azira-east', d: 'M756 684 V816', width: 7 },
];

export interface Place {
  id: string;
  name: string;
  /** pin on the township map */
  pin: Pt;
  /** pin on the Adira site plan, in feet, when the place is inside Adira */
  site?: Pt;
}

export const PLACES: Place[] = [
  { id: 'adira-pavilion', name: 'Pavilion, Taman Adira', pin: [528, 500], site: [562, 104] },
  { id: 'adira-lawn', name: 'Community lawn, Taman Adira', pin: [530, 516], site: [562, 184] },
  { id: 'adira-playground', name: 'Playground, Taman Adira', pin: [532, 532], site: [528, 270] },
  { id: 'adira-court', name: 'Multipurpose court, Taman Adira', pin: [530, 550], site: [562, 352] },
  { id: 'adira-epdm', name: 'EPDM court, Taman Adira', pin: [536, 566], site: [600, 432] },
  { id: 'adira-fitness', name: 'Fitness station, Taman Adira', pin: [530, 582], site: [528, 486] },
  { id: 'adira-linear', name: 'Linear park jogging path, Adira', pin: [462, 626], site: [300, 676] },
  { id: 'adira-skate', name: 'Skate and bike tracks, linear park', pin: [500, 626], site: [430, 716] },
  { id: 'town-park', name: 'Town Park lake', pin: [948, 604] },
  { id: 'town-park-fields', name: 'Town Park fields', pin: [658, 630] },
  { id: 'town-park-lawn', name: 'Town Park lawn', pin: [800, 630] },
  { id: 'lakeside', name: 'Lakeside path by R-8', pin: [462, 662] },
];

export const placeById = (id: string): Place | undefined => PLACES.find((p) => p.id === id);

// ---------------------------------------------------------------- Adira site plan (feet)

export interface SiteRoad { name: string; x: number; y: number; w: number; h: number; label: Pt; vertical?: boolean }
export interface SiteArea { id: string; name: string; kind: 'garden' | 'linear' | 'buffer' | 'lake'; x: number; y: number; w: number; h: number }
export interface Amenity { code: string; name: string; at: Pt; area: 'garden' | 'linear' }
export interface SiteLot {
  id: string; street: string; no: number; type: 'intermediate' | 'end' | 'corner';
  x: number; y: number; w: number; h: number; faces: 'north' | 'south';
}

const STREET_Y = [20, 210, 400, 590]; // top edge of Jalan Adira 1..4, each 40 ft wide
const ROW_DEPTH = 75;
const COLS = [30, 270]; // west and east column start x

export function buildAdiraSite() {
  const lots: SiteLot[] = [];
  const roads: SiteRoad[] = STREET_Y.map((y, i) => ({ name: `Jalan Adira ${i + 1}`, x: 0, y, w: 486, h: 40, label: [12, y + 26] as Pt }));
  roads.push({ name: 'Jalan Adira Utama', x: 222, y: 20, w: 40, h: 610, label: [236, 330] as Pt, vertical: true });

  // 12 terrace rows: 3 back-to-back pairs per column, between the four streets.
  const counters: Record<string, { odd: number; even: number }> = {};
  let spineEnds = 0;
  for (let pair = 0; pair < 3; pair++) {
    const top = STREET_Y[pair] + 40;
    for (const half of ['a', 'b'] as const) {
      const y = half === 'a' ? top : top + ROW_DEPTH;
      const faces = half === 'a' ? 'north' : 'south';
      const street = `Jalan Adira ${half === 'a' ? pair + 1 : pair + 2}`;
      const side = faces === 'north' ? 'even' : 'odd'; // houses south of a street are even, north are odd
      counters[street] ??= { odd: -1, even: 0 };
      for (let c = 0; c < 2; c++) {
        const count = pair === 2 && half === 'b' && c === 1 ? 10 : 9;
        let x = COLS[c];
        for (let k = 0; k < count; k++) {
          const isEnd = k === 0 || k === count - 1;
          const w = isEnd ? 22 : 20;
          const touchesSpine = (c === 0 && k === count - 1) || (c === 1 && k === 0);
          let type: SiteLot['type'] = 'intermediate';
          if (isEnd) type = touchesSpine && spineEnds++ < 10 ? 'corner' : 'end';
          const n = counters[street];
          const no = side === 'even' ? (n.even += 2) : (n.odd += 2);
          lots.push({ id: `adira-${street.split(' ').pop()}-${no}`, street, no, type, x, y, w, h: ROW_DEPTH, faces });
          x += w;
        }
      }
    }
  }

  const areas: SiteArea[] = [
    { id: 'buffer-west', name: 'Green buffer', kind: 'buffer', x: 0, y: 60, w: 26, h: 530 },
    { id: 'garden', name: 'Taman Adira neighbourhood garden', kind: 'garden', x: 494, y: 20, w: 140, h: 610 },
    { id: 'linear', name: 'Adira linear park', kind: 'linear', x: 0, y: 640, w: 634, h: 118 },
    { id: 'lake', name: 'Lake', kind: 'lake', x: 0, y: 758, w: 634, h: 40 },
  ];

  // The 16 amenities from SDP's Adira brochure (positions approximate).
  const amenities: Amenity[] = [
    { code: 'C', name: 'Pavilion', at: [562, 104], area: 'garden' },
    { code: 'E', name: 'Community lawn', at: [562, 184], area: 'garden' },
    { code: 'K', name: 'Playground', at: [528, 270], area: 'garden' },
    { code: 'D', name: 'Multipurpose court', at: [562, 352], area: 'garden' },
    { code: 'J', name: 'EPDM court', at: [600, 432], area: 'garden' },
    { code: 'M', name: 'Fitness station', at: [528, 486], area: 'garden' },
    { code: 'O', name: 'Relaxing shelter', at: [604, 540], area: 'garden' },
    { code: 'B', name: 'Picnic area', at: [528, 590], area: 'garden' },
    { code: 'A', name: 'Jogging path', at: [300, 676], area: 'linear' },
    { code: 'L', name: 'Brisk walk walkway', at: [140, 676], area: 'linear' },
    { code: 'F', name: 'Kid’s track', at: [70, 716], area: 'linear' },
    { code: 'G', name: 'Bike track', at: [200, 716], area: 'linear' },
    { code: 'H', name: 'Roller blades track', at: [320, 716], area: 'linear' },
    { code: 'I', name: 'Skateboard track', at: [430, 716], area: 'linear' },
    { code: 'N', name: 'Outdoor exercise', at: [540, 700], area: 'linear' },
    { code: 'P', name: 'Linear park', at: [600, 740], area: 'linear' },
  ];

  return {
    name: 'Adira, Series 1',
    phase: 'Phase R6A',
    size: { w: 634, h: 798 },
    lots, roads, areas, amenities,
    entrance: { name: 'Alura entrance', at: [8, 40] as Pt },
    scaleNote: '1 unit = 1 foot. Lots are 20 ft (intermediate) or 22 ft (end and corner) wide and 75 ft deep.',
  };
}

export type AdiraSite = ReturnType<typeof buildAdiraSite>;

export function pointInPolygon([x, y]: Pt, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
