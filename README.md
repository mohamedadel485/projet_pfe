# UptimeWarden

Application de surveillance de disponibilité web avec alertes en temps réel.

## Structure du projet

```
projet_pfe/
├── client/                    # Application React
│   ├── public/
│   ├── src/
│   ├── package.json
│   └── README.md
│
├── server/                    # API Node.js/Express
│   ├── backend_server_js.js  # Logique principale du serveur
│   ├── server.js             # Point d'entrée du serveur
│   ├── package.json
│   ├── .env.example
│   └── README.md
│
├── package.json              # Scripts pour orchestrer les deux projets
├── api_documentation.md      # Documentation API
├── database_schema.md        # Schéma de la base de données
└── deployment_guide.md       # Guide de déploiement
```

## Installation complète

```bash
# Installez les dépendances pour tous les projets
npm run install-all
```

## Démarrage

### Mode développement (client + serveur)

```bash
npm start
```

### Serveur uniquement

```bash
npm run server:dev
```

### Client uniquement

```bash
npm run client
```

## Build pour production

```bash
npm run build
```

## Technologies

### Backend

- Node.js + Express
- MongoDB + Mongoose
- JWT pour l'authentification
- WebSockets pour les mises à jour temps réel
- node-cron pour la planification

### Frontend

- React
- Tailwind CSS
- Axios pour les requêtes API

## Configuration

1. Configurez les variables d'environnement du serveur (voir `server/.env.example`)
2. Assurez-vous que MongoDB est en cours d'exécution
3. Lancez l'application

## Documentation

- [API Documentation](./api_documentation.md)
- [Database Schema](./database_schema.md)
- [Deployment Guide](./deployment_guide.md)
- [Server README](./server/README.md)
- [Client README](./client/README.md)

## License

MIT
