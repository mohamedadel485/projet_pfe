import { Response } from 'express';
import { validationResult } from 'express-validator';
import Utilisateur from '../models/Utilisateur';
import Monitor from '../models/Moniteur';
import MonitorLog from '../models/MonitorLog';
import Incident from '../models/Incident';
import Integration from '../models/Integration';
import emailService from '../services/emailService';
import monitorService from '../services/monitorService';
import integrationService from '../services/integrationService';
import predictionService from '../services/predictionService';
import { AuthRequest } from '../middleware/auth';
import { ensureStatusPageForMonitor } from './statusPageController';

const METHODS_WITHOUT_BODY = new Set(['HEAD', 'GET', 'DELETE', 'OPTIONS']);

type ResponseValidationPayload = {
  field?: string;
  mode?: string;
  expectedValue?: unknown;
  expectedType?: unknown;
};

const normalizeResponseValidation = (
  payload: Record<string, unknown>,
  res: Response,
): boolean => {
  if (!payload.responseValidation || typeof payload.responseValidation !== 'object') {
    return true;
  }

  const responseValidation = payload.responseValidation as ResponseValidationPayload;
  const mode = String(responseValidation.mode ?? '').toLowerCase();
  responseValidation.field = 'status';

  if (mode === 'value') {
    const expectedValue = String(responseValidation.expectedValue ?? '').trim();
    if (expectedValue === '') {
      res.status(400).json({
        error: 'responseValidation.expectedValue est requis pour le mode value',
      });
      return false;
    }
    responseValidation.mode = 'value';
    responseValidation.expectedValue = expectedValue;
    delete responseValidation.expectedType;
    return true;
  }

  if (mode === 'type') {
    const expectedType = String(responseValidation.expectedType ?? '')
      .trim()
      .toLowerCase();
    if (!['string', 'boolean', 'number'].includes(expectedType)) {
      res.status(400).json({
        error: 'responseValidation.expectedType invalide pour le mode type',
      });
      return false;
    }
    responseValidation.mode = 'type';
    responseValidation.expectedType = expectedType;
    delete responseValidation.expectedValue;
    return true;
  }

  delete payload.responseValidation;
  return true;
};

const stripBodyForMethodWithoutBody = (
  payload: Record<string, unknown>,
  httpMethod: string,
): void => {
  if (METHODS_WITHOUT_BODY.has(String(httpMethod).toUpperCase())) {
    delete payload.body;
  }
};

const monitorController = {
  create: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const monitorData = {
        ...req.body,
        owner: req.user!._id,
      };
      stripBodyForMethodWithoutBody(
        monitorData,
        String(monitorData.httpMethod ?? ''),
      );
      if (!normalizeResponseValidation(monitorData, res)) {
        return;
      }

      const monitor = new Monitor(monitorData);
      await monitor.save();

      try {
        await ensureStatusPageForMonitor(monitor, req.user!._id);
      } catch (error) {
        console.warn('Erreur creation status page (creation monitor):', error);
      }

      try {
        const firstResult = await monitorService.checkMonitor(monitor);
        await monitorService.logCheckResult(monitor, firstResult);
      } catch (error) {
        console.warn(
          'Erreur verification immediate (creation monitor):',
          error,
        );
      }

      if (
        monitor.domainExpiryMode === 'enabled' ||
        monitor.sslExpiryMode === 'enabled'
      ) {
        try {
          await monitorService.refreshSecurityChecks(monitor);
        } catch (error) {
          console.warn(
            'Erreur verification SSL/WHOIS (creation monitor):',
            error,
          );
        }
      }

      res.status(201).json({
        message: 'Monitor créé avec succès',
        monitor,
      });
    } catch (error: any) {
      console.error('Erreur création monitor:', error);
      res.status(500).json({ error: 'Erreur lors de la création du monitor' });
    }
  },

  list: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { status, type } = req.query;

      const query: any = {
        $or: [{ owner: req.user!._id }, { sharedWith: req.user!._id }],
      };

      if (status) {
        query.status = status;
      }
      if (type) {
        query.type = type;
      }

      const monitors = await Monitor.find(query)
        .populate('owner', 'name email')
        .sort({ createdAt: -1 });

      res.json({ monitors });
    } catch (error: any) {
      console.error('Erreur récupération monitors:', error);
      res
        .status(500)
        .json({ error: 'Erreur lors de la récupération des monitors' });
    }
  },

  getById: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const monitor = await Monitor.findOne({
        _id: id,
        $or: [{ owner: req.user!._id }, { sharedWith: req.user!._id }],
      }).populate('owner', 'name email');

      if (!monitor) {
        res.status(404).json({ error: 'Monitor non trouvé' });
        return;
      }

      res.json({ monitor });
    } catch (error: any) {
      console.error('Erreur récupération monitor:', error);
      res
        .status(500)
        .json({ error: 'Erreur lors de la récupération du monitor' });
    }
  },

  getPrediction: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const monitor = await Monitor.findOne({
        _id: id,
        $or: [{ owner: req.user!._id }, { sharedWith: req.user!._id }],
      });

      if (!monitor) {
        res.status(404).json({ error: 'Monitor non trouvÃ©' });
        return;
      }

      const now = new Date();
      const lookbackStart = new Date(now.getTime() - 48 * 60 * 60 * 1000);

      const [logs, incidents] = await Promise.all([
        MonitorLog.find({
          monitor: id,
          checkedAt: { $gte: lookbackStart },
        })
          .sort({ checkedAt: -1 })
          .limit(2500),
        Incident.find({
          monitor: id,
          $or: [{ startedAt: { $gte: lookbackStart } }, { status: 'ongoing' }],
        })
          .sort({ startedAt: -1 })
          .limit(100),
      ]);

      const prediction = predictionService.buildMonitorPrediction({
        monitor,
        logs,
        incidents,
        now,
      });

      res.json({ prediction });
    } catch (error: any) {
      console.error('Erreur prediction monitor:', error);
      res
        .status(500)
        .json({ error: 'Erreur lors de la rÃ©cupÃ©ration de la prediction' });
    }
  },

  update: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { id } = req.params;

      const monitor = await Monitor.findOne({
        _id: id,
        owner: req.user!._id,
      });

      if (!monitor) {
        res.status(404).json({
          error: 'Monitor non trouvé ou vous n\'êtes pas le propriétaire',
        });
        return;
      }

      const updatePayload = { ...req.body } as Record<string, unknown>;
      stripBodyForMethodWithoutBody(
        updatePayload,
        String(updatePayload.httpMethod ?? monitor.httpMethod ?? ''),
      );
      if (!normalizeResponseValidation(updatePayload, res)) {
        return;
      }

      Object.assign(monitor, updatePayload);
      await monitor.save();

      if (
        monitor.domainExpiryMode === 'enabled' ||
        monitor.sslExpiryMode === 'enabled'
      ) {
        try {
          await monitorService.refreshSecurityChecks(monitor);
        } catch (error) {
          console.warn(
            'Erreur verification SSL/WHOIS (update monitor):',
            error,
          );
        }
      }

      res.json({
        message: 'Monitor mis à jour avec succès',
        monitor,
      });
    } catch (error: any) {
      console.error('Erreur mise à jour monitor:', error);
      res
        .status(500)
        .json({ error: 'Erreur lors de la mise à jour du monitor' });
    }
  },

  delete: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const monitor = await Monitor.findOne({
        _id: id,
        owner: req.user!._id,
      });

      if (!monitor) {
        res.status(404).json({
          error: 'Monitor non trouvé ou vous n\'êtes pas le propriétaire',
        });
        return;
      }

      await monitor.deleteOne();
      await MonitorLog.deleteMany({ monitor: id });

      res.json({ message: 'Monitor supprimé avec succès' });
    } catch (error: any) {
      console.error('Erreur suppression monitor:', error);
      res
        .status(500)
        .json({ error: 'Erreur lors de la suppression du monitor' });
    }
  },

  pause: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const monitor = await Monitor.findOne({
        _id: id,
        owner: req.user!._id,
      });

      if (!monitor) {
        res.status(404).json({ error: 'Monitor non trouvé' });
        return;
      }

      monitor.status = 'paused';
      monitor.pausedByMaintenance = false;
      monitor.manuallyResumed = false;
      await monitor.save();

      res.json({
        message: 'Monitor mis en pause',
        monitor,
      });
    } catch (error: any) {
      console.error('Erreur pause monitor:', error);
      res
        .status(500)
        .json({ error: 'Erreur lors de la mise en pause du monitor' });
    }
  },

  resume: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const monitor = await Monitor.findOne({
        _id: id,
        owner: req.user!._id,
      });

      if (!monitor) {
        res.status(404).json({ error: 'Monitor non trouvé' });
        return;
      }

      monitor.status = 'pending';
      monitor.pausedByMaintenance = false;
      monitor.manuallyResumed = true;
      await monitor.save();

      try {
        const resumeResult = await monitorService.checkMonitor(monitor);
        await monitorService.logCheckResult(monitor, resumeResult);
      } catch (error) {
        console.warn('Erreur verification immediate (resume monitor):', error);
      }

      res.json({
        message: 'Monitor repris',
        monitor,
      });
    } catch (error: any) {
      console.error('Erreur reprise monitor:', error);
      res.status(500).json({ error: 'Erreur lors de la reprise du monitor' });
    }
  },

  check: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const monitor = await Monitor.findOne({
        _id: id,
        $or: [{ owner: req.user!._id }, { sharedWith: req.user!._id }],
      });

      if (!monitor) {
        res.status(404).json({ error: 'Monitor non trouvé' });
        return;
      }

      const result = await monitorService.checkMonitor(monitor);
      await monitorService.logCheckResult(monitor, result);
      try {
        await monitorService.refreshSecurityChecks(monitor);
      } catch (error) {
        console.warn('Erreur verification SSL/WHOIS (manual check):', error);
      }

      res.json({
        message: 'Vérification effectuée',
        result: {
          status: result.status,
          responseTime: result.responseTime,
          statusCode: result.statusCode,
          errorMessage: result.errorMessage,
        },
        monitor,
      });
    } catch (error: any) {
      console.error('Erreur vérification monitor:', error);
      res
        .status(500)
        .json({ error: 'Erreur lors de la vérification du monitor' });
    }
  },

  testAlert: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const monitor = await Monitor.findOne({
        _id: id,
        $or: [{ owner: req.user!._id }, { sharedWith: req.user!._id }],
      });

      if (!monitor) {
        res.status(404).json({ error: 'Monitor non trouvé' });
        return;
      }

      console.log(`\n🔧 TEST ALERT for monitor ${monitor.name}`);
      console.log(`   Current status: ${monitor.status}`);
      console.log(`   Owner: ${monitor.owner}`);

      const integrations = await Integration.find({
        owner: req.user!._id,
        isActive: true,
        events: 'down',
      });

      console.log(
        `   Found ${integrations.length} integrations for DOWN event`,
      );
      integrations.forEach((i: any) => {
        console.log(
          `   - ${i.type} (${i.customValue || i.endpointUrl}) - events: ${i.events}`,
        );
      });

      await integrationService.notifyMonitorStatusChange({
        monitor,
        previousStatus: 'up',
        result: {
          status: 'down',
          responseTime: 0,
          errorMessage:
            'Test alert - simulated downtime for integration testing',
        },
      });

      res.json({
        message: 'Alerte DOWN envoyée à toutes les intégrations configurées',
        integrations_found: integrations.length,
        monitor,
      });
    } catch (error: any) {
      console.error('Erreur envoi alerte test:', error);
      res.status(500).json({
        error: `Erreur lors de l'envoi de l'alerte test: ${error.message}`,
      });
    }
  },

  getLogs: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { limit = 100, page = 1, startDate, endDate } = req.query;

      const monitor = await Monitor.findOne({
        _id: id,
        $or: [{ owner: req.user!._id }, { sharedWith: req.user!._id }],
      });

      if (!monitor) {
        res.status(404).json({ error: 'Monitor non trouvé' });
        return;
      }

      const parsedLimit = Number(limit);
      const parsedPage = Number(page);

      const safeLimit =
        Number.isFinite(parsedLimit) && parsedLimit >= 0
          ? Math.min(Math.floor(parsedLimit), 50000)
          : 100;
      const safePage =
        Number.isFinite(parsedPage) && parsedPage > 0
          ? Math.floor(parsedPage)
          : 1;

      const query: Record<string, unknown> = { monitor: id };
      const checkedAtFilter: Record<string, Date> = {};

      if (typeof startDate === 'string' && startDate.trim() !== '') {
        const parsedStartDate = new Date(startDate);
        if (!Number.isNaN(parsedStartDate.getTime())) {
          checkedAtFilter.$gte = parsedStartDate;
        }
      }

      if (typeof endDate === 'string' && endDate.trim() !== '') {
        const parsedEndDate = new Date(endDate);
        if (!Number.isNaN(parsedEndDate.getTime())) {
          checkedAtFilter.$lte = parsedEndDate;
        }
      }

      if (Object.keys(checkedAtFilter).length > 0) {
        query.checkedAt = checkedAtFilter;
      }

      const total = await MonitorLog.countDocuments(query);

      let logsQuery = MonitorLog.find(query).sort({ checkedAt: -1 });
      let currentPage = safePage;
      let currentLimit = safeLimit;

      if (safeLimit > 0) {
        const skip = (safePage - 1) * safeLimit;
        logsQuery = logsQuery.limit(safeLimit).skip(skip);
      } else {
        currentPage = 1;
        currentLimit = total;
      }

      const logs = await logsQuery;

      res.json({
        logs,
        pagination: {
          total,
          page: currentPage,
          limit: currentLimit,
          pages: currentLimit > 0 ? Math.ceil(total / currentLimit) : 1,
        },
      });
    } catch (error: any) {
      console.error('Erreur récupération logs:', error);
      res
        .status(500)
        .json({ error: 'Erreur lors de la récupération des logs' });
    }
  },

  share: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { userId } = req.body;
      const normalizedUserId = String(userId).trim();

      const monitor = await Monitor.findOne({
        _id: id,
        owner: req.user!._id,
      });

      if (!monitor) {
        res.status(404).json({ error: 'Monitor non trouvé' });
        return;
      }

      const targetUser = await Utilisateur.findById(normalizedUserId).select(
        'name email isActive',
      );
      if (!targetUser) {
        res.status(404).json({ error: 'Utilisateur non trouve' });
        return;
      }

      if (!targetUser.isActive) {
        res.status(400).json({ error: 'Cet utilisateur est desactive' });
        return;
      }

      const alreadyShared = monitor.sharedWith.some(
        (sharedUserId) => sharedUserId.toString() === normalizedUserId,
      );
      if (alreadyShared) {
        res
          .status(400)
          .json({ error: 'Monitor déjà partagé avec cet utilisateur' });
        return;
      }

      monitor.sharedWith.push(targetUser._id);
      await monitor.save();

      try {
        await emailService.sendMonitorAccessNotification(
          targetUser.email,
          targetUser.name,
          monitor.name,
          monitor.id,
          req.user?.name,
        );
      } catch (mailError) {
        console.error('Notification email partage monitor echouee:', mailError);
        res.json({
          message: 'Monitor partage avec succes.',
          warning:
            "Acces ajoute, mais la notification email n'a pas pu etre envoyee.",
          monitor,
        });
        return;
      }

      res.json({
        message:
          'Monitor partage avec succes et notification envoyee par email.',
        monitor,
      });
    } catch (error: any) {
      console.error('Erreur partage monitor:', error);
      res.status(500).json({ error: 'Erreur lors du partage du monitor' });
    }
  },

  unshare: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id, userId } = req.params;

      const monitor = await Monitor.findOne({
        _id: id,
        owner: req.user!._id,
      });

      if (!monitor) {
        res.status(404).json({ error: 'Monitor non trouvé' });
        return;
      }

      monitor.sharedWith = monitor.sharedWith.filter(
        (uid) => uid.toString() !== userId,
      );
      await monitor.save();

      res.json({
        message: 'Partage retiré avec succès',
        monitor,
      });
    } catch (error: any) {
      console.error('Erreur retrait partage:', error);
      res.status(500).json({ error: 'Erreur lors du retrait du partage' });
    }
  },
};

export default monitorController;
