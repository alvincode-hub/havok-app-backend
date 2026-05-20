# Dashboard API

Documentation for the protected dashboard routes served by `server/src/routes/dashboard.routes.js`.

Verified against source on 2026-05-20.

## Base behavior

- HTML entrypoint: `GET /dashboard`
- HTML shell: `GET /dashboard/`
- Login page: `GET /dashboard/login`
- Preferred JSON prefix: `/dashboard/api`
- Alias JSON prefix: `/api/dashboard`
- Auth mechanism: Express session cookie created by `POST /dashboard/login`

If a dashboard JSON route is called without a valid admin session, the server returns:

```json
{
  "error": "Session dashboard invalide. Reconnecte-toi."
}
```

`GET /dashboard` currently redirects to `/dashboard/`.

The dashboard HTML shell is served statically on `/dashboard/` even without a session. Protected data access is enforced by the dashboard JSON API.

## Login flow

### POST /dashboard/login

Request body:

```json
{
  "username": "admin",
  "password": "plain-text-password"
}
```

Success response:

```json
{
  "success": true
}
```

Possible errors:

```json
{
  "success": false,
  "error": "Identifiants manquants"
}
```

```json
{
  "success": false,
  "error": "Identifiants invalides"
}
```

### POST /dashboard/logout

Success response:

```json
{
  "success": true
}
```

## Route prefixes

Every JSON endpoint below exists on both prefixes:

- `/dashboard/api`
- `/api/dashboard`

Examples:

- `/dashboard/api/overview`
- `/api/dashboard/overview`

## Read endpoints

### GET /dashboard/api

Returns the full aggregated payload used by the dashboard UI.

Top-level fields:

- `meta`
- `header`
- `featuredEventId`
- `events`
- `trackedPlayers`
- `recentResults`
- `actu`
- `casts`
- `dataSources`
- `summaryCards`
- `settings`
- `notes`

### GET /dashboard/api/overview

Returns:

```json
{
  "meta": {},
  "header": {},
  "summaryCards": [],
  "featuredEventId": "",
  "notes": [],
  "dataSources": []
}
```

### GET /dashboard/api/events

Returns:

```json
{
  "items": []
}
```

### GET /dashboard/api/events/:eventId

Returns one event object, or `404` if not found:

```json
{
  "error": "Event introuvable."
}
```

### GET /dashboard/api/content

Returns:

```json
{
  "trackedPlayers": [],
  "recentResults": [],
  "actu": [],
  "casts": []
}
```

### GET /dashboard/api/config

Returns the combined editable payload:

```json
{
  "teamConfig": {
    "description": "",
    "players": []
  },
  "tournamentFilter": {
    "description": "",
    "acceptedEventIds": []
  },
  "actuConfig": [],
  "castConfig": {
    "entries": []
  },
  "eventOptions": [],
  "castWindowOptions": []
}
```

### GET /dashboard/api/status

Returns a readiness summary for local sources:

```json
{
  "generatedAt": "2026-05-20T20:30:00.000Z",
  "region": "EU",
  "allSourcesPresent": true,
  "sourceCount": 10,
  "readyCount": 10,
  "sources": []
}
```

## Config endpoints

### GET /dashboard/api/config/team

Returns:

```json
{
  "description": "Liste locale des joueurs suivis.",
  "players": []
}
```

Each player entry uses:

```json
{
  "accountId": "",
  "name": "",
  "image": "",
  "imageSource": "",
  "country": "",
  "countryFlag": "",
  "countryFlagSource": ""
}
```

### PUT /dashboard/api/config/team

Saves the tracked team config, then refreshes enriched results.

Success response:

```json
{
  "ok": true,
  "message": "Config team sauvegardee.",
  "config": {}
}
```

### GET /dashboard/api/config/tournament-filter

Returns:

```json
{
  "description": "Liste locale des eventId retenus.",
  "acceptedEventIds": []
}
```

### PUT /dashboard/api/config/tournament-filter

Saves the accepted event list, then refreshes enriched calendar and results.

Success response:

```json
{
  "ok": true,
  "message": "Tournament filter sauvegarde.",
  "config": {}
}
```

### GET /dashboard/api/config/actu

Returns an array of actu cards. Normalized fields:

```json
[
  {
    "id": "actu-1",
    "name": "",
    "image": "",
    "date": "2026-05-20",
    "dateLabel": "20 mai 2026",
    "description": "",
    "link": ""
  }
]
```

### PUT /dashboard/api/config/actu

Saves actu cards and cleans up removed dashboard assets.

Success response:

```json
{
  "ok": true,
  "message": "Actu sauvegardee.",
  "config": []
}
```

### GET /dashboard/api/config/cast

Returns:

```json
{
  "entries": [
    {
      "windowId": "",
      "youtube": {
        "channelName": "",
        "link": ""
      },
      "twitch": {
        "channelName": "",
        "link": ""
      }
    }
  ]
}
```

### PUT /dashboard/api/config/cast

Saves cast channels without triggering a data rebuild.

Success response:

```json
{
  "ok": true,
  "message": "Config cast sauvegardee.",
  "config": {}
}
```

## Force refresh endpoint

### POST /dashboard/api/updateCron

Starts the orchestration flow in the background:

1. events
2. live results
3. score rules
4. event results
5. cleanup results
6. profiles
7. enriched sync

Possible success payload:

```json
{
  "ok": true,
  "message": "Force refresh lance en arriere-plan.",
  "lockState": {}
}
```

If another orchestration is already running:

```json
{
  "ok": false,
  "message": "Une synchronisation est deja en cours.",
  "lockState": {}
}
```

## Notes

- The dashboard front-end uses `credentials: "same-origin"` for every JSON request.
- Dashboard assets are served from `/dashboard-assets/...`.
- `GET /dashboard/api/events/:eventId` is the only dashboard read route that explicitly returns `404`.
