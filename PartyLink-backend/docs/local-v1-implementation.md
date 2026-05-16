# PartyLink Local V1 Backend

This backend is focused on event discovery and ticketing with a local SQLite database.

## Implemented Surface

- Local database schema migration runner.
- External identity support via the `x-user-id` request header.
- Automatic user provisioning on first authenticated request.
- Standardized API success/error envelopes.
- Validation with Zod for params/query/body.
- Security middleware: helmet, CORS allowlist, request IDs, request logging, and rate limiting.
- Ticketing resources:
  - `GET /health/live`
  - `GET /v1/users/me`
  - `PATCH /v1/users/me/profile`
  - `POST /v1/users/me/profile-picture`
  - `GET /v1/users/:userId/profile-picture`
  - `GET /v1/users/:userId/parties-attending`
  - `GET /v1/parties`
  - `GET /v1/parties/:partyId`
  - `GET /v1/parties/:partyId/banner`
  - `POST /v1/parties/:partyId/attend`

## Local Database

- Default database file: `PartyLink-backend/local-v1.db`
- Override with `LOCAL_DB_PATH=/absolute/path/to/your.db`

Active tables:

- `users`
- `user_profiles`
- `parties`
- `tickets`
- `party_ticket_codes`

Legacy social tables are dropped by migration when present.

## Run Locally

1. Install dependencies: `npm install`
2. Seed local DB: `npm run seed`
3. Start API: `npm run dev`

Server default: `http://localhost:4000`

## Environment

- `CORS_ORIGIN`
- `LOCAL_DB_PATH`
- `V1_PORT` or `PORT`

Protected routes expect `x-user-id` with the authenticated Clerk user id.
