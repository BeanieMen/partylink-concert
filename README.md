# PartyLink — Fullstack (Backend + Mobile)

This repository contains two projects:

- `PartyLink-backend`: a TypeScript Express backend (SQLite by default).
- `PartyLink-mobile`: a Next.js frontend with Capacitor for native builds.

This README explains how to set up both projects for local development, build, and debug on device/emulator.

**Quick Links**
- Backend env: [PartyLink-backend/src/v1/config/env.ts](PartyLink-backend/src/v1/config/env.ts#L1-L20)
- Backend scripts: [PartyLink-backend/package.json](PartyLink-backend/package.json#L1-L40)
- Mobile scripts: [PartyLink-mobile/package.json](PartyLink-mobile/package.json#L1-L40)
- Mobile API client: [PartyLink-mobile/src/lib/api.ts](PartyLink-mobile/src/lib/api.ts#L1-L40)

---

## Prerequisites

- Node.js 18+ and npm (or a compatible package manager).
- Git.
- For Android native builds: Android Studio + Android SDK + JDK.
- For iOS native builds: Xcode (macOS only).

---

## Get the code

```bash
git clone <repo-url>
cd partylink-front-back
```

You will see two folders at the repo root: `PartyLink-backend` and `PartyLink-mobile`.

---

## Backend (PartyLink-backend)

The backend is a TypeScript Express app that by default uses a local SQLite file (`local-v1.db`) for development.

Basic commands (run from `PartyLink-backend`):

```bash
cd PartyLink-backend
npm install

# Run in dev mode (uses tsx):
npm run dev

# Seed local data (creates/updates local DB):
npm run seed

# Build -> outputs compiled JS to `dist/`:
npm run build

# Start built server:
npm run start

# Lint / typecheck:
npm run lint
npm run typecheck
```

Important config and environment variables:

- `NODE_ENV` — environment (defaults to `development`).
- `V1_PORT` or `PORT` — port the server listens on (defaults to `4000`).
- `LOCAL_DB_PATH` — path to the local SQLite file (defaults to `local-v1.db` in the project root).
- `CORS_ORIGIN` — allowed CORS origins (defaults include localhost and Capacitor origins).

See the source for defaults: [PartyLink-backend/src/v1/config/env.ts](PartyLink-backend/src/v1/config/env.ts#L1-L20).

Notes:
- The repo includes `sqlite3` as the default dev DB. If you want to use Postgres or another DB, update DB client code accordingly.
- If you change the server port, update the mobile app's `NEXT_PUBLIC_API_BASE_URL` accordingly.

---

## Mobile (PartyLink-mobile)

The mobile app is built with Next.js and can be run in the browser for development. Capacitor is configured for native builds.

Basic commands (run from `PartyLink-mobile`):

```bash
cd PartyLink-mobile
npm install

# Run the Next.js dev server (binds to 0.0.0.0 on port 8081):
npm run dev

# Build optimized production bundle:
npm run build

# Start the built Next.js server:
npm run start

# Typecheck / lint:
npm run typecheck
npm run lint

# Capacitor: build + sync native projects
npm run cap:sync
# then open native projects for platform-specific work:
npm run cap:open:android
npm run cap:open:ios
```

API configuration:

- The mobile app reads the backend base URL from `NEXT_PUBLIC_API_BASE_URL`. If unset it defaults to `http://localhost:4000`.
  - See `API_BASE_URL` in [PartyLink-mobile/src/lib/api.ts](PartyLink-mobile/src/lib/api.ts#L1-L40).

To point the app at your local backend when developing in the browser, set:

```bash
export NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
npm run dev
```

For testing on a device/emulator:
- If running on an Android/iOS emulator on the same machine, `http://10.0.2.2:4000` (Android emulator) or machine IP may be required instead of `localhost`.
- For Capacitor native builds, after `npm run cap:sync`, open the native IDE and run on a simulator/device.

---

## Local development workflow (recommended)

1. Start the backend:

```bash
cd PartyLink-backend
npm install
npm run seed   # optional: populate example data
npm run dev
```

2. Start the mobile app (in a separate terminal):

```bash
cd PartyLink-mobile
npm install
export NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
npm run dev
```

3. Open the web UI at http://localhost:8081 and verify features.

---

## Troubleshooting

- Backend: if you see DB lock or permission errors, ensure the process has write access to the project directory and `LOCAL_DB_PATH` location.
- Mobile: if assets or API calls fail, check the `API_BASE_URL` value and CORS settings on the backend (`CORS_ORIGIN`).
- Capacitor: native builds require platform tooling (Xcode / Android Studio) — run `npx cap doctor` if you see environment problems.

---

## Useful files
- [PartyLink-backend/package.json](PartyLink-backend/package.json#L1-L40) — backend scripts and deps
- [PartyLink-mobile/package.json](PartyLink-mobile/package.json#L1-L40) — mobile scripts and deps
- [PartyLink-mobile/src/lib/api.ts](PartyLink-mobile/src/lib/api.ts#L1-L40) — API client and `NEXT_PUBLIC_API_BASE_URL`

---

## Next steps / Notes for contributors

- Consider adding a `.env.example` in each project for common environment variables.
- Add CI scripts to run `npm run lint` and `npm run typecheck` for both projects.

If you'd like, I can also:

- Add a `.env.example` file for the backend and mobile.
- Create scripts for running both services concurrently (e.g., using `concurrently` or a root-level `dev` script).

---

Author: BeanieMan

## AI USAGE
ai was used in the making of the frontend and readme