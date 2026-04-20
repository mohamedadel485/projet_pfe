import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import { authenticate, AuthRequest } from '../middleware/auth';
import StatusPage from '../models/StatusPage';
import Monitor from '../models/Monitor';
import MonitorLog from '../models/MonitorLog';
import Incident from '../models/Incident';

const router = Router();

const SALT_ROUNDS = 10;
const generateStatusPageId = (): string =>
  `status-page-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const normalizeMonitorIds = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .filter((monitorId): monitorId is string => typeof monitorId === 'string')
        .map((monitorId) => monitorId.trim())
        .filter((monitorId) => monitorId !== '')
    )
  );
};

const buildPublicStatusPagePayload = async (statusPage: {
  statusPageId: string;
  pageName: string;
  passwordEnabled: boolean;
  monitorIds: string[];
  owner: unknown;
  customDomain?: string;
  logoName?: string;
  density?: 'wide' | 'compact';
  alignment?: 'left' | 'center';
}) => {
  const monitors = await Monitor.find({
    _id: { $in: statusPage.monitorIds },
    owner: statusPage.owner,
  }).sort({ createdAt: -1 });

  const monitorIds = monitors.map((monitor) => monitor._id.toString());
  const [rawLogs, rawIncidents] = await Promise.all([
    MonitorLog.find({ monitor: { $in: monitorIds } })
      .sort({ checkedAt: -1 })
      .limit(500)
      .lean(),
    Incident.find({ monitor: { $in: monitorIds } })
      .sort({ startedAt: -1 })
      .limit(500)
      .lean(),
  ]);

  const logsByMonitorId: Record<string, unknown[]> = {};
  for (const monitorId of monitorIds) {
    logsByMonitorId[monitorId] = rawLogs.filter((log) => String(log.monitor) === monitorId);
  }

  const incidentsByMonitorId: Record<string, unknown[]> = {};
  for (const monitorId of monitorIds) {
    incidentsByMonitorId[monitorId] = rawIncidents
      .filter((incident) => String(incident.monitor) === monitorId)
      .map((incident) => ({
        _id: incident._id,
        monitor: incident.monitor,
        status: incident.status === 'ongoing' ? 'down' : 'up',
        responseTime: 0,
        errorMessage: incident.errorMessage,
        checkedAt: incident.lastCheckedAt,
        startedAt: incident.startedAt,
        resolvedAt: incident.resolvedAt,
        durationMs: incident.durationMs,
      }));
  }

  return {
    statusPage: {
      id: statusPage.statusPageId,
      pageName: statusPage.pageName,
      passwordEnabled: statusPage.passwordEnabled,
      monitors,
      customDomain: statusPage.customDomain,
      logoName: statusPage.logoName,
      density: statusPage.density,
      alignment: statusPage.alignment,
    },
    logsByMonitorId,
    incidentsByMonitorId,
  };
};

const buildPublicPayloadFromSingleMonitor = async (monitor: {
  _id: unknown;
  name: string;
  owner: unknown;
}): Promise<{
  statusPage: {
    id: string;
    pageName: string;
    passwordEnabled: boolean;
    monitors: unknown[];
    customDomain?: string;
    logoName?: string;
    density?: 'wide' | 'compact';
    alignment?: 'left' | 'center';
  };
  logsByMonitorId: Record<string, unknown[]>;
  incidentsByMonitorId: Record<string, unknown[]>;
}> => {
  const fullMonitor = await Monitor.findById(monitor._id);
  if (!fullMonitor) {
    throw new Error('Monitor non trouve');
  }

  const monitorId = fullMonitor._id.toString();
  const [rawLogs, rawIncidents] = await Promise.all([
    MonitorLog.find({ monitor: monitorId }).sort({ checkedAt: -1 }).limit(500).lean(),
    Incident.find({ monitor: monitorId }).sort({ startedAt: -1 }).limit(500).lean(),
  ]);

  const incidents = rawIncidents.map((incident) => ({
    _id: incident._id,
    monitor: incident.monitor,
    status: incident.status === 'ongoing' ? 'down' : 'up',
    responseTime: 0,
    errorMessage: incident.errorMessage,
    checkedAt: incident.lastCheckedAt,
    startedAt: incident.startedAt,
    resolvedAt: incident.resolvedAt,
    durationMs: incident.durationMs,
  }));

  return {
    statusPage: {
      id: monitorId,
      pageName: fullMonitor.name,
      passwordEnabled: false,
      monitors: [fullMonitor],
      density: 'wide',
      alignment: 'left',
    },
    logsByMonitorId: { [monitorId]: rawLogs },
    incidentsByMonitorId: { [monitorId]: incidents },
  };
};

router.put(
  '/:id',
  authenticate,
  [
    body('pageName').notEmpty().trim(),
    body('monitorIds').isArray(),
    body('passwordEnabled').optional().isBoolean(),
    body('password').optional().isString(),
    body('customDomain').optional().isString(),
    body('logoName').optional().isString(),
    body('density').optional().isIn(['wide', 'compact']),
    body('alignment').optional().isIn(['left', 'center']),
  ],
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const statusPageId = String(req.params.id ?? '').trim();
      if (!statusPageId) {
        res.status(400).json({ error: 'Identifiant de status page invalide' });
        return;
      }

      const monitorIds = normalizeMonitorIds(req.body.monitorIds);
      const ownedMonitors = await Monitor.find({
        _id: { $in: monitorIds },
        owner: req.user!._id,
      }).select('_id');
      const ownedMonitorIdSet = new Set(ownedMonitors.map((monitor) => monitor._id.toString()));
      const allowedMonitorIds = monitorIds.filter((monitorId) => ownedMonitorIdSet.has(monitorId));

      const passwordEnabled = Boolean(req.body.passwordEnabled);
      const rawPassword = typeof req.body.password === 'string' ? req.body.password.trim() : '';
      if (passwordEnabled && rawPassword === '') {
        res.status(400).json({ error: 'Mot de passe requis quand la protection est activee' });
        return;
      }

      const nextPageName = String(req.body.pageName ?? '').trim();
      const nextCustomDomain = typeof req.body.customDomain === 'string' ? req.body.customDomain.trim() : '';
      const nextLogoName = typeof req.body.logoName === 'string' ? req.body.logoName.trim() : '';
      const nextDensity = req.body.density === 'compact' ? 'compact' : 'wide';
      const nextAlignment = req.body.alignment === 'center' ? 'center' : 'left';

      const existing = await StatusPage.findOne({
        statusPageId,
        owner: req.user!._id,
      });
      const nextPasswordHash = passwordEnabled
        ? rawPassword
          ? await bcrypt.hash(rawPassword, SALT_ROUNDS)
          : existing?.passwordHash
        : undefined;

      const existingStatusPage = await StatusPage.findOne({ statusPageId });
      let resolvedStatusPageId = statusPageId;

      if (existingStatusPage && String(existingStatusPage.owner) !== String(req.user!._id)) {
        // Prevent cross-user collisions when a client-generated id already exists for another account.
        do {
          resolvedStatusPageId = generateStatusPageId();
          // eslint-disable-next-line no-await-in-loop
        } while (await StatusPage.exists({ statusPageId: resolvedStatusPageId }));
      }

      const statusPage = await StatusPage.findOneAndUpdate(
        { statusPageId: resolvedStatusPageId, owner: req.user!._id },
        {
          $set: {
            pageName: nextPageName,
            monitorIds: allowedMonitorIds,
            passwordEnabled,
            passwordHash: nextPasswordHash,
            customDomain: nextCustomDomain || undefined,
            logoName: nextLogoName || undefined,
            density: nextDensity,
            alignment: nextAlignment,
          },
          $setOnInsert: {
            statusPageId: resolvedStatusPageId,
            owner: req.user!._id,
          },
        },
        { upsert: true, new: true }
      );

      res.json({
        message: 'Status page sauvegardee avec succes',
        statusPage: {
          id: statusPage.statusPageId,
          pageName: statusPage.pageName,
          monitorIds: statusPage.monitorIds,
          passwordEnabled: statusPage.passwordEnabled,
          customDomain: statusPage.customDomain,
          logoName: statusPage.logoName,
          density: statusPage.density,
          alignment: statusPage.alignment,
        },
      });
    } catch (error) {
      console.error('Erreur sauvegarde status page:', error);
      res.status(500).json({ error: 'Erreur lors de la sauvegarde de la status page' });
    }
  }
);

router.delete(
  '/:id',
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const statusPageId = String(req.params.id ?? '').trim();
      const deleted = await StatusPage.findOneAndDelete({
        statusPageId,
        owner: req.user!._id,
      });

      if (!deleted) {
        res.status(404).json({ error: 'Status page non trouvee' });
        return;
      }

      res.json({ message: 'Status page supprimee avec succes' });
    } catch (error) {
      console.error('Erreur suppression status page:', error);
      res.status(500).json({ error: 'Erreur lors de la suppression de la status page' });
    }
  }
);

router.get('/:id/public', async (req: Request, res: Response): Promise<void> => {
  try {
    const statusPageId = String(req.params.id ?? '').trim();
    const statusPage = await StatusPage.findOne({ statusPageId }).lean();

    if (!statusPage) {
      // Backward compatibility: older frontend links can point to monitor id directly.
      const monitorFallback = await Monitor.findById(statusPageId).lean();
      if (!monitorFallback) {
        res.status(404).json({ error: 'Status page non trouvee' });
        return;
      }

      const monitorPayload = await buildPublicPayloadFromSingleMonitor(monitorFallback);
      res.json(monitorPayload);
      return;
    }

    if (statusPage.passwordEnabled) {
      res.status(401).json({ error: 'Status page protegee par mot de passe' });
      return;
    }

    const payload = await buildPublicStatusPagePayload(statusPage);
    res.json(payload);
  } catch (error) {
    console.error('Erreur recuperation status page publique:', error);
    res.status(500).json({ error: 'Erreur lors de la recuperation de la status page publique' });
  }
});

router.post(
  '/:id/unlock',
  [body('password').isString()],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const statusPageId = String(req.params.id ?? '').trim();
      const password = String(req.body.password ?? '');
      const statusPage = await StatusPage.findOne({ statusPageId });

      if (!statusPage) {
        res.status(404).json({ error: 'Status page non trouvee' });
        return;
      }

      if (!statusPage.passwordEnabled) {
        const payload = await buildPublicStatusPagePayload(statusPage);
        res.json(payload);
        return;
      }

      if (!statusPage.passwordHash) {
        res.status(401).json({ error: 'Mot de passe invalide' });
        return;
      }

      const validPassword = await bcrypt.compare(password, statusPage.passwordHash);
      if (!validPassword) {
        res.status(401).json({ error: 'Mot de passe invalide' });
        return;
      }

      const payload = await buildPublicStatusPagePayload(statusPage);
      res.json(payload);
    } catch (error) {
      console.error('Erreur unlock status page:', error);
      res.status(500).json({ error: 'Erreur lors du deblocage de la status page' });
    }
  }
);

export default router;
