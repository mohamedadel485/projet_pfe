# UptimeWarden Backend

Backend API pour l'application de surveillance de disponibilité web UptimeWarden.

## Installation

```bash
npm install
```

## Configuration

1. Créez un fichier `.env` basé sur `.env.example` :

```bash
cp .env.example .env
```

2. Configurez les variables d'environnement :
   - `MONGODB_URI`: Votre URL de connexion MongoDB
   - `JWT_SECRET`: Clé secrète pour les tokens JWT
   - `EMAIL_USER` et `EMAIL_PASSWORD`: Identifiants pour l'envoi d'emails
   - `PORT`: Port du serveur (par défaut: 5000)

## Développement

```bash
npm run dev
```

Le serveur démarrera en mode développement avec nodemon (rechargement automatique).

## Production

```bash
npm start
```

## API Documentation

Voir [api_documentation.md](../api_documentation.md) pour la documentation complète des endpoints.

## Architecture

- **Express.js**: Framework web
- **MongoDB + Mongoose**: Base de données
- **WebSockets**: Mises à jour en temps réel
- **node-cron**: Planificateur de tâches
- **JWT**: Authentification

## Points d'accès principaux

- `GET /` - Vérifier le statut du serveur
- `POST /api/auth/register` - Inscription
- `POST /api/auth/login` - Connexion
- `GET /api/monitors` - Lister les moniteurs
- `POST /api/monitors` - Créer un moniteur
- `WebSocket` - Connexion temps réel

## Support

Pour plus d'informations, consultez la documentation complète du projet.
