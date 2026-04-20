import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import Integration, { IntegrationEvent, IntegrationType } from '../models/Integration';
import { authenticate, AuthRequest } from '../middleware/auth';
import integrationService from '../services/integrationService';

const router = Router();

const normalizeEvents = (events: unknown): IntegrationEvent[] => {
  if (!Array.isArray(events) || events.length === 0) {
    return ['up', 'down'];
  }

  const unique = Array.from(new Set(events.filter((event): event is IntegrationEvent => event === 'up' || event === 'down')));
  return unique.length > 0 ? unique : ['up', 'down'];
};

/**
 * POST /api/integrations
 * Creer une integration webhook/slack/telegram
 */
router.post(
  '/',
  authenticate,
  [
    body('type').optional().isIn(['webhook', 'slack', 'telegram']),
    body('endpointUrl').isURL({ protocols: ['http', 'https'], require_protocol: true }),
    body('customValue').optional({ nullable: true }).isString().isLength({ max: 500 }),
    body('events').optional().isArray({ min: 1 }),
    body('events.*').optional().isIn(['up', 'down']),
  ],
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const type = (req.body.type as IntegrationType | undefined) ?? 'webhook';
      const endpointUrl = String(req.body.endpointUrl).trim();
      const customValueRaw = typeof req.body.customValue === 'string' ? req.body.customValue.trim() : '';
      const events = normalizeEvents(req.body.events);

      const existingIntegration = await Integration.findOne({
        owner: req.user!._id,
        type,
        endpointUrl,
      });

      let integration = existingIntegration;
      let message = 'Integration creee avec succes';

      if (integration) {
        integration.customValue = customValueRaw === '' ? undefined : customValueRaw;
        integration.events = events;
        integration.isActive = true;
        await integration.save();
        message = 'Integration mise a jour avec succes';
      } else {
        integration = await Integration.create({
          owner: req.user!._id,
          type,
          endpointUrl,
          customValue: customValueRaw === '' ? undefined : customValueRaw,
          events,
        });
      }

      try {
        await integrationService.sendIntegrationTest(integration);
      } catch (error) {
        console.error(`Erreur envoi notification de test pour integration ${integration._id}:`, error);
      }

      res.status(existingIntegration ? 200 : 201).json({
        message,
        integration,
      });
    } catch (error: any) {
      console.error('Erreur creation integration:', error);
      res.status(500).json({ error: 'Erreur lors de la creation de l\'integration' });
    }
  }
);

/**
 * GET /api/integrations
 * Lister les integrations de l'utilisateur
 */
router.get(
  '/',
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const integrations = await Integration.find({ owner: req.user!._id }).sort({ createdAt: -1 });
      res.json({ integrations });
    } catch (error: any) {
      console.error('Erreur recuperation integrations:', error);
      res.status(500).json({ error: 'Erreur lors de la recuperation des integrations' });
    }
  }
);

/**
 * DELETE /api/integrations/:id
 * Supprimer une integration de l'utilisateur
 */
router.delete(
  '/:id',
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const integration = await Integration.findOne({
        _id: req.params.id,
        owner: req.user!._id,
      });

      if (!integration) {
        res.status(404).json({ error: 'Integration non trouvee' });
        return;
      }

      await integration.deleteOne();
      res.json({ message: 'Integration supprimee' });
    } catch (error: any) {
      console.error('Erreur suppression integration:', error);
      res.status(500).json({ error: 'Erreur lors de la suppression de l\'integration' });
    }
  }
);

export default router;
