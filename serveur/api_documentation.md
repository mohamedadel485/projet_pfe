# 📡 UptimeWarden - Documentation API

Documentation complète de l'API REST de UptimeWarden.

## Base URL

```
Production: https://api.uptimewarden.com
Development: http://localhost:5000
```

## Authentification

L'API utilise JWT (JSON Web Tokens) pour l'authentification.

### Headers Requis

```http
Authorization: Bearer <votre_token_jwt>
Content-Type: application/json
```

---

## 🔐 Authentication

### Inscription

Créer un nouveau compte utilisateur.

**Endpoint:** `POST /api/auth/register`

**Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "name": "John Doe"
}
```

**Response:** `201 Created`
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

**Erreurs:**
- `400` - Email déjà utilisé
- `500` - Erreur serveur

---

### Connexion

Authentifier un utilisateur existant.

**Endpoint:** `POST /api/auth/login`

**Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Response:** `200 OK`
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

**Erreurs:**
- `401` - Identifiants invalides
- `500` - Erreur serveur

---

## 📊 Monitors

### Lister tous les moniteurs

Récupérer tous les moniteurs de l'utilisateur authentifié.

**Endpoint:** `GET /api/monitors`

**Headers:**
```http
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
[
  {
    "_id": "507f1f77bcf86cd799439011",
    "userId": "507f191e810c19729de860ea",
    "name": "API Principal",
    "url": "https://api.example.com",
    "type": "HTTPS",
    "interval": 5,
    "timeout": 30,
    "status": "up",
    "uptime": 99.8,
    "lastCheck": "2024-01-15T10:30:00Z",
    "lastResponseTime": 145,
    "alertChannels": {
      "email": true,
      "sms": false,
      "slack": false,
      "discord": false
    },
    "createdAt": "2024-01-01T00:00:00Z"
  }
]
```

---

### Créer un moniteur

Ajouter un nouveau point de surveillance.

**Endpoint:** `POST /api/monitors`

**Headers:**
```http
Authorization: Bearer <token>
Content-Type: application/json
```

**Body:**
```json
{
  "name": "Mon Site Web",
  "url": "https://www.example.com",
  "type": "HTTPS",
  "interval": 5,
  "timeout": 30,
  "sslCheck": true,
  "alertChannels": {
    "email": true,
    "sms": false,
    "slack": true,
    "discord": false
  },
  "alertThreshold": 2
}
```

**Types disponibles:**
- `HTTP` - Surveillance HTTP
- `HTTPS` - Surveillance HTTPS avec option SSL
- `PING` - Test de connectivité réseau
- `PORT` - Vérification de port TCP
- `KEYWORD` - Recherche de mot-clé dans la réponse

**Paramètres optionnels supplémentaires:**

Pour `KEYWORD`:
```json
{
  "keyword": "Success"
}
```

Pour `PORT`:
```json
{
  "port": 3306
}
```

Pour `HTTP/HTTPS` avec méthode personnalisée:
```json
{
  "method": "POST",
  "headers": {
    "Authorization": "Bearer token",
    "Content-Type": "application/json"
  },
  "body": "{\"test\": true}"
}
```

**Response:** `201 Created`
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "userId": "507f191e810c19729de860ea",
  "name": "Mon Site Web",
  "url": "https://www.example.com",
  "type": "HTTPS",
  "interval": 5,
  "timeout": 30,
  "status": "up",
  "uptime": 100,
  "sslCheck": true,
  "alertChannels": {
    "email": true,
    "sms": false,
    "slack": true,
    "discord": false
  },
  "createdAt": "2024-01-15T10:30:00Z"
}
```

**Erreurs:**
- `400` - Données invalides
- `401` - Non authentifié
- `500` - Erreur serveur

---

### Obtenir un moniteur

Récupérer les détails d'un moniteur spécifique.

**Endpoint:** `GET /api/monitors/:id`

**Headers:**
```http
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "userId": "507f191e810c19729de860ea",
  "name": "API Principal",
  "url": "https://api.example.com",
  "type": "HTTPS",
  "interval": 5,
  "timeout": 30,
  "status": "up",
  "uptime": 99.8,
  "lastCheck": "2024-01-15T10:30:00Z",
  "lastResponseTime": 145,
  "sslCheck": true,
  "sslExpiryDate": "2024-12-31T23:59:59Z",
  "alertChannels": {
    "email": true,
    "sms": false,
    "slack": false,
    "discord": false
  },
  "createdAt": "2024-01-01T00:00:00Z"
}
```

**Erreurs:**
- `404` - Moniteur non trouvé
- `401` - Non authentifié

---

### Mettre à jour un moniteur

Modifier la configuration d'un moniteur existant.

**Endpoint:** `PUT /api/monitors/:id`

**Headers:**
```http
Authorization: Bearer <token>
Content-Type: application/json
```

**Body:**
```json
{
  "name": "API Principal (Mise à jour)",
  "interval": 10,
  "alertChannels": {
    "email": true,
    "sms": true,
    "slack": true,
    "discord": false
  }
}
```

**Response:** `200 OK`
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "name": "API Principal (Mise à jour)",
  "interval": 10,
  // ... autres champs mis à jour
}
```

**Erreurs:**
- `400` - Données invalides
- `404` - Moniteur non trouvé
- `401` - Non authentifié

---

### Supprimer un moniteur

Supprimer définitivement un moniteur.

**Endpoint:** `DELETE /api/monitors/:id`

**Headers:**
```http
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "message": "Moniteur supprimé"
}
```

**Erreurs:**
- `404` - Moniteur non trouvé
- `401` - Non authentifié

---

### Mettre en pause / Reprendre

Mettre en pause ou reprendre la surveillance d'un moniteur.

**Endpoint:** `PATCH /api/monitors/:id/status`

**Body:**
```json
{
  "status": "paused"
}
```

Valeurs possibles: `up`, `down`, `paused`

**Response:** `200 OK`

---

## 📈 Check History

### Obtenir l'historique des vérifications

Récupérer l'historique des checks pour un moniteur.

**Endpoint:** `GET /api/monitors/:id/history`

**Query Parameters:**
- `limit` (optionnel) - Nombre maximum de résultats (défaut: 100, max: 1000)
- `period` (optionnel) - Période: `24h`, `7d`, `30d` (défaut: 24h)
- `status` (optionnel) - Filtrer par status: `up`, `down`

**Exemple:**
```
GET /api/monitors/507f1f77bcf86cd799439011/history?limit=50&period=7d&status=down
```

**Response:** `200 OK`
```json
[
  {
    "_id": "507f1f77bcf86cd799439012",
    "monitorId": "507f1f77bcf86cd799439011",
    "status": "up",
    "responseTime": 145,
    "statusCode": 200,
    "timestamp": "2024-01-15T10:30:00Z"
  },
  {
    "_id": "507f1f77bcf86cd799439013",
    "monitorId": "507f1f77bcf86cd799439011",
    "status": "down",
    "responseTime": 0,
    "statusCode": null,
    "error": "Connection timeout",
    "timestamp": "2024-01-15T10:25:00Z"
  }
]
```

---

### Statistiques d'historique

Obtenir des statistiques agrégées.

**Endpoint:** `GET /api/monitors/:id/stats`

**Query Parameters:**
- `period` - Période d'analyse: `24h`, `7d`, `30d`, `90d`

**Response:** `200 OK`
```json
{
  "period": "30d",
  "totalChecks": 8640,
  "upChecks": 8621,
  "downChecks": 19,
  "uptime": 99.78,
  "avgResponseTime": 147,
  "minResponseTime": 89,
  "maxResponseTime": 523,
  "incidents": 3,
  "longestOutage": 45,
  "dataPoints": [
    {
      "date": "2024-01-15",
      "uptime": 100,
      "avgResponseTime": 145,
      "checks": 288
    }
  ]
}
```

---

## 🚨 Incidents

### Lister les incidents

Récupérer tous les incidents des moniteurs de l'utilisateur.

**Endpoint:** `GET /api/incidents`

**Query Parameters:**
- `resolved` (optionnel) - Filtrer par état: `true`, `false`
- `limit` (optionnel) - Nombre de résultats (défaut: 50)
- `monitorId` (optionnel) - Filtrer par moniteur

**Response:** `200 OK`
```json
[
  {
    "_id": "507f1f77bcf86cd799439014",
    "monitorId": {
      "_id": "507f1f77bcf86cd799439011",
      "name": "API Principal",
      "url": "https://api.example.com"
    },
    "type": "outage",
    "severity": "critical",
    "startTime": "2024-01-15T08:00:00Z",
    "endTime": "2024-01-15T08:15:00Z",
    "duration": 15,
    "resolved": true,
    "details": "Connection timeout",
    "notificationsSent": ["email", "slack"]
  }
]
```

---

### Obtenir un incident

Détails d'un incident spécifique.

**Endpoint:** `GET /api/incidents/:id`

**Response:** `200 OK`
```json
{
  "_id": "507f1f77bcf86cd799439014",
  "monitorId": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "API Principal",
    "url": "https://api.example.com"
  },
  "type": "outage",
  "severity": "critical",
  "startTime": "2024-01-15T08:00:00Z",
  "endTime": "2024-01-15T08:15:00Z",
  "duration": 15,
  "resolved": true,
  "acknowledgedBy": "507f191e810c19729de860ea",
  "acknowledgedAt": "2024-01-15T08:05:00Z",
  "details": "Connection timeout",
  "errorLog": [
    "2024-01-15T08:00:00Z - Connection timeout",
    "2024-01-15T08:05:00Z - Connection timeout",
    "2024-01-15T08:10:00Z - Connection timeout"
  ],
  "notificationsSent": ["email", "slack"],
  "rootCause": "Server overload",
  "resolution": "Increased server capacity",
  "createdAt": "2024-01-15T08:00:00Z"
}
```

---

### Accuser réception d'un incident

Marquer un incident comme pris en compte.

**Endpoint:** `POST /api/incidents/:id/acknowledge`

**Response:** `200 OK`
```json
{
  "message": "Incident acknowledged",
  "incident": {
    // ... détails de l'incident
    "acknowledgedBy": "507f191e810c19729de860ea",
    "acknowledgedAt": "2024-01-15T08:05:00Z"
  }
}
```

---

## 📄 Status Pages

### Créer une page de statut

**Endpoint:** `POST /api/status-pages`

**Body:**
```json
{
  "slug": "mon-entreprise-status",
  "title": "Statut de Mes Services",
  "description": "Page de statut en temps réel",
  "isPublic": true,
  "monitors": [
    "507f1f77bcf86cd799439011",
    "507f1f77bcf86cd799439012"
  ],
  "branding": {
    "logo": "https://example.com/logo.png",
    "primaryColor": "#3b82f6",
    "backgroundColor": "#ffffff"
  },
  "showIncidentHistory": true,
  "showUptimePercentage": true,
  "showResponseTime": true
}
```

**Response:** `201 Created`
```json
{
  "_id": "507f1f77bcf86cd799439015",
  "userId": "507f191e810c19729de860ea",
  "slug": "mon-entreprise-status",
  "title": "Statut de Mes Services",
  "description": "Page de statut en temps réel",
  "isPublic": true,
  "monitors": ["507f1f77bcf86cd799439011"],
  "branding": {
    "logo": "https://example.com/logo.png",
    "primaryColor": "#3b82f6",
    "backgroundColor": "#ffffff"
  },
  "createdAt": "2024-01-15T10:30:00Z"
}
```

---

### Obtenir une page de statut (Public)

**Endpoint:** `GET /api/status-pages/:slug`

**Note:** Cet endpoint est public (pas d'authentification requise)

**Response:** `200 OK`
```json
{
  "_id": "507f1f77bcf86cd799439015",
  "slug": "mon-entreprise-status",
  "title": "Statut de Mes Services",
  "description": "Page de statut en temps réel",
  "monitors": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "name": "API Principal",
      "status": "up",
      "uptime": 99.8,
      "lastResponseTime": 145
    }
  ],
  "branding": {
    "logo": "https://example.com/logo.png",
    "primaryColor": "#3b82f6"
  },
  "recentIncidents": []
}
```

---

### Mettre à jour une page de statut

**Endpoint:** `PUT /api/status-pages/:id`

**Body:** (Mêmes champs que la création)

**Response:** `200 OK`

---

### Supprimer une page de statut

**Endpoint:** `DELETE /api/status-pages/:id`

**Response:** `200 OK`

---

## 📊 Statistics

### Statistiques globales

Obtenir les statistiques générales du compte.

**Endpoint:** `GET /api/stats`

**Response:** `200 OK`
```json
{
  "totalMonitors": 15,
  "upMonitors": 14,
  "downMonitors": 1,
  "totalChecks": 43200,
  "globalUptime": 99.65,
  "avgResponseTime": 152,
  "activeIncidents": 1,
  "resolvedIncidents": 23,
  "totalIncidents": 24,
  "checksLast24h": 4320,
  "alertsSent": 45,
  "byType": {
    "HTTP": 5,
    "HTTPS": 8,
    "PING": 1,
    "PORT": 1
  }
}
```

---

### Statistiques par période

**Endpoint:** `GET /api/stats/period`

**Query Parameters:**
- `start` - Date de début (ISO 8601)
- `end` - Date de fin (ISO 8601)

**Exemple:**
```
GET /api/stats/period?start=2024-01-01T00:00:00Z&end=2024-01-31T23:59:59Z
```

**Response:** `200 OK`
```json
{
  "period": {
    "start": "2024-01-01T00:00:00Z",
    "end": "2024-01-31T23:59:59Z"
  },
  "totalChecks": 133920,
  "upChecks": 133234,
  "downChecks": 686,
  "uptime": 99.49,
  "avgResponseTime": 148,
  "incidents": 12,
  "dailyStats": [
    {
      "date": "2024-01-01",
      "checks": 4320,
      "uptime": 99.8,
      "avgResponseTime": 145
    }
  ]
}
```

---

## 🔔 Notifications

### Configurer les préférences

**Endpoint:** `PUT /api/user/notifications`

**Body:**
```json
{
  "email": true,
  "sms": false,
  "slack": true,
  "discord": false,
  "slackWebhook": "https://hooks.slack.com/services/YOUR/WEBHOOK",
  "discordWebhook": "",
  "phoneNumber": "+33612345678"
}
```

**Response:** `200 OK`

---

### Tester les notifications

Envoyer une notification de test.

**Endpoint:** `POST /api/notifications/test`

**Body:**
```json
{
  "channel": "email"
}
```

Canaux disponibles: `email`, `sms`, `slack`, `discord`

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Notification de test envoyée",
  "channel": "email"
}
```

---

## 🔧 Maintenance Windows

### Créer une fenêtre de maintenance

**Endpoint:** `POST /api/maintenance-windows`

**Body:**
```json
{
  "title": "Maintenance du serveur",
  "description": "Mise à jour de sécurité",
  "monitorIds": ["507f1f77bcf86cd799439011"],
  "startTime": "2024-01-20T02:00:00Z",
  "endTime": "2024-01-20T04:00:00Z",
  "notifySubscribers": true
}
```

**Response:** `201 Created`

---

## ⚡ WebSocket

### Connexion

Se connecter au serveur WebSocket pour recevoir des mises à jour en temps réel.

**Endpoint:** `ws://localhost:5000/ws`

**Authentification:**
Envoyer un message JSON avec le token après la connexion:
```json
{
  "type": "auth",
  "token": "your_jwt_token"
}
```

### Messages reçus

**Mise à jour de moniteur:**
```json
{
  "type": "monitor_update",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "status": "down",
    "lastResponseTime": 0,
    "lastCheck": "2024-01-15T10:30:00Z"
  }
}
```

**Nouvel incident:**
```json
{
  "type": "new_incident",
  "data": {
    "_id": "507f1f77bcf86cd799439014",
    "monitorId": "507f1f77bcf86cd799439011",
    "type": "outage",
    "startTime": "2024-01-15T10:30:00Z"
  }
}
```

**Incident résolu:**
```json
{
  "type": "incident_resolved",
  "data": {
    "_id": "507f1f77bcf86cd799439014",
    "duration": 15,
    "endTime": "2024-01-15T10:45:00Z"
  }
}
```

---

## 📝 Rate Limiting

L'API implémente un rate limiting pour éviter les abus:

- **Authentification**: 10 requêtes / 15 minutes par IP
- **API générale**: 100 requêtes / 15 minutes par utilisateur
- **WebSocket**: 60 connexions / heure par utilisateur

**Headers de réponse:**
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642261200
```

**Erreur rate limit dépassé:** `429 Too Many Requests`
```json
{
  "error": "Trop de requêtes, veuillez réessayer plus tard",
  "retryAfter": 900
}
```

---

## 🚫 Codes d'Erreur

| Code | Description |
|------|-------------|
| 200 | Succès |
| 201 | Ressource créée |
| 400 | Requête invalide |
| 401 | Non authentifié |
| 403 | Accès interdit |
| 404 | Ressource non trouvée |
| 409 | Conflit (ressource existe déjà) |
| 422 | Entité non traitable (validation échouée) |
| 429 | Trop de requêtes |
| 500 | Erreur serveur interne |
| 503 | Service temporairement indisponible |

**Format des erreurs:**
```json
{
  "error": "Message d'erreur descriptif",
  "code": "ERROR_CODE",
  "details": {
    "field": "Détails supplémentaires"
  }
}
```

---

## 📦 SDK et Bibliothèques

### JavaScript/Node.js

```bash
npm install uptimewarden-sdk
```

```javascript
const UptimeWarden = require('uptimewarden-sdk');

const client = new UptimeWarden({
  apiKey: 'your_api_key',
  baseURL: 'https://api.uptimewarden.com'
});

// Créer un moniteur
const monitor = await client.monitors.create({
  name: 'Mon API',
  url: 'https://api.example.com',
  type: 'HTTPS'
});

// Lister les moniteurs
const monitors = await client.monitors.list();

// WebSocket
client.on('monitor_update', (data) => {
  console.log('Mise à jour:', data);
});
```

---

## 🔗 Webhooks Sortants

Configurez des webhooks pour recevoir des notifications sur vos endpoints.

**Configuration:** Dans les paramètres du compte

**Format des webhooks:**

```http
POST https://your-endpoint.com/webhook
Content-Type: application/json
X-UptimeWarden-Signature: sha256=...
```

```json
{
  "event": "monitor.down",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "monitorId": "507f1f77bcf86cd799439011",
    "monitorName": "API Principal",
    "url": "https://api.example.com",
    "error": "Connection timeout"
  }
}
```

**Événements disponibles:**
- `monitor.down` - Moniteur en panne
- `monitor.up` - Moniteur rétabli
- `incident.created` - Nouvel incident
- `incident.resolved` - Incident résolu
- `ssl.expiring` - Certificat SSL expirant bientôt

---

Pour plus d'informations, consultez la [documentation complète](https://docs.uptimewarden.com) ou contactez le [support](mailto:support@uptimewarden.com).