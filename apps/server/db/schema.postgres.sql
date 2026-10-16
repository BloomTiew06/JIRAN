-- JIRAN production schema (PostgreSQL 15+, works on Supabase).
-- The prototype keeps the same shapes in SQLite as JSON rows; this is the
-- relational version for when SDP runs it for real.
-- Money-free by design: no price, amount, payment or wallet column anywhere.

CREATE TABLE precincts (
  id            text PRIMARY KEY,
  township      text NOT NULL DEFAULT 'bandar-bukit-raja-2',
  name          text NOT NULL,
  status        text NOT NULL CHECK (status IN ('occupied', 'upcoming')),
  homes         int  NOT NULL DEFAULT 0,
  polygon       jsonb NOT NULL,           -- [[x,y],...] in township plan space
  label         jsonb NOT NULL,
  tint          text NOT NULL,
  has_street_view boolean NOT NULL DEFAULT false
);

CREATE TABLE units (
  id          text PRIMARY KEY,           -- matches SDP's unit reference
  precinct_id text NOT NULL REFERENCES precincts(id),
  street      text NOT NULL,
  house_no    int  NOT NULL,
  x           int  NOT NULL,
  y           int  NOT NULL,
  wall        text NOT NULL,
  roof        text NOT NULL,
  UNIQUE (precinct_id, street, house_no)
);

CREATE TABLE residents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sdp_customer_id text UNIQUE,            -- from SDP purchaser records, never shown to neighbours
  unit_id       text REFERENCES units(id),
  precinct_id   text NOT NULL REFERENCES precincts(id),
  first_name    text NOT NULL,            -- only first name is ever shown
  avatar        text NOT NULL,
  interests     text[] NOT NULL DEFAULT '{}',
  skills        text[] NOT NULL DEFAULT '{}',
  moved_in      date NOT NULL,
  circle        text NOT NULL,            -- Move-in Circle: precinct + phase + key month
  is_admin      boolean NOT NULL DEFAULT false,
  decor         jsonb NOT NULL DEFAULT '{}',
  consent_at    timestamptz NOT NULL,     -- PDPA consent at sign-up
  lang          text NOT NULL DEFAULT 'en' CHECK (lang IN ('en', 'ms', 'zh', 'ta'))
);
CREATE INDEX ON residents (precinct_id);

CREATE TABLE waves (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_id  uuid NOT NULL REFERENCES residents(id),
  to_id    uuid NOT NULL REFERENCES residents(id),
  at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (from_id, to_id),
  CHECK (from_id <> to_id)
);

CREATE TABLE items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid NOT NULL REFERENCES residents(id),
  precinct_id text NOT NULL REFERENCES precincts(id),
  title       text NOT NULL CHECK (length(title) <= 60),
  note        text NOT NULL DEFAULT '',
  category    text NOT NULL CHECK (category IN ('tools','home','kitchen','festive','kids','sports')),
  available   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE loans (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id        uuid NOT NULL REFERENCES items(id),
  lender_id      uuid NOT NULL REFERENCES residents(id),
  borrower_id    uuid NOT NULL REFERENCES residents(id),
  precinct_id    text NOT NULL REFERENCES precincts(id),
  status         text NOT NULL CHECK (status IN ('requested','accepted','declined','handed_over','returned','cancelled')),
  pickup         text NOT NULL,
  days           int  NOT NULL CHECK (days BETWEEN 1 AND 7),
  handover_code  text NOT NULL,
  condition_photo_url text,
  stars          int CHECK (stars BETWEEN 1 AND 5),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE giveaways (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid NOT NULL REFERENCES residents(id),
  precinct_id text NOT NULL REFERENCES precincts(id),
  title       text NOT NULL,
  note        text NOT NULL DEFAULT '',
  claimed_by  uuid REFERENCES residents(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE gatherings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id     uuid NOT NULL REFERENCES residents(id),
  precinct_id text NOT NULL REFERENCES precincts(id),
  scope       text NOT NULL CHECK (scope IN ('precinct','township')),
  kind        text NOT NULL CHECK (kind IN ('meetup','sport','cleanup','open_house','class')),
  title       text NOT NULL,
  place       text NOT NULL,
  pin         jsonb NOT NULL,
  starts_at   timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE gathering_rsvps (
  gathering_id uuid REFERENCES gatherings(id) ON DELETE CASCADE,
  resident_id  uuid REFERENCES residents(id),
  PRIMARY KEY (gathering_id, resident_id)
);

CREATE TABLE help_requests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES residents(id),
  helper_id    uuid REFERENCES residents(id),
  precinct_id  text NOT NULL REFERENCES precincts(id),
  kind         text NOT NULL CHECK (kind IN ('fix','carry','tutor','watch_house','other')),
  note         text NOT NULL,
  status       text NOT NULL CHECK (status IN ('open','accepted','done')),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE contacts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   uuid NOT NULL REFERENCES residents(id),
  contact_id uuid NOT NULL REFERENCES residents(id),
  status     text NOT NULL CHECK (status IN ('pending','accepted')),
  UNIQUE (owner_id, contact_id)
);

CREATE TABLE sos_alerts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id  uuid NOT NULL REFERENCES residents(id),
  precinct_id  text NOT NULL REFERENCES precincts(id),
  notified     uuid[] NOT NULL,
  at           timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz
);

CREATE TABLE flood_alerts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level        text NOT NULL CHECK (level IN ('watch','warning','danger')),
  title        text NOT NULL,
  source       text NOT NULL,             -- e.g. JPS publicinfobanjir / MetMalaysia feed
  precinct_ids text[] NOT NULL,
  issued_at    timestamptz NOT NULL DEFAULT now(),
  ended_at     timestamptz
);

CREATE TABLE flood_checkins (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id    uuid NOT NULL REFERENCES flood_alerts(id),
  resident_id uuid NOT NULL REFERENCES residents(id),
  precinct_id text NOT NULL REFERENCES precincts(id),
  status      text NOT NULL CHECK (status IN ('safe','need_help','can_help')),
  note        text NOT NULL DEFAULT '',
  at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (alert_id, resident_id)
);

-- Points are recognition only: they unlock decorations and badges.
CREATE TABLE points_ledger (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id uuid NOT NULL REFERENCES residents(id),
  delta       int  NOT NULL,
  reason      text NOT NULL,
  at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON points_ledger (resident_id);
