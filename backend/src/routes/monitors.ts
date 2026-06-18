import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate } from '../middleware/auth';
import { normalizeMonitorPayload } from '../middleware/normalizePayload';
import monitorController from '../controllers/monitorController';

const router = Router();

const createMonitorValidators = [
  body('name').notEmpty().trim(),
  body('url').isURL({
    protocols: ['http', 'https', 'ws', 'wss'],
    require_protocol: true,
  }),
  body('type').optional().isIn(['http', 'https', 'ws', 'wss']),
  body('interval').optional().isInt({ min: 1 }),
  body('timeout').optional().isInt({ min: 5, max: 300 }),
  body('httpMethod')
    .optional()
    .isIn(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']),
  body('expectedStatusCode').optional().isInt({ min: 100, max: 599 }),
  body('ipVersion')
    .optional()
    .isIn([
      'IPv4 / IPv6 (IPv4 Priority)',
      'IPv6 / IPv4 (IPv6 Priority)',
      'IPv4 only',
      'IPv6 only',
    ]),
  body('followRedirections').optional().isBoolean(),
  body('upStatusCodeGroups').optional().isArray({ min: 1 }),
  body('upStatusCodeGroups.*').optional().isIn(['2xx', '3xx']),
  body('domainExpiryMode').optional().isIn(['enabled', 'disabled']),
  body('sslExpiryMode').optional().isIn(['enabled', 'disabled']),
  body('emailNotificationsEnabled').optional().isBoolean(),
  body('body').optional().isString(),
  body('headers').optional().isObject(),
  body('responseValidation').optional().isObject(),
  body('responseValidation.field').optional().isIn(['status']),
  body('responseValidation.mode').optional().isIn(['value', 'type']),
  body('responseValidation.expectedValue').optional().isString(),
  body('responseValidation.expectedType')
    .optional()
    .isIn(['string', 'boolean', 'number']),
];

const updateMonitorValidators = [
  body('name').optional().trim().notEmpty(),
  body('url')
    .optional()
    .isURL({
      protocols: ['http', 'https', 'ws', 'wss'],
      require_protocol: true,
    }),
  body('type').optional().isIn(['http', 'https', 'ws', 'wss']),
  body('interval').optional().isInt({ min: 1 }),
  body('timeout').optional().isInt({ min: 5, max: 300 }),
  body('httpMethod')
    .optional()
    .isIn(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']),
  body('ipVersion')
    .optional()
    .isIn([
      'IPv4 / IPv6 (IPv4 Priority)',
      'IPv6 / IPv4 (IPv6 Priority)',
      'IPv4 only',
      'IPv6 only',
    ]),
  body('followRedirections').optional().isBoolean(),
  body('upStatusCodeGroups').optional().isArray({ min: 1 }),
  body('upStatusCodeGroups.*').optional().isIn(['2xx', '3xx']),
  body('domainExpiryMode').optional().isIn(['enabled', 'disabled']),
  body('sslExpiryMode').optional().isIn(['enabled', 'disabled']),
  body('emailNotificationsEnabled').optional().isBoolean(),
  body('body').optional().isString(),
  body('headers').optional().isObject(),
  body('responseValidation').optional().isObject(),
  body('responseValidation.field').optional().isIn(['status']),
  body('responseValidation.mode').optional().isIn(['value', 'type']),
  body('responseValidation.expectedValue').optional().isString(),
  body('responseValidation.expectedType')
    .optional()
    .isIn(['string', 'boolean', 'number']),
];

router.post(
  '/',
  authenticate,
  normalizeMonitorPayload,
  createMonitorValidators,
  monitorController.create,
);

router.get('/', authenticate, monitorController.list);

router.get('/:id/prediction', authenticate, monitorController.getPrediction);

router.get('/:id/logs', authenticate, monitorController.getLogs);

router.get('/:id', authenticate, monitorController.getById);

router.put(
  '/:id',
  authenticate,
  normalizeMonitorPayload,
  updateMonitorValidators,
  monitorController.update,
);

router.delete('/:id', authenticate, monitorController.delete);

router.post('/:id/pause', authenticate, monitorController.pause);

router.post('/:id/resume', authenticate, monitorController.resume);

router.post('/:id/check', authenticate, monitorController.check);

router.post('/:id/test-alert', authenticate, monitorController.testAlert);

router.post(
  '/:id/share',
  authenticate,
  [body('userId').notEmpty()],
  monitorController.share,
);

router.delete('/:id/share/:userId', authenticate, monitorController.unshare);

export default router;
