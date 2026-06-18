import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate } from '../middleware/auth';
import { normalizeRegisterPayload } from '../middleware/normalizePayload';
import authController from '../controllers/authController';
import {
  PASSWORD_RESET_CODE_LENGTH,
  LOGIN_OTP_CODE_LENGTH,
} from '../utils/authTokenHelpers';

const router = Router();

router.post(
  '/register',
  normalizeRegisterPayload,
  [
    body('email').isEmail().withMessage('Email invalide').normalizeEmail(),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Le mot de passe doit contenir au moins 6 caracteres')
      .matches(/[A-Z]/)
      .withMessage('Le mot de passe doit contenir au moins une majuscule')
      .matches(/\d/)
      .withMessage('Le mot de passe doit contenir au moins un chiffre')
      .matches(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/)
      .withMessage('Le mot de passe doit contenir au moins un caractere special'),
    body('name').notEmpty().withMessage('Le nom est requis').trim(),
  ],
  authController.register,
);

router.post(
  '/login',
  normalizeRegisterPayload,
  [
    body('email').isEmail().withMessage('Email invalide').normalizeEmail(),
    body('password').notEmpty().withMessage('Mot de passe requis'),
  ],
  authController.login,
);

router.post(
  '/login/verify-otp',
  [
    body('email').isEmail().withMessage('Email invalide').normalizeEmail(),
    body('code')
      .isLength({ min: LOGIN_OTP_CODE_LENGTH, max: LOGIN_OTP_CODE_LENGTH })
      .withMessage('Code OTP invalide')
      .trim(),
  ],
  authController.verifyLoginOtp,
);

router.post(
  '/forgot-password',
  [body('email').isEmail().withMessage('Email invalide').normalizeEmail()],
  authController.forgotPassword,
);

router.post(
  '/check-email',
  [body('email').isEmail().withMessage('Email invalide')],
  authController.checkEmail,
);

router.post(
  '/reset-password',
  [
    body('email').isEmail().withMessage('Email invalide').normalizeEmail(),
    body('code')
      .isLength({
        min: PASSWORD_RESET_CODE_LENGTH,
        max: PASSWORD_RESET_CODE_LENGTH,
      })
      .withMessage('Code invalide')
      .trim(),
    body('newPassword')
      .isLength({ min: 6 })
      .withMessage('Le mot de passe doit contenir au moins 6 caracteres')
      .matches(/[A-Z]/)
      .withMessage('Le mot de passe doit contenir au moins une majuscule')
      .matches(/\d/)
      .withMessage('Le mot de passe doit contenir au moins un chiffre')
      .matches(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/)
      .withMessage('Le mot de passe doit contenir au moins un caractere special'),
  ],
  authController.resetPassword,
);

router.post(
  '/change-password',
  authenticate,
  [
    body('currentPassword')
      .notEmpty()
      .withMessage('Le mot de passe actuel est requis'),
    body('newPassword')
      .isLength({ min: 6 })
      .withMessage('Le nouveau mot de passe doit contenir au moins 6 caracteres')
      .matches(/[A-Z]/)
      .withMessage('Le mot de passe doit contenir au moins une majuscule')
      .matches(/\d/)
      .withMessage('Le mot de passe doit contenir au moins un chiffre')
      .matches(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/)
      .withMessage('Le mot de passe doit contenir au moins un caractere special'),
  ],
  authController.changePassword,
);

router.post(
  '/accept-invitation',
  normalizeRegisterPayload,
  [
    body('token').notEmpty().withMessage("Token d'invitation requis"),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Le mot de passe doit contenir au moins 6 caracteres')
      .matches(/[A-Z]/)
      .withMessage('Le mot de passe doit contenir au moins une majuscule')
      .matches(/\d/)
      .withMessage('Le mot de passe doit contenir au moins un chiffre')
      .matches(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/)
      .withMessage('Le mot de passe doit contenir au moins un caractere special'),
  ],
  authController.acceptInvitation,
);

router.get('/me', authenticate, authController.me);

router.post(
  '/request-account',
  [
    body('email')
      .isEmail()
      .withMessage('Veuillez fournir une adresse email valide')
      .normalizeEmail(),
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Le nom est requis')
      .isLength({ min: 2, max: 100 })
      .withMessage('Le nom doit contenir entre 2 et 100 caracteres'),
    body('message')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Le message ne doit pas depasser 500 caracteres'),
  ],
  authController.requestAccount,
);

router.get('/account-requests', authenticate, authController.getAccountRequests);

router.post(
  '/approve-request',
  authenticate,
  [
    body('requestId').notEmpty().withMessage("L'ID de la demande est requis"),
    body('tempPassword')
      .isLength({ min: 6 })
      .withMessage('Le mot de passe doit contenir au moins 6 caracteres'),
    body('role')
      .optional()
      .isIn(['user', 'admin'])
      .withMessage("Le role doit etre 'user' ou 'admin'"),
    body('monitorIds')
      .optional()
      .isArray()
      .withMessage('monitorIds doit etre un tableau'),
  ],
  authController.approveRequest,
);

router.post(
  '/reject-request',
  authenticate,
  [body('requestId').notEmpty().withMessage("L'ID de la demande est requis")],
  authController.rejectRequest,
);

router.delete(
  '/account-requests',
  authenticate,
  [
    body('status')
      .optional()
      .isIn(['approved', 'rejected'])
      .withMessage("Le statut doit etre 'approved' ou 'rejected'"),
  ],
  authController.deleteAccountRequests,
);

router.post('/logout', authController.logout);

export default router;
