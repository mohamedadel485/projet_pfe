import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate } from '../middleware/auth';
import { statusPageLogoUpload } from '../middleware/upload';
import statusPageController from '../controllers/statusPageController';

const router = Router();

router.get('/', authenticate, statusPageController.list);

router.put(
  '/:id',
  authenticate,
  statusPageLogoUpload.single('logo'),
  [
    body('pageName').notEmpty().trim(),
    body('passwordEnabled').optional().isBoolean(),
    body('password').optional().isString(),
    body('customDomain').optional().isString(),
    body('logoName').optional().isString(),
    body('density').optional().isIn(['wide', 'compact']),
    body('alignment').optional().isIn(['left', 'center']),
  ],
  statusPageController.upsert,
);

router.delete('/:id', authenticate, statusPageController.delete);

router.patch(
  '/:id/publish',
  authenticate,
  [body('isPublished').isBoolean()],
  statusPageController.setPublished,
);

router.get('/:id/public', statusPageController.getPublic);

router.post(
  '/:id/unlock',
  [body('password').isString()],
  statusPageController.unlock,
);

export default router;
