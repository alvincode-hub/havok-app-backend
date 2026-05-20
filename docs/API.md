# API Documentation

Documentation for the public `/api` routes of **HavokAPI-v1**.

## Base URL

```txt
http://localhost:3000
```

The port can be changed with the `PORT` environment variable.

## Authentication

### 1. App key

All `/api` routes require `x-app-key`, except:

```txt
GET /api/health
```

Protected routes require this header:

```http
x-app-key: <APP_API_KEY>
```

If the key is missing or invalid, the server returns:

```json
{
  "success": false,
  "error": "Unauthorized"
}
```

### 2. Mobile app session

All data routes also require a short mobile session token in production:

```http
Authorization: Bearer <accessToken>
```

This session token is created in two steps:

1. `POST /api/app/challenge`
2. `POST /api/app/session`

In non-production environments, the session check is currently bypassed by the server. The `x-app-key` is still required.

If the bearer token is missing in production, the server returns:

```json
{
  "success": false,
  "error": "Session mobile manquante"
}
```

If the bearer token is invalid in production, the server returns:

```json
{
  "success": false,
  "error": "Session mobile invalide"
}
```

## Rate limit

Global `/api` rate limit:

- `60` requests per minute

Additional limits for the mobile session bootstrap:

- `POST /api/app/challenge`: `20` requests per minute
- `POST /api/app/session`: `10` requests per minute

If the global `/api` limit is exceeded, the server returns:

```json
{
  "success": false,
  "error": "Too many requests"
}
```

## Endpoint format

Routes are documented without the query string in the path column.
Query parameters are listed separately for each endpoint.

## Endpoints overview

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/health` | No | Checks if the server is running |
| POST | `/api/app/challenge` | App key | Creates a one-time challenge for the mobile session bootstrap |
| POST | `/api/app/session` | App key | Exchanges a challenge and attestation payload for a short bearer session |
| GET | `/api/home` | App key + session | Returns home screen data |
| GET | `/api/tournaments/calendrier` | App key + session | Returns the tournament calendar |
| GET | `/api/tournaments/allWindow` | App key + session | Returns an event and its windows from `eventId` or `windowId` |
| GET | `/api/tournaments/window` | App key + session | Returns details for one tournament window |
| GET | `/api/tournaments/results` | App key + session | Returns one page of results for one tournament window |
| GET | `/api/players` | App key + session | Returns all tracked players, simplified |
| GET | `/api/player` | App key + session | Returns full data for one tracked player |

---

## GET /api/health

Checks if the server is running.

### Authentication

Not required.

### Response `200`

```json
{
  "status": "ok",
  "success": true
}
```

### Example

```bash
curl http://localhost:3000/api/health
```

---

## POST /api/app/challenge

Creates a one-time challenge used to bootstrap a short mobile app session.

### Authentication

Requires `x-app-key`.

### Rate limit

`20` requests per minute, plus the global `/api` limit.

### Request body

| Name | Type | Required | Description |
|---|---|---|---|
| `installationId` | string | Yes | Stable installation identifier |
| `platform` | string | Yes | Supported values: `ios`, `android`, `web` |
| `appVersion` | string | Yes | App version sent by the client |

### Example request

```bash
curl -X POST http://localhost:3000/api/app/challenge \
  -H "Content-Type: application/json" \
  -H "x-app-key: <APP_API_KEY>" \
  -d '{
    "installationId": "expo-dev-device-001",
    "platform": "web",
    "appVersion": "1.0.0"
  }'
```

### Response `201`

```json
{
  "success": true,
  "challenge": "base64url-random-value",
  "expiresAt": "2026-05-20T10:45:00.000Z",
  "ttlSeconds": 180
}
```

### Possible errors

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

---

## POST /api/app/session

Exchanges a previously issued challenge and an attestation payload for a short JWT bearer session.

### Authentication

Requires `x-app-key`.

### Rate limit

`10` requests per minute, plus the global `/api` limit.

### Request body

| Name | Type | Required | Description |
|---|---|---|---|
| `challenge` | string | Yes | Challenge returned by `/api/app/challenge` |
| `installationId` | string | Yes | Must match the challenge payload |
| `platform` | string | Yes | Must match the challenge payload |
| `appVersion` | string | Yes | Must match the challenge payload |
| `attestation` | object | Yes | Attestation payload validated by the server |

### Development attestation payload

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

### Example request

```bash
curl -X POST http://localhost:3000/api/app/session \
  -H "Content-Type: application/json" \
  -H "x-app-key: <APP_API_KEY>" \
  -d '{
    "challenge": "base64url-random-value",
    "installationId": "expo-dev-device-001",
    "platform": "web",
    "appVersion": "1.0.0",
    "attestation": {
      "provider": "development",
      "payload": {
        "challenge": "base64url-random-value",
        "installationId": "expo-dev-device-001",
        "platform": "web",
        "appVersion": "1.0.0"
      }
    }
  }'
```

### Response `201`

```json
{
  "success": true,
  "accessToken": "<JWT>",
  "tokenType": "Bearer",
  "expiresAt": "2026-05-20T10:52:00.000Z",
  "expiresInSeconds": 600
}
```

### Possible errors

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

```json
{
  "success": false,
  "error": "Trop de creations de session"
}
```

---

## GET /api/home

Returns the main data used for the app home screen.

### Authentication

Requires `x-app-key`.

In production, also requires `Authorization: Bearer <accessToken>`.

### Source file

```txt
data/enriched/home.json
```

### Query parameters

None.

### Response `200`

Returns an object.

```json
{
  "actu": [],
  "liveTournament": {
    "tournamentName": "Division 1 FNCS (Week 5 - Day 2)",
    "tournamentId": "epicgames_S40_FNCSDivisionalCup_Division1_EU",
    "windowId": "S40_FNCSDivisionalCup_Division1_Week5Day2_EU",
    "image": "https://cdn2.unrealengine.com/example.jpg",
    "start": "2026-05-19T17:00:00.000Z",
    "end": "2026-05-19T20:00:00.000Z",
    "teamFormat": "Duo",
    "gameMode": "Battle Royale",
    "resolvedLocation": "Fortnite:epicgames_S40_FNCSDivisionalCup_Division1_EU:S40_FNCSDivisionalCup_Division1_Week5Day2_EU"
  },
  "upcomingTournaments": [
    {
      "tournamentName": "Division 1 FNCS (Week 5 - Final)",
      "tournamentId": "epicgames_S40_FNCSDivisionalCup_Division1_EU",
      "windowId": "S40_FNCSDivisionalCup_Division1_Week5Final_EU",
      "image": "https://cdn2.unrealengine.com/example.jpg",
      "start": "2026-05-23T17:00:00.000Z",
      "end": "2026-05-23T19:40:00.000Z",
      "teamFormat": "Duo",
      "gameMode": "Battle Royale",
      "resolvedLocation": "Fortnite:epicgames_S40_FNCSDivisionalCup_Division1_EU:S40_FNCSDivisionalCup_Division1_Week5Final_EU"
    }
  ],
  "lastPlayedWindow": {
    "tournament": {
      "windowId": "S40_ReloadEliteSeries3Final_EU",
      "tournamentId": "epicgames_S40_ReloadEliteSeries3Final_EU",
      "tournamentName": "Reload Elite Series (Final)",
      "start": "2026-05-17T15:00:00.000Z",
      "end": "2026-05-17T18:20:00.000Z",
      "image": "https://cdn2.unrealengine.com/example.jpg",
      "gameMode": "Reload",
      "teamFormat": "Duo"
    },
    "places": []
  }
}
```

### Example

```bash
curl http://localhost:3000/api/home \
  -H "x-app-key: <APP_API_KEY>" \
  -H "Authorization: Bearer <accessToken>"
```

### Possible errors

```json
{
  "error": "Erreur lors de la recuperation de l'acceuil"
}
```

---

## GET /api/tournaments/calendrier

Returns the tournament calendar.

### Authentication

Requires `x-app-key`.

In production, also requires `Authorization: Bearer <accessToken>`.

### Source file

```txt
data/enriched/calendrier.json
```

### Query parameters

None.

### Response `200`

Returns an array.

```json
[
  {
    "tournamentId": "epicgames_S40_FNCSMajor1_LastChanceQualifier_EU",
    "windowId": "S40_FNCSMajor1_LastChanceQualifier_EU",
    "name": "Fortnite Championship Series (Last Chance)",
    "image": "https://cdn2.unrealengine.com/example.jpg",
    "start": "2026-04-20T17:00:00.000Z",
    "end": "2026-04-20T20:00:00.000Z",
    "teamFormat": "Duo",
    "mode": "Battle Royale"
  }
]
```

### Example

```bash
curl http://localhost:3000/api/tournaments/calendrier \
  -H "x-app-key: <APP_API_KEY>" \
  -H "Authorization: Bearer <accessToken>"
```

### Possible errors

```json
{
  "error": "Erreur lors de la recuperation  du calendrier des tournois"
}
```

---

## GET /api/tournaments/allWindow

Returns an event with all its known windows.

### Authentication

Requires `x-app-key`.

In production, also requires `Authorization: Bearer <accessToken>`.

### Source file

```txt
data/enriched/eventList.json
```

### Query parameters

At least one of these query parameters is required:

| Name | Type | Required | Description |
|---|---|---|---|
| `eventId` | string | No | Event ID to resolve directly |
| `windowId` | string | No | Window ID used to find its parent event |

If both are provided, `eventId` is used first.

### Response `200`

Returns one event object, or `null` if no matching event is found.

```json
{
  "id": "epicgames_S40_FNCSDivisionalCup_Division1_EU",
  "windows": [
    {
      "windowId": "S40_FNCSDivisionalCup_Division1_Week5Day1_EU",
      "start": "2026-05-18T17:00:00.000Z",
      "end": "2026-05-18T20:00:00.000Z",
      "name": "Division 1 FNCS (Week 5 - Day 1)"
    },
    {
      "windowId": "S40_FNCSDivisionalCup_Division1_Week5Day2_EU",
      "start": "2026-05-19T17:00:00.000Z",
      "end": "2026-05-19T20:00:00.000Z",
      "name": "Division 1 FNCS (Week 5 - Day 2)"
    }
  ]
}
```

### Missing parameters response `400`

```json
{
  "error": "windowId ou eventId est requis"
}
```

### Examples

```bash
curl "http://localhost:3000/api/tournaments/allWindow?eventId=epicgames_S40_FNCSDivisionalCup_Division1_EU" \
  -H "x-app-key: <APP_API_KEY>" \
  -H "Authorization: Bearer <accessToken>"
```

```bash
curl "http://localhost:3000/api/tournaments/allWindow?windowId=S40_FNCSDivisionalCup_Division1_Week5Day2_EU" \
  -H "x-app-key: <APP_API_KEY>" \
  -H "Authorization: Bearer <accessToken>"
```

### Possible errors

```json
{
  "error": "Erreur lors de la recuperation des windows d'un tournoi"
}
```

---

## GET /api/tournaments/window

Returns details for one tournament window.

### Authentication

Requires `x-app-key`.

In production, also requires `Authorization: Bearer <accessToken>`.

### Source file

```txt
data/enriched/window-details.json
```

### Query parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `windowId` | string | Yes | Tournament window ID |

### Response `200`

Returns one tournament window object, or `null` if no window matches the given `windowId`.

```json
{
  "tournamentId": "epicgames_S40_FNCSDivisionalCup_Division1_EU",
  "tournamentName": "Division 1 FNCS (Week 5 - Day 2)",
  "description": "Tournament description",
  "type": "Event",
  "images": {
    "square": "https://cdn2.unrealengine.com/example-square.jpg",
    "tile": "https://cdn2.unrealengine.com/example-tile.jpg",
    "background": "https://cdn2.unrealengine.com/example-background.jpg"
  },
  "windowId": "S40_FNCSDivisionalCup_Division1_Week5Day2_EU",
  "start": "2026-05-19T17:00:00.000Z",
  "end": "2026-05-19T20:00:00.000Z",
  "cast": {
    "youtube": {
      "channelName": "",
      "link": ""
    },
    "twitch": {
      "channelName": "",
      "link": ""
    }
  },
  "matchCap": 6,
  "mode": "Battle Royale",
  "teamFormat": "Duo",
  "anyRequiredTokens": [],
  "blockedTokens": [],
  "requiredTokens": [],
  "requiresQualification": false,
  "leaderboardId": "Fortnite:epicgames_S40_FNCSDivisionalCup_Division1_EU:S40_FNCSDivisionalCup_Division1_Week5Day2_EU",
  "prizes": [
    {
      "scoringType": "value",
      "threshold": 1,
      "rewardType": "cash",
      "value": "1000",
      "quantity": 1
    }
  ],
  "scoreRules": {
    "id": "ScoringRules_DuosDivisionalCup_Div1",
    "leaderboardDefId": "br_placetop1_stat",
    "rule": [
      {
        "type": "PLACEMENT_STAT_INDEX",
        "value": 1,
        "points": 65
      }
    ]
  },
  "playerQual": [
    {
      "accountId": "b39cded93b0f4aa59ffdadf0db18e853",
      "playerName": "Pixie",
      "image": "/dashboard-assets/players/b39cded93b0f4aa59ffdadf0db18e853-5f99856eee.jpg",
      "isThisPlayerQual": true
    }
  ]
}
```

### Missing `windowId` response `400`

```json
{
  "error": "windowId est requis"
}
```

### Example

```bash
curl "http://localhost:3000/api/tournaments/window?windowId=S40_FNCSDivisionalCup_Division1_Week5Day2_EU" \
  -H "x-app-key: <APP_API_KEY>" \
  -H "Authorization: Bearer <accessToken>"
```

### Possible errors

```json
{
  "error": "Erreur lors de la recuperation des details de tournoi"
}
```

---

## GET /api/tournaments/results

Returns results for one tournament window.

### Authentication

Requires `x-app-key`.

In production, also requires `Authorization: Bearer <accessToken>`.

### Source file

```txt
data/enriched/results.json
```

### Query parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `windowId` | string | Yes | Tournament window ID |
| `page` | number | No | Zero-based page index. Defaults to `0` |
| `cumulatif` | boolean | No | When `true` or `1`, returns cumulative leaderboard data |

### Response `200`

Returns one tournament result object, or `null` if no result matches the given `windowId`.

The `leaderboard` field is now a single object for the requested page, not an array of pages.

```json
{
  "tournamentId": "epicgames_S40_FNCSDivisionalCup_Division1_EU",
  "tournamentName": "Division 1 FNCS (Week 5 - Day 2)",
  "windowId": "S40_FNCSDivisionalCup_Division1_Week5Day2_EU",
  "start": "2026-05-19T17:00:00.000Z",
  "end": "2026-05-19T20:00:00.000Z",
  "leaderboard": {
    "id": "epicgames_S40_FNCSDivisionalCup_Division1_EU",
    "windowId": "S40_FNCSDivisionalCup_Division1_Week5Day2_EU",
    "totalPages": 5,
    "results": [
      {
        "rank": 1,
        "accountIds": [
          "account_id_1",
          "account_id_2"
        ],
        "names": [
          "Player 1",
          "Player 2"
        ],
        "teamAccountId": "team_account_id",
        "points": 607,
        "nbGamesPlayed": 11,
        "kills": 102,
        "top15s": 6,
        "top5s": 4,
        "wins": 1,
        "pointsKills": 306,
        "pointsTop": 301,
        "avrgPlacement": 20.45,
        "sessionHistory": [],
        "labels": [
          "Qual"
        ],
        "rankLabel": "#1",
        "pointsLabel": "607 pts"
      }
    ],
    "qualStatus": [
      {
        "accountId": "b39cded93b0f4aa59ffdadf0db18e853",
        "name": "Pixie",
        "image": "/dashboard-assets/players/b39cded93b0f4aa59ffdadf0db18e853-5f99856eee.jpg",
        "labels": [
          "Qual"
        ],
        "rank": 68,
        "points": 313
      }
    ]
  },
  "players": [
    {
      "accountId": "b39cded93b0f4aa59ffdadf0db18e853",
      "name": "Pixie",
      "image": "/dashboard-assets/players/b39cded93b0f4aa59ffdadf0db18e853-5f99856eee.jpg"
    }
  ]
}
```

### Missing `windowId` response `400`

```json
{
  "error": "windowId est requis"
}
```

### Examples

```bash
curl "http://localhost:3000/api/tournaments/results?windowId=S40_FNCSDivisionalCup_Division1_Week5Day2_EU" \
  -H "x-app-key: <APP_API_KEY>" \
  -H "Authorization: Bearer <accessToken>"
```

```bash
curl "http://localhost:3000/api/tournaments/results?windowId=S40_FNCSDivisionalCup_Division1_Week5Day2_EU&page=1" \
  -H "x-app-key: <APP_API_KEY>" \
  -H "Authorization: Bearer <accessToken>"
```

```bash
curl "http://localhost:3000/api/tournaments/results?windowId=S40_FNCSDivisionalCup_Division1_Week5Day2_EU&cumulatif=true" \
  -H "x-app-key: <APP_API_KEY>" \
  -H "Authorization: Bearer <accessToken>"
```

### Possible errors

```json
{
  "error": "Erreur lors de la recuperation des resultats de tournoi"
}
```

---

## GET /api/players

Returns all tracked players with simplified data.

### Authentication

Requires `x-app-key`.

In production, also requires `Authorization: Bearer <accessToken>`.

### Source file

```txt
data/enriched/players.json
```

### Query parameters

None.

### Response `200`

Returns an array.

The server currently returns only these fields for this endpoint:

- `id`
- `name`
- `image`
- `pseudo`
- `country`
- `countryFlag`

```json
[
  {
    "id": "b39cded93b0f4aa59ffdadf0db18e853",
    "name": "Pixie",
    "image": "/dashboard-assets/players/b39cded93b0f4aa59ffdadf0db18e853-5f99856eee.jpg",
    "pseudo": "havok pixie sc",
    "country": "Sweden",
    "countryFlag": "/dashboard-assets/flags/se-df5c52fd5a.png"
  }
]
```

### Example

```bash
curl http://localhost:3000/api/players \
  -H "x-app-key: <APP_API_KEY>" \
  -H "Authorization: Bearer <accessToken>"
```

### Possible errors

```json
{
  "error": "Erreur lors de la recuperation des joueurs"
}
```

---

## GET /api/player

Returns full data for one tracked player.

### Authentication

Requires `x-app-key`.

In production, also requires `Authorization: Bearer <accessToken>`.

### Source file

```txt
data/enriched/players.json
```

### Query parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `playerId` | string | Yes | Player account ID |

### Response `200`

Returns one player object, or `null` if no player matches the given `playerId`.

```json
{
  "id": "b39cded93b0f4aa59ffdadf0db18e853",
  "name": "Pixie",
  "pseudo": "havok pixie sc",
  "image": "/dashboard-assets/players/b39cded93b0f4aa59ffdadf0db18e853-5f99856eee.jpg",
  "countryFlag": "/dashboard-assets/flags/se-df5c52fd5a.png",
  "country": "Sweden",
  "top5": 1,
  "bestTop": 5,
  "avgKill": 59,
  "avgTop": 5,
  "lastTournaments": [
    {
      "tournamentId": "epicgames_S40_FNCSDivisionalCup_Division1_EU",
      "tournamentName": "Division 1 FNCS (Week 5 - Day 2)",
      "windowId": "S40_FNCSDivisionalCup_Division1_Week5Day2_EU",
      "start": "2026-05-19T17:00:00.000Z",
      "end": "2026-05-19T20:00:00.000Z",
      "image": "https://cdn2.unrealengine.com/example.jpg",
      "teamFormat": "Duo",
      "gameMode": "Battle Royale",
      "result": {
        "rank": 5,
        "points": 100,
        "kills": 20,
        "top15s": 3,
        "top5s": 1,
        "wins": 1,
        "nbGamesPlayed": 6,
        "teamAccountId": "team_account_id",
        "accountIds": [
          "account_id_1",
          "account_id_2"
        ],
        "names": [
          "Player 1",
          "Player 2"
        ]
      }
    }
  ]
}
```

### Missing `playerId` response `400`

```json
{
  "error": "playerId est requis"
}
```

### Example

```bash
curl "http://localhost:3000/api/player?playerId=b39cded93b0f4aa59ffdadf0db18e853" \
  -H "x-app-key: <APP_API_KEY>" \
  -H "Authorization: Bearer <accessToken>"
```

### Possible errors

```json
{
  "error": "Erreur lors de la recuperation du joueur b39cded93b0f4aa59ffdadf0db18e853"
}
```

---

## Notes

- Successful API responses do not use a global `success: true` wrapper, except `/api/health`.
- `POST /api/app/challenge` and `POST /api/app/session` return a `success` wrapper because they are part of the security bootstrap flow.
- `/api/tournaments/allWindow`, `/api/tournaments/window`, `/api/tournaments/results`, and `/api/player` return `null` with status `200` when nothing matches.
- The route name is `/api/tournaments/calendrier`, not `/api/tournaments/calendar`.
- Query parameters are read from `req.query`, not from the request body.
