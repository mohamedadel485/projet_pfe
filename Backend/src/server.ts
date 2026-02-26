import express, { Application, NextFunction, Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { Server } from 'http';
import path from 'path';
import { connectDB } from './config/database';
import { startCleanupScheduler, startMonitorScheduler } from './config/scheduler';

// Load environment variables before importing routes/services that may read them.
const envPath = path.resolve(__dirname, '..', '.env');
// Force .env values to win over inherited shell environment values.
dotenv.config({ path: envPath, override: true });

import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import monitorRoutes from './routes/monitors';
import invitationRoutes from './routes/invitations';

const app: Application = express();
const DEFAULT_PORT = 3001;
const MAX_PORT_RETRIES = 10;
const DEFAULT_ALLOWED_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];
const LOCALHOST_ORIGIN_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

const parsePort = (rawPort: string): number => {
  const parsed = Number(rawPort);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(`PORT invalide: ${rawPort}`);
  }
  return parsed;
};

const parseAllowedOrigins = (rawValue?: string): string[] => {
  if (!rawValue || rawValue.trim() === '') {
    return DEFAULT_ALLOWED_ORIGINS;
  }

  if (rawValue.trim() === '*') {
    return ['*'];
  }

  return rawValue
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
};

const isSmtpConfigured = (): boolean => {
  const required = ['EMAIL_HOST', 'EMAIL_PORT', 'EMAIL_USER', 'EMAIL_PASSWORD', 'EMAIL_FROM'];
  return required.every((key) => {
    const value = String(process.env[key] ?? '').trim();
    if (value === '') return false;
    if (key === 'EMAIL_PASSWORD' && value === 'REPLACE_WITH_GOOGLE_APP_PASSWORD') return false;
    return true;
  });
};

const listenWithRetry = async (
  expressApp: Application,
  port: number,
  retriesLeft: number,
  canRetry: boolean
): Promise<{ server: Server; port: number }> => {
  try {
    const server = await new Promise<Server>((resolve, reject) => {
      const instance = expressApp.listen(port);

      instance.once('listening', () => {
        resolve(instance);
      });

      instance.once('error', (error: NodeJS.ErrnoException) => {
        instance.removeAllListeners('listening');
        reject(error);
      });
    });

    return { server, port };
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (canRetry && err.code === 'EADDRINUSE' && retriesLeft > 0) {
      const nextPort = port + 1;
      console.warn(`Port ${port} occupe. Nouvelle tentative sur ${nextPort}...`);
      return listenWithRetry(expressApp, nextPort, retriesLeft - 1, canRetry);
    }
    throw err;
  }
};

// Middlewares
const allowedOrigins = parseAllowedOrigins(process.env.CORS_ORIGIN);
const allowAnyLocalhostOrigin = !process.env.CORS_ORIGIN || process.env.CORS_ORIGIN.trim() === '';
const isDevelopmentLike = (process.env.NODE_ENV ?? 'development') !== 'production';

app.use(
  cors({
    origin: (origin, callback) => {
      if (
        !origin ||
        allowedOrigins.includes('*') ||
        allowedOrigins.includes(origin) ||
        ((allowAnyLocalhostOrigin || isDevelopmentLike) && LOCALHOST_ORIGIN_PATTERN.test(origin))
      ) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS refuse pour l'origine: ${origin}`));
    },
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/monitors', monitorRoutes);
app.use('/api/invitations', invitationRoutes);

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

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Route non trouvee',
    path: req.path,
  });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Erreur non geree:', err);

  if (err.message.startsWith('CORS refuse pour l\'origine:')) {
    res.status(403).json({
      error: err.message,
    });
    return;
  }

  const exposedError = isDevelopmentLike ? err.message : 'Erreur interne du serveur';
  res.status(500).json({
    error: exposedError,
    message: isDevelopmentLike ? err.message : undefined,
  });
});

const startServer = async (): Promise<void> => {
  try {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim() === '') {
      throw new Error(`JWT_SECRET manquant. Verifiez le fichier ${envPath}`);
    }

    await connectDB();
    startMonitorScheduler();
    startCleanupScheduler();

    const hasExplicitPort = process.env.PORT !== undefined;
    const requestedPort = parsePort(process.env.PORT ?? String(DEFAULT_PORT));
    const { port } = await listenWithRetry(
      app,
      requestedPort,
      MAX_PORT_RETRIES,
      !hasExplicitPort
    );

    app.set('port', port);

    if (!hasExplicitPort && port !== requestedPort) {
      console.warn(`Port ${requestedPort} indisponible, serveur lance sur ${port}.`);
    }

    console.log('');
    console.log('====================================');
    console.log(`Serveur demarre sur le port ${port}`);
    console.log(`Environnement: ${process.env.NODE_ENV || 'development'}`);
    console.log(`URL: http://localhost:${port}`);
    console.log(`SMTP configure: ${isSmtpConfigured() ? 'oui' : 'non'}`);
    console.log(
      `Fallback invitation sans email: ${String(process.env.INVITATION_ALLOW_WITHOUT_EMAIL ?? 'auto (true hors production)')}`
    );
    console.log(
      `Fallback reset password dev: ${String(process.env.ALLOW_DEV_PASSWORD_RESET_FALLBACK ?? 'false')}`
    );
    console.log('====================================');
    console.log('');
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'EADDRINUSE') {
      console.error(
        `Erreur: le port ${process.env.PORT ?? DEFAULT_PORT} est occupe. Definissez PORT avec une autre valeur.`
      );
    } else {
      console.error('Erreur lors du demarrage du serveur:', error);
    }
    process.exit(1);
  }
};

process.on('SIGTERM', () => {
  console.log('SIGTERM recu. Arret du serveur...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT recu. Arret du serveur...');
  process.exit(0);
});

startServer();

export default app;
