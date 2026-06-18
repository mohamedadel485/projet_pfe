import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate, isAdmin } from '../middleware/auth';
import invitationController from '../controllers/invitationController';

const router = Router();

router.post(
  '/',
  authenticate,
  isAdmin,
  [
    body('name').notEmpty().withMessage('Le nom est requis').trim(),
    body('email').isEmail().normalizeEmail(),
    body('monitorIds')
      .optional()
      .isArray()
      .withMessage('monitorIds doit etre une liste'),
    body('monitorIds.*')
      .optional()
      .isMongoId()
      .withMessage('Un monitorId est invalide'),
    body('role')
      .optional()
      .isIn(['admin', 'member', 'user'])
      .withMessage('Le role doit etre admin, member ou user'),
  ],
  invitationController.create,
);

router.get('/', authenticate, isAdmin, invitationController.list);

router.get('/:token', invitationController.getByToken);

router.delete('/:id', authenticate, isAdmin, invitationController.delete);

router.post('/:id/resend', authenticate, isAdmin, invitationController.resend);

export default router;
