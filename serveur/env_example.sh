# Configuration du serveur
PORT=5000
NODE_ENV=development

# Base de données MongoDB
MONGODB_URI=mongodb://localhost:27017/uptimewarden

# JWT Secret (générer une clé aléatoire sécurisée pour la production)
JWT_SECRET=votre-cle-secrete-tres-longue-et-aleatoire-changez-moi

# Configuration Email (Gmail exemple)
EMAIL_USER=votre-email@gmail.com
EMAIL_PASSWORD=votre-mot-de-passe-app

# Configuration SMS (Twilio exemple)
TWILIO_ACCOUNT_SID=votre-account-sid
TWILIO_AUTH_TOKEN=votre-auth-token
TWILIO_PHONE_NUMBER=+1234567890

# Configuration Slack (optionnel)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# Configuration Discord (optionnel)
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR/WEBHOOK/URL

# Limites de monitoring
MAX_MONITORS_PER_USER=50
MIN_CHECK_INTERVAL=1
MAX_CHECK_INTERVAL=1440

# Frontend URL (pour CORS)
FRONTEND_URL=http://localhost:3000