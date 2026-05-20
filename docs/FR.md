# HavokAPI-v1

Serveur Node.js/Express qui recupere, stocke, normalise, enrichit et expose des donnees Fortnite Competitive pour une app mobile.

## Description

Ce serveur recupere des donnees Fortnite a partir d'une connexion a un compte Epic Games/Fortnite.

Apres la connexion, il permet de :

- traquer des joueurs par `accountId`
- filtrer les tournois pris en compte
- recuperer les tournois a venir
- recuperer les details des tournois
- recuperer les resultats de tournois
- gerer certains joueurs depuis un dashboard

Les endpoints finaux sont prevus pour l'app mobile dediee, mais peuvent evoluer selon les besoins.

## Exemples de donnees

- dates, noms et images des tournois a venir
- details de tournoi : systeme de points, recompenses, horaires
- resultats de tournoi avec pagination
- resultats des joueurs traques
- informations de joueurs enrichies depuis le dashboard

## Architecture

### Recuperation des donnees

```txt
fnbr.js
  ->
raw
  ->
normalized
  ->
enriched
```

### Couches de donnees

| Etape | Description |
|---|---|
| `fnbr.js` | Recupere les donnees brutes |
| `raw` | Sauvegarde les donnees sans modification |
| `normalized` | Nettoie et reformate les donnees |
| `enriched` | Ajoute des donnees calculees ou complementaires |

### Flux API

```txt
router
  ->
controller
  ->
service
```

### Couches API

| Element | Role |
|---|---|
| `router` | Redirige les requetes vers les bons controllers |
| `controller` | Lit la requete et appelle les services |
| `service` | Contient la logique principale du serveur |

## Endpoints

### API

| Methode | Route | Description |
|---|---|---|
| GET | `/api/health` | Verifie si le serveur fonctionne |
| POST | `/api/app/challenge` | Cree un challenge temporaire pour initialiser la session mobile |
| POST | `/api/app/session` | Echange le challenge et l'attestation contre une courte session bearer |
| GET | `/api/home` | Donnees principales pour l'accueil |
| GET | `/api/tournaments/calendrier` | Liste des tournois a venir |
| GET | `/api/tournaments/allWindow` | Retourne un event et ses windows depuis `eventId` ou `windowId` |
| GET | `/api/tournaments/window` | Details d'une fenetre de tournoi |
| GET | `/api/tournaments/results` | Resultats d'une fenetre avec `windowId`, `page` et `cumulatif` |
| GET | `/api/players` | Liste des joueurs traques |
| GET | `/api/player` | Informations d'un joueur |

### Dashboard

| Methode | Route | Description |
|---|---|---|
| GET | `/dashboard` | Page principale du dashboard |
| GET | `/dashboard/login` | Page de connexion |
| POST | `/dashboard/login` | Connexion au dashboard |
| POST | `/dashboard/logout` | Deconnexion du dashboard |

## Securite

### Authentification API

- `GET /api/health` est public.
- `POST /api/app/challenge` et `POST /api/app/session` demandent `x-app-key`.
- Toutes les routes de donnees demandent `x-app-key`.
- En production, les routes de donnees demandent aussi `Authorization: Bearer <accessToken>`.
- Hors production, la verification de session mobile est actuellement bypass cote serveur.

### Bootstrap de session mobile

1. Appeler `POST /api/app/challenge` avec `installationId`, `platform` et `appVersion`.
2. Appeler `POST /api/app/session` avec le `challenge` recu et un payload `attestation`.
3. Reutiliser le JWT recu comme `Authorization: Bearer <accessToken>` sur les routes de donnees.

### Rate limits

- Limite globale `/api` : `60` requetes/minute
- `POST /api/app/challenge` : `20` requetes/minute
- `POST /api/app/session` : `10` requetes/minute

## Installation

### 1. Cloner le projet

```bash
git clone <url-du-projet>
cd HavokAPI-v1
```

### 2. Installer les dependances

```bash
npm install
```

### 3. Configurer le fichier `.env`

Creer un fichier `.env` a la racine du projet.

Tu peux utiliser `.env.example` comme modele.

Variables importantes :

```env
PORT=3000
APP_API_KEY=shared-public-app-key
APP_AUTH_JWT_SECRET=replace-with-a-long-random-secret
APP_ATTESTATION_MODE=development
APP_SESSION_TTL_SECONDS=600
APP_CHALLENGE_TTL_SECONDS=180
```

### 4. Lancer le serveur

```bash
npm start
```

## Connexion au compte Fortnite

Pour connecter un compte Fortnite, ouvre ce lien :

```txt
https://www.epicgames.com/id/api/redirect?clientId=3f69e56c7649492c8cc29f1af08a8a12&responseType=code
```

Recupere ensuite le `authorizationCode` et utilise-le dans le serveur.

## Utilisation

1. Cloner le projet
2. Configurer le fichier `.env`
3. Installer les dependances avec `npm install`
4. Lancer le serveur avec `npm start`
5. Connecter le compte Fortnite avec le `authorizationCode`
6. Aller sur `/dashboard/login`
7. Se connecter au dashboard

## Notes importantes

- L'app mobile ne doit jamais appeler `fnbr.js` directement.
- Les donnees doivent toujours passer par le serveur.
- Les routes de donnees demandent `x-app-key`, et en production aussi une session bearer courte creee via `/api/app/challenge` puis `/api/app/session`.
- Le mode d'attestation `development` est surtout prevu pour les environnements locaux ou de dev. L'attestation native de production reste a brancher cote Apple/Google.
- Le fichier `.env` ne doit jamais etre envoye sur GitHub.
- Le fichier `deviceAuth.json` ne doit jamais etre envoye sur GitHub.
- Les endpoints peuvent etre modifies selon les besoins de l'app mobile.
