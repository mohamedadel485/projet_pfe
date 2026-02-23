import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import Monitor from '../models/Monitor';
import MonitorLog from '../models/MonitorLog';
import monitorService from '../services/monitorService';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

/**
 * POST /api/monitors
 * Créer un nouveau monitor
 */
router.post(
  '/',
  authenticate,
  [
    body('name').notEmpty().trim(),
    body('url').isURL({ protocols: ['http', 'https', 'ws', 'wss'], require_protocol: true }),
    body('type').optional().isIn(['http', 'https', 'ws', 'wss']),
    body('interval').optional().isInt({ min: 1 }),
    body('timeout').optional().isInt({ min: 5, max: 300 }),
    body('httpMethod').optional().isIn(['GET', 'POST', 'PUT', 'DELETE', 'HEAD']),
    body('expectedStatusCode').optional().isInt({ min: 100, max: 599 }),
  ],
  async (req: AuthRequest, res: Response): Promise<void> => {
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

      const monitor = new Monitor(monitorData);
      await monitor.save();

      res.status(201).json({
        message: 'Monitor créé avec succès',
        monitor,
      });
    } catch (error: any) {
      console.error('Erreur création monitor:', error);
      res.status(500).json({ error: 'Erreur lors de la création du monitor' });
    }
  }
);

/**
 * GET /api/monitors
 * Lister tous les monitors de l'utilisateur
 */
router.get(
  '/',
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { status, type } = req.query;

      const query: any = {
        $or: [
          { owner: req.user!._id },
          { sharedWith: req.user!._id },
        ],
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
      res.status(500).json({ error: 'Erreur lors de la récupération des monitors' });
    }
  }
);

/**
 * GET /api/monitors/:id
 * Obtenir un monitor par ID
 */
router.get(
  '/:id',
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const monitor = await Monitor.findOne({
        _id: id,
        $or: [
          { owner: req.user!._id },
          { sharedWith: req.user!._id },
        ],
      }).populate('owner', 'name email');

      if (!monitor) {
        res.status(404).json({ error: 'Monitor non trouvé' });
        return;
      }

      res.json({ monitor });
    } catch (error: any) {
      console.error('Erreur récupération monitor:', error);
      res.status(500).json({ error: 'Erreur lors de la récupération du monitor' });
    }
  }
);

/**
 * PUT /api/monitors/:id
 * Mettre à jour un monitor
 */
router.put(
  '/:id',
  authenticate,
  [
    body('name').optional().trim().notEmpty(),
    body('url').optional().isURL({ protocols: ['http', 'https', 'ws', 'wss'], require_protocol: true }),
    body('type').optional().isIn(['http', 'https', 'ws', 'wss']),
    body('interval').optional().isInt({ min: 1 }),
    body('timeout').optional().isInt({ min: 5, max: 300 }),
  ],
  async (req: AuthRequest, res: Response): Promise<void> => {
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
        res.status(404).json({ error: 'Monitor non trouvé ou vous n\'êtes pas le propriétaire' });
        return;
      }

      Object.assign(monitor, req.body);
      await monitor.save();

      res.json({
        message: 'Monitor mis à jour avec succès',
        monitor,
      });
    } catch (error: any) {
      console.error('Erreur mise à jour monitor:', error);
      res.status(500).json({ error: 'Erreur lors de la mise à jour du monitor' });
    }
  }
);

/**
 * DELETE /api/monitors/:id
 * Supprimer un monitor
 */
router.delete(
  '/:id',
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const monitor = await Monitor.findOne({
        _id: id,
        owner: req.user!._id,
      });

      if (!monitor) {
        res.status(404).json({ error: 'Monitor non trouvé ou vous n\'êtes pas le propriétaire' });
        return;
      }

      await monitor.deleteOne();
      await MonitorLog.deleteMany({ monitor: id });

      res.json({ message: 'Monitor supprimé avec succès' });
    } catch (error: any) {
      console.error('Erreur suppression monitor:', error);
      res.status(500).json({ error: 'Erreur lors de la suppression du monitor' });
    }
  }
);

/**
 * POST /api/monitors/:id/pause
 * Mettre en pause un monitor
 */
router.post(
  '/:id/pause',
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
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
      await monitor.save();

      res.json({
        message: 'Monitor mis en pause',
        monitor,
      });
    } catch (error: any) {
      console.error('Erreur pause monitor:', error);
      res.status(500).json({ error: 'Erreur lors de la mise en pause du monitor' });
    }
  }
);

/**
 * POST /api/monitors/:id/resume
 * Reprendre un monitor en pause
 */
router.post(
  '/:id/resume',
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
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
      await monitor.save();

      res.json({
        message: 'Monitor repris',
        monitor,
      });
    } catch (error: any) {
      console.error('Erreur reprise monitor:', error);
      res.status(500).json({ error: 'Erreur lors de la reprise du monitor' });
    }
  }
);

/**
 * POST /api/monitors/:id/check
 * Vérifier manuellement un monitor
 */
router.post(
  '/:id/check',
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const monitor = await Monitor.findOne({
        _id: id,
        $or: [
          { owner: req.user!._id },
          { sharedWith: req.user!._id },
        ],
      });

      if (!monitor) {
        res.status(404).json({ error: 'Monitor non trouvé' });
        return;
      }

      const result = await monitorService.checkMonitor(monitor);
      await monitorService.logCheckResult(monitor, result);

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
      res.status(500).json({ error: 'Erreur lors de la vérification du monitor' });
    }
  }
);

/**
 * GET /api/monitors/:id/logs
 * Obtenir l'historique des vérifications
 */
router.get(
  '/:id/logs',
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { limit = 100, page = 1 } = req.query;

      const monitor = await Monitor.findOne({
        _id: id,
        $or: [
          { owner: req.user!._id },
          { sharedWith: req.user!._id },
        ],
      });

      if (!monitor) {
        res.status(404).json({ error: 'Monitor non trouvé' });
        return;
      }

      const skip = (Number(page) - 1) * Number(limit);

      const logs = await MonitorLog.find({ monitor: id })
        .sort({ checkedAt: -1 })
        .limit(Number(limit))
        .skip(skip);

      const total = await MonitorLog.countDocuments({ monitor: id });

      res.json({
        logs,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          pages: Math.ceil(total / Number(limit)),
        },
      });
    } catch (error: any) {
      console.error('Erreur récupération logs:', error);
      res.status(500).json({ error: 'Erreur lors de la récupération des logs' });
    }
  }
);

/**
 * POST /api/monitors/:id/share
 * Partager un monitor avec un utilisateur
 */
router.post(
  '/:id/share',
  authenticate,
  [body('userId').notEmpty()],
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { userId } = req.body;

      const monitor = await Monitor.findOne({
        _id: id,
        owner: req.user!._id,
      });

      if (!monitor) {
        res.status(404).json({ error: 'Monitor non trouvé' });
        return;
      }

      if (monitor.sharedWith.includes(userId)) {
        res.status(400).json({ error: 'Monitor déjà partagé avec cet utilisateur' });
        return;
      }

      monitor.sharedWith.push(userId);
      await monitor.save();

      res.json({
        message: 'Monitor partagé avec succès',
        monitor,
      });
    } catch (error: any) {
      console.error('Erreur partage monitor:', error);
      res.status(500).json({ error: 'Erreur lors du partage du monitor' });
    }
  }
);

/**
 * DELETE /api/monitors/:id/share/:userId
 * Retirer le partage d'un monitor
 */
router.delete(
  '/:id/share/:userId',
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
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
        (uid) => uid.toString() !== userId
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
  }
);

export default router;
