import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate } from '../middleware/auth';
import { normalizeIntegrationPayload } from '../middleware/normalizePayload';
import integrationController from '../controllers/integrationController';

const router = Router();

router.post(
  '/',
  authenticate,
  normalizeIntegrationPayload,
  [
    body('type').optional().isIn(['webhook', 'slack', 'telegram']),
    body('endpointUrl').isURL({ protocols: ['http', 'https'], require_protocol: true }),
    body('customValue').optional({ nullable: true }).isString().isLength({ max: 500 }),
    body('events').optional().isArray({ min: 1 }),
    body('events.*').optional().isIn(['up', 'down']),
  ],
  integrationController.create,
);

router.get('/', authenticate, integrationController.list);

router.delete('/:id', authenticate, integrationController.delete);

export default router;
