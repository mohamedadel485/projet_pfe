import express, { Application, Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { connectDB } from './config/database';
import { startMonitorScheduler, startCleanupScheduler } from './config/scheduler';

// Charger les variables d'environnement
dotenv.config();

// Importer les routes
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import monitorRoutes from './routes/monitors';
import invitationRoutes from './routes/invitations';

// Créer l'application Express
const app: Application = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logger pour le développement
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/monitors', monitorRoutes);
app.use('/api/invitations', invitationRoutes);

// Route de test
app.get('/', (_req: Request, res: Response) => {
  res.json({
    message: 'API Uptime Monitor',
    version: '1.0.0',
    status: 'active',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      monitors: '/api/monitors',
      invitations: '/api/invitations',
    },
  });
});

// Route de santé
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Gestion des routes non trouvées
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Route non trouvée',
    path: req.path,
  });
});

// Gestion globale des erreurs
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Erreur non gérée:', err);
  res.status(500).json({
    error: 'Erreur interne du serveur',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// Fonction de démarrage du serveur
const startServer = async (): Promise<void> => {
  try {
    // Connexion à la base de données
    await connectDB();

    // Démarrer les schedulers
    startMonitorScheduler();
    startCleanupScheduler();

    // Démarrer le serveur
    app.listen(PORT, () => {
      console.log('');
      console.log('🚀 ====================================');
      console.log(`🚀 Serveur démarré sur le port ${PORT}`);
      console.log(`🚀 Environnement: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🚀 URL: http://localhost:${PORT}`);
      console.log('🚀 ====================================');
      console.log('');
    });
  } catch (error) {
    console.error('❌ Erreur lors du démarrage du serveur:', error);
    process.exit(1);
  }
};

// Gestion de l'arrêt propre
process.on('SIGTERM', () => {
  console.log('SIGTERM reçu. Arrêt du serveur...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT reçu. Arrêt du serveur...');
  process.exit(0);
});

// Démarrer le serveur
startServer();

export default app;
