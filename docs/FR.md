# HavokAPI-v1

Serveur Node.js/Express permettant de récupérer et d'exposer des informations Fortnite Competitive pour une app mobile externe.

## Description

Ce serveur récupère des données Fortnite à partir d'une connexion à un compte Epic Games/Fortnite.

Après la connexion, il permet de :

- traquer des joueurs par `accountId`
- filtrer les tournois pris en compte
- récupérer les tournois à venir
- récupérer les détails des tournois
- récupérer les résultats de tournois
- gérer certains joueurs depuis un dashboard

Les endpoints finaux sont prêts à être utilisés dans l'app mobile dédiée, mais peuvent être modifiés selon les besoins.

## Exemples de données récupérées

- Date, nom et image des tournois à venir
- Détails des tournois : système de points, récompenses, horaires
- Résultats de tournois avec un top donné
- Résultats des joueurs traqués
- Informations des joueurs ajoutés dans le dashboard

## Architecture

### Récupération des données

```txt
fnbr.js
  ↓
raw
  ↓
normalized
  ↓
enriched
```

### Explication

| Étape | Description |
|---|---|
| `fnbr.js` | Récupération des données brutes |
| `raw` | Sauvegarde des données brutes |
| `normalized` | Nettoyage et normalisation des données |
| `enriched` | Ajout de données calculées ou complémentaires |

### Endpoints finaux

```txt
router
  ↓
controller
  ↓
service
```

### Explication

| Élément | Rôle |
|---|---|
| `router` | Redirige les requêtes vers les bons controllers |
| `controller` | Récupère la requête et appelle les services |
| `service` | Contient la logique principale du serveur |

## Endpoints

### API

| Méthode | Route | Description |
|---|---|---|
| GET | `/api/health` | Vérifie si le serveur fonctionne |
| GET | `/api/home` | Données principales pour l'accueil |
| GET | `/api/tournaments/calendrier` | Liste des tournois à venir |
| GET | `/api/tournaments/allWindow` | Retourne un event et ses windows depuis `eventId` ou `windowId` |
| GET | `/api/tournaments/window` | Détails d'une fenêtre de tournoi |
| GET | `/api/tournaments/results` | Résultats d'une fenêtre avec `windowId`, `page` et `cumulatif` |
| GET | `/api/players` | Liste des joueurs traqués |
| GET | `/api/player` | Informations d'un joueur |

### Dashboard

| Méthode | Route | Description |
|---|---|---|
| GET | `/dashboard` | Page principale du dashboard |
| GET | `/dashboard/login` | Page de connexion |
| POST | `/dashboard/login` | Connexion au dashboard |
| POST | `/dashboard/logout` | Déconnexion du dashboard |

## Installation

### 1. Cloner le projet

```bash
git clone <url-du-projet>
cd HavokAPI-v1
```

### 2. Installer les dépendances

```bash
npm install
```

### 3. Configurer le fichier `.env`

Créer un fichier `.env` à la racine du projet

Tu peux utilisé `.env.example` comme modèle.

Exemple :

```env
PORT=3000
```

### 4. Lancer le serveur

```bash
npm start
```

## Connexion au compte Fortnite

Pour connecter un compte Fortnite, ouvrir ce lien :

```txt
https://www.epicgames.com/id/api/redirect?clientId=3f69e56c7649492c8cc29f1af08a8a12&responseType=code
```

Récupérer ensuite le `authorizationCode` et l'utiliser dans le serveur.

## Utilisation

1. Cloner le projet
2. Configurer le fichier `.env`
3. Installer les dépendances avec `npm install`
4. Lancer le serveur avec `npm start`
5. Connecter le compte Fortnite avec le `authorizationCode`
6. Aller sur `/dashboard/login`
7. Se connecter au dashboard

## Notes importantes

- L'app mobile ne doit jamais appeler `fnbr.js` directement.
- Les données doivent toujours passer par le serveur.
- Le fichier `.env` ne doit jamais être envoyé sur GitHub.
- Le fichier `deviceAuth.json` ne doit jamais être envoyé sur GitHub.
- Les endpoints peuvent être modifiés selon les besoins de l'app mobile.
