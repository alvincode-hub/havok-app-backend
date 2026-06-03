# HavokAPI-v1

Serveur Express utilisé par `HavokApp` pour exposer les données Fortnite Competitive à partir de snapshots locaux et d’une configuration gérée par l’administrateur.

## Périmètre actuel

Le serveur fournit actuellement :

* une API mobile publique sous `/api`
* une coquille d’interface de dashboard sous `/dashboard/`
* une API JSON protégée pour le dashboard sous `/dashboard/api`
* des tâches de synchronisation planifiées qui actualisent les données locales `raw`, `normalized` et `enriched`

Les données sont stockées sur le disque dans `server/data`. Les snapshots JSON sont persistés sous cette forme :

```json
{
  "updatedAt": "2026-05-20T20:26:55.385Z",
  "data": []
}
```

L’API HTTP renvoie directement le contenu `data`, sans l’enveloppe de stockage.

## API publique

Documentée dans [docs/API.md](./docs/API.md).

### Routes disponibles

| Méthode | Route                         | Description                                                  |
| ------- | ----------------------------- | ------------------------------------------------------------ |
| GET     | `/api/health`                 | Vérification de l’état du serveur                            |
| POST    | `/api/app/challenge`          | Crée un challenge de session d’application à usage unique    |
| POST    | `/api/app/session`            | Échange le challenge + l’attestation contre un JWT court     |
| GET     | `/api/home`                   | Données de l’écran d’accueil                                 |
| GET     | `/api/tournaments/calendrier` | Calendrier des tournois                                      |
| GET     | `/api/tournaments/allWindow`  | Recherche de groupe d’événements par `eventId` ou `windowId` |
| GET     | `/api/tournaments/window`     | Données détaillées d’une fenêtre                             |
| GET     | `/api/tournaments/results`    | Données paginées du classement                               |
| GET     | `/api/players`                | Liste simplifiée des joueurs suivis                          |
| GET     | `/api/player`                 | Profil complet d’un joueur suivi                             |

### Modèle d’authentification

* `GET /api/health` est public.
* `POST /api/app/challenge` et `POST /api/app/session` nécessitent `x-app-key`.
* Les routes de données nécessitent `x-app-key`.
* En `NODE_ENV=production`, les routes de données nécessitent aussi `Authorization: Bearer <accessToken>`.
* Hors production, la vérification de session Bearer est contournée côté serveur.

## Dashboard

Documenté dans [docs/DASHBOARD.md](./docs/DASHBOARD.md).

### Routes HTML

| Méthode | Route                 | Description                                            |
| ------- | --------------------- | ------------------------------------------------------ |
| GET     | `/`                   | Redirige vers `/dashboard/login`                       |
| GET     | `/dashboard/login`    | Page de connexion                                      |
| POST    | `/dashboard/login`    | Crée le cookie de session du dashboard                 |
| POST    | `/dashboard/logout`   | Détruit la session du dashboard                        |
| GET     | `/dashboard`          | Redirige vers `/dashboard/`                            |
| GET     | `/dashboard/`         | Coquille de l’application dashboard                    |
| GET     | `/dashboard-assets/*` | Assets statiques générés pour les aperçus du dashboard |

### Routes JSON

L’API JSON du dashboard est disponible sur deux préfixes équivalents :

* `/dashboard/api/...`
* `/api/dashboard/...`

Le front-end du dashboard utilise actuellement `/dashboard/api/...`.

### Endpoints du dashboard implémentés

| Méthode   | Route                                     | Description                                     |
| --------- | ----------------------------------------- | ----------------------------------------------- |
| GET       | `/dashboard/api`                          | Données agrégées complètes du dashboard         |
| GET       | `/dashboard/api/overview`                 | En-tête, résumés, cartes des sources, notes     |
| GET       | `/dashboard/api/events`                   | Collection de cartes d’événements               |
| GET       | `/dashboard/api/events/:eventId`          | Une carte d’événement                           |
| GET       | `/dashboard/api/content`                  | Joueurs suivis, résultats récents, actus, casts |
| GET       | `/dashboard/api/config`                   | Données de configuration modifiables combinées  |
| GET       | `/dashboard/api/status`                   | Résumé de disponibilité des sources             |
| GET / PUT | `/dashboard/api/config/team`              | Configuration de l’équipe                       |
| GET / PUT | `/dashboard/api/config/tournament-filter` | Configuration du filtre de tournois             |
| GET / PUT | `/dashboard/api/config/actu`              | Configuration des actus                         |
| GET / PUT | `/dashboard/api/config/cast`              | Configuration des casts                         |
| POST      | `/dashboard/api/updateCron`               | Lance une actualisation forcée en arrière-plan  |

Les requêtes non authentifiées vers l’API du dashboard renvoient un JSON `401`. La coquille HTML du dashboard elle-même est servie statiquement sur `/dashboard/` ; la protection des données est appliquée par l’API JSON.

## Tâches cron

Le planificateur est enregistré au démarrage de l’application dans [src/jobs/cron.js](./src/jobs/cron.js).

| Fréquence              | Tâche                         |
| ---------------------- | ----------------------------- |
| Toutes les minutes     | résultats des événements live |
| Toutes les 30 minutes  | résultats des événements      |
| Toutes les 6 heures    | catalogue des événements      |
| Toutes les heures      | profils des joueurs           |
| Tous les jours à 00:00 | règles de score               |
| Tous les jours à 03:00 | nettoyage des résultats       |

Une actualisation forcée manuelle est aussi disponible via `POST /dashboard/api/updateCron`.

## Installation

### 1. Installer

```bash
npm install
```

### 2. Configurer `.env`

Partir de [server/.env.example](./.env.example).

Variables importantes :

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

Les variables d’authentification d’appareil Fortnite restent nécessaires pour les tâches du client FNBR :

```env
FORTNITE_AUTH_CLIENT=
FORTNITE_DEVICE_AUTH_FILE=
```

### 3. Lancer

```bash
npm start
```

Pour le développement local :

```bash
npm run dev
```

Pour un déploiement web en production, partir de [server/.env.production.example](./.env.production.example) et garder
`APP_ATTESTATION_MODE=web`.

### 4. Connecter ton compte Fortnite

Va sur https://www.epicgames.com/id/api/redirect?clientId=3f69e56c7649492c8cc29f1af08a8a12&responseType=code et connecte-toi.

```json
{
  "warning": "Do not share this code with any 3rd party service. It allows full access to your Epic account.",
  "redirectUrl": "com.epicgames.fortnite://fnauth/?code=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "authorizationCode": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "exchangeCode": null,
  "sid": null
}
```

Entre **authorizationCode** et attends.

## État de vérification

Vérifié avec le code source et l’exécution locale le 2026-05-20 :

* `GET /api/health` renvoie `200`
* `GET /api/players` renvoie `401` sans `x-app-key`
* `GET /api/players` renvoie `200` avec `x-app-key`
* `GET /api/tournaments/results` renvoie des données de classement paginées avec `windowId`

## Limites connues

* Le déploiement web en production est supporté avec `APP_ATTESTATION_MODE=web`.
* L’attestation native de production pour les builds App Store / Play Store n’est pas encore implémentée dans ce dépôt.
* En développement, les vérifications de session Bearer mobile sont volontairement contournées côté serveur.
* L’authentification du dashboard repose sur un cookie de session et est prévue pour une utilisation sur la même origine.
  ::: 
