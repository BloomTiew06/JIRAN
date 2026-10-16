# JIRAN

A neighbourhood app that lives as a tab inside the Sime Darby Property app.
Residents of Bandar Bukit Raja 2 see their township and their own precinct as a
playable map, meet the neighbours they just moved in next to, share for free,
join activities, help each other and check in during flood alerts.

**Money-free by design.** No prices, rent, deposits, sales, payments or vouchers.
The backend rejects any listing, activity, skill or help post that mentions them,
and skills can only be free or swapped for another skill.

## The Adira site plan

The precinct map follows SDP's published facts for **Adira Series 1 (Phase R6A)**:

- 109 double-storey terraces: 85 intermediate lots (20 ft × 75 ft), 14 end lots
  and 10 corner lots (22 ft × 75 ft), each with a 2.4 m backyard
- 12 terrace rows, back to back, along Jalan Adira 1 to 4 and a central spine road
- Taman Adira neighbourhood garden and the Adira linear park with the 16
  amenities A to P from the brochure (pavilion, community lawn, playground,
  multipurpose court, EPDM court, fitness station, jogging path, bike, roller
  blade and skateboard tracks and more)
- The Alura entrance

Street names, house numbers and the exact amenity positions are approximations
until SDP shares its CAD site plan. Replace `buildAdiraSite()` in
`packages/core/src/geo.ts` with real coordinates when you have them.

## Three map levels

Pinch or scroll to move between them, or use the round buttons.

1. **My street in 3D** (default): your house in the middle with the neighbours
   on your street either side, drawn with Three.js in a toon style. Roof colours,
   cars, porch plants, festive decorations, new-house ribbons and name chips come
   from live data. Tap a house to open that neighbour. Drag to orbit; zoom out
   past the furthest view to open the floor plan. Devices without WebGL go
   straight to the floor plan. Code: `apps/web/src/street3d`.
2. **Adira floor plan**: the whole 2D site plan of Series 1 with gable roofs,
   porches, cars and gardens. Zoom in past the limit to go back to your street
   in 3D; zoom out past the limit for the township.
3. **Township**: all of Bandar Bukit Raja 2. Zoom into your precinct to return
   to the floor plan.

## Features (mapped to the brief)

1. **Meet your neighbours**: profile (name, photo, introduction, interests,
   activities, skills, languages, free times, privacy), resident directory with
   search by name, interest or skill, connection requests with an intro message
   (accept, decline, cancel), private chat once connected, suggestions for new
   residents, similar interests and people open to meeting.
2. **Common ground**: shared-interest matching with reasons ("You both like
   Badminton", same Move-in Circle, same street, shared language), recommended
   neighbours you can dismiss, activity partner finder by activity and time,
   interest groups (create, join, leave, discuss, admins manage members),
   suggested activities.
3. **Neighbour help**: borrow and lend (search, filter by category, availability
   and period; item condition and borrowing conditions; request with dates;
   statuses Pending approval, Approved, Borrowed, Returned, Cancelled; QR
   handover, condition photo, return reminders, ratings, history), skills
   exchange (free or swap, requests with dates, feedback), ask for help and
   offer help (Open, Response received, Assistance confirmed, Completed,
   Cancelled), give-aways.
4. **Community activities**: feed with search and filters (date, category),
   details with participants and limits, join and leave, create, edit and
   cancel, My activities, reminders.
5. **New neighbour welcome**: welcome guide (facilities, booking, rules, waste,
   contacts), introduction template you edit then publish, neighbours can
   welcome you, community buddy programme, onboarding interests with
   personalised recommendations, new resident checklist.
6. **JIRAN extras**: PDPA consent and 18+ at join, avatar and house colour,
   four app languages, Move-in Circles, new-house ribbons, precinct
   noticeboard (announcements, lost and found), neighbour contacts and SOS
   after "Call 999", watch my house, flood check-in, points for recognition
   only, badges, house decorations, festive decorations in season, precinct
   lights on the township map, anonymised SDP dashboard.

## Stack (TypeScript everywhere)

| Part | Tech | Folder |
|---|---|---|
| Shared rules, services and API routes | TypeScript, no dependencies | `packages/core` |
| Backend | Node.js 22 + Fastify 5, Server-Sent Events, SQLite (`node:sqlite`) | `apps/server` |
| Frontend | React 18 + Vite 5, SVG maps, Three.js 3D street | `apps/web` |
| Production database | PostgreSQL / Supabase schema | `apps/server/db/schema.postgres.sql` |

The server and the web app's offline demo run the same route table
(`packages/core/src/routes.ts`), so the demo behaves exactly like the real API.

## Run it

Needs Node.js 22.13 or newer.

```bash
npm install
npm test                      # 15 API tests
npm run typecheck
npm run build                 # web app into apps/web/dist
npm start -w @jiran/server    # API + web app on http://localhost:8787
```

Development with hot reload: `npm run dev:server` and `npm run dev:web`, then
open http://localhost:5173.

`npm run build:demo -w @jiran/web` makes one self-contained HTML file
(`apps/web/dist-demo/index.html`) that runs everything in the browser on demo
data. Use it as the judges' prototype link.

The demo saves every change in the browser (localStorage) and restores it on
the next visit, including after a new version is published, so it never starts
over by surprise. The tab and map level you were on are remembered too. To start
again, use "Reset demo data" on the Me screen or "Start fresh" on the sign-in
screen. If a future change makes old saved data unreadable, bump `DEMO_SCHEMA`
in `apps/web/src/api.ts` and everyone gets fresh demo data once.

Every icon button shows what it does before you press it: hover with a mouse,
tab to it with the keyboard, or press and hold on a phone (holding shows the
label without pressing the button). Labels come from each button's
`aria-label` (`apps/web/src/tooltips.tsx`).

Environment variables: `PORT` (default 8787), `JIRAN_DB` (SQLite file path),
`JIRAN_SECRET` (token signing secret; set this outside development).

## Deploy

**Prototype link (offline demo, free).** Push to GitHub, then in the repo go to
Settings > Pages > Source and pick "GitHub Actions". Every push to `main` runs
`.github/workflows/pages.yml` and publishes the demo at
`https://<your-user>.github.io/<repo>/`. It runs entirely in the browser on demo
data, so it never goes down or resets during judging.

**Full app (real backend).** The `Dockerfile` builds the web app and starts the
Fastify server on `PORT` (default 8787).

- Render: New > Blueprint > pick the repo. `render.yaml` sets up a free web
  service with a generated `JIRAN_SECRET`. The free plan has no persistent
  disk, so the database is re-seeded with the demo residents on each restart,
  and the service sleeps after 15 minutes idle (first visit takes about a
  minute to wake).
- Railway or Fly.io: deploy the same Dockerfile, set `JIRAN_SECRET`, and mount a
  volume at `/data` to keep the SQLite database across restarts.

`.github/workflows/ci.yml` runs the typecheck, tests and build on every push.

## Demo residents

| Handover code | Who |
|---|---|
| `ADIRA-212` | Hana, No. 12 Jalan Adira 2 (the demo "you") |
| `ADIRA-120` | Irfan, just got his keys: try the onboarding |
| `ADIRA-208` | Aisyah, lends a drill, has sent Hana a connection request |
| `ADIRA-211` | Ravi, fixes taps |
| `SDP-ADMIN` | SDP Community Team: dashboard, announcements, flood alerts |

Open two browser windows to see both sides: Hana requests Aisyah's drill,
Aisyah approves and types Hana's handover code, confirms the return, Hana rates
it. Or sign in as SDP, simulate a flood warning, and watch Adira's houses light
up with check-ins.

## Privacy rules (enforced in `packages/core/src/service`)

- Households are only visible to residents of the same precinct; other
  precincts show totals only.
- Neighbours see a display name and street, never phone numbers or full names.
- Residents can hide from the directory and hide their interests.
- Chat opens only after both sides accept a connection.
- Only connected neighbours can be asked to watch your house or be an
  emergency contact.
- The SDP dashboard is aggregate only.

## Demo data

All residents, items, groups and activities are invented. Real residents would
come from SDP's purchaser records at key handover.
