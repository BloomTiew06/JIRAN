// Domain types shared by the server and the web app.
// Township map points use the Bandar Bukit Raja 2 plan's pixel space (about
// 1500 x 855). Adira site-plan points are in feet (1 unit = 1 ft).

export type Id = string;
export type Pt = [number, number];

export interface Precinct {
  id: Id;
  name: string;
  polygon: Pt[];
  label: Pt;
  tint: string;
  homes: number;
  status: 'occupied' | 'upcoming';
  hasStreetView: boolean;
}

export type LotType = 'intermediate' | 'end' | 'corner';

export interface Unit {
  id: Id;
  precinctId: Id;
  street: string;
  no: number;
  type: LotType;
  /** lot rectangle on the site plan, in feet */
  x: number;
  y: number;
  w: number;
  h: number;
  faces: 'north' | 'south';
}

export type DecorKey = 'plants' | 'lights' | 'bunting' | 'porchCat' | 'festive';
export type TimeSlot = 'weekday-morning' | 'weekday-evening' | 'weekend-morning' | 'weekend-evening';
export type Lang = 'en' | 'ms' | 'zh' | 'ta';

export interface Intro {
  text: string;
  publishedAt: string | null;
  welcomedBy: Id[];
}

export interface Resident {
  id: Id;
  unitId: Id | null;
  precinctId: Id;
  firstName: string;
  avatar: string;
  houseColor: string;
  photo: string | null;
  bio: string;
  interests: string[];
  activities: string[];
  skills: string[];
  languages: string[];
  availability: TimeSlot[];
  openToMeet: boolean;
  privacy: { directory: boolean; showInterests: boolean };
  lang: Lang;
  /** YYYY-MM the keys were collected */
  movedIn: string;
  joinedAt: string;
  circle: string;
  handoverCode: string;
  isAdmin?: boolean;
  onboarded: boolean;
  consentAt: string | null;
  guideSeen: boolean;
  isBuddy: boolean;
  intro: Intro | null;
  decor: Record<DecorKey, boolean>;
}

export interface Connection {
  id: Id;
  from: Id;
  to: Id;
  message: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  at: string;
  respondedAt: string | null;
}

export interface Message { id: Id; connectionId: Id; from: Id; to: Id; text: string; at: string }

export interface Dismissal { id: Id; residentId: Id; targetId: Id }

export interface Group {
  id: Id;
  precinctId: Id;
  name: string;
  description: string;
  category: string;
  organiserId: Id;
  adminIds: Id[];
  memberIds: Id[];
  createdAt: string;
}

export interface GroupPost { id: Id; groupId: Id; authorId: Id; text: string; at: string }

export type ActivityCategory = 'sport' | 'social' | 'cleanup' | 'open_house' | 'class' | 'kids' | 'games' | 'study';

export interface Activity {
  id: Id;
  hostId: Id;
  precinctId: Id;
  scope: 'precinct' | 'township';
  category: ActivityCategory;
  title: string;
  description: string;
  placeId: string;
  place: string;
  startsAt: string;
  endsAt: string;
  capacity: number | null;
  participants: Id[];
  groupId: Id | null;
  status: 'active' | 'cancelled';
  createdAt: string;
}

export type ItemCategory = 'tools' | 'home' | 'kitchen' | 'festive' | 'kids' | 'sports';
export type ItemCondition = 'like_new' | 'good' | 'well_used';

export interface Item {
  id: Id;
  ownerId: Id;
  precinctId: Id;
  title: string;
  note: string;
  category: ItemCategory;
  condition: ItemCondition;
  maxDays: number;
  conditions: string;
  available: boolean;
  createdAt: string;
}

export type LoanStatus = 'requested' | 'accepted' | 'declined' | 'handed_over' | 'returned' | 'cancelled';

export interface Loan {
  id: Id;
  itemId: Id;
  lenderId: Id;
  borrowerId: Id;
  precinctId: Id;
  status: LoanStatus;
  startDate: string;
  endDate: string;
  note: string;
  handoverCode: string;
  conditionPhoto: boolean;
  stars: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface Giveaway { id: Id; ownerId: Id; precinctId: Id; title: string; note: string; claimedBy: Id | null; createdAt: string }

export type SkillCategory = 'tutoring' | 'computer' | 'cooking' | 'gardening' | 'language' | 'repairs' | 'other';

export interface Skill {
  id: Id;
  ownerId: Id;
  precinctId: Id;
  title: string;
  description: string;
  category: SkillCategory;
  availability: string;
  arrangement: 'free' | 'swap';
  swapFor: string;
  active: boolean;
  createdAt: string;
}

export interface SkillRequest {
  id: Id;
  skillId: Id;
  ownerId: Id;
  requesterId: Id;
  date: string;
  note: string;
  status: 'requested' | 'accepted' | 'declined' | 'completed' | 'cancelled';
  stars: number | null;
  feedback: string;
  createdAt: string;
}

export type HelpCategory = 'carry' | 'pets' | 'computer' | 'repairs' | 'errands' | 'other';

export interface HelpResponse { residentId: Id; message: string; at: string }

export interface HelpRequest {
  id: Id;
  requesterId: Id;
  precinctId: Id;
  title: string;
  category: HelpCategory;
  description: string;
  preferredAt: string;
  resources: string;
  responses: HelpResponse[];
  helperId: Id | null;
  status: 'open' | 'confirmed' | 'completed' | 'cancelled';
  createdAt: string;
}

export interface HelpOffer {
  id: Id;
  ownerId: Id;
  precinctId: Id;
  title: string;
  category: HelpCategory;
  description: string;
  availability: string;
  active: boolean;
  createdAt: string;
}

export interface Contact { id: Id; ownerId: Id; contactId: Id; status: 'pending' | 'accepted' }

export interface WatchRequest {
  id: Id;
  ownerId: Id;
  watcherId: Id;
  precinctId: Id;
  from: string;
  to: string;
  note: string;
  status: 'pending' | 'accepted' | 'declined' | 'done';
  createdAt: string;
}

export type FloodLevel = 'watch' | 'warning' | 'danger';
export interface FloodAlert { id: Id; level: FloodLevel; title: string; source: string; precinctIds: Id[]; issuedAt: string; endedAt: string | null }
export type CheckinStatus = 'safe' | 'need_help' | 'can_help';
export interface FloodCheckin { id: Id; alertId: Id; residentId: Id; precinctId: Id; status: CheckinStatus; note: string; at: string }
export interface SosAlert { id: Id; residentId: Id; precinctId: Id; notified: Id[]; at: string; cancelledAt: string | null }

export interface Notice {
  id: Id;
  precinctId: Id;
  authorId: Id;
  kind: 'announcement' | 'lost' | 'found' | 'general';
  title: string;
  body: string;
  resolved: boolean;
  at: string;
}

export interface BuddyLink {
  id: Id;
  newcomerId: Id;
  buddyId: Id;
  precinctId: Id;
  status: 'pending' | 'active' | 'declined' | 'ended';
  at: string;
}

export interface Notification {
  id: Id;
  residentId: Id;
  text: string;
  /** where tapping it leads, e.g. "neighbours:connections" */
  link: string;
  at: string;
  readAt: string | null;
}

export interface LedgerEntry { id: Id; residentId: Id; delta: number; reason: string; at: string }

export interface JiranEvent {
  type: string;
  precinctId: Id | null;
  to?: Id[];
  message: string;
  at: string;
}
