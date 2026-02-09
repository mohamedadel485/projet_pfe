# 🚀 Guide de Déploiement - UptimeWarden

Guide complet pour déployer UptimeWarden en production.

## 📋 Table des Matières

1. [Prérequis](#prérequis)
2. [Déploiement sur VPS/Cloud](#déploiement-sur-vpscloud)
3. [Déploiement avec Docker](#déploiement-avec-docker)
4. [Déploiement sur Heroku](#déploiement-sur-heroku)
5. [Configuration Nginx](#configuration-nginx)
6. [Configuration SSL](#configuration-ssl)
7. [Monitoring & Logs](#monitoring--logs)
8. [Sécurité](#sécurité)

---

## Prérequis

### Serveur Minimum
- **CPU**: 2 cores
- **RAM**: 2 GB
- **Disque**: 20 GB SSD
- **OS**: Ubuntu 20.04+ / Debian 11+ / CentOS 8+

### Logiciels Requis
- Node.js 16+ et npm
- MongoDB 5.0+
- Nginx (reverse proxy)
- Certbot (SSL)
- PM2 (process manager)

---

## Déploiement sur VPS/Cloud

### 1. Préparation du Serveur

```bash
# Mise à jour du système
sudo apt update && sudo apt upgrade -y

# Installation des dépendances système
sudo apt install -y curl git build-essential
```

### 2. Installation de Node.js

```bash
# Installation via NodeSource
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Vérification
node --version
npm --version
```

### 3. Installation de MongoDB

```bash
# Import de la clé GPG MongoDB
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -

# Ajout du repository
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list

# Installation
sudo apt update
sudo apt install -y mongodb-org

# Démarrage et activation
sudo systemctl start mongod
sudo systemctl enable mongod

# Vérification
sudo systemctl status mongod
```

### 4. Sécurisation de MongoDB

```bash
# Connexion à MongoDB
mongosh

# Création d'un utilisateur admin
use admin
db.createUser({
  user: "admin",
  pwd: "VotreMotDePasseSecurise123!",
  roles: [ { role: "userAdminAnyDatabase", db: "admin" } ]
})

# Création d'un utilisateur pour l'application
use uptimewarden
db.createUser({
  user: "uptimewarden_user",
  pwd: "MotDePasseApplication456!",
  roles: [ { role: "readWrite", db: "uptimewarden" } ]
})

exit
```

```bash
# Activation de l'authentification
sudo nano /etc/mongod.conf

# Ajouter/Modifier:
security:
  authorization: enabled

# Redémarrage
sudo systemctl restart mongod
```

### 5. Clonage et Configuration de l'Application

```bash
# Création d'un utilisateur dédié
sudo useradd -m -s /bin/bash uptimewarden
sudo su - uptimewarden

# Clonage du repository
git clone https://github.com/votre-username/uptimewarden.git
cd uptimewarden

# Installation des dépendances
npm install

# Configuration de l'environnement
nano .env
```

Fichier `.env` de production:
```env
NODE_ENV=production
PORT=5000

# MongoDB avec authentification
MONGODB_URI=mongodb://uptimewarden_user:MotDePasseApplication456!@localhost:27017/uptimewarden?authSource=uptimewarden

# JWT Secret (générer avec: openssl rand -base64 32)
JWT_SECRET=votre_cle_jwt_tres_securisee_32_caracteres_minimum

# Email (exemple Gmail)
EMAIL_USER=alerts@votredomaine.com
EMAIL_PASSWORD=votre_mot_de_passe_app

# Twilio (optionnel)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# Frontend URL
FRONTEND_URL=https://uptimewarden.votredomaine.com
```

### 6. Installation de PM2

```bash
# Installation globale
sudo npm install -g pm2

# Démarrage de l'application
pm2 start server.js --name uptimewarden

# Configuration du démarrage automatique
pm2 startup systemd
# Suivre les instructions affichées

pm2 save

# Vérification
pm2 status
pm2 logs uptimewarden
```

### Configuration PM2 avancée

Créer `ecosystem.config.js`:
```javascript
module.exports = {
  apps: [{
    name: 'uptimewarden',
    script: 'server.js',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production'
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    max_memory_restart: '500M',
    watch: false,
    autorestart: true
  }]
};
```

```bash
pm2 start ecosystem.config.js
pm2 save
```

---

## Configuration Nginx

### 1. Installation

```bash
sudo apt install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 2. Configuration du Reverse Proxy

```bash
sudo nano /etc/nginx/sites-available/uptimewarden
```

```nginx
# Configuration pour UptimeWarden
upstream uptimewarden_backend {
    server 127.0.0.1:5000;
    keepalive 64;
}

# Redirection HTTP vers HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name uptimewarden.votredomaine.com;
    
    # Pour Let's Encrypt
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
    
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# Configuration HTTPS
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name uptimewarden.votredomaine.com;

    # Logs
    access_log /var/log/nginx/uptimewarden.access.log;
    error_log /var/log/nginx/uptimewarden.error.log;

    # SSL Configuration (sera ajouté par Certbot)
    # ssl_certificate /etc/letsencrypt/live/uptimewarden.votredomaine.com/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/uptimewarden.votredomaine.com/privkey.pem;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json;

    # Client body size (pour les uploads)
    client_max_body_size 10M;

    # Proxy settings
    location / {
        proxy_pass http://uptimewarden_backend;
        proxy_http_version 1.1;
        
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_cache_bypass $http_upgrade;
        proxy_buffering off;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # WebSocket support
    location /ws {
        proxy_pass http://uptimewarden_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;
    }
}
```

### 3. Activation de la Configuration

```bash
# Créer le lien symbolique
sudo ln -s /etc/nginx/sites-available/uptimewarden /etc/nginx/sites-enabled/

# Tester la configuration
sudo nginx -t

# Redémarrage
sudo systemctl restart nginx
```

---

## Configuration SSL

### Installation de Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### Obtention du Certificat SSL

```bash
# Obtenir et installer le certificat
sudo certbot --nginx -d uptimewarden.votredomaine.com

# Test du renouvellement automatique
sudo certbot renew --dry-run
```

Le renouvellement automatique est configuré via cron.

---

## Déploiement avec Docker

### 1. Dockerfile

Créer `Dockerfile`:
```dockerfile
FROM node:18-alpine

# Installer les dépendances système
RUN apk add --no-cache python3 make g++

# Créer le répertoire de l'app
WORKDIR /usr/src/app

# Copier les fichiers package
COPY package*.json ./

# Installer les dépendances
RUN npm ci --only=production

# Copier le code source
COPY . .

# Exposition du port
EXPOSE 5000

# Sanity check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:5000', (r) => {if (r.statusCode == 200) process.exit(0); process.exit(1);})"

# Démarrage
CMD [ "node", "server.js" ]
```

### 2. Docker Compose

Créer `docker-compose.yml`:
```yaml
version: '3.8'

services:
  mongodb:
    image: mongo:6.0
    container_name: uptimewarden-mongo
    restart: always
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_ROOT_PASSWORD}
      MONGO_INITDB_DATABASE: uptimewarden
    volumes:
      - mongodb_data:/data/db
      - ./mongo-init.js:/docker-entrypoint-initdb.d/mongo-init.js:ro
    networks:
      - uptimewarden-network
    ports:
      - "27017:27017"

  app:
    build: .
    container_name: uptimewarden-app
    restart: always
    depends_on:
      - mongodb
    environment:
      NODE_ENV: production
      PORT: 5000
      MONGODB_URI: mongodb://uptimewarden_user:${MONGO_APP_PASSWORD}@mongodb:27017/uptimewarden?authSource=uptimewarden
      JWT_SECRET: ${JWT_SECRET}
      EMAIL_USER: ${EMAIL_USER}
      EMAIL_PASSWORD: ${EMAIL_PASSWORD}
    ports:
      - "5000:5000"
    networks:
      - uptimewarden-network
    volumes:
      - ./logs:/usr/src/app/logs

  nginx:
    image: nginx:alpine
    container_name: uptimewarden-nginx
    restart: always
    depends_on:
      - app
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
      - certbot-etc:/etc/letsencrypt
      - certbot-var:/var/lib/letsencrypt
    networks:
      - uptimewarden-network

volumes:
  mongodb_data:
    driver: local
  certbot-etc:
  certbot-var:

networks:
  uptimewarden-network:
    driver: bridge
```

### 3. Fichier d'initialisation MongoDB

Créer `mongo-init.js`:
```javascript
db = db.getSiblingDB('uptimewarden');

db.createUser({
  user: 'uptimewarden_user',
  pwd: process.env.MONGO_APP_PASSWORD,
  roles: [
    {
      role: 'readWrite',
      db: 'uptimewarden'
    }
  ]
});
```

### 4. Variables d'environnement Docker

Créer `.env`:
```env
MONGO_ROOT_PASSWORD=SuperSecureRootPassword123!
MONGO_APP_PASSWORD=AppPassword456!
JWT_SECRET=your_jwt_secret_here
EMAIL_USER=alerts@yourdomain.com
EMAIL_PASSWORD=your_email_password
```

### 5. Démarrage

```bash
# Build et démarrage
docker-compose up -d

# Vérifier les logs
docker-compose logs -f

# Arrêt
docker-compose down

# Arrêt avec suppression des volumes
docker-compose down -v
```

---

## Déploiement sur Heroku

### 1. Préparation

```bash
# Installation de Heroku CLI
curl https://cli-assets.heroku.com/install.sh | sh

# Login
heroku login
```

### 2. Création de l'Application

```bash
# Créer l'app
heroku create uptimewarden

# Ajouter MongoDB
heroku addons:create mongolab:sandbox

# Configurer les variables
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=your_jwt_secret
heroku config:set EMAIL_USER=your_email
heroku config:set EMAIL_PASSWORD=your_password
```

### 3. Procfile

Créer `Procfile`:
```
web: node server.js
```

### 4. Déploiement

```bash
git add .
git commit -m "Ready for Heroku"
git push heroku main

# Vérifier les logs
heroku logs --tail
```

---

## Monitoring & Logs

### 1. Configuration des Logs

```bash
# Créer le répertoire des logs
mkdir -p /home/uptimewarden/uptimewarden/logs

# Rotation des logs avec logrotate
sudo nano /etc/logrotate.d/uptimewarden
```

```
/home/uptimewarden/uptimewarden/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 uptimewarden uptimewarden
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
```

### 2. Monitoring avec PM2

```bash
# Dashboard PM2
pm2 monit

# Métriques détaillées
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30
```

### 3. Monitoring Système

Installation de Netdata:
```bash
bash <(curl -Ss https://my-netdata.io/kickstart.sh)
```

---

## Sécurité

### 1. Firewall (UFW)

```bash
# Installation
sudo apt install -y ufw

# Configuration
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'

# Activation
sudo ufw enable
sudo ufw status
```

### 2. Fail2Ban

```bash
# Installation
sudo apt install -y fail2ban

# Configuration
sudo nano /etc/fail2ban/jail.local
```

```ini
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true

[nginx-http-auth]
enabled = true

[nginx-noscript]
enabled = true
```

```bash
sudo systemctl restart fail2ban
```

### 3. Mises à Jour Automatiques

```bash
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

### 4. Sauvegarde Automatique MongoDB

Créer `/home/uptimewarden/backup.sh`:
```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/home/uptimewarden/backups"
mkdir -p $BACKUP_DIR

mongodump --uri="mongodb://uptimewarden_user:password@localhost:27017/uptimewarden" \
  --out="$BACKUP_DIR/$DATE"

# Garder seulement les 7 dernières sauvegardes
find $BACKUP_DIR -type d -mtime +7 -exec rm -rf {} \;
```

```bash
chmod +x /home/uptimewarden/backup.sh

# Cron quotidien à 2h du matin
crontab -e
0 2 * * * /home/uptimewarden/backup.sh
```

---

## Maintenance

### Redémarrage de l'Application

```bash
pm2 restart uptimewarden
```

### Mise à Jour

```bash
cd /home/uptimewarden/uptimewarden
git pull
npm install
pm2 restart uptimewarden
```

### Vérification de la Santé

```bash
# Status PM2
pm2 status

# Logs
pm2 logs uptimewarden --lines 100

# Métriques
pm2 monit

# Status MongoDB
sudo systemctl status mongod

# Status Nginx
sudo systemctl status nginx
```

---

## Troubleshooting

### L'application ne démarre pas

```bash
# Vérifier les logs
pm2 logs uptimewarden

# Vérifier la config
cat .env

# Tester MongoDB
mongosh --eval "db.adminCommand('ping')"
```

### Problèmes de connexion MongoDB

```bash
# Vérifier le service
sudo systemctl status mongod

# Logs MongoDB
sudo tail -f /var/log/mongodb/mongod.log

# Tester la connexion
mongosh -u uptimewarden_user -p --authenticationDatabase uptimewarden
```

### Erreurs Nginx

```bash
# Tester la configuration
sudo nginx -t

# Logs
sudo tail -f /var/log/nginx/error.log
```

---

**Note**: Adaptez toutes les configurations à votre environnement spécifique. Changez tous les mots de passe par défaut!