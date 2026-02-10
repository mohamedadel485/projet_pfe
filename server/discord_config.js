// Lire le token depuis les variables d'environnement
module.exports = {
  DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN || "",
  DISCORD_WEBHOOK_URL: process.env.DISCORD_WEBHOOK_URL || "",
  DISCORD_ALERT_CHANNEL_ID: process.env.DISCORD_ALERT_CHANNEL_ID || ""
};
