# JIRAN

A neighbourhood mini program for residents of Bandar Bukit Raja 2, designed as a
tab inside the Sime Darby Property app. Meet your neighbours, share items and
skills, join community activities and look out for each other. No money involved.

**Live demo:** https://jiran-yzone.vercel.app/

## Features

- **Neighbourhood map**: your street in 3D, the Adira floor plan with all 109
  homes, and the whole township. Zoom or use the back button to move between them.
- **Join**: verified with your key handover code, then placed at your own home.
  PDPA consent, 18 and over, four languages.
- **Neighbours**: profiles, a searchable directory, suggested neighbours with
  reasons, Move-in Circles, connection requests and private chat.
- **Share**: borrow and lend with QR handover and ratings, give-aways and skill
  swaps. Always free.
- **Activities**: browse, join or create activities, interest groups and open
  houses, pinned on the map.
- **Help and safety**: ask for or offer help, flood check-in, neighbour contacts
  and SOS, watch my house, and a precinct noticeboard.
- **Welcome**: welcome guide, introduction template, buddy programme and a new
  resident checklist.
- **Nurture**: points for recognition only, house decorations, badges and
  precinct lights.
- **SDP Community Team**: announcements, flood alerts, an anonymised floor plan
  view and a dashboard.

## Try it

Open the live demo and sign in with one of these codes:

| Code | Resident |
|---|---|
| `ADIRA-212` | Hana |
| `ADIRA-120` | Irfan (new resident, shows onboarding) |
| `ADIRA-208` | Aisyah |
| `ADIRA-211` | Ravi |
| `SDP-ADMIN` | SDP Community Team |

The demo runs in your browser and saves your changes on your device. All data
is fictional.

## Built with

| Area | Technology | Used for |
|---|---|---|
| Language | TypeScript 5 | All code: web app, server and shared logic |
| Web app | React 18 | Screens and components |
| Build tool | Vite 5 | Development server and production builds |
| 3D street view | Three.js | Your street and neighbours' houses in 3D |
| Maps | SVG | Floor plan and township map, with pan and zoom |
| Fonts | Montserrat (Fontsource) | Type matching the Sime Darby Property app |
| Offline demo | vite-plugin-singlefile | The whole app in one HTML file that runs in the browser |
| Server | Node.js 22 and Fastify 5 | API and serving the web app |
| Live updates | Server-Sent Events | Notifications and flood alerts in real time |
| Sign-in | Signed tokens (HMAC, Node.js crypto) | Secure sessions after the handover code check |
| Database | SQLite (built into Node.js) | Storing residents, items, activities and more |
| Production database | PostgreSQL schema | Ready for a hosted database such as Supabase |
| Testing | Node.js test runner | API tests for every feature |
| Hosting | Vercel | The live demo |
| Version control | Git and GitHub | Source code |

The server and the offline demo share the same rules and API routes
(`packages/core`), so the demo behaves exactly like the real app.

## Run locally

Requires Node.js 22.13 or newer.

```bash
npm install
npm run build
npm start -w @jiran/server
```

Then open http://localhost:8787.

Other commands:

```bash
npm run dev:server                # server with auto reload
npm run dev:web                   # web app with hot reload on http://localhost:5173
npm test                          # API tests
npm run typecheck                 # type-check every package
npm run build:demo -w @jiran/web  # offline demo in apps/web/dist-demo
```

## Deployment

Vercel builds the offline demo from `main` using `vercel.json`. Every push to
`main` updates the live demo.

## Project structure

```
apps/
  server/   Fastify API, SQLite storage and tests
  web/      React web app, maps and 3D street view
packages/
  core/     Shared types, rules, demo data and API routes
```
