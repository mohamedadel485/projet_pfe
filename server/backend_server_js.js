require("dotenv").config();

// Discord.js pour bot Discord
const { Client, GatewayIntentBits } = require("discord.js");
const {
  DISCORD_BOT_TOKEN,
  DISCORD_WEBHOOK_URL,
  DISCORD_ALERT_CHANNEL_ID,
} = require("./discord_config");
let discordBotClient = null;
let discordBotReady = false;

function startDiscordBot() {
  if (discordBotClient) return;
  if (!DISCORD_BOT_TOKEN) {
    console.warn("DISCORD_BOT_TOKEN manquant, bot désactivé.");
    return;
  }
  discordBotClient = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });
  discordBotClient.once("ready", () => {
    discordBotReady = true;
    console.log(`Discord bot pret : ${discordBotClient.user.tag}`);
    console.log("🤖 Bot Discord prêt !");
  });
  discordBotClient.on("messageCreate", (message) => {
    if (message.author.bot) return;
    if (message.content === "ping") {
      message.reply("pong ✅");
    }
  });

  discordBotClient.login(DISCORD_BOT_TOKEN).catch((error) => {
    console.error("Erreur login Discord:", error);
  });
}
startDiscordBot();
// server.js - Backend principal de UptimeWarden
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cron = require("node-cron");
const axios = require("axios");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const { WebSocketServer } = require("ws");
const http = require("http");
const https = require("https");
const ping = require("ping");
const net = require("net");

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Configuration
const PORT = process.env.PORT || 5000;
const JWT_SECRET =
  process.env.JWT_SECRET || "your-secret-key-change-in-production";
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/uptimewarden";

// Middleware
app.use(cors());
app.use(express.json());

// Connexion MongoDB
mongoose
  .connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB connecté"))
  .catch((err) => console.error("❌ Erreur MongoDB:", err));

// ============= SCHEMAS MONGOOSE =============

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  googleId: String, // ID Google pour la connexion OAuth
  role: {
    type: String,
    enum: ["admin", "editor", "viewer"],
    default: "viewer",
  },
  notifications: {
    email: { type: Boolean, default: true },
    sms: { type: Boolean, default: false },
    slack: { type: Boolean, default: false },
    discord: { type: Boolean, default: false },
  },
  slackWebhook: String,
  discordWebhook: String,
  createdAt: { type: Date, default: Date.now },
});

const MonitorSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  name: { type: String, required: true },
  url: { type: String, required: true },
  type: {
    type: String,
    enum: ["HTTP", "HTTPS", "PING", "PORT", "KEYWORD"],
    required: true,
  },
  interval: { type: Number, default: 5 }, // minutes
  timeout: { type: Number, default: 30 }, // secondes
  keyword: String, // Pour type KEYWORD
  port: Number, // Pour type PORT
  status: { type: String, enum: ["up", "down", "paused"], default: "up" },
  uptime: { type: Number, default: 100 },
  lastCheck: Date,
  lastResponseTime: Number,
  sslCheck: { type: Boolean, default: false },
  sslExpiryDate: Date,
  region: { type: String, default: "global" },
  tags: [{ type: String }],
  alertChannels: {
    email: { type: Boolean, default: true },
    sms: { type: Boolean, default: false },
    slack: { type: Boolean, default: false },
    discord: { type: Boolean, default: false },
  },
  createdAt: { type: Date, default: Date.now },
});

const CheckHistorySchema = new mongoose.Schema({
  monitorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Monitor",
    required: true,
  },
  status: { type: String, enum: ["up", "down", "maintenance"], required: true },
  responseTime: Number,
  statusCode: Number,
  error: String,
  timestamp: { type: Date, default: Date.now },
});

// API Keys for integrations
const ApiKeySchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  name: String,
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  scopes: [String],
  revoked: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

// Maintenance windows
const MaintenanceSchema = new mongoose.Schema({
  monitorId: { type: mongoose.Schema.Types.ObjectId, ref: "Monitor" },
  title: String,
  startTime: Date,
  endTime: Date,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  description: String,
  createdAt: { type: Date, default: Date.now },
});

const IncidentSchema = new mongoose.Schema({
  monitorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Monitor",
    required: true,
  },
  type: {
    type: String,
    enum: ["outage", "degraded", "ssl_expiry"],
    required: true,
  },
  startTime: { type: Date, default: Date.now },
  endTime: Date,
  duration: Number, // minutes
  resolved: { type: Boolean, default: false },
  notificationsSent: [String],
  details: String,
});

const StatusPageSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  slug: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  description: String,
  isPublic: { type: Boolean, default: true },
  monitors: [{ type: mongoose.Schema.Types.ObjectId, ref: "Monitor" }],
  customDomain: String,
  branding: {
    logo: String,
    primaryColor: { type: String, default: "#3b82f6" },
    backgroundColor: { type: String, default: "#ffffff" },
  },
  createdAt: { type: Date, default: Date.now },
});

// Modèles
const User = mongoose.model("User", UserSchema);
const Monitor = mongoose.model("Monitor", MonitorSchema);
const CheckHistory = mongoose.model("CheckHistory", CheckHistorySchema);
const Incident = mongoose.model("Incident", IncidentSchema);
const StatusPage = mongoose.model("StatusPage", StatusPageSchema);
const ApiKey = mongoose.model("ApiKey", ApiKeySchema);
const Maintenance = mongoose.model("Maintenance", MaintenanceSchema);

// ============= MIDDLEWARE D'AUTHENTIFICATION =============

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Token non fourni" });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Token invalide" });
    req.user = user;
    next();
  });
};

// API key middleware (for private integrations)
const authenticateApiKey = async (req, res, next) => {
  try {
    const key = req.headers["x-api-key"] || req.query.api_key;
    if (!key) return res.status(401).json({ error: "API key required" });

    const apiKey = await ApiKey.findOne({ key, revoked: false });
    if (!apiKey) return res.status(403).json({ error: "Invalid API key" });

    req.apiKey = apiKey;
    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ============= SERVICES DE MONITORING =============

class MonitoringService {
  static async checkHTTP(url, timeout = 30000) {
    const startTime = Date.now();
    try {
      const response = await axios.get(url, {
        timeout,
        validateStatus: () => true,
        maxRedirects: 5,
      });

      const responseTime = Date.now() - startTime;
      const isUp = response.status >= 200 && response.status < 500;

      return {
        status: isUp ? "up" : "down",
        responseTime,
        statusCode: response.status,
        error: isUp ? null : `Status code: ${response.status}`,
      };
    } catch (error) {
      return {
        status: "down",
        responseTime: Date.now() - startTime,
        statusCode: null,
        error: error.message,
      };
    }
  }

  static async checkPing(host) {
    try {
      const startTime = Date.now();
      const res = await ping.promise.probe(host, { timeout: 10 });
      const responseTime = Date.now() - startTime;

      return {
        status: res.alive ? "up" : "down",
        responseTime: res.time || responseTime,
        error: res.alive ? null : "Host unreachable",
      };
    } catch (error) {
      return {
        status: "down",
        responseTime: 0,
        error: error.message,
      };
    }
  }

  static async checkPort(host, port, timeout = 10000) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const socket = new net.Socket();

      socket.setTimeout(timeout);

      socket.on("connect", () => {
        const responseTime = Date.now() - startTime;
        socket.destroy();
        resolve({
          status: "up",
          responseTime,
          error: null,
        });
      });

      socket.on("timeout", () => {
        socket.destroy();
        resolve({
          status: "down",
          responseTime: timeout,
          error: "Connection timeout",
        });
      });

      socket.on("error", (err) => {
        socket.destroy();
        resolve({
          status: "down",
          responseTime: Date.now() - startTime,
          error: err.message,
        });
      });

      socket.connect(port, host);
    });
  }

  static async checkKeyword(url, keyword, timeout = 30000) {
    try {
      const response = await axios.get(url, { timeout });
      const content = response.data.toString();
      const found = content.includes(keyword);

      return {
        status: found ? "up" : "down",
        responseTime: response.headers["x-response-time"] || 0,
        error: found ? null : `Keyword "${keyword}" not found`,
      };
    } catch (error) {
      return {
        status: "down",
        responseTime: 0,
        error: error.message,
      };
    }
  }

  static async checkSSL(url) {
    try {
      const urlObj = new URL(url);
      return new Promise((resolve) => {
        const options = {
          host: urlObj.hostname,
          port: 443,
          method: "GET",
          rejectUnauthorized: false,
        };

        const req = https.request(options, (res) => {
          const cert = res.socket.getPeerCertificate();
          if (cert && cert.valid_to) {
            const expiryDate = new Date(cert.valid_to);
            const daysUntilExpiry = Math.floor(
              (expiryDate - new Date()) / (1000 * 60 * 60 * 24),
            );

            resolve({
              valid: true,
              expiryDate,
              daysUntilExpiry,
              issuer: cert.issuer,
            });
          } else {
            resolve({ valid: false, error: "No certificate found" });
          }
        });

        req.on("error", (err) => {
          resolve({ valid: false, error: err.message });
        });

        req.end();
      });
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  static async performCheck(monitor) {
    let result;

    switch (monitor.type) {
      case "HTTP":
      case "HTTPS":
        result = await this.checkHTTP(monitor.url, monitor.timeout * 1000);
        break;
      case "PING":
        const host = monitor.url.replace(/^https?:\/\//, "").split("/")[0];
        result = await this.checkPing(host);
        break;
      case "PORT":
        const [portHost] = monitor.url.split(":");
        result = await this.checkPort(
          portHost,
          monitor.port,
          monitor.timeout * 1000,
        );
        break;
      case "KEYWORD":
        result = await this.checkKeyword(
          monitor.url,
          monitor.keyword,
          monitor.timeout * 1000,
        );
        break;
      default:
        result = { status: "down", error: "Unknown monitor type" };
    }

    // Vérification SSL si activée
    if (monitor.sslCheck && monitor.type === "HTTPS") {
      const sslResult = await this.checkSSL(monitor.url);
      if (sslResult.valid) {
        monitor.sslExpiryDate = sslResult.expiryDate;

        // Alerte si le certificat expire dans moins de 30 jours
        if (sslResult.daysUntilExpiry < 30) {
          await NotificationService.sendAlert(monitor, {
            type: "ssl_expiry",
            message: `Le certificat SSL expire dans ${sslResult.daysUntilExpiry} jours`,
          });
        }
      }
    }

    return result;
  }
}

// ============= SERVICE DE NOTIFICATIONS =============

class NotificationService {
  static async sendEmail(to, subject, html) {
    // Configuration du transporteur email (exemple avec Gmail)
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    try {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to,
        subject,
        html,
      });
      return { success: true };
    } catch (error) {
      console.error("Erreur email:", error);
      return { success: false, error: error.message };
    }
  }

  static async sendSlack(webhook, message) {
    try {
      await axios.post(webhook, {
        text: message,
        username: "UptimeWarden",
        icon_emoji: ":warning:",
      });
      return { success: true };
    } catch (error) {
      console.error("Erreur Slack:", error);
      return { success: false, error: error.message };
    }
  }

  static async sendDiscord(webhook, message) {
    try {
      await axios.post(webhook, {
        content: message,
        username: "UptimeWarden",
      });
      return { success: true };
    } catch (error) {
      console.error("Erreur Discord:", error);
      return { success: false, error: error.message };
    }
  }

  static async sendDiscordBot(message) {
    if (!discordBotClient || !discordBotReady) {
      console.warn("Discord bot non prÃªt, message ignorÃ©.");
      return { success: false, error: "Discord bot not ready" };
    }
    if (!DISCORD_ALERT_CHANNEL_ID) {
      return { success: false, error: "Missing DISCORD_ALERT_CHANNEL_ID" };
    }
    try {
      const channel = await discordBotClient.channels.fetch(
        DISCORD_ALERT_CHANNEL_ID,
      );
      if (!channel || !channel.send) {
        return { success: false, error: "Invalid Discord channel" };
      }
      await channel.send(message);
      return { success: true };
    } catch (error) {
      console.error("Erreur Discord bot:", error);
      return { success: false, error: error.message };
    }
  }

  static async sendAlert(monitor, incident) {
    const user = await User.findById(monitor.userId);
    if (!user) return;

    const message = `🚨 Alerte ${monitor.name}: ${incident.message || incident.error}`;

    // Email
    if (monitor.alertChannels.email && user.notifications.email) {
      await this.sendEmail(
        user.email,
        `Alerte UptimeWarden - ${monitor.name}`,
        `<h2>Alerte pour ${monitor.name}</h2>
         <p><strong>URL:</strong> ${monitor.url}</p>
         <p><strong>Statut:</strong> ${incident.type}</p>
         <p><strong>Message:</strong> ${incident.message || incident.error}</p>
         <p><strong>Heure:</strong> ${new Date().toLocaleString("fr-FR")}</p>`,
      );
    }

    // Slack (exemple - nécessite configuration webhook par utilisateur)
    if (monitor.alertChannels.slack && user.notifications.slack) {
      // await this.sendSlack(user.slackWebhook, message);
    }

    // Discord (webhook global ou par utilisateur)
    const discordWebhook = user.discordWebhook || DISCORD_WEBHOOK_URL || "";
    if (monitor.alertChannels.discord) {
      if (discordWebhook) {
        await this.sendDiscord(discordWebhook, message);
      } else if (DISCORD_ALERT_CHANNEL_ID) {
        await this.sendDiscordBot(message);
      } else {
        console.warn(
          "Discord activÃ© mais aucun webhook ni channel ID configurÃ©.",
        );
      }
    }
  }
}

// ============= SCHEDULER DE MONITORING =============

class MonitorScheduler {
  static activeMonitors = new Map();

  static async startMonitoring(monitor) {
    const cronExpression = `*/${monitor.interval} * * * *`;

    const task = cron.schedule(cronExpression, async () => {
      await this.runCheck(monitor._id);
    });

    this.activeMonitors.set(monitor._id.toString(), task);
    console.log(
      `✅ Monitoring démarré pour: ${monitor.name} (${cronExpression})`,
    );

    // Premier check immédiat
    await this.runCheck(monitor._id);
  }

  static async runCheck(monitorId) {
    try {
      const monitor = await Monitor.findById(monitorId);
      if (!monitor || monitor.status === "paused") return;

      const result = await MonitoringService.performCheck(monitor);

      // Vérifier si une période de maintenance est active pour ce moniteur
      const now = new Date();
      const activeMaintenance = await Maintenance.findOne({
        monitorId: monitor._id,
        startTime: { $lte: now },
        endTime: { $gte: now },
      });

      if (activeMaintenance) {
        // Marquer le check comme période de maintenance et ne pas affecter l'uptime
        await CheckHistory.create({
          monitorId: monitor._id,
          status: "maintenance",
          responseTime: result.responseTime,
          statusCode: result.statusCode,
          error: "maintenance",
        });

        monitor.lastCheck = now;
        monitor.lastResponseTime = result.responseTime;
        await monitor.save();

        // Envoyer mise à jour mais ne pas créer d'incident ni recalculer l'uptime
        this.broadcastUpdate(monitor);
        return;
      }

      // Enregistrement de l'historique
      await CheckHistory.create({
        monitorId: monitor._id,
        status: result.status,
        responseTime: result.responseTime,
        statusCode: result.statusCode,
        error: result.error,
      });

      // Mise à jour du moniteur
      const previousStatus = monitor.status;
      monitor.status = result.status;
      monitor.lastCheck = now;
      monitor.lastResponseTime = result.responseTime;

      // Calcul de l'uptime (basé sur les 100 derniers checks, en excluant 'maintenance')
      const recentChecks = await CheckHistory.find({ monitorId: monitor._id })
        .sort({ timestamp: -1 })
        .limit(200);

      const validChecks = recentChecks.filter(
        (c) => c.status === "up" || c.status === "down",
      );
      const upChecks = validChecks.filter((c) => c.status === "up").length;
      monitor.uptime =
        validChecks.length > 0
          ? (upChecks / validChecks.length) * 100
          : monitor.uptime;

      await monitor.save();

      // Gestion des incidents
      if (result.status === "down" && previousStatus === "up") {
        // Nouvel incident
        const incident = await Incident.create({
          monitorId: monitor._id,
          type: "outage",
          startTime: new Date(),
          details: result.error,
        });

        await NotificationService.sendAlert(monitor, {
          type: "outage",
          message: `Le service est en panne: ${result.error}`,
        });
      } else if (result.status === "up" && previousStatus === "down") {
        // Résolution d'incident
        const openIncident = await Incident.findOne({
          monitorId: monitor._id,
          resolved: false,
        }).sort({ startTime: -1 });

        if (openIncident) {
          openIncident.resolved = true;
          openIncident.endTime = new Date();
          openIncident.duration = Math.floor(
            (openIncident.endTime - openIncident.startTime) / (1000 * 60),
          );
          await openIncident.save();

          await NotificationService.sendAlert(monitor, {
            type: "resolved",
            message: `Le service est de nouveau opérationnel après ${openIncident.duration} minutes`,
          });
        }
      }

      // Envoi WebSocket aux clients connectés
      this.broadcastUpdate(monitor);
    } catch (error) {
      console.error(`Erreur lors du check ${monitorId}:`, error);
    }
  }

  static broadcastUpdate(monitor) {
    wss.clients.forEach((client) => {
      if (client.readyState === 1) {
        // WebSocket.OPEN
        client.send(
          JSON.stringify({
            type: "monitor_update",
            data: monitor,
          }),
        );
      }
    });
  }

  static stopMonitoring(monitorId) {
    const task = this.activeMonitors.get(monitorId.toString());
    if (task) {
      task.stop();
      this.activeMonitors.delete(monitorId.toString());
      console.log(`⏸️ Monitoring arrêté pour: ${monitorId}`);
    }
  }

  static async initializeAll() {
    const monitors = await Monitor.find({ status: { $ne: "paused" } });
    for (const monitor of monitors) {
      await this.startMonitoring(monitor);
    }
    console.log(`🚀 ${monitors.length} moniteurs initialisés`);
  }
}

// ============= ROUTES API =============

// Authentification
app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, password, name } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "Email déjà utilisé" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      email,
      password: hashedPassword,
      name,
    });

    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET);

    res.status(201).json({
      token,
      user: { id: user._id, email: user.email, name: user.name },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "Identifiants invalides" });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: "Identifiants invalides" });
    }

    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET);

    res.json({
      token,
      user: { id: user._id, email: user.email, name: user.name },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Authentification Google
app.post("/api/auth/google", async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: "Token Google non fourni" });
    }

    // Décoder le token Google JWT
    const parts = token.split(".");
    if (parts.length !== 3) {
      return res.status(400).json({ error: "Token invalide" });
    }

    // Décoder le payload (deuxième partie)
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");

    try {
      const jsonPayload = Buffer.from(base64, "base64").toString("utf8");
      const decoded = JSON.parse(jsonPayload);

      const { email, name, picture, sub } = decoded;

      if (!email) {
        return res.status(400).json({ error: "Email non fourni par Google" });
      }

      // Chercher ou créer l'utilisateur
      let user = await User.findOne({ email });

      if (!user) {
        // Créer un nouvel utilisateur avec un mot de passe temporaire (non utilisé)
        const tempPassword = Math.random().toString(36).slice(-32);
        const hashedPassword = await bcrypt.hash(tempPassword, 10);

        user = await User.create({
          email,
          password: hashedPassword,
          name: name || email.split("@")[0],
          googleId: sub, // Stocker l'ID Google unique
        });
      }

      // Générer un token JWT
      const jwtToken = jwt.sign(
        { id: user._id, email: user.email },
        JWT_SECRET,
      );

      res.status(200).json({
        token: jwtToken,
        user: { id: user._id, email: user.email, name: user.name },
      });
    } catch (decodeError) {
      console.error("Erreur décodage token:", decodeError);
      return res.status(400).json({ error: "Token Google invalide" });
    }
  } catch (error) {
    console.error("Erreur Google Auth:", error);
    res.status(500).json({ error: "Erreur lors de la connexion Google" });
  }
});

// Moniteurs
app.get("/api/monitors", authenticateToken, async (req, res) => {
  try {
    const monitors = await Monitor.find({ userId: req.user.id });
    res.json(monitors);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/monitors", authenticateToken, async (req, res) => {
  try {
    const monitor = await Monitor.create({
      ...req.body,
      userId: req.user.id,
    });

    await MonitorScheduler.startMonitoring(monitor);

    res.status(201).json(monitor);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/monitors/:id", authenticateToken, async (req, res) => {
  try {
    const monitor = await Monitor.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      req.body,
      { new: true },
    );

    if (!monitor) {
      return res.status(404).json({ error: "Moniteur non trouvé" });
    }

    // Redémarrer le monitoring avec la nouvelle configuration
    MonitorScheduler.stopMonitoring(monitor._id);
    await MonitorScheduler.startMonitoring(monitor);

    res.json(monitor);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/monitors/:id", authenticateToken, async (req, res) => {
  try {
    const monitor = await Monitor.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!monitor) {
      return res.status(404).json({ error: "Moniteur non trouvé" });
    }

    MonitorScheduler.stopMonitoring(monitor._id);

    // Supprimer l'historique et les incidents associés
    await CheckHistory.deleteMany({ monitorId: monitor._id });
    await Incident.deleteMany({ monitorId: monitor._id });

    res.json({ message: "Moniteur supprimé" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Historique des checks
app.get("/api/monitors/:id/history", authenticateToken, async (req, res) => {
  try {
    const { limit = 100, period = "24h" } = req.query;

    let startDate = new Date();
    if (period === "24h") startDate.setHours(startDate.getHours() - 24);
    else if (period === "7d") startDate.setDate(startDate.getDate() - 7);
    else if (period === "30d") startDate.setDate(startDate.getDate() - 30);

    const history = await CheckHistory.find({
      monitorId: req.params.id,
      timestamp: { $gte: startDate },
    })
      .sort({ timestamp: -1 })
      .limit(parseInt(limit));

    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Incidents
app.get("/api/incidents", authenticateToken, async (req, res) => {
  try {
    const monitors = await Monitor.find({ userId: req.user.id });
    const monitorIds = monitors.map((m) => m._id);

    const incidents = await Incident.find({
      monitorId: { $in: monitorIds },
    })
      .populate("monitorId")
      .sort({ startTime: -1 })
      .limit(50);

    res.json(incidents);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Pages de statut
app.post("/api/status-pages", authenticateToken, async (req, res) => {
  try {
    const statusPage = await StatusPage.create({
      ...req.body,
      userId: req.user.id,
    });
    res.status(201).json(statusPage);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/status-pages/:slug", async (req, res) => {
  try {
    const statusPage = await StatusPage.findOne({
      slug: req.params.slug,
    }).populate("monitors");

    if (!statusPage) {
      return res.status(404).json({ error: "Page de statut non trouvée" });
    }

    res.json(statusPage);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Statistiques
app.get("/api/stats", authenticateToken, async (req, res) => {
  try {
    const monitors = await Monitor.find({ userId: req.user.id });
    const monitorIds = monitors.map((m) => m._id);

    const totalChecks = await CheckHistory.countDocuments({
      monitorId: { $in: monitorIds },
    });

    const upChecks = await CheckHistory.countDocuments({
      monitorId: { $in: monitorIds },
      status: "up",
    });

    const activeIncidents = await Incident.countDocuments({
      monitorId: { $in: monitorIds },
      resolved: false,
    });

    const avgResponseTime = await CheckHistory.aggregate([
      { $match: { monitorId: { $in: monitorIds }, status: "up" } },
      { $group: { _id: null, avg: { $avg: "$responseTime" } } },
    ]);

    res.json({
      totalMonitors: monitors.length,
      upMonitors: monitors.filter((m) => m.status === "up").length,
      totalChecks,
      globalUptime:
        totalChecks > 0 ? ((upChecks / totalChecks) * 100).toFixed(2) : 0,
      avgResponseTime: avgResponseTime[0]?.avg?.toFixed(0) || 0,
      activeIncidents,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API Keys (create/list/revoke)
app.post("/api/apikeys", authenticateToken, async (req, res) => {
  try {
    const { name, scopes = [] } = req.body;
    const key = crypto.randomBytes(32).toString("hex");

    const apiKey = await ApiKey.create({
      key,
      name,
      scopes,
      userId: req.user.id,
    });

    // Return the raw key once
    res.status(201).json({
      id: apiKey._id,
      key: apiKey.key,
      name: apiKey.name,
      scopes: apiKey.scopes,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/apikeys", authenticateToken, async (req, res) => {
  try {
    const keys = await ApiKey.find({ userId: req.user.id }).select(
      "_id name scopes revoked createdAt",
    );
    res.json(keys);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/apikeys/:id", authenticateToken, async (req, res) => {
  try {
    const key = await ApiKey.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });
    if (!key) return res.status(404).json({ error: "API key non trouvée" });
    key.revoked = true;
    await key.save();
    res.json({ message: "API key révoquée" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Maintenance windows
app.post("/api/maintenances", authenticateToken, async (req, res) => {
  try {
    const { monitorId, title, startTime, endTime, description } = req.body;
    const m = await Maintenance.create({
      monitorId,
      title,
      startTime,
      endTime,
      description,
      createdBy: req.user.id,
    });
    res.status(201).json(m);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/maintenances", authenticateToken, async (req, res) => {
  try {
    // Return maintenances for monitors owned by the user
    const monitors = await Monitor.find({ userId: req.user.id }).select("_id");
    const monitorIds = monitors.map((m) => m._id);
    const list = await Maintenance.find({
      monitorId: { $in: monitorIds },
    }).sort({ startTime: -1 });
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/maintenances/:id", authenticateToken, async (req, res) => {
  try {
    const m = await Maintenance.findById(req.params.id);
    if (!m) return res.status(404).json({ error: "Maintenance non trouvée" });
    // Allow delete if owner or admin
    if (String(m.createdBy) !== String(req.user.id)) {
      const user = await User.findById(req.user.id);
      if (!user || user.role !== "admin")
        return res.status(403).json({ error: "Non autorisé" });
    }
    await m.remove();
    res.json({ message: "Maintenance supprimée" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Public JSON status endpoint (optionally filtered by status page slug)
app.get("/api/public/status", async (req, res) => {
  try {
    const { slug } = req.query;
    let monitorsList = [];
    if (slug) {
      const page = await StatusPage.findOne({ slug }).populate("monitors");
      if (!page)
        return res.status(404).json({ error: "Status page non trouvée" });
      monitorsList = page.monitors.map((m) => ({
        id: m._id,
        name: m.name,
        status: m.status,
        uptime: m.uptime,
        responseTime: m.lastResponseTime,
        region: m.region,
      }));
    } else {
      const mons = await Monitor.find({}).select(
        "name status uptime lastResponseTime region type url lastCheck",
      );
      monitorsList = mons.map((m) => ({
        id: m._id,
        name: m.name,
        status: m.status,
        uptime: m.uptime,
        responseTime: m.lastResponseTime,
        region: m.region,
      }));
    }

    const openIncidents = await Incident.find({ resolved: false })
      .populate("monitorId")
      .limit(50);

    const overall = monitorsList.some((m) => m.status === "down")
      ? "degraded"
      : "operational";

    res.json({
      status: overall,
      monitors: monitorsList,
      incidents: openIncidents,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// WebSocket pour les mises à jour en temps réel
wss.on("connection", (ws) => {
  console.log("✅ Nouveau client WebSocket connecté");

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);
      // Traiter les messages du client si nécessaire
    } catch (error) {
      console.error("Erreur WebSocket:", error);
    }
  });

  ws.on("close", () => {
    console.log("❌ Client WebSocket déconnecté");
  });
});

// Route racine
app.get("/", (req, res) => {
  res.json({
    name: "UptimeWarden API",
    version: "1.0.0",
    status: "operational",
  });
});

// Démarrage du serveur
server.listen(PORT, async () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);

  // Initialiser tous les moniteurs actifs
  await MonitorScheduler.initializeAll();
});

// Gestion propre de l'arrêt
process.on("SIGINT", () => {
  console.log("\n⏹️ Arrêt du serveur...");
  MonitorScheduler.activeMonitors.forEach((task, id) => {
    task.stop();
  });
  process.exit(0);
});
