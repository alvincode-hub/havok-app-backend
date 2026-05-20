# HavokAPI-v1

Cette note resume l'etat reel du serveur au 2026-05-20.

## Ce que fait le serveur

Le projet expose trois surfaces principales :

- une API mobile publique sous `/api`
- un dashboard HTML sous `/dashboard`
- une API JSON protegee de dashboard sous `/dashboard/api` avec alias `/api/dashboard`

Les donnees sont lues dans `server/data` a partir des couches :

```txt
fnbr -> raw -> normalized -> enriched
```

Les fichiers JSON de stockage sont enregistres avec une enveloppe :

```json
{
  "updatedAt": "...",
  "data": ...
}
```

Les routes HTTP renvoient uniquement `data`.

## Endpoints API mobile

| Methode | Route | Description |
|---|---|---|
| GET | `/api/health` | Healthcheck public |
| POST | `/api/app/challenge` | Cree un challenge de session mobile |
| POST | `/api/app/session` | Cree une session bearer courte |
| GET | `/api/home` | Payload de l'accueil |
| GET | `/api/tournaments/calendrier` | Calendrier des windows |
| GET | `/api/tournaments/allWindow` | Lookup event par `eventId` ou `windowId` |
| GET | `/api/tournaments/window` | Details d'une window |
| GET | `/api/tournaments/results` | Une page de leaderboard |
| GET | `/api/players` | Liste simplifiee des joueurs suivis |
| GET | `/api/player` | Profil complet d'un joueur suivi |

Details complets dans [docs/API.md](./API.md).

## Authentification API mobile

- `GET /api/health` est public.
- `POST /api/app/challenge` et `POST /api/app/session` demandent `x-app-key`.
- Les routes metier demandent `x-app-key`.
- En production, elles demandent aussi `Authorization: Bearer <accessToken>`.
- Hors production, la verification de session mobile est bypass cote serveur.

## Dashboard

### Pages

| Methode | Route | Description |
|---|---|---|
| GET | `/` | Redirection vers `/dashboard/login` |
| GET | `/dashboard/login` | Page de connexion |
| POST | `/dashboard/login` | Ouvre la session admin |
| POST | `/dashboard/logout` | Ferme la session admin |
| GET | `/dashboard` | Redirection vers `/dashboard/` |
| GET | `/dashboard/` | Shell du dashboard |
| GET | `/dashboard-assets/*` | Assets images du dashboard |

### API JSON

Le dashboard expose les endpoints suivants sur `/dashboard/api` et `/api/dashboard` :

| Methode | Route | Description |
|---|---|---|
| GET | `/overview` | Resume, cartes, notes, sources |
| GET | `/events` | Liste d'events |
| GET | `/events/:eventId` | Detail d'un event |
| GET | `/content` | Joueurs suivis, resultats, actu, casts |
| GET | `/config` | Payload combine de configuration |
| GET | `/status` | Etat des sources locales |
| GET / PUT | `/config/team` | Configuration des joueurs suivis |
| GET / PUT | `/config/tournament-filter` | Filtre des eventId retenus |
| GET / PUT | `/config/actu` | Cartes d'actu |
| GET / PUT | `/config/cast` | Liens Twitch / YouTube |
| POST | `/updateCron` | Force refresh en arriere-plan |

Doc detaillee dans [docs/DASHBOARD.md](./DASHBOARD.md).

Comportement auth :

- sans session valide, les endpoints JSON renvoient `401`
- le shell HTML `/dashboard/` reste servi statiquement; la protection est appliquee sur l'API JSON

## Cron

Le scheduler est active au demarrage dans `src/jobs/cron.js`.

| Frequence | Tache |
|---|---|
| chaque minute | live results |
| toutes les 30 min | event results |
| toutes les 6 h | events |
| chaque heure | profiles |
| chaque jour a 00:00 | score rules |
| chaque jour a 03:00 | cleanup results |

Le dashboard peut aussi lancer un force refresh via `POST /dashboard/api/updateCron`.

## Installation rapide

```bash
npm install
```

Puis configurer [server/.env.example](../.env.example) avec au minimum :

```env
PORT=3000
NODE_ENV=development
APP_API_KEY=replace-with-your-app-api-key
APP_AUTH_JWT_SECRET=replace-with-your-jwt-secret
APP_ATTESTATION_MODE=development
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=
SESSION_SECRET=replace-with-your-dashboard-session-secret
```

Demarrage :

```bash
npm start
```

Mode dev :

```bash
npm run dev
```

## Verifications faites

Verifie localement le 2026-05-20 :

- `GET /api/health` repond `200`
- `GET /api/players` repond `401` sans `x-app-key`
- `GET /api/players` repond `200` avec `x-app-key`
- `GET /api/tournaments/results?windowId=<knownWindowId>&page=0` repond `200`
- `npm run lint` passe dans `HavokApp`
- `npm run typecheck` passe dans `HavokApp`

## Limites connues

- L'attestation native de production Apple / Google n'est pas encore implemente dans ce repo.
- Le bypass de session mobile en environnement non production est volontaire.
- Le dashboard est pense pour un usage same-origin avec cookie de session.
