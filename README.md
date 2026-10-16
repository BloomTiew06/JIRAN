# JIRAN

A neighbourhood app for residents of Bandar Bukit Raja 2, built as a tab inside
the Sime Darby Property app. Meet the neighbours you just moved in next to,
borrow and lend, join activities and help each other. No money involved.

## Features

- **Neighbourhood map** of your street in 3D, the precinct floor plan and the whole township
- **Neighbours**: profiles, directory, connection requests and private chat
- **Common ground**: shared-interest suggestions, interest groups and activity partners
- **Share**: borrow and lend items, give-aways and free skill swaps
- **Activities**: browse, join or create community activities
- **Help**: ask for or offer help, emergency contacts and flood check-ins
- **Welcome**: onboarding, welcome guide, buddy programme and new resident checklist

## Tech stack

- **Frontend**: React 18, Vite 5, Three.js
- **Backend**: Node.js 22, Fastify 5, SQLite
- **Shared logic**: TypeScript package used by both the server and the offline demo

## Getting started

Requires Node.js 22.13 or newer.

```bash
npm install
npm run build
npm start -w @jiran/server
```

Open http://localhost:8787.

For development with hot reload, run `npm run dev:server` and `npm run dev:web`,
then open http://localhost:5173.

Other commands:

```bash
npm test                          # run the API tests
npm run typecheck                 # type-check all packages
npm run build:demo -w @jiran/web  # build the offline demo into apps/web/dist-demo
```

The offline demo is a single HTML file that runs entirely in the browser and
saves changes locally.

## Demo accounts

| Code | Resident |
|---|---|
| `ADIRA-212` | Hana |
| `ADIRA-120` | Irfan (new resident, shows onboarding) |
| `ADIRA-208` | Aisyah |
| `ADIRA-211` | Ravi |
| `SDP-ADMIN` | SDP Community Team (admin dashboard) |

All demo data is fictional.

## Configuration

| Variable | Description | Default |
|---|---|---|
| `PORT` | Server port | `8787` |
| `JIRAN_DB` | SQLite database file path | `apps/server/data/jiran.sqlite` |
| `JIRAN_SECRET` | Token signing secret (required in production) | development secret |

## Deployment

- **Demo on GitHub Pages**: enable Settings > Pages > Source: GitHub Actions.
  Each push to `main` publishes the offline demo.
- **Full app**: deploy with the included `Dockerfile`, or use `render.yaml` on
  Render (New > Blueprint).

## Project structure

```
apps/
  server/   Fastify API
  web/      React web app
packages/
  core/     Shared types, rules and API routes
```
