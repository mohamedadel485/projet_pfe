# 🗄️ UptimeWarden - Schéma de Base de Données

## Collections MongoDB

### 1. Users (Utilisateurs)

Collection pour la gestion des utilisateurs de l'application.

```javascript
{
  _id: ObjectId,
  email: String (unique, required),
  password: String (hashed, required),
  name: String (required),
  role: String (enum: ['admin', 'user'], default: 'user'),
  notifications: {
    email: Boolean (default: true),
    sms: Boolean (default: false),
    slack: Boolean (default: false),
    discord: Boolean (default: false)
  },
  slackWebhook: String (optional),
  discordWebhook: String (optional),
  phoneNumber: String (optional),
  createdAt: Date (default: Date.now),
  lastLogin: Date,
  isActive: Boolean (default: true)
}
```

**Index:**
- `email` (unique)
- `createdAt`

### 2. Monitors (Moniteurs)

Collection pour les points de surveillance configurés.

```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: 'User', required),
  name: String (required),
  url: String (required),
  type: String (enum: ['HTTP', 'HTTPS', 'PING', 'PORT', 'KEYWORD'], required),
  interval: Number (minutes, default: 5),
  timeout: Number (seconds, default: 30),
  
  // Configuration spécifique selon le type
  keyword: String (pour type KEYWORD),
  port: Number (pour type PORT),
  method: String (GET/POST/PUT, pour HTTP/HTTPS),
  headers: Object (custom headers pour HTTP/HTTPS),
  body: String (pour POST/PUT requests),
  
  // État actuel
  status: String (enum: ['up', 'down', 'paused'], default: 'up'),
  uptime: Number (pourcentage, default: 100),
  lastCheck: Date,
  lastResponseTime: Number (milliseconds),
  lastError: String,
  
  // SSL
  sslCheck: Boolean (default: false),
  sslExpiryDate: Date,
  sslDaysRemaining: Number,
  
  // Alertes
  alertChannels: {
    email: Boolean (default: true),
    sms: Boolean (default: false),
    slack: Boolean (default: false),
    discord: Boolean (default: false)
  },
  alertThreshold: Number (consecutive failures before alert, default: 1),
  
  // Métadonnées
  createdAt: Date (default: Date.now),
  updatedAt: Date,
  tags: [String]
}
```

**Index:**
- `userId`
- `status`
- `createdAt`
- Compound: `userId + status`

### 3. CheckHistory (Historique des Vérifications)

Collection pour l'historique de toutes les vérifications effectuées.

```javascript
{
  _id: ObjectId,
  monitorId: ObjectId (ref: 'Monitor', required),
  status: String (enum: ['up', 'down'], required),
  responseTime: Number (milliseconds),
  statusCode: Number (HTTP status code),
  error: String,
  sslInfo: {
    valid: Boolean,
    expiryDate: Date,
    issuer: String
  },
  headers: Object,
  timestamp: Date (default: Date.now, indexed)
}
```

**Index:**
- `monitorId`
- `timestamp` (descending)
- Compound: `monitorId + timestamp`
- TTL: 90 jours (configurable)

### 4. Incidents (Incidents)

Collection pour tracker les pannes et incidents.

```javascript
{
  _id: ObjectId,
  monitorId: ObjectId (ref: 'Monitor', required),
  type: String (enum: ['outage', 'degraded', 'ssl_expiry'], required),
  severity: String (enum: ['critical', 'warning', 'info'], default: 'critical'),
  
  // Timing
  startTime: Date (default: Date.now),
  endTime: Date,
  duration: Number (minutes),
  
  // État
  resolved: Boolean (default: false),
  acknowledgedBy: ObjectId (ref: 'User'),
  acknowledgedAt: Date,
  
  // Notifications
  notificationsSent: [String] (channels: email, sms, etc.),
  notificationAttempts: Number (default: 0),
  
  // Détails
  details: String,
  errorLog: [String],
  affectedRegions: [String],
  
  // Post-mortem
  rootCause: String,
  resolution: String,
  preventiveMeasures: String,
  
  createdAt: Date (default: Date.now)
}
```

**Index:**
- `monitorId`
- `resolved`
- `startTime` (descending)
- Compound: `monitorId + resolved`

### 5. StatusPages (Pages de Statut)

Collection pour les pages de statut publiques/privées.

```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: 'User', required),
  slug: String (required, unique),
  title: String (required),
  description: String,
  
  // Visibilité
  isPublic: Boolean (default: true),
  password: String (hashed, pour pages privées),
  
  // Moniteurs inclus
  monitors: [ObjectId] (ref: 'Monitor'),
  monitorGroups: [{
    name: String,
    monitors: [ObjectId]
  }],
  
  // Customisation
  customDomain: String,
  branding: {
    logo: String (URL),
    favicon: String (URL),
    primaryColor: String (hex, default: '#3b82f6'),
    backgroundColor: String (hex, default: '#ffffff'),
    customCSS: String
  },
  
  // Contenu
  announcementBanner: {
    enabled: Boolean (default: false),
    message: String,
    type: String (enum: ['info', 'warning', 'error'])
  },
  
  // Statistiques
  viewCount: Number (default: 0),
  subscriberCount: Number (default: 0),
  
  // Configuration
  showIncidentHistory: Boolean (default: true),
  showUptimePercentage: Boolean (default: true),
  showResponseTime: Boolean (default: true),
  
  createdAt: Date (default: Date.now),
  updatedAt: Date
}
```

**Index:**
- `userId`
- `slug` (unique)
- `isPublic`

### 6. StatusPageSubscribers (Abonnés aux Pages de Statut)

Collection pour les abonnements aux pages de statut.

```javascript
{
  _id: ObjectId,
  statusPageId: ObjectId (ref: 'StatusPage', required),
  email: String (required),
  phone: String,
  notificationPreferences: {
    incidents: Boolean (default: true),
    maintenance: Boolean (default: true),
    resolved: Boolean (default: true)
  },
  verified: Boolean (default: false),
  verificationToken: String,
  subscribedAt: Date (default: Date.now),
  unsubscribeToken: String
}
```

**Index:**
- `statusPageId`
- Compound: `statusPageId + email` (unique)

### 7. MaintenanceWindows (Fenêtres de Maintenance)

Collection pour planifier des maintenances.

```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: 'User', required),
  monitorIds: [ObjectId] (ref: 'Monitor'),
  title: String (required),
  description: String,
  
  // Planning
  startTime: Date (required),
  endTime: Date (required),
  timezone: String (default: 'UTC'),
  
  // État
  status: String (enum: ['scheduled', 'in_progress', 'completed', 'cancelled'], default: 'scheduled'),
  
  // Notifications
  notifySubscribers: Boolean (default: true),
  notificationsSent: Boolean (default: false),
  reminderSent: Boolean (default: false),
  
  createdAt: Date (default: Date.now),
  updatedAt: Date
}
```

**Index:**
- `userId`
- `startTime`
- `status`

### 8. AlertRules (Règles d'Alerte)

Collection pour les règles d'alerte avancées.

```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: 'User', required),
  monitorId: ObjectId (ref: 'Monitor', required),
  name: String (required),
  
  // Conditions
  conditions: [{
    metric: String (enum: ['response_time', 'uptime', 'status_code', 'ssl_expiry']),
    operator: String (enum: ['>', '<', '=', '!=', '>=', '<=']),
    threshold: Number,
    duration: Number (minutes)
  }],
  
  // Actions
  actions: [{
    type: String (enum: ['email', 'sms', 'slack', 'discord', 'webhook']),
    config: Object
  }],
  
  // État
  enabled: Boolean (default: true),
  lastTriggered: Date,
  triggerCount: Number (default: 0),
  
  createdAt: Date (default: Date.now)
}
```

**Index:**
- `monitorId`
- `enabled`

### 9. APIKeys (Clés API)

Collection pour les clés API générées par les utilisateurs.

```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: 'User', required),
  name: String (required),
  key: String (hashed, required, unique),
  prefix: String (visible prefix, ex: 'uw_live_'),
  
  // Permissions
  scopes: [String] (enum: ['read', 'write', 'delete']),
  
  // Restrictions
  ipWhitelist: [String],
  rateLimit: Number (requests per hour),
  
  // État
  isActive: Boolean (default: true),
  lastUsed: Date,
  usageCount: Number (default: 0),
  
  expiresAt: Date,
  createdAt: Date (default: Date.now)
}
```

**Index:**
- `userId`
- `key` (unique)
- `isActive`

### 10. AuditLogs (Logs d'Audit)

Collection pour la traçabilité des actions utilisateurs.

```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: 'User'),
  action: String (required),
  resource: String (ex: 'monitor', 'status_page'),
  resourceId: ObjectId,
  
  // Détails
  changes: Object (before/after),
  ipAddress: String,
  userAgent: String,
  
  // Métadonnées
  timestamp: Date (default: Date.now),
  successful: Boolean (default: true),
  errorMessage: String
}
```

**Index:**
- `userId`
- `timestamp` (descending)
- `resource`
- TTL: 365 jours

## Relations entre Collections

```
User (1) ----< (N) Monitor
User (1) ----< (N) StatusPage
User (1) ----< (N) MaintenanceWindow
User (1) ----< (N) APIKey

Monitor (1) ----< (N) CheckHistory
Monitor (1) ----< (N) Incident
Monitor (1) ----< (N) AlertRule

StatusPage (1) ----< (N) StatusPageSubscriber
StatusPage (N) >----< (N) Monitor (many-to-many)

MaintenanceWindow (N) >----< (N) Monitor (many-to-many)
```

## Stratégies d'Index

### Performances
- Index sur les champs fréquemment interrogés
- Compound index pour les requêtes multi-champs
- Index sur les timestamps pour le tri

### TTL (Time To Live)
- CheckHistory: 90 jours par défaut
- AuditLogs: 365 jours par défaut
- Configuration via variables d'environnement

### Optimisations
```javascript
// Agrégations pré-calculées pour les statistiques
db.monitors.aggregate([
  {
    $lookup: {
      from: "checkhistories",
      localField: "_id",
      foreignField: "monitorId",
      as: "checks"
    }
  },
  {
    $project: {
      uptime: {
        $multiply: [
          { $divide: [
            { $size: { $filter: {
              input: "$checks",
              as: "check",
              cond: { $eq: ["$$check.status", "up"] }
            }}},
            { $size: "$checks" }
          ]},
          100
        ]
      }
    }
  }
])
```

## Backup et Maintenance

### Backup Automatique
```bash
# Backup quotidien
mongodump --db uptimewarden --out /backups/$(date +%Y%m%d)

# Restore
mongorestore --db uptimewarden /backups/20240115/uptimewarden
```

### Nettoyage
```javascript
// Nettoyer les anciennes données
db.checkhistories.deleteMany({
  timestamp: { $lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }
});
```

## Sécurité

### Chiffrement
- Mots de passe: bcrypt (10 rounds)
- Clés API: hash SHA-256
- Données sensibles: chiffrement AES-256

### Contrôle d'Accès
```javascript
// Créer un utilisateur MongoDB avec permissions limitées
db.createUser({
  user: "uptimewarden",
  pwd: "secure_password",
  roles: [
    { role: "readWrite", db: "uptimewarden" }
  ]
})
```