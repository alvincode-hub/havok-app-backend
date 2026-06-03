# HavokAPI-v1

Express server used by `HavokApp` to expose Fortnite Competitive data from local snapshots and admin-managed config.

## Current scope

The server currently provides:

- a public mobile API under `/api`
- a dashboard UI shell under `/dashboard/`
- a protected dashboard JSON API under `/dashboard/api`
- scheduled sync jobs that refresh local `raw`, `normalized`, and `enriched` data

Data is stored on disk in `server/data`. JSON snapshots are persisted as:

```json
{
  "updatedAt": "2026-05-20T20:26:55.385Z",
  "data": []
}
```

The HTTP API returns the unwrapped `data` payload, not the storage envelope.

## Public API

Documented in [docs/API.md](./docs/API.md).

### Available routes

| Method | Route | Description |
|---|---|---|
| GET | `/api/health` | Health check |
| POST | `/api/app/challenge` | Creates a one-time app session challenge |
| POST | `/api/app/session` | Exchanges challenge + attestation for a short JWT |
| GET | `/api/home` | Home screen payload |
| GET | `/api/tournaments/calendrier` | Tournament calendar |
| GET | `/api/tournaments/allWindow` | Event group lookup by `eventId` or `windowId` |
| GET | `/api/tournaments/window` | Window detail payload |
| GET | `/api/tournaments/results` | Paged leaderboard payload |
| GET | `/api/players` | Simplified tracked player list |
| GET | `/api/player` | Full tracked player profile |

### Auth model

- `GET /api/health` is public.
- `POST /api/app/challenge` and `POST /api/app/session` require `x-app-key`.
- Data routes require `x-app-key`.
- In `NODE_ENV=production`, data routes also require `Authorization: Bearer <accessToken>`.
- In non-production, bearer-session verification is bypassed server-side.

## Dashboard

Documented in [docs/DASHBOARD.md](./docs/DASHBOARD.md).

### HTML routes

| Method | Route | Description |
|---|---|---|
| GET | `/` | Redirects to `/dashboard/login` |
| GET | `/dashboard/login` | Login page |
| POST | `/dashboard/login` | Creates the dashboard session cookie |
| POST | `/dashboard/logout` | Destroys the dashboard session |
| GET | `/dashboard` | Redirects to `/dashboard/` |
| GET | `/dashboard/` | Dashboard app shell |
| GET | `/dashboard-assets/*` | Static assets generated for dashboard previews |

### JSON routes

The dashboard JSON API is available on two equivalent prefixes:

- `/dashboard/api/...`
- `/api/dashboard/...`

The dashboard front-end currently uses `/dashboard/api/...`.

### Implemented dashboard endpoints

| Method | Route | Description |
|---|---|---|
| GET | `/dashboard/api` | Full aggregated dashboard payload |
| GET | `/dashboard/api/overview` | Header, summaries, source cards, notes |
| GET | `/dashboard/api/events` | Event card collection |
| GET | `/dashboard/api/events/:eventId` | One event card |
| GET | `/dashboard/api/content` | Tracked players, recent results, actu, casts |
| GET | `/dashboard/api/config` | Combined editable config payload |
| GET | `/dashboard/api/status` | Source readiness summary |
| GET / PUT | `/dashboard/api/config/team` | Team config |
| GET / PUT | `/dashboard/api/config/tournament-filter` | Tournament filter config |
| GET / PUT | `/dashboard/api/config/actu` | Actu config |
| GET / PUT | `/dashboard/api/config/cast` | Cast config |
| POST | `/dashboard/api/updateCron` | Starts a background force refresh |

Unauthenticated dashboard API requests return `401` JSON. The dashboard HTML shell itself is served statically on `/dashboard/`; protected data is enforced by the JSON API.

## Cron jobs

The scheduler is registered at app startup in [src/jobs/cron.js](./src/jobs/cron.js).

| Schedule | Job |
|---|---|
| Every minute | live event results |
| Every 30 minutes | event results |
| Every 6 hours | event catalog |
| Every hour | player profiles |
| Daily at 00:00 | score rules |
| Daily at 03:00 | cleanup results |

Manual force refresh is also available through `POST /dashboard/api/updateCron`.

## Setup

### 1. Install

```bash
npm install
```

### 2. Configure `.env`

Start from [server/.env.example](./.env.example).

Important variables:

```env
PORT=3000
NODE_ENV=development

APP_API_KEY=replace-with-your-app-api-key
APP_AUTH_JWT_SECRET=replace-with-your-jwt-secret
APP_ATTESTATION_MODE=development
APP_SESSION_TTL_SECONDS=600
APP_CHALLENGE_TTL_SECONDS=180

ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=
SESSION_SECRET=replace-with-your-dashboard-session-secret
DASHBOARD_ORIGIN=http://localhost:3000
TRUST_PROXY=1
```

Fortnite device auth variables are still required for the FNBR client jobs:

```env
FORTNITE_AUTH_CLIENT=
FORTNITE_DEVICE_AUTH_FILE=
```

### 3. Run

```bash
npm start
```

For local development:

```bash
npm run dev
```

For a production web deployment, start from [server/.env.production.example](./.env.production.example) and keep `APP_ATTESTATION_MODE=web`.

## Render demo branch

The `demo` branch can run on Render with bundled snapshot data and without Fortnite credentials.

Use these settings:

```env
NODE_ENV=production
DEMO_MODE=true
TRUST_PROXY=1
```

Behavior in demo mode:

- public API data routes are readable without `x-app-key`
- mobile bearer-session checks are bypassed
- dashboard pages and read-only JSON endpoints are accessible without login
- dashboard write actions and manual refresh endpoints return `403`
- cron jobs and Fortnite login are disabled
- the branch is expected to ship bundled snapshots from `data/enriched`, `data/config`, and `data/normalized/events/events.json`

You can deploy it directly with [render.yaml](./render.yaml).

## Verification status

Checked against source and local runtime on 2026-05-20:

- `GET /api/health` returns `200`
- `GET /api/players` returns `401` without `x-app-key`
- `GET /api/players` returns `200` with `x-app-key`
- `GET /api/tournaments/results` returns paged leaderboard data with `windowId`

## Known limitations

- Production web deployment is supported with `APP_ATTESTATION_MODE=web`.
- Native production attestation for App Store / Play Store builds is not implemented in this repo yet.
- In development, mobile bearer-session checks are intentionally bypassed server-side.
- Dashboard auth is session-cookie based and intended for same-origin use.
