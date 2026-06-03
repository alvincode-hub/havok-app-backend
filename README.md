# HavokAPI-v1

Express server used by `HavokApp` to expose Fortnite Competitive data from local snapshots and admin-managed config.

## Current scope

The server currently provides:

- a public mobile API under `/api`
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
- cron jobs and Fortnite login are disabled
- the branch is expected to ship bundled snapshots from `data/enriched`

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
