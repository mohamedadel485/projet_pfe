import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate, isAdmin } from '../middleware/auth';
import { normalizeUserPayload } from '../middleware/normalizePayload';
import { avatarUpload } from '../middleware/upload';
import userController from '../controllers/userController';

const router = Router();

router.get('/', authenticate, isAdmin, userController.list);

router.get('/stats/overview', authenticate, isAdmin, userController.statsOverview);

router.put(
  '/me',
  authenticate,
  normalizeUserPayload,
  [
    body('name').optional().trim().notEmpty(),
    body('email').optional().isEmail().normalizeEmail(),
  ],
  userController.updateMe,
);

router.post(
  '/me/avatar',
  authenticate,
  avatarUpload.single('avatar'),
  userController.uploadAvatar,
);

router.delete('/me/avatar', authenticate, userController.deleteAvatar);

router.get('/:id', authenticate, isAdmin, userController.getById);

router.put(
  '/:id',
  authenticate,
  isAdmin,
  normalizeUserPayload,
  [
    body('name').optional().trim().notEmpty(),
    body('email').optional().isEmail().normalizeEmail(),
    body('role').optional().isIn(['admin', 'user']),
    body('isActive').optional().isBoolean(),
  ],
  userController.updateById,
);

router.delete('/:id', authenticate, isAdmin, userController.deleteById);

export default router;
