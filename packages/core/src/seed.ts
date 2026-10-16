import { buildAdiraSite, PRECINCT_SHAPES } from './geo.ts';
import { ACTIVITIES, AVATAR_COLORS, HOUSE_COLORS, INTERESTS, LANGUAGES } from './rules.ts';
import { memoryStore, type SeedData, type Store } from './store.ts';
import type {
  Activity, BuddyLink, Connection, Contact, DecorKey, Giveaway, Group, GroupPost, HelpOffer, HelpRequest, Item,
  LedgerEntry, Loan, Message, Notice, Precinct, Resident, Skill, SkillRequest, TimeSlot, Unit, WatchRequest,
} from './types.ts';

/**
 * Demo data. Adira's 109 lots follow SDP's published Series 1 facts; every
 * resident, item and activity is invented for the prototype. Real residents
 * would come from SDP's purchaser records at key handover.
 */

const HOMES: Record<string, number> = {
  'kyra-1': 240, lumira: 210, 'kyra-2': 180, lyra: 260, 'casira-1': 90, 'casira-2': 150,
  adira: 109, persada: 120, athira: 160, azira: 140, ayra: 200,
};

function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

const noDecor = (): Record<DecorKey, boolean> => ({ plants: false, lights: false, bunting: false, porchCat: false, festive: true });

interface PersonaSpec {
  id: string; name: string; street: number; no: number; movedIn: string; bio: string;
  interests: string[]; activities: string[]; skills?: string[]; languages: string[]; slots: TimeSlot[];
  openToMeet?: boolean; buddy?: boolean; onboarded?: boolean;
}

const PERSONAS: PersonaSpec[] = [
  { id: 'hana', name: 'Hana', street: 2, no: 12, movedIn: '2026-03', bio: 'Mum of one, plant hoarder, always up for badminton.', interests: ['Badminton', 'Gardening', 'Kids in Standard 2', 'Baking'], activities: ['Badminton', 'Gardening', 'Playdates'], languages: ['Bahasa Malaysia', 'English'], slots: ['weekday-evening', 'weekend-morning'], openToMeet: true },
  { id: 'aisyah', name: 'Aisyah', street: 2, no: 8, movedIn: '2026-03', bio: 'Two doors from the playground. Happy to lend my tools.', interests: ['Baking', 'Cats', 'DIY'], activities: ['Baking'], languages: ['Bahasa Malaysia', 'English'], slots: ['weekend-morning', 'weekend-evening'], openToMeet: true, buddy: true },
  { id: 'meiling', name: 'Mei Ling', street: 2, no: 9, movedIn: '2026-03', bio: 'Weekend kuih maker. Kids welcome in my kitchen.', interests: ['Kuih', 'Baking', 'Hiking'], activities: ['Baking'], skills: ['Kuih baking for kids'], languages: ['Mandarin', 'Cantonese', 'English', 'Bahasa Malaysia'], slots: ['weekend-morning'], buddy: true },
  { id: 'ravi', name: 'Ravi', street: 2, no: 11, movedIn: '2026-04', bio: 'Engineer, cyclist, the guy with the toolbox.', interests: ['Cycling', 'DIY', 'Car care'], activities: ['Cycling'], skills: ['Leaky taps', 'Wiring basics'], languages: ['Tamil', 'English', 'Bahasa Malaysia'], slots: ['weekday-evening', 'weekend-morning'], buddy: true },
  { id: 'farid', name: 'Farid', street: 2, no: 14, movedIn: '2026-03', bio: 'Kenduri cook and badminton smasher.', interests: ['Badminton', 'Cooking', 'Futsal'], activities: ['Badminton', 'Futsal'], languages: ['Bahasa Malaysia', 'English'], slots: ['weekday-evening', 'weekend-evening'] },
  { id: 'kumar', name: 'Kumar', street: 2, no: 16, movedIn: '2026-05', bio: 'Car guy. Ask me about tyres.', interests: ['Car care', 'Badminton', 'Fishing'], activities: ['Badminton'], languages: ['Tamil', 'English', 'Bahasa Malaysia'], slots: ['weekend-morning'] },
  { id: 'nurul', name: 'Nurul', street: 2, no: 13, movedIn: '2026-04', bio: 'Teacher by day. My son is in Standard 2.', interests: ['Kids in Standard 2', 'Reading', 'Studying'], activities: ['Studying', 'Playdates'], skills: ['Year 6 maths', 'School run swap'], languages: ['Bahasa Malaysia', 'English'], slots: ['weekday-evening'], openToMeet: true },
  { id: 'jason', name: 'Jason', street: 2, no: 15, movedIn: '2026-03', bio: 'Runs the Tuesday badminton group.', interests: ['Badminton', 'Futsal', 'Gaming'], activities: ['Badminton', 'Futsal', 'Gaming'], languages: ['English', 'Mandarin', 'Hokkien'], slots: ['weekday-evening', 'weekend-evening'] },
  { id: 'siewhui', name: 'Siew Hui', street: 2, no: 7, movedIn: '2026-03', bio: 'Board game collector, part-time baker.', interests: ['Board games', 'Baking', 'Language exchange'], activities: ['Board games', 'Baking'], skills: ['Mandarin conversation'], languages: ['Mandarin', 'English'], slots: ['weekend-evening'], openToMeet: true },
  { id: 'aminah', name: 'Aminah', street: 2, no: 10, movedIn: '2026-03', bio: 'Retired, green fingers, keeps an eye on the street.', interests: ['Gardening', 'Cooking', 'Reading'], activities: ['Gardening'], skills: ['Watch my house', 'Plant care'], languages: ['Bahasa Malaysia'], slots: ['weekday-morning', 'weekend-morning'], buddy: true },
  { id: 'weijie', name: 'Wei Jie', street: 2, no: 18, movedIn: '2026-04', bio: 'Dad of twins, cycling on Sundays.', interests: ['Kids in Standard 2', 'Cycling', 'Board games'], activities: ['Cycling', 'Playdates'], languages: ['Mandarin', 'English'], slots: ['weekend-morning'] },
  { id: 'thanesh', name: 'Thanesh', street: 2, no: 17, movedIn: '2026-05', bio: 'IT support for the whole family, and now the street.', interests: ['Gaming', 'Basketball', 'Photography'], activities: ['Gaming', 'Basketball'], skills: ['Phone and wifi setup'], languages: ['Tamil', 'English'], slots: ['weekday-evening', 'weekend-evening'], openToMeet: true },
  { id: 'priya', name: 'Priya', street: 3, no: 1, movedIn: '2026-04', bio: 'Kolam artist. Deepavali open house this year!', interests: ['Cooking', 'Photography', 'Language exchange'], activities: ['Yoga'], skills: ['Tamil conversation'], languages: ['Tamil', 'English', 'Bahasa Malaysia'], slots: ['weekday-morning', 'weekend-evening'] },
  { id: 'hafiz', name: 'Hafiz', street: 3, no: 3, movedIn: '2026-06', bio: 'Just settled in. Fishing at the lake most weekends.', interests: ['Fishing', 'Futsal'], activities: ['Futsal'], languages: ['Bahasa Malaysia', 'English'], slots: ['weekend-morning'] },
  { id: 'daniel', name: 'Daniel', street: 3, no: 5, movedIn: '2026-05', bio: 'Training for my first half marathon.', interests: ['Jogging', 'Futsal', 'Basketball'], activities: ['Jogging', 'Futsal', 'Basketball'], languages: ['English', 'Bahasa Malaysia'], slots: ['weekday-morning', 'weekend-morning'], openToMeet: true },
  { id: 'zara', name: 'Zara', street: 3, no: 7, movedIn: '2026-06', bio: 'Thrifter and cat mum to Oyen.', interests: ['Cats', 'Photography', 'Yoga'], activities: ['Yoga'], languages: ['English', 'Bahasa Malaysia'], slots: ['weekday-evening'] },
  { id: 'irfan', name: 'Irfan', street: 1, no: 20, movedIn: '2026-10', bio: '', interests: [], activities: [], languages: [], slots: [], onboarded: false },
];

const FIRST_NAMES = [
  'Aiman', 'Nadia', 'Syafiq', 'Farah', 'Haziq', 'Izzati', 'Amir', 'Liyana', 'Hakim', 'Sofea', 'Danish', 'Balqis',
  'Khairul', 'Najwa', 'Zul', 'Mira', 'Rizal', 'Fatin', 'Adam', 'Alya', 'Wei Ling', 'Jun Hao', 'Mei Xin', 'Kah Wai',
  'Siew Ling', 'Chee Keong', 'Jia Yi', 'Boon Hock', 'Xin Yi', 'Kok Leong', 'Kavitha', 'Arun', 'Deepa', 'Suresh',
  'Malini', 'Vikram', 'Anand', 'Shalini', 'Rajesh', 'Devi', 'Grace', 'Joseph', 'Melissa', 'Dylan', 'Hidayah',
  'Iskandar', 'Yasmin', 'Shu Fen', 'Ganesh', 'Lavanya', 'Ethan', 'Puteri',
];

const BIOS = [
  'New to Klang, still finding the best nasi lemak.', 'Weekend cyclist and coffee person.', 'Two kids, one dog, zero free time.',
  'Work from home, happy to sign for your parcels.', 'Learning to garden, killing fewer plants each month.',
  'Big on board games, small on sleep.', 'Retired teacher, love a good chat.', 'University student, quiet most of the time.',
];

export function seedStore(): Store {
  const r = rng(2026);
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
  const some = <T,>(xs: readonly T[], min: number, max: number) => {
    const n = min + Math.floor(r() * (max - min + 1));
    return [...new Set(Array.from({ length: n }, () => pick(xs)))];
  };
  const day = (d: string, t = '09:00') => `${d}T${t}:00.000Z`;

  const precincts: Precinct[] = PRECINCT_SHAPES.map((s) => ({ ...s, homes: HOMES[s.id] ?? 0 }));
  const site = buildAdiraSite();
  const units: Unit[] = site.lots.map((l) => ({ ...l, precinctId: 'adira' }));
  const unitAt = (street: number, no: number) => units.find((u) => u.street === `Jalan Adira ${street}` && u.no === no)!;

  const residents: Resident[] = [];
  const base = (over: Partial<Resident> & Pick<Resident, 'id' | 'firstName' | 'precinctId'>): Resident => ({
    unitId: null, avatar: pick(AVATAR_COLORS), houseColor: pick(HOUSE_COLORS), photo: null, bio: '',
    interests: [], activities: [], skills: [], languages: [], availability: [], openToMeet: false,
    privacy: { directory: true, showInterests: true }, lang: 'en', movedIn: '2026-03', joinedAt: day('2026-03-15'),
    circle: '', handoverCode: '', onboarded: true, consentAt: day('2026-03-15'), guideSeen: true, isBuddy: false,
    intro: null, decor: noDecor(), ...over,
  });

  PERSONAS.forEach((p, i) => {
    const u = unitAt(p.street, p.no);
    const joined = `${p.movedIn}-${p.id === 'irfan' ? '14' : String(10 + (i % 15)).padStart(2, '0')}`;
    residents.push(base({
      id: p.id, firstName: p.name, precinctId: 'adira', unitId: u.id, avatar: AVATAR_COLORS[i % AVATAR_COLORS.length],
      houseColor: p.id === 'hana' ? '#E8452C' : HOUSE_COLORS[i % HOUSE_COLORS.length], bio: p.bio,
      interests: p.interests, activities: p.activities, skills: p.skills ?? [], languages: p.languages, availability: p.slots,
      openToMeet: !!p.openToMeet, isBuddy: !!p.buddy, movedIn: p.movedIn, joinedAt: day(joined),
      circle: `adira-r6a-${p.movedIn}`, handoverCode: `ADIRA-${p.street}${String(p.no).padStart(2, '0')}`,
      onboarded: p.onboarded ?? true, consentAt: p.onboarded === false ? null : day(joined), guideSeen: p.onboarded !== false,
      decor: { ...noDecor(), plants: p.id === 'hana' },
    }));
  });

  // Other joined Adira homes, generated.
  const taken = new Set(residents.map((x) => x.unitId));
  let g = 0;
  for (const u of units) {
    if (taken.has(u.id) || r() < 0.42) continue;
    const name = FIRST_NAMES[g % FIRST_NAMES.length];
    const month = pick(['2026-03', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']);
    const joined = month === '2026-10' ? `2026-10-0${1 + Math.floor(r() * 9)}` : `${month}-${String(5 + Math.floor(r() * 20)).padStart(2, '0')}`;
    residents.push(base({
      id: `adira-n${g}`, firstName: name, precinctId: 'adira', unitId: u.id, bio: pick(BIOS),
      interests: some(INTERESTS, 2, 4), activities: some(ACTIVITIES, 1, 3), languages: some(LANGUAGES, 1, 3),
      availability: some(['weekday-morning', 'weekday-evening', 'weekend-morning', 'weekend-evening'] as TimeSlot[], 1, 2),
      openToMeet: r() > 0.5, movedIn: month, joinedAt: day(joined), circle: `adira-r6a-${month}`,
      handoverCode: `ADIRA-${u.street.split(' ').pop()}${String(u.no).padStart(2, '0')}`,
      intro: month === '2026-10' || month === '2026-09'
        ? { text: `Hi everyone, I’m ${name} at No. ${u.no}, ${u.street}. ${pick(BIOS)}`, publishedAt: day(joined, '12:00'), welcomedBy: [] }
        : null,
    }));
    g++;
  }
  // Zara published an intro when she arrived.
  const zara = residents.find((x) => x.id === 'zara')!;
  zara.intro = { text: 'Hi Adira! Zara here at No. 7, Jalan Adira 3, with my ginger cat Oyen. Love thrifting and sunset yoga.', publishedAt: day('2026-06-20'), welcomedBy: ['aminah', 'priya'] };

  residents.push(base({
    id: 'sdp-team', firstName: 'SDP Community Team', precinctId: 'adira', isAdmin: true, handoverCode: 'SDP-ADMIN',
    circle: 'staff', avatar: '#E8452C', privacy: { directory: false, showInterests: false },
  }));

  // Anonymous residents in other precincts, only ever shown as totals.
  for (const p of precincts) {
    if (p.status !== 'occupied' || p.id === 'adira') continue;
    const n = Math.round(p.homes * (0.12 + r() * 0.38));
    for (let i = 0; i < n; i++) {
      residents.push(base({ id: `${p.id}-r${i}`, firstName: 'Neighbour', precinctId: p.id, handoverCode: `${p.id.toUpperCase()}-${i}`, circle: `${p.id}-p1`, privacy: { directory: true, showInterests: false } }));
    }
  }

  // Connections.
  const connections: Connection[] = [];
  const has = (a: string, b: string) => connections.some((c) => (c.from === a && c.to === b) || (c.from === b && c.to === a));
  const connect = (from: string, to: string, at: string, status: Connection['status'] = 'accepted', message = '') => {
    if (from === to || has(from, to)) return;
    connections.push({ id: `c-${from}-${to}`, from, to, message, status, at, respondedAt: status === 'accepted' ? at : null });
  };
  connect('hana', 'farid', day('2026-10-02'), 'accepted', 'Hi Farid! Saw you at badminton, want to play Tuesday?');
  connect('ravi', 'hana', day('2026-10-02'), 'accepted', 'Welcome to the street! Shout if anything needs fixing.');
  connect('aisyah', 'hana', day('2026-10-13'), 'pending', 'Hi Hana! I’m two doors down at No. 8. Our kids should meet at the playground.');
  for (const [a, b] of [['aisyah', 'meiling'], ['aisyah', 'siewhui'], ['farid', 'jason'], ['jason', 'daniel'], ['nurul', 'weijie'],
    ['aminah', 'priya'], ['kumar', 'ravi'], ['priya', 'hafiz'], ['zara', 'thanesh'], ['aminah', 'zara'], ['jason', 'kumar'],
    ['meiling', 'siewhui'], ['daniel', 'thanesh'], ['ravi', 'thanesh']]) connect(a, b, day('2026-09-20'));
  const adiraIds = residents.filter((x) => x.precinctId === 'adira' && x.unitId && x.onboarded).map((x) => x.id);
  for (const id of adiraIds) {
    if (!id.startsWith('adira-n')) continue;
    const k = Math.floor(r() * 5);
    for (let j = 0; j < k; j++) connect(id, pick(adiraIds.filter((x) => x !== 'hana' && x !== 'irfan')), day('2026-09-10'));
  }
  const otherPrecinctPairs = residents.filter((x) => x.precinctId !== 'adira');
  for (let k = 0; k < otherPrecinctPairs.length * 0.6; k++) {
    const a = pick(otherPrecinctPairs);
    const peers = otherPrecinctPairs.filter((x) => x.precinctId === a.precinctId);
    connect(a.id, pick(peers).id, day('2026-08-01'));
  }

  const messages: Message[] = [
    { id: 'm1', connectionId: 'c-hana-farid', from: 'farid', to: 'hana', text: 'Tuesday 8.30 at the multipurpose court, I’ll bring shuttlecocks.', at: day('2026-10-03', '11:00') },
    { id: 'm2', connectionId: 'c-hana-farid', from: 'hana', text: 'Deal! Can my husband join too?', at: day('2026-10-03', '11:05') },
    { id: 'm3', connectionId: 'c-hana-farid', from: 'farid', to: 'hana', text: 'Of course, more the merrier.', at: day('2026-10-03', '11:09') },
  ].map((m) => ({ to: 'farid', ...m })) as Message[];

  const items: Item[] = [];
  const item = (id: string, ownerId: string, title: string, category: Item['category'], o: Partial<Item> = {}) =>
    items.push({ id, ownerId, precinctId: 'adira', title, note: '', category, condition: 'good', maxDays: 3, conditions: '', available: true, createdAt: day('2026-10-01'), ...o });
  item('i-drill', 'aisyah', 'Cordless drill', 'tools', { note: 'Comes with a box of drill bits', condition: 'like_new', conditions: 'Please charge the battery before returning.' });
  item('i-ladder', 'aisyah', '6ft ladder', 'tools', { available: false, maxDays: 2 });
  item('i-canopy', 'farid', 'Canopy tent', 'festive', { note: 'Fits 3 tables, good for open houses', maxDays: 4, conditions: 'Dry it before folding if it rained.' });
  item('i-chairs', 'farid', '20 plastic chairs', 'festive', { maxDays: 4, condition: 'well_used' });
  item('i-washer', 'kumar', 'Pressure washer', 'tools', { note: 'Great for porch tiles', maxDays: 2 });
  item('i-jack', 'kumar', 'Car jack', 'tools', { maxDays: 1 });
  item('i-rackets', 'jason', 'Badminton rackets x4', 'sports', { note: 'Shuttlecocks included', maxDays: 7 });
  item('i-mixer', 'siewhui', 'Stand mixer', 'kitchen', { condition: 'like_new' });
  item('i-tins', 'siewhui', 'Kuih moulds and baking tins', 'kitchen', { maxDays: 5 });
  item('i-ball', 'daniel', 'Futsal ball and cones', 'sports', { maxDays: 7, condition: 'well_used' });
  item('i-garden', 'aminah', 'Garden tools set', 'home', { note: 'Spade, rake, gloves', maxDays: 5 });
  item('i-bike', 'weijie', 'Kids bicycle (age 6 to 9)', 'kids', { maxDays: 7 });
  item('i-pelita', 'priya', 'Deepavali oil lamps (pelita)', 'festive', { maxDays: 7, conditions: 'Back by 15 Nov please.' });
  item('i-games', 'siewhui', 'Board game box: Catan, Ticket to Ride', 'kids', { maxDays: 7 });

  const loans: Loan[] = [
    { id: 'l-ladder', itemId: 'i-ladder', lenderId: 'aisyah', borrowerId: 'siewhui', precinctId: 'adira', status: 'handed_over', startDate: '2026-10-15', endDate: '2026-10-17', note: 'Changing a ceiling light', handoverCode: '418205', conditionPhoto: true, stars: null, createdAt: day('2026-10-14'), updatedAt: day('2026-10-15') },
    { id: 'l-jack', itemId: 'i-jack', lenderId: 'kumar', borrowerId: 'hana', precinctId: 'adira', status: 'returned', startDate: '2026-10-03', endDate: '2026-10-04', note: '', handoverCode: '220931', conditionPhoto: true, stars: 5, createdAt: day('2026-10-02'), updatedAt: day('2026-10-04') },
  ];

  const giveaways: Giveaway[] = [
    { id: 'gv-boxes', ownerId: 'zara', precinctId: 'adira', title: 'Moving boxes, about 15', note: 'Flattened, in my porch', claimedBy: null, createdAt: day('2026-10-10') },
    { id: 'gv-tiles', ownerId: 'weijie', precinctId: 'adira', title: 'Spare floor tiles, 6 pieces', note: 'Same tiles as the Adira kitchens', claimedBy: null, createdAt: day('2026-10-11') },
    { id: 'gv-curtains', ownerId: 'hafiz', precinctId: 'adira', title: 'Curtains for the master bedroom windows', note: 'Grey, blackout', claimedBy: null, createdAt: day('2026-10-12') },
  ];

  const skills: Skill[] = [];
  const skill = (id: string, ownerId: string, title: string, category: Skill['category'], description: string, availability: string, arrangement: Skill['arrangement'] = 'free', swapFor = '') =>
    skills.push({ id, ownerId, precinctId: 'adira', title, description, category, availability, arrangement, swapFor, active: true, createdAt: day('2026-10-01') });
  skill('s-kuih', 'meiling', 'Kuih baking for kids', 'cooking', 'Kuih lapis and onde-onde with your kids in my kitchen. Up to 4 kids.', 'Saturday mornings');
  skill('s-taps', 'ravi', 'Fix leaky taps and basic wiring checks', 'repairs', 'I bring my own tools. Nothing behind the DB box, call a licensed electrician for that.', 'Weekday evenings');
  skill('s-maths', 'nurul', 'Year 6 maths tutoring', 'tutoring', 'Fractions, percentages and problem solving. One hour per session.', 'Weekday evenings', 'swap', 'Help in my garden');
  skill('s-wifi', 'thanesh', 'Phone, laptop and wifi setup', 'computer', 'Mesh wifi, new phones, printers, parental controls.', 'Weekend evenings');
  skill('s-plants', 'aminah', 'Plant care and composting', 'gardening', 'Which plants survive Klang sun, and starting a compost bin.', 'Weekday mornings');
  skill('s-tamil', 'priya', 'Tamil conversation practice', 'language', 'Casual chat over teh tarik.', 'Weekend evenings', 'swap', 'Mandarin practice');
  skill('s-mandarin', 'siewhui', 'Mandarin conversation practice', 'language', 'Beginner friendly, 45 minutes.', 'Weekend evenings', 'swap', 'Tamil practice');

  const skillRequests: SkillRequest[] = [
    { id: 'sr-1', skillId: 's-wifi', ownerId: 'thanesh', requesterId: 'aminah', date: '2026-10-18', note: 'Mesh wifi for my parents’ room', status: 'accepted', stars: null, feedback: '', createdAt: day('2026-10-12') },
    { id: 'sr-2', skillId: 's-plants', ownerId: 'aminah', requesterId: 'hana', date: '2026-10-08', note: 'My chillies keep dying', status: 'completed', stars: 5, feedback: 'So helpful, the chillies are alive!', createdAt: day('2026-10-05') },
  ];

  const help: HelpRequest[] = [
    { id: 'h-wardrobe', requesterId: 'weijie', precinctId: 'adira', title: 'Move a wardrobe upstairs', category: 'carry', description: 'One more pair of hands, about 15 minutes.', preferredAt: day('2026-10-18', '02:00'), resources: 'Gloves', responses: [{ residentId: 'jason', message: 'I can do Sunday 10am.', at: day('2026-10-14') }], helperId: null, status: 'open', createdAt: day('2026-10-13') },
    { id: 'h-oyen', requesterId: 'zara', precinctId: 'adira', title: 'Feed my cat Oyen this weekend', category: 'pets', description: 'Twice a day, food is by the door. Spare key with Aminah.', preferredAt: day('2026-10-24', '00:00'), resources: '', responses: [], helperId: null, status: 'open', createdAt: day('2026-10-15') },
    { id: 'h-printer', requesterId: 'aminah', precinctId: 'adira', title: 'Printer will not connect to wifi', category: 'computer', description: 'HP printer, new router.', preferredAt: day('2026-10-17', '06:00'), resources: '', responses: [{ residentId: 'thanesh', message: 'I’ll pop by Saturday afternoon.', at: day('2026-10-13') }], helperId: 'thanesh', status: 'confirmed', createdAt: day('2026-10-12') },
  ];

  const helpOffers: HelpOffer[] = [
    { id: 'ho-1', ownerId: 'jason', precinctId: 'adira', title: 'Extra hands for moving furniture', category: 'carry', description: 'Weekends, I’m strong-ish.', availability: 'Weekends', active: true, createdAt: day('2026-10-01') },
    { id: 'ho-2', ownerId: 'aminah', precinctId: 'adira', title: 'Keep an eye on your house', category: 'errands', description: 'I’m home most days. Parcels, plants, a look-around.', availability: 'Any day', active: true, createdAt: day('2026-10-01') },
    { id: 'ho-3', ownerId: 'daniel', precinctId: 'adira', title: 'Walk your dog with mine', category: 'pets', description: 'Morning walks on the linear park.', availability: 'Weekday mornings', active: true, createdAt: day('2026-10-01') },
  ];

  const groups: Group[] = [];
  const group = (id: string, name: string, category: string, description: string, organiserId: string, memberIds: string[]) =>
    groups.push({ id, precinctId: 'adira', name, category, description, organiserId, adminIds: [organiserId], memberIds: [...new Set([organiserId, ...memberIds])], createdAt: day('2026-09-01') });
  const generated = residents.filter((x) => x.id.startsWith('adira-n'));
  const fans = (interest: string) => generated.filter((x) => x.interests.includes(interest) || x.activities.includes(interest)).map((x) => x.id);
  group('g-badminton', 'Adira Badminton Club', 'Badminton', 'Tuesday nights at the multipurpose court. All levels, rackets to borrow.', 'jason', ['farid', 'hana', 'daniel', 'kumar', ...fans('Badminton')]);
  group('g-parents', 'Standard 2 Parents', 'Kids in Standard 2', 'School runs, homework help and weekend playdates.', 'nurul', ['weijie', 'hana', ...fans('Kids in Standard 2')]);
  group('g-bakers', 'Kuih & Bakes', 'Baking', 'Swap recipes, borrow moulds, bake together before festivals.', 'meiling', ['siewhui', 'aisyah', ...fans('Baking')]);
  group('g-runners', 'Linear Park Runners', 'Jogging', 'Sunrise jogs on the linear park, couch to 5K pace.', 'daniel', fans('Jogging'));
  group('g-gamers', 'Adira Gamers', 'Gaming', 'Board games and console nights at the pavilion.', 'thanesh', ['siewhui', 'jason', ...fans('Gaming'), ...fans('Board games')]);
  group('g-garden', 'Garden Growers', 'Gardening', 'Seeds, cuttings and composting tips for Klang weather.', 'aminah', ['priya', 'hana', ...fans('Gardening')]);

  const groupPosts: GroupPost[] = [
    { id: 'gp1', groupId: 'g-badminton', authorId: 'jason', text: 'Court booked for Tuesday 8.30pm. Bring water, it gets hot!', at: day('2026-10-14') },
    { id: 'gp2', groupId: 'g-badminton', authorId: 'farid', text: 'Anyone keen for doubles this Saturday morning too?', at: day('2026-10-15') },
    { id: 'gp3', groupId: 'g-garden', authorId: 'aminah', text: 'I have extra pandan and serai cuttings. Free to anyone in the group.', at: day('2026-10-12') },
    { id: 'gp4', groupId: 'g-parents', authorId: 'nurul', text: 'School run rota for next week is up. Two seats left in my car on Wednesday.', at: day('2026-10-15') },
    { id: 'gp5', groupId: 'g-bakers', authorId: 'meiling', text: 'Deepavali murukku session at my place? Pick a date.', at: day('2026-10-13') },
  ];

  const activities: Activity[] = [];
  const act = (id: string, hostId: string, title: string, category: Activity['category'], placeId: string, place: string, startsAt: string, hours: number, o: Partial<Activity> = {}) =>
    activities.push({
      id, hostId, precinctId: 'adira', scope: 'precinct', category, title, description: '', placeId, place, startsAt,
      endsAt: new Date(new Date(startsAt).getTime() + hours * 3600000).toISOString(), capacity: null, participants: [],
      groupId: null, status: 'active', createdAt: day('2026-10-05'), ...o,
    });
  act('a-jog', 'daniel', 'Sunrise jog on the linear park', 'sport', 'adira-linear', 'Linear park jogging path, Adira', '2026-10-16T23:00:00.000Z', 1, { groupId: 'g-runners', participants: ['jason', 'farid'], description: 'Easy 5K, we wait for everyone.' });
  act('a-badminton', 'jason', 'Badminton night', 'sport', 'adira-court', 'Multipurpose court, Taman Adira', '2026-10-20T12:30:00.000Z', 2, { groupId: 'g-badminton', capacity: 8, participants: ['farid', 'kumar', 'daniel'], description: 'Doubles rotation. Rackets to borrow from Jason.' });
  act('a-futsal', 'daniel', 'Friendly futsal: Adira vs Lyra', 'sport', 'town-park-fields', 'Town Park fields', '2026-10-21T12:30:00.000Z', 2, { scope: 'township', capacity: 14, participants: ['jason', 'hafiz', 'thanesh'] });
  act('a-study', 'nurul', 'Quiet study hour (SPM and uni)', 'study', 'adira-pavilion', 'Pavilion, Taman Adira', '2026-10-22T12:00:00.000Z', 2, { capacity: 12, participants: [], description: 'Bring your own books. Nurul can help with maths.' });
  act('a-boardgames', 'thanesh', 'Board games night', 'games', 'adira-pavilion', 'Pavilion, Taman Adira', '2026-10-23T12:00:00.000Z', 3, { groupId: 'g-gamers', capacity: 12, participants: ['siewhui', 'jason'] });
  act('a-housewarm', 'hafiz', 'Housewarming makan at Hafiz’s', 'open_house', 'home', 'No. 3, Jalan Adira 3', '2026-10-24T11:00:00.000Z', 3, { participants: ['priya'] });
  act('a-gotong', 'aminah', 'Gotong-royong: tidy Taman Adira', 'cleanup', 'adira-pavilion', 'Pavilion, Taman Adira', '2026-10-25T00:00:00.000Z', 2, { capacity: 30, participants: ['priya', 'nurul'], description: 'Gloves and bags provided. Breakfast after.' });
  act('a-kuih', 'meiling', 'Kuih baking for kids', 'class', 'adira-pavilion', 'Pavilion, Taman Adira', '2026-10-31T02:00:00.000Z', 2, { groupId: 'g-bakers', capacity: 10, participants: ['nurul', 'weijie'] });
  act('a-kites', 'farid', 'Kite flying at the Town Park', 'social', 'town-park-lawn', 'Town Park lawn', '2026-11-01T09:00:00.000Z', 2, { scope: 'township' });
  act('a-deepavali', 'priya', 'Deepavali open house at Priya’s', 'open_house', 'home', 'No. 1, Jalan Adira 3', '2026-11-08T03:00:00.000Z', 5, { participants: ['aminah', 'hafiz', 'aisyah'], description: 'Murukku, briyani and kolam drawing for the kids. Everyone welcome.' });

  const notices: Notice[] = [
    { id: 'n-welcome', precinctId: 'adira', authorId: 'sdp-team', kind: 'announcement', title: 'Welcome to Adira Series 1', body: 'Keys for the last Series 1 homes are being handed over this month. Say hi to the new houses with ribbons on the map!', resolved: false, at: day('2026-10-01') },
    { id: 'n-defects', precinctId: 'adira', authorId: 'sdp-team', kind: 'announcement', title: 'Reporting defects', body: 'Use “Report a defect” in the Sime Darby Property app. Include photos and your unit number.', resolved: false, at: day('2026-10-05') },
    { id: 'n-oyen', precinctId: 'adira', authorId: 'zara', kind: 'lost', title: 'Lost: ginger cat Oyen', body: 'Last seen near the playground on Thursday evening. Very friendly, blue collar.', resolved: false, at: day('2026-10-15') },
    { id: 'n-parcel', precinctId: 'adira', authorId: 'kumar', kind: 'found', title: 'Found: parcel for No. 22, Jalan Adira 1', body: 'Left at my gate by mistake. Collect from No. 16, Jalan Adira 2.', resolved: false, at: day('2026-10-14') },
  ];

  const buddies: BuddyLink[] = [{ id: 'b-zara', newcomerId: 'zara', buddyId: 'aminah', precinctId: 'adira', status: 'active', at: day('2026-06-21') }];
  const contacts: Contact[] = [
    { id: 'ct-1', ownerId: 'hana', contactId: 'ravi', status: 'accepted' },
    { id: 'ct-2', ownerId: 'hana', contactId: 'farid', status: 'accepted' },
  ];
  const watches: WatchRequest[] = [
    { id: 'w-1', ownerId: 'farid', watcherId: 'hana', precinctId: 'adira', from: '2026-10-24', to: '2026-10-26', note: 'Away for a kenduri in Ipoh. Just check the gate is locked, thanks!', status: 'pending', createdAt: day('2026-10-15') },
  ];

  const ledger: LedgerEntry[] = [];
  const pts = (residentId: string, delta: number, reason: string, d: string) =>
    ledger.push({ id: `p-${residentId}-${ledger.length}`, residentId, delta, reason, at: day(d, '08:00') });
  pts('hana', 50, 'Joined JIRAN at key handover', '2026-03-20');
  pts('hana', 20, 'Completed your profile', '2026-03-20');
  pts('hana', 10, 'Connected with Farid', '2026-10-02');
  pts('hana', 10, 'Connected with Ravi', '2026-10-02');
  pts('hana', 10, 'Returned and rated Car jack', '2026-10-04');
  pts('hana', 5, 'Joined Garden Growers', '2026-10-05');
  pts('hana', 5, 'Joined Adira Badminton Club', '2026-10-06');
  pts('hana', 15, 'Neighbour contacts set up', '2026-10-06');
  pts('hana', 15, 'Learned plant care from Aminah', '2026-10-08');
  pts('hana', 100, 'Move-in Circle welcome week', '2026-10-09');
  for (const x of residents) {
    if (x.precinctId === 'adira' && x.unitId && x.id !== 'hana' && x.id !== 'irfan' && !x.isAdmin) pts(x.id, 50 + Math.round(r() * 220), 'Neighbourly activity', '2026-10-09');
  }

  const data: SeedData = {
    precincts, units, residents, connections, messages, dismissals: [], groups, groupPosts, activities, items, loans,
    giveaways, skills, skillRequests, help, helpOffers, contacts, watches, floodAlerts: [], floodCheckins: [], sos: [],
    notices, buddies, notifications: [], ledger,
  };
  return memoryStore(data);
}

/** Demo personas the sign-in screen offers (each maps to a handover code). */
export const DEMO_PERSONAS = [
  { residentId: 'hana', code: 'ADIRA-212', label: 'Hana', note: 'No. 12, Jalan Adira 2 · you, in the demo' },
  { residentId: 'irfan', code: 'ADIRA-120', label: 'Irfan', note: 'Got his keys this week · try onboarding' },
  { residentId: 'aisyah', code: 'ADIRA-208', label: 'Aisyah', note: 'No. 8, Jalan Adira 2 · lends her drill' },
  { residentId: 'ravi', code: 'ADIRA-211', label: 'Ravi', note: 'No. 11, Jalan Adira 2 · fixes taps' },
  { residentId: 'sdp-team', code: 'SDP-ADMIN', label: 'SDP Community Team', note: 'Dashboard, notices and flood alerts' },
];
