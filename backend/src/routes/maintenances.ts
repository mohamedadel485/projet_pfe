import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { authenticate } from '../middleware/auth';
import { normalizeMaintenancePayload } from '../middleware/normalizePayload';
import maintenanceController from '../controllers/maintenanceController';
import { MaintenanceStatus } from '../models/Maintenance';

const router = Router();

const allowedStatuses: MaintenanceStatus[] = ['scheduled', 'ongoing', 'paused', 'completed', 'cancelled'];

router.get(
  '/',
  authenticate,
  [
    query('status').optional().isIn(allowedStatuses),
    query('monitorId').optional().isMongoId(),
    query('search').optional().isString().trim().isLength({ max: 200 }),
  ],
  maintenanceController.list,
);

router.post(
  '/',
  authenticate,
  normalizeMaintenancePayload,
  [
    body('monitorId').isMongoId(),
    body('name').optional().isString().trim().isLength({ min: 1, max: 120 }),
    body('reason').optional().isString().trim().isLength({ max: 1000 }),
    body('startAt').isISO8601(),
    body('endAt').isISO8601(),
  ],
  maintenanceController.create,
);

router.post(
  '/:id/start',
  authenticate,
  [param('id').isMongoId()],
  maintenanceController.start,
);

router.post(
  '/:id/pause',
  authenticate,
  [param('id').isMongoId()],
  maintenanceController.pause,
);

router.post(
  '/:id/resume',
  authenticate,
  [param('id').isMongoId()],
  maintenanceController.resume,
);

router.delete(
  '/:id',
  authenticate,
  [param('id').isMongoId()],
  maintenanceController.delete,
);

export default router;
