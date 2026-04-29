import { Router, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import Maintenance, { MaintenanceStatus } from '../models/Maintenance';
import Monitor from '../models/Monitor';
import { authenticate, AuthRequest } from '../middleware/auth';
import maintenanceService from '../services/maintenanceService';

const router = Router();

const allowedStatuses: MaintenanceStatus[] = ['scheduled', 'ongoing', 'paused', 'completed', 'cancelled'];

const parseDateInput = (rawValue: string): Date | null => {
  const parsed = new Date(rawValue);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
};

const getOwnedMaintenance = async (id: string, ownerId: string) =>
  Maintenance.findOne({
    _id: id,
    owner: ownerId,
  });

/**
 * GET /api/maintenances
 * Lister les maintenances de l'utilisateur (sur les monitors accessibles)
 */
router.get(
  '/',
  authenticate,
  [
    query('status').optional().isIn(allowedStatuses),
    query('monitorId').optional().isMongoId(),
    query('search').optional().isString().trim().isLength({ max: 200 }),
  ],
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      await maintenanceService.refreshMaintenanceStates();

      const { status, monitorId, search } = req.query as {
        status?: MaintenanceStatus;
        monitorId?: string;
        search?: string;
      };

      const accessibleMonitors = await Monitor.find({
        $or: [{ owner: req.user!._id }, { sharedWith: req.user!._id }],
      }).select('_id');

      const monitorIds = accessibleMonitors.map((monitor) => monitor._id);
      if (monitorIds.length === 0) {
        res.json({ maintenances: [] });
        return;
      }

      const maintenanceQuery: {
        monitor: { $in: typeof monitorIds } | string;
        status?: MaintenanceStatus;
      } = {
        monitor: { $in: monitorIds },
      };

      if (status) {
        maintenanceQuery.status = status;
      }
      if (monitorId) {
        const isAccessible = monitorIds.some((id) => id.toString() === monitorId);
        if (!isAccessible) {
          res.json({ maintenances: [] });
          return;
        }
        maintenanceQuery.monitor = monitorId;
      }

      const maintenances = await Maintenance.find(maintenanceQuery)
        .sort({ startAt: -1, createdAt: -1 })
        .populate('monitor', 'name url type status');

      if (!search || search.trim() === '') {
        res.json({ maintenances });
        return;
      }

      const normalizedSearch = search.trim().toLowerCase();
      const filteredMaintenances = maintenances.filter((maintenance) => {
        const monitor = maintenance.monitor as unknown as { name?: string; url?: string } | null;
        const content = [maintenance.name, maintenance.reason, monitor?.name ?? '', monitor?.url ?? '']
          .join(' ')
          .toLowerCase();
        return content.includes(normalizedSearch);
      });

      res.json({ maintenances: filteredMaintenances });
    } catch (error: any) {
      console.error('Erreur récupération maintenances:', error);
      res.status(500).json({ error: 'Erreur lors de la récupération des maintenances' });
    }
  }
);

/**
 * POST /api/maintenances
 * Créer une maintenance planifiée
 */
router.post(
  '/',
  authenticate,
  [
    body('monitorId').isMongoId(),
    body('name').optional().isString().trim().isLength({ min: 1, max: 120 }),
    body('reason').optional().isString().trim().isLength({ max: 1000 }),
    body('startAt').isISO8601(),
    body('endAt').isISO8601(),
  ],
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const {
        monitorId,
        name,
        reason,
        startAt: startAtRaw,
        endAt: endAtRaw,
      } = req.body as {
        monitorId: string;
        name?: string;
        reason?: string;
        startAt: string;
        endAt: string;
      };

      const monitor = await Monitor.findOne({
        _id: monitorId,
        owner: req.user!._id,
      });

      if (!monitor) {
        res.status(404).json({ error: 'Monitor non trouvé ou vous n\'êtes pas le propriétaire' });
        return;
      }

      const startAt = parseDateInput(startAtRaw);
      const endAt = parseDateInput(endAtRaw);
      if (!startAt || !endAt || endAt.getTime() <= startAt.getTime()) {
        res.status(400).json({ error: 'Fenêtre de maintenance invalide' });
        return;
      }

      const now = new Date();
      const initialStatus = maintenanceService.getStatusForWindow(startAt, endAt, now);
      const maintenance = new Maintenance({
        name: name?.trim() || `Maintenance ${monitor.name}`,
        reason: reason?.trim() || '',
        status: initialStatus,
        monitor: monitor._id,
        owner: req.user!._id,
        startAt,
        endAt,
      });

      await maintenance.save();
      await maintenanceService.syncMonitorMaintenanceState(String(monitor._id), now);
      await maintenance.populate('monitor', 'name url type status');

      res.status(201).json({
        message: 'Maintenance créée avec succès',
        maintenance,
      });
    } catch (error: any) {
      console.error('Erreur création maintenance:', error);
      res.status(500).json({ error: 'Erreur lors de la création de la maintenance' });
    }
  }
);

/**
 * POST /api/maintenances/:id/start
 * Démarrer immédiatement une maintenance
 */
router.post(
  '/:id/start',
  authenticate,
  [param('id').isMongoId()],
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { id } = req.params;
      const maintenance = await getOwnedMaintenance(id, String(req.user!._id));
      if (!maintenance) {
        res.status(404).json({ error: 'Maintenance non trouvée' });
        return;
      }

      if (maintenance.status === 'cancelled') {
        res.status(400).json({ error: 'Cette maintenance est annulée' });
        return;
      }

      const now = new Date();
      if (now.getTime() >= maintenance.endAt.getTime()) {
        maintenance.status = 'completed';
        await maintenance.save();
        await maintenanceService.syncMonitorMaintenanceState(String(maintenance.monitor), now);
        res.status(400).json({ error: 'La maintenance est déjà terminée' });
        return;
      }

      if (maintenance.startAt.getTime() > now.getTime()) {
        maintenance.startAt = now;
      }
      maintenance.status = 'ongoing';
      await maintenance.save();
      await maintenanceService.syncMonitorMaintenanceState(String(maintenance.monitor), now);
      await maintenance.populate('monitor', 'name url type status');

      res.json({
        message: 'Maintenance démarrée',
        maintenance,
      });
    } catch (error: any) {
      console.error('Erreur démarrage maintenance:', error);
      res.status(500).json({ error: 'Erreur lors du démarrage de la maintenance' });
    }
  }
);

/**
 * POST /api/maintenances/:id/pause
 * Mettre une maintenance en pause
 */
router.post(
  '/:id/pause',
  authenticate,
  [param('id').isMongoId()],
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { id } = req.params;
      const maintenance = await getOwnedMaintenance(id, String(req.user!._id));
      if (!maintenance) {
        res.status(404).json({ error: 'Maintenance non trouvée' });
        return;
      }

      if (maintenance.status === 'completed' || maintenance.status === 'cancelled') {
        res.status(400).json({ error: 'Cette maintenance ne peut plus être mise en pause' });
        return;
      }

      maintenance.status = 'paused';
      await maintenance.save();
      await maintenanceService.syncMonitorMaintenanceState(String(maintenance.monitor));
      await maintenance.populate('monitor', 'name url type status');

      res.json({
        message: 'Maintenance mise en pause',
        maintenance,
      });
    } catch (error: any) {
      console.error('Erreur pause maintenance:', error);
      res.status(500).json({ error: 'Erreur lors de la mise en pause de la maintenance' });
    }
  }
);

/**
 * POST /api/maintenances/:id/resume
 * Reprendre une maintenance
 */
router.post(
  '/:id/resume',
  authenticate,
  [param('id').isMongoId()],
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { id } = req.params;
      const maintenance = await getOwnedMaintenance(id, String(req.user!._id));
      if (!maintenance) {
        res.status(404).json({ error: 'Maintenance non trouvée' });
        return;
      }

      if (maintenance.status === 'cancelled') {
        res.status(400).json({ error: 'Cette maintenance est annulée' });
        return;
      }

      const now = new Date();
      const computedStatus = maintenanceService.getStatusForWindow(maintenance.startAt, maintenance.endAt, now);
      maintenance.status = computedStatus === 'completed' ? 'completed' : computedStatus;
      await maintenance.save();
      await maintenanceService.syncMonitorMaintenanceState(String(maintenance.monitor), now);
      await maintenance.populate('monitor', 'name url type status');

      res.json({
        message: maintenance.status === 'completed' ? 'Maintenance terminée' : 'Maintenance reprise',
        maintenance,
      });
    } catch (error: any) {
      console.error('Erreur reprise maintenance:', error);
      res.status(500).json({ error: 'Erreur lors de la reprise de la maintenance' });
    }
  }
);

/**
 * DELETE /api/maintenances/:id
 * Supprimer une maintenance
 */
router.delete(
  '/:id',
  authenticate,
  [param('id').isMongoId()],
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { id } = req.params;
      const maintenance = await getOwnedMaintenance(id, String(req.user!._id));
      if (!maintenance) {
        res.status(404).json({ error: 'Maintenance non trouvée' });
        return;
      }

      const monitorId = String(maintenance.monitor);
      await maintenance.deleteOne();
      await maintenanceService.syncMonitorMaintenanceState(monitorId);

      res.json({
        message: 'Maintenance supprimée',
      });
    } catch (error: any) {
      console.error('Erreur suppression maintenance:', error);
      res.status(500).json({ error: 'Erreur lors de la suppression de la maintenance' });
    }
  }
);

export default router;
