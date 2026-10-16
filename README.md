# JIRAN

A neighbourhood app for residents of Bandar Bukit Raja 2, designed as a tab
inside the Sime Darby Property app. Meet your neighbours, share items and
skills, join community activities and help each other. No money involved.

**Live demo:** https://jiran-yzone.vercel.app/

## Features

- **Neighbourhood map**: your street in 3D, the precinct floor plan and the whole township
- **Neighbours**: profiles, directory, connection requests and private chat
- **Share**: borrow and lend items, give-aways and free skill swaps
- **Activities**: browse, join or create community activities and interest groups
- **Help**: ask for or offer help, emergency contacts and flood check-ins
- **Welcome**: onboarding, welcome guide and buddy programme for new residents

## Try it

Open the live demo and sign in with one of these codes:

| Code | Resident |
|---|---|
| `ADIRA-212` | Hana |
| `ADIRA-120` | Irfan (new resident) |
| `ADIRA-208` | Aisyah |
| `ADIRA-211` | Ravi |
| `SDP-ADMIN` | SDP Community Team |

The demo runs in your browser and saves your changes on your device. All data is fictional.

## Tech stack

- **Frontend**: React, Vite, Three.js
- **Backend**: Node.js, Fastify, SQLite
- **Language**: TypeScript

## Run locally

Requires Node.js 22.13 or newer.

```bash
npm install
npm run build
npm start -w @jiran/server
```

Then open http://localhost:8787.

## Project structure

```
apps/
  server/   Backend API
  web/      Web app
packages/
  core/     Shared logic
```
