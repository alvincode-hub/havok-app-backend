# HavokAPI-v1

Node.js/Express server used to fetch, store, normalize, enrich and expose Fortnite Competitive data for a mobile app.

## Description

This server retrieves Fortnite Competitive data using a Fortnite account connection.

After authentication, it allows you to:

- track players by `accountId`
- filter which tournaments are used
- fetch upcoming tournaments
- fetch tournament details
- fetch tournament results
- manage tracked players from a dashboard

The final endpoints are ready to be used by the dedicated mobile app, but they can be changed depending on the app needs.

## Data examples

- Upcoming tournament dates, names and images
- Tournament details: scoring system, rewards and schedule
- Tournament results with a selected top range
- Results for tracked players
- Player information added from the dashboard

## Architecture

### Data fetching flow

```txt
fnbr.js
  ↓
raw
  ↓
normalized
  ↓
enriched
```

### Data layers

| Step | Description |
|---|---|
| `fnbr.js` | Fetches raw Fortnite data |
| `raw` | Stores raw data without modification |
| `normalized` | Cleans and formats the raw data |
| `enriched` | Adds computed or extra data |

### API flow

```txt
router
  ↓
controller
  ↓
service
```

### API layers

| Layer | Role |
|---|---|
| `router` | Redirects requests to the correct controllers |
| `controller` | Reads the request and calls the services |
| `service` | Contains the main server logic |

## Endpoints

### API

| Method | Route | Description |
|---|---|---|
| GET | `/api/health` | Checks if the server is running |
| POST | `/api/app/challenge` | Creates a one-time challenge for the mobile session bootstrap |
| POST | `/api/app/session` | Exchanges the challenge + attestation payload for a short JWT session |
| GET | `/api/home` | Returns main home data |
| GET | `/api/tournaments/calendrier` | Returns upcoming tournaments |
| GET | `/api/tournaments/allWindow` | Returns an event and its windows from `eventId` or `windowId` |
| GET | `/api/tournaments/window` | Returns tournament window details |
| GET | `/api/tournaments/results` | Returns tournament window results with `windowId`, optional `page`, and optional `cumulatif` |
| GET | `/api/players` | Returns tracked players |
| GET | `/api/player` | Returns player information |

### Dashboard

| Method | Route | Description |
|---|---|---|
| GET | `/dashboard` | Main dashboard page |
| GET | `/dashboard/login` | Login page |
| POST | `/dashboard/login` | Dashboard login |
| POST | `/dashboard/logout` | Dashboard logout |

## Installation

### 1. Clone the project

```bash
git clone <project-url>
cd HavokAPI-v1
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure `.env`

Create a `.env` file at the root of the project.

You can use `.env.example` as a template.

Variables added for the mobile session flow:

```bash
APP_API_KEY=shared-public-app-key
APP_AUTH_JWT_SECRET=replace-with-a-long-random-secret
APP_ATTESTATION_MODE=development
APP_SESSION_TTL_SECONDS=600
APP_CHALLENGE_TTL_SECONDS=180
```

### 4. Start the server

```bash
npm start
```

## Fortnite account authentication

To connect a Fortnite account, open this link:

```txt
https://www.epicgames.com/id/api/redirect?clientId=3f69e56c7649492c8cc29f1af08a8a12&responseType=code
```

Then copy the `authorizationCode` and use it in the server.

## Usage

1. Clone the project
2. Configure the `.env` file
3. Install dependencies with `npm install`
4. Start the server with `npm start`
5. Connect the Fortnite account using the `authorizationCode`
6. Go to `/dashboard/login`
7. Log in to the dashboard

## Important notes

- The mobile app must never call `fnbr.js` directly.
- All Fortnite data must go through this server.
- Mobile routes now require both `x-app-key` and a short bearer session created from `/api/app/challenge` then `/api/app/session`.
- The current `development` attestation mode is intended for local Expo Go / dev builds. Native production attestation still needs Apple/Google verification setup.
- The `.env` file must never be pushed to GitHub.
- The `deviceAuth.json` file must never be pushed to GitHub.
- Final endpoints can be changed depending on the mobile app needs.
- More documentation on /docs/.
