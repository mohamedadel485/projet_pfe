import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import path from 'path';
import { AuthRequest } from '../middleware/auth';
import { uploadsRoot } from '../middleware/upload';
import StatusPage from '../models/StatusPage';
import Monitor from '../models/Moniteur';
import MonitorLog from '../models/MonitorLog';
import Incident from '../models/Incident';
import Utilisateur from '../models/Utilisateur';
import { getAuthTokenFromRequest, jwtSecret } from '../utils/authTokenHelpers';

const SALT_ROUNDS = 10;

const generateStatusPageId = (): string =>
  `status-page-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const collectCoveredMonitorIds = (
  statusPages: Array<{ statusPageId?: string; monitorIds?: string[] }>,
  ownedMonitorIds: Set<string>,
): Set<string> => {
  const coveredMonitorIds = new Set<string>();

  for (const statusPage of statusPages) {
    const statusPageId = typeof statusPage.statusPageId === 'string' ? statusPage.statusPageId.trim() : '';
    if (statusPageId !== '' && ownedMonitorIds.has(statusPageId)) {
      coveredMonitorIds.add(statusPageId);
    }

    for (const monitorId of statusPage.monitorIds ?? []) {
      if (typeof monitorId !== 'string') continue;
      const trimmedMonitorId = monitorId.trim();
      if (trimmedMonitorId !== '') {
        coveredMonitorIds.add(trimmedMonitorId);
      }
    }
  }

  return coveredMonitorIds;
};

const generateUniqueStatusPageId = async (): Promise<string> => {
  let statusPageId = generateStatusPageId();
  while (await StatusPage.exists({ statusPageId })) {
    statusPageId = generateStatusPageId();
  }
  return statusPageId;
};

export const ensureStatusPageForMonitor = async (
  monitor: { _id: unknown; name?: string },
  ownerId: unknown,
): Promise<void> => {
  const monitorId = String(monitor._id ?? '').trim();
  if (!monitorId) return;

  const pageName = String(monitor.name ?? '').trim() || 'Status page';

  const legacyPage = await StatusPage.findOne({
    owner: ownerId,
    statusPageId: monitorId,
  });

  if (legacyPage) {
    const linkedMonitorIds = Array.isArray(legacyPage.monitorIds)
      ? legacyPage.monitorIds.map((id) => String(id).trim()).filter(Boolean)
      : [];

    if (!linkedMonitorIds.includes(monitorId)) {
      await StatusPage.updateOne(
        { _id: legacyPage._id },
        { $set: { pageName, monitorIds: [monitorId] } },
      );
    }
    return;
  }

  const alreadyLinked = await StatusPage.exists({
    owner: ownerId,
    monitorIds: monitorId,
  });

  if (alreadyLinked) return;

  const statusPageId = await generateUniqueStatusPageId();

  await StatusPage.create({
    statusPageId,
    owner: ownerId,
    pageName,
    monitorIds: [monitorId],
    passwordEnabled: false,
    isPublished: false,
    density: 'wide',
    alignment: 'left',
  });
};

export const ensureStatusPagesForOwnedMonitors = async (ownerId: unknown): Promise<void> => {
  const [monitors, statusPages] = await Promise.all([
    Monitor.find({ owner: ownerId }).select('_id name').lean(),
    StatusPage.find({ owner: ownerId }).select('statusPageId monitorIds').lean(),
  ]);

  if (monitors.length === 0) return;

  const ownedMonitorIds = new Set(monitors.map((monitor) => monitor._id.toString()));
  const coveredMonitorIds = collectCoveredMonitorIds(statusPages, ownedMonitorIds);

  const repairLegacyPages: Array<Promise<unknown>> = [];
  for (const statusPage of statusPages) {
    const statusPageId = typeof statusPage.statusPageId === 'string' ? statusPage.statusPageId.trim() : '';
    if (statusPageId === '' || !ownedMonitorIds.has(statusPageId)) continue;

    const monitorIds = Array.isArray(statusPage.monitorIds)
      ? statusPage.monitorIds.filter((monitorId): monitorId is string => typeof monitorId === 'string')
      : [];

    if (monitorIds.includes(statusPageId)) continue;

    repairLegacyPages.push(
      StatusPage.updateOne(
        { owner: ownerId, statusPageId },
        { $addToSet: { monitorIds: statusPageId } },
      ),
    );
  }

  if (repairLegacyPages.length > 0) {
    await Promise.all(repairLegacyPages);
    coveredMonitorIds.clear();
    const refreshedStatusPages = await StatusPage.find({ owner: ownerId })
      .select('statusPageId monitorIds')
      .lean();
    collectCoveredMonitorIds(refreshedStatusPages, ownedMonitorIds).forEach((monitorId) => {
      coveredMonitorIds.add(monitorId);
    });
  }

  const missingMonitors = monitors.filter((monitor) => !coveredMonitorIds.has(monitor._id.toString()));

  await Promise.all(
    missingMonitors.map((monitor) => ensureStatusPageForMonitor(monitor, ownerId)),
  );
};

const normalizeMonitorIds = (value: unknown): string[] => {
  let normalizedValue = value;

  if (typeof normalizedValue === 'string') {
    const trimmedValue = normalizedValue.trim();
    if (trimmedValue === '') return [];

    try {
      normalizedValue = JSON.parse(trimmedValue);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(normalizedValue)) return [];

  return Array.from(
    new Set(
      normalizedValue
        .filter((monitorId): monitorId is string => typeof monitorId === 'string')
        .map((monitorId) => monitorId.trim())
        .filter((monitorId) => monitorId !== '')
    )
  );
};

const parseBooleanField = (value: unknown): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalizedValue = value.trim().toLowerCase();
    return normalizedValue === 'true' || normalizedValue === '1' || normalizedValue === 'yes';
  }

  return false;
};

const getRequestBaseUrl = (req: Request): string => `${req.protocol}://${req.get('host')}`;

const resolvePublicAssetUrl = (baseUrl: string, assetPath?: string): string | undefined => {
  if (typeof assetPath !== 'string') return undefined;

  const trimmedAssetPath = assetPath.trim();
  if (trimmedAssetPath === '') return undefined;

  if (/^https?:\/\//i.test(trimmedAssetPath)) {
    return trimmedAssetPath;
  }

  try {
    return new URL(trimmedAssetPath, baseUrl).toString();
  } catch {
    return trimmedAssetPath;
  }
};

const resolveStoredLogoFilePath = (logoPath?: string | null): string | null => {
  if (typeof logoPath !== 'string') return null;

  const trimmedLogoPath = logoPath.trim();
  if (trimmedLogoPath === '') return null;

  const pathname = /^https?:\/\//i.test(trimmedLogoPath)
    ? (() => {
        try {
          return new URL(trimmedLogoPath).pathname;
        } catch {
          return '';
        }
      })()
    : trimmedLogoPath;

  if (pathname === '') return null;

  const relativePath = pathname.replace(/^\/?uploads\//, '');
  if (relativePath === pathname) return null;

  return path.join(uploadsRoot, relativePath);
};

const deleteStoredStatusPageLogoFile = (logoPath?: string | null): void => {
  const logoFilePath = resolveStoredLogoFilePath(logoPath);
  if (!logoFilePath) return;

  try {
    if (fs.existsSync(logoFilePath)) {
      fs.unlinkSync(logoFilePath);
    }
  } catch {
    // Ignore file removal failures to keep the API resilient.
  }
};

const getOptionalAuthenticatedUser = async (req: Request) => {
  const token = getAuthTokenFromRequest(req);
  if (!token || !jwtSecret) return null;

  try {
    const decoded = jwt.verify(token, jwtSecret) as { userId?: string };
    if (typeof decoded !== 'object' || decoded === null || typeof decoded.userId !== 'string') {
      return null;
    }

    const user = await Utilisateur.findById(decoded.userId).select('-password');
    if (!user || !user.isActive) {
      return null;
    }

    return user;
  } catch {
    return null;
  }
};

const buildPublicStatusPagePayload = async (statusPage: {
  statusPageId: string;
  pageName: string;
  passwordEnabled: boolean;
  monitorIds: string[];
  owner: unknown;
  customDomain?: string;
  logoName?: string;
  logoPath?: string;
  density?: 'wide' | 'compact';
  alignment?: 'left' | 'center';
  isPublished?: boolean;
}, baseUrl: string) => {
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
      isPublished: statusPage.isPublished ?? true,
      monitors,
      viewerCanBypassPassword: false,
      customDomain: statusPage.customDomain,
      logoName: statusPage.logoName,
      logoUrl: resolvePublicAssetUrl(baseUrl, statusPage.logoPath),
      density: statusPage.density,
      alignment: statusPage.alignment,
    },
    logsByMonitorId,
    incidentsByMonitorId,
  };
};

const buildPublicStatusPagePreviewPayload = (
  statusPage: {
    statusPageId: string;
    pageName: string;
    passwordEnabled: boolean;
    customDomain?: string;
    logoName?: string;
    logoPath?: string;
    density?: 'wide' | 'compact';
    alignment?: 'left' | 'center';
    isPublished?: boolean;
  },
  baseUrl: string,
) => ({
  statusPage: {
    id: statusPage.statusPageId,
    pageName: statusPage.pageName,
    passwordEnabled: true,
    isPublished: statusPage.isPublished ?? true,
    monitors: [],
    viewerCanBypassPassword: false,
    customDomain: statusPage.customDomain,
    logoName: statusPage.logoName,
    logoUrl: resolvePublicAssetUrl(baseUrl, statusPage.logoPath),
    density: statusPage.density,
    alignment: statusPage.alignment,
  },
  logsByMonitorId: {},
  incidentsByMonitorId: {},
});

const buildPublicPayloadFromSingleMonitor = async (monitor: {
  _id: unknown;
  name: string;
  owner: unknown;
}): Promise<{
  statusPage: {
    id: string;
    pageName: string;
    passwordEnabled: boolean;
    isPublished: boolean;
    monitors: unknown[];
    viewerCanBypassPassword: boolean;
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
      isPublished: true,
      monitors: [fullMonitor],
      viewerCanBypassPassword: false,
      density: 'wide',
      alignment: 'left',
    },
    logsByMonitorId: { [monitorId]: rawLogs },
    incidentsByMonitorId: { [monitorId]: incidents },
  };
};

const statusPageController = {
  upsert: async (req: AuthRequest, res: Response): Promise<void> => {
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

      const passwordEnabled = parseBooleanField(req.body.passwordEnabled);
      const rawPassword = typeof req.body.password === 'string' ? req.body.password.trim() : '';

      const nextPageName = String(req.body.pageName ?? '').trim();
      const nextCustomDomain = typeof req.body.customDomain === 'string' ? req.body.customDomain.trim() : '';
      const nextDensity = req.body.density === 'compact' ? 'compact' : 'wide';
      const nextAlignment = req.body.alignment === 'center' ? 'center' : 'left';
      const nextIsPublished =
        req.body.isPublished === undefined ? undefined : parseBooleanField(req.body.isPublished);
      const uploadedLogo = req.file as { originalname?: string; filename?: string } | undefined;

      const existing = await StatusPage.findOne({
        statusPageId,
        owner: req.user!._id,
      });

      if (passwordEnabled && rawPassword === '' && !existing?.passwordHash) {
        res.status(400).json({ error: 'Mot de passe requis quand la protection est activee' });
        return;
      }
      const nextPasswordHash = passwordEnabled
        ? rawPassword
          ? await bcrypt.hash(rawPassword, SALT_ROUNDS)
          : existing?.passwordHash
        : undefined;
      const nextLogoNameCandidate =
        typeof req.body.logoName === 'string' ? req.body.logoName.trim() : '';
      const nextLogoName =
        nextLogoNameCandidate !== ''
          ? nextLogoNameCandidate
          : uploadedLogo
            ? uploadedLogo.originalname?.trim() || uploadedLogo.filename?.trim() || existing?.logoName
            : existing?.logoName;
      let nextLogoPath = existing?.logoPath;

      if (uploadedLogo?.filename) {
        nextLogoPath = `/uploads/status-pages/${uploadedLogo.filename}`;
      }

      const existingStatusPage = await StatusPage.findOne({ statusPageId });
      let resolvedStatusPageId = statusPageId;

      if (existingStatusPage && String(existingStatusPage.owner) !== String(req.user!._id)) {
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
            logoPath: nextLogoPath || undefined,
            density: nextDensity,
            alignment: nextAlignment,
            ...(nextIsPublished === undefined ? {} : { isPublished: nextIsPublished }),
          },
          $setOnInsert: {
            statusPageId: resolvedStatusPageId,
            owner: req.user!._id,
          },
        },
        { upsert: true, new: true }
      );

      if (uploadedLogo?.filename && existing?.logoPath && existing.logoPath !== statusPage.logoPath) {
        deleteStoredStatusPageLogoFile(existing.logoPath);
      }

      res.json({
        message: 'Status page sauvegardee avec succes',
        statusPage: {
          id: statusPage.statusPageId,
          pageName: statusPage.pageName,
          monitorIds: statusPage.monitorIds,
          passwordEnabled: statusPage.passwordEnabled,
          isPublished: statusPage.isPublished ?? true,
          customDomain: statusPage.customDomain,
          logoName: statusPage.logoName,
          logoUrl: resolvePublicAssetUrl(getRequestBaseUrl(req), statusPage.logoPath),
          density: statusPage.density,
          alignment: statusPage.alignment,
        },
      });
    } catch (error) {
      console.error('Erreur sauvegarde status page:', error);
      res.status(500).json({ error: 'Erreur lors de la sauvegarde de la status page' });
    }
  },

  list: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      await ensureStatusPagesForOwnedMonitors(req.user!._id);

      const statusPages = await StatusPage.find({ owner: req.user!._id })
        .sort({ updatedAt: -1 })
        .lean();

      const baseUrl = getRequestBaseUrl(req);

      res.json({
        statusPages: statusPages.map((statusPage) => ({
          id: statusPage.statusPageId,
          pageName: statusPage.pageName,
          monitorIds: statusPage.monitorIds,
          passwordEnabled: statusPage.passwordEnabled,
          isPublished: statusPage.isPublished ?? true,
          customDomain: statusPage.customDomain,
          logoName: statusPage.logoName,
          logoUrl: resolvePublicAssetUrl(baseUrl, statusPage.logoPath),
          density: statusPage.density,
          alignment: statusPage.alignment,
          updatedAt: statusPage.updatedAt,
        })),
      });
    } catch (error) {
      console.error('Erreur recuperation status pages:', error);
      res.status(500).json({ error: 'Erreur lors de la recuperation des status pages' });
    }
  },

  delete: async (req: AuthRequest, res: Response): Promise<void> => {
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

      deleteStoredStatusPageLogoFile((deleted as { logoPath?: string | null }).logoPath);

      res.json({ message: 'Status page supprimee avec succes' });
    } catch (error) {
      console.error('Erreur suppression status page:', error);
      res.status(500).json({ error: 'Erreur lors de la suppression de la status page' });
    }
  },

  setPublished: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const statusPageId = String(req.params.id ?? '').trim();
      const isPublished = parseBooleanField(req.body.isPublished);
      const statusPage = await StatusPage.findOneAndUpdate(
        { statusPageId, owner: req.user!._id },
        { $set: { isPublished } },
        { new: true },
      );

      if (!statusPage) {
        res.status(404).json({ error: 'Status page non trouvee' });
        return;
      }

      res.json({
        message: isPublished ? 'Status page publiee avec succes' : 'Status page depubliee avec succes',
        statusPage: {
          id: statusPage.statusPageId,
          isPublished: statusPage.isPublished ?? true,
        },
      });
    } catch (error) {
      console.error('Erreur publication status page:', error);
      res.status(500).json({ error: 'Erreur lors de la mise a jour du statut de publication' });
    }
  },

  getPublic: async (req: Request, res: Response): Promise<void> => {
    try {
      const statusPageId = String(req.params.id ?? '').trim();
      const statusPage = await StatusPage.findOne({ statusPageId }).lean();
      const viewerUser = await getOptionalAuthenticatedUser(req);

      if (!statusPage) {
        const monitorFallback = await Monitor.findById(statusPageId).lean();
        if (!monitorFallback) {
          res.status(404).json({ error: 'Status page non trouvee' });
          return;
        }

        const monitorPayload = await buildPublicPayloadFromSingleMonitor(monitorFallback);
        res.json(monitorPayload);
        return;
      }

      const viewerIsOwner = viewerUser
        ? String(viewerUser._id) === String(statusPage.owner)
        : false;

      if (statusPage.isPublished === false && !viewerIsOwner) {
        res.status(410).json({ error: 'Status page non publiee' });
        return;
      }

      if (statusPage.passwordEnabled) {
        if (viewerIsOwner) {
          const payload = await buildPublicStatusPagePayload(
            statusPage,
            getRequestBaseUrl(req),
          );
          payload.statusPage.viewerCanBypassPassword = true;
          res.json(payload);
          return;
        }

        res.json(buildPublicStatusPagePreviewPayload(statusPage, getRequestBaseUrl(req)));
        return;
      }

      const payload = await buildPublicStatusPagePayload(statusPage, getRequestBaseUrl(req));
      payload.statusPage.viewerCanBypassPassword = viewerIsOwner;
      res.json(payload);
    } catch (error) {
      console.error('Erreur recuperation status page publique:', error);
      res.status(500).json({ error: 'Erreur lors de la recuperation de la status page publique' });
    }
  },

  unlock: async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const statusPageId = String(req.params.id ?? '').trim();
      const password = String(req.body.password ?? '');
      const statusPage = await StatusPage.findOne({ statusPageId });
      const viewerUser = await getOptionalAuthenticatedUser(req);

      if (!statusPage) {
        res.status(404).json({ error: 'Status page non trouvee' });
        return;
      }

      const viewerIsOwner = viewerUser
        ? String(viewerUser._id) === String(statusPage.owner)
        : false;

      if (statusPage.isPublished === false && !viewerIsOwner) {
        res.status(410).json({ error: 'Status page non publiee' });
        return;
      }

      if (viewerIsOwner) {
        const payload = await buildPublicStatusPagePayload(statusPage, getRequestBaseUrl(req));
        payload.statusPage.viewerCanBypassPassword = true;
        res.json(payload);
        return;
      }

      if (!statusPage.passwordEnabled) {
        const payload = await buildPublicStatusPagePayload(statusPage, getRequestBaseUrl(req));
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

      const payload = await buildPublicStatusPagePayload(statusPage, getRequestBaseUrl(req));
      res.json(payload);
    } catch (error) {
      console.error('Erreur unlock status page:', error);
      res.status(500).json({ error: 'Erreur lors du deblocage de la status page' });
    }
  },
};

export default statusPageController;
