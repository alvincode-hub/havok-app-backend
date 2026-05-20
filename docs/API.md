# Public API

Documentation for the mobile-facing `/api` routes.

Verified against source and local HTTP checks on 2026-05-20.

Dashboard routes are documented separately in [DASHBOARD.md](./DASHBOARD.md).

## Base URL

```txt
http://localhost:3000
```

The port comes from `PORT`.

## Authentication

### Public route

`GET /api/health` is public.

### App key

Every other `/api` route requires:

```http
x-app-key: <APP_API_KEY>
```

Invalid or missing key:

```json
{
  "success": false,
  "error": "Unauthorized"
}
```

### Mobile bearer session

In `NODE_ENV=production`, data routes also require:

```http
Authorization: Bearer <accessToken>
```

The token is created with:

1. `POST /api/app/challenge`
2. `POST /api/app/session`

In non-production, the server bypasses bearer-session verification but still requires `x-app-key`.

Missing bearer token in production:

```json
{
  "success": false,
  "error": "Session mobile manquante"
}
```

Invalid bearer token in production:

```json
{
  "success": false,
  "error": "Session mobile invalide"
}
```

## Rate limits

Global `/api` limit:

- `60` requests / minute

Session bootstrap limits:

- `POST /api/app/challenge`: `20` requests / minute
- `POST /api/app/session`: `10` requests / minute

Global limit response:

```json
{
  "success": false,
  "error": "Too many requests"
}
```

## Route summary

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/health` | None | Health check |
| POST | `/api/app/challenge` | App key | Creates a one-time challenge |
| POST | `/api/app/session` | App key | Creates a short bearer session |
| GET | `/api/home` | App key + session in production | Home payload |
| GET | `/api/tournaments/calendrier` | App key + session in production | Tournament calendar |
| GET | `/api/tournaments/allWindow` | App key + session in production | Event lookup by `eventId` or `windowId` |
| GET | `/api/tournaments/window` | App key + session in production | Window detail payload |
| GET | `/api/tournaments/results` | App key + session in production | One leaderboard page |
| GET | `/api/players` | App key + session in production | Simplified tracked players |
| GET | `/api/player` | App key + session in production | Full tracked player profile |

## GET /api/health

Response:

```json
{
  "status": "ok",
  "success": true
}
```

## POST /api/app/challenge

Request body:

| Name | Type | Required | Notes |
|---|---|---|---|
| `installationId` | string | Yes | Stable client installation id |
| `platform` | string | Yes | `ios`, `android`, or `web` |
| `appVersion` | string | Yes | Client app version |

Success response:

```json
{
  "success": true,
  "challenge": "base64url-random-value",
  "expiresAt": "2026-05-20T10:45:00.000Z",
  "ttlSeconds": 180
}
```

Common errors:

```json
{
  "success": false,
  "error": "installationId est requis"
}
```

```json
{
  "success": false,
  "error": "platform invalide"
}
```

```json
{
  "success": false,
  "error": "Trop de demandes de challenge"
}
```

## POST /api/app/session

Request body:

| Name | Type | Required | Notes |
|---|---|---|---|
| `challenge` | string | Yes | Value returned by `/api/app/challenge` |
| `installationId` | string | Yes | Must match the challenge |
| `platform` | string | Yes | Must match the challenge |
| `appVersion` | string | Yes | Must match the challenge |
| `attestation` | object | Yes | Provider-specific attestation payload |

When `APP_ATTESTATION_MODE=development`, the current server expects:

```json
{
  "provider": "development",
  "payload": {
    "challenge": "base64url-random-value",
    "installationId": "expo-dev-device-001",
    "platform": "web",
    "appVersion": "1.0.0"
  }
}
```

Success response:

```json
{
  "success": true,
  "accessToken": "<JWT>",
  "tokenType": "Bearer",
  "expiresAt": "2026-05-20T10:52:00.000Z",
  "expiresInSeconds": 600
}
```

Common errors:

```json
{
  "success": false,
  "error": "challenge introuvable"
}
```

```json
{
  "success": false,
  "error": "payload d'attestation incoherent"
}
```

## GET /api/home

Source file:

```txt
server/data/enriched/home.json
```

Returns:

```json
{
  "actu": [],
  "liveTournament": null,
  "upcomingTournaments": [],
  "lastPlayedWindow": {
    "tournament": null,
    "places": []
  }
}
```

Notes:

- `actu` is an array of news cards.
- `liveTournament` is `null` when nothing is live.
- `lastPlayedWindow` can be `null`.

## GET /api/tournaments/calendrier

Source file:

```txt
server/data/enriched/calendrier.json
```

Returns an array of tournament windows:

```json
[
  {
    "tournamentId": "epicgames_example",
    "windowId": "window_example",
    "name": "Tournament name",
    "image": "https://cdn.example.com/image.jpg",
    "start": "2026-05-20T17:00:00.000Z",
    "end": "2026-05-20T20:00:00.000Z",
    "teamFormat": "Duo",
    "mode": "Battle Royale"
  }
]
```

## GET /api/tournaments/allWindow

Query parameters:

| Name | Type | Required | Notes |
|---|---|---|---|
| `eventId` | string | No | Direct event lookup |
| `windowId` | string | No | Resolves the parent event from a window |

At least one of `eventId` or `windowId` is required.

Missing params:

```json
{
  "error": "windowId ou eventId est requis"
}
```

Successful response:

```json
{
  "id": "epicgames_example",
  "windows": [
    {
      "windowId": "window_example",
      "start": "2026-05-20T17:00:00.000Z",
      "end": "2026-05-20T20:00:00.000Z",
      "name": "Tournament window"
    }
  ]
}
```

Returns `null` with status `200` when nothing matches.

## GET /api/tournaments/window

Query parameters:

| Name | Type | Required |
|---|---|---|
| `windowId` | string | Yes |

Missing param:

```json
{
  "error": "windowId est requis"
}
```

Key response fields:

- `tournamentId`
- `tournamentName`
- `windowId`
- `start`
- `end`
- `description`
- `type`
- `images`
- `cast`
- `matchCap`
- `mode`
- `teamFormat`
- `requiresQualification`
- `leaderboardId`
- `prizes`
- `scoreRules`
- `playerQual`

Returns `null` with status `200` when nothing matches.

## GET /api/tournaments/results

Query parameters:

| Name | Type | Required | Notes |
|---|---|---|---|
| `windowId` | string | Yes | Tournament window id |
| `page` | number | No | Zero-based page index, default `0` |
| `cumulatif` | boolean | No | `true` or `1` for cumulative leaderboard |

Missing param:

```json
{
  "error": "windowId est requis"
}
```

Successful response shape:

```json
{
  "tournamentId": "epicgames_example",
  "tournamentName": "Tournament name",
  "windowId": "window_example",
  "start": "2026-05-20T17:00:00.000Z",
  "end": "2026-05-20T20:00:00.000Z",
  "leaderboard": {
    "id": "epicgames_example",
    "windowId": "window_example",
    "totalPages": 5,
    "results": [],
    "qualStatus": []
  },
  "players": []
}
```

Notes:

- `leaderboard.results` contains only the requested page.
- The API does not return the storage envelope or the full page matrix.
- `qualStatus` lists tracked Havok players and labels when available.
- Returns `null` with status `200` when the window is unknown or when the requested leaderboard variant does not exist.

Verified locally on 2026-05-20:

- `GET /api/tournaments/results?windowId=<knownWindowId>&page=0` returned `200`
- the response included `leaderboard.totalPages`
- leaderboard entry keys included `rank`, `names`, `points`, `nbGamesPlayed`, `kills`, `wins`, `labels`, `rankLabel`, and `pointsLabel`

## GET /api/players

Source file:

```txt
server/data/enriched/players.json
```

Returns simplified tracked players:

```json
[
  {
    "id": "account_id",
    "name": "Pixie",
    "image": "/dashboard-assets/players/example.jpg",
    "pseudo": "havok pixie sc",
    "country": "Sweden",
    "countryFlag": "/dashboard-assets/flags/example.png"
  }
]
```

Verified locally on 2026-05-20:

- without `x-app-key`: `401`
- with `x-app-key`: `200`

## GET /api/player

Query parameters:

| Name | Type | Required |
|---|---|---|
| `playerId` | string | Yes |

Missing param:

```json
{
  "error": "playerId est requis"
}
```

Returns a full tracked player profile:

```json
{
  "id": "account_id",
  "name": "Pixie",
  "pseudo": "havok pixie sc",
  "image": "/dashboard-assets/players/example.jpg",
  "countryFlag": "/dashboard-assets/flags/example.png",
  "country": "Sweden",
  "top5": 1,
  "bestTop": 5,
  "avgKill": 59,
  "avgTop": 5,
  "lastTournaments": []
}
```

Returns `null` with status `200` when nothing matches.

## Notes

- Successful data routes do not wrap payloads in `success: true`.
- Only `/api/health`, `/api/app/challenge`, and `/api/app/session` use a success envelope.
- Query parameters are read from `req.query`.
- The route name is `/api/tournaments/calendrier`, not `/api/tournaments/calendar`.
