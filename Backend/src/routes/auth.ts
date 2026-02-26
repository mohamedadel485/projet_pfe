import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import User from '../models/User';
import Invitation from '../models/Invitation';
import emailService from '../services/emailService';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const jwtSecret = process.env.JWT_SECRET as string;
const jwtExpiresIn = (process.env.JWT_EXPIRE ?? '7d') as SignOptions['expiresIn'];
const PASSWORD_RESET_CODE_LENGTH = 6;
const passwordResetCodeExpireMinutes = Number(process.env.PASSWORD_RESET_CODE_EXPIRE_MINUTES ?? 10);
const exposeDebugDetails = (process.env.NODE_ENV ?? 'development') !== 'production';

const generatePasswordResetCode = (): string => {
  const min = 10 ** (PASSWORD_RESET_CODE_LENGTH - 1);
  const max = 10 ** PASSWORD_RESET_CODE_LENGTH;
  return String(crypto.randomInt(min, max));
};

/**
 * POST /api/auth/register
 * Inscription (premier admin uniquement)
 */
router.post(
  '/register',
  [
    body('email').isEmail().withMessage('Email invalide').normalizeEmail(),
    body('password').isLength({ min: 6 }).withMessage('Le mot de passe doit contenir au moins 6 caracteres'),
    body('name').notEmpty().withMessage('Le nom est requis').trim(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const formattedErrors = errors.array();
        res.status(400).json({
          error: String(formattedErrors[0]?.msg ?? 'Donnees invalides'),
          errors: formattedErrors,
        });
        return;
      }

      const { email, password, name } = req.body;

      // Vérifier si un utilisateur existe déjà
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        res.status(400).json({ error: 'Cet email est déjà utilisé' });
        return;
      }

      // Vérifier si c'est le premier utilisateur (sera admin)
      const userCount = await User.countDocuments();
      const role = userCount === 0 ? 'admin' : 'user';

      // Si ce n'est pas le premier utilisateur, refuser (seules les invitations sont autorisées)
      if (role === 'user') {
        res.status(403).json({ 
          error: 'L\'inscription directe est désactivée. Vous devez être invité par un administrateur.' 
        });
        return;
      }

      const user = new User({
        email,
        password,
        name,
        role,
      });

      await user.save();

      if (!jwtSecret) {
        res.status(500).json({ error: 'Configuration serveur invalide: JWT_SECRET manquant' });
        return;
      }

      const token = jwt.sign(
        { userId: user._id },
        jwtSecret,
        { expiresIn: jwtExpiresIn }
      );

      res.status(201).json({
        message: 'Compte administrateur créé avec succès',
        token,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      });
    } catch (error: any) {
      console.error('Erreur inscription:', error);
      res.status(500).json({ error: 'Erreur lors de l\'inscription' });
    }
  }
);

/**
 * POST /api/auth/login
 * Connexion
 */
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Email invalide').normalizeEmail(),
    body('password').notEmpty().withMessage('Mot de passe requis'),
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const formattedErrors = errors.array();
        res.status(400).json({
          error: String(formattedErrors[0]?.msg ?? 'Donnees invalides'),
          errors: formattedErrors,
        });
        return;
      }

      const { email, password } = req.body;

      const user = await User.findOne({ email });
      if (!user) {
        res.status(401).json({ error: 'Email ou mot de passe incorrect' });
        return;
      }

      if (!user.isActive) {
        res.status(401).json({ error: 'Compte désactivé' });
        return;
      }

      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        res.status(401).json({ error: 'Email ou mot de passe incorrect' });
        return;
      }

      if (!jwtSecret) {
        res.status(500).json({ error: 'Configuration serveur invalide: JWT_SECRET manquant' });
        return;
      }

      const token = jwt.sign(
        { userId: user._id },
        jwtSecret,
        { expiresIn: jwtExpiresIn }
      );

      res.json({
        message: 'Connexion réussie',
        token,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      });
    } catch (error: any) {
      console.error('Erreur connexion:', error);
      res.status(500).json({ error: 'Erreur lors de la connexion' });
    }
  }
);

/**
 * POST /api/auth/forgot-password
 * Envoie un code de reinitialisation de mot de passe
 */
router.post(
  '/forgot-password',
  [
    body('email').isEmail().withMessage('Email invalide').normalizeEmail(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const formattedErrors = errors.array();
        res.status(400).json({
          error: String(formattedErrors[0]?.msg ?? 'Donnees invalides'),
          errors: formattedErrors,
        });
        return;
      }

      const { email } = req.body as { email: string };
      const user = await User.findOne({ email });

      // Reponse volontairement generique pour ne pas exposer les comptes existants.
      if (!user || !user.isActive) {
        res.json({
          message: 'Si un compte existe pour cet email, un code de verification a ete envoye.',
        });
        return;
      }

      const resetCode = generatePasswordResetCode();
      user.passwordResetCode = resetCode;
      user.passwordResetExpires = new Date(Date.now() + passwordResetCodeExpireMinutes * 60 * 1000);
      await user.save();

      try {
        await emailService.sendPasswordResetCode(user.email, resetCode, user.name);
        res.json({
          message: 'Code de verification envoye par email.',
          delivery: 'smtp',
        });
        return;
      } catch (mailError: any) {
        user.passwordResetCode = undefined;
        user.passwordResetExpires = undefined;
        await user.save();

        res.status(502).json({
          error: "Le code de reinitialisation n'a pas pu etre envoye. Verifiez la configuration SMTP.",
          details: exposeDebugDetails ? mailError?.message : undefined,
        });
        return;
      }
    } catch (error: any) {
      console.error('Erreur forgot-password:', error);
      res.status(500).json({
        error: 'Erreur lors de la demande de reinitialisation',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined,
      });
    }
  }
);

/**
 * POST /api/auth/reset-password
 * Reinitialiser le mot de passe avec le code recu par email
 */
router.post(
  '/reset-password',
  [
    body('email').isEmail().withMessage('Email invalide').normalizeEmail(),
    body('code')
      .isLength({ min: PASSWORD_RESET_CODE_LENGTH, max: PASSWORD_RESET_CODE_LENGTH })
      .withMessage('Code invalide')
      .trim(),
    body('newPassword')
      .isLength({ min: 6 })
      .withMessage('Le mot de passe doit contenir au moins 6 caracteres'),
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const formattedErrors = errors.array();
        res.status(400).json({
          error: String(formattedErrors[0]?.msg ?? 'Donnees invalides'),
          errors: formattedErrors,
        });
        return;
      }

      const { email, code, newPassword } = req.body as {
        email: string;
        code: string;
        newPassword: string;
      };

      const user = await User.findOne({ email });
      if (!user || !user.isActive) {
        res.status(400).json({ error: 'Code invalide ou expire' });
        return;
      }

      if (!user.passwordResetCode || !user.passwordResetExpires) {
        res.status(400).json({ error: 'Code invalide ou expire' });
        return;
      }

      if (user.passwordResetExpires < new Date()) {
        user.passwordResetCode = undefined;
        user.passwordResetExpires = undefined;
        await user.save();
        res.status(400).json({ error: 'Code invalide ou expire' });
        return;
      }

      if (user.passwordResetCode !== code.trim()) {
        res.status(400).json({ error: 'Code invalide ou expire' });
        return;
      }

      user.password = newPassword;
      user.passwordResetCode = undefined;
      user.passwordResetExpires = undefined;
      await user.save();

      res.json({ message: 'Mot de passe reinitialise avec succes' });
    } catch (error: any) {
      console.error('Erreur reset-password:', error);
      res.status(500).json({
        error: 'Erreur lors de la reinitialisation du mot de passe',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined,
      });
    }
  }
);

/**
 * POST /api/auth/accept-invitation
 * Accepter une invitation et créer un compte
 */
router.post(
  '/accept-invitation',
  [
    body('token').notEmpty().withMessage('Token d invitation requis'),
    body('password').isLength({ min: 6 }).withMessage('Le mot de passe doit contenir au moins 6 caracteres'),
    body('name').notEmpty().withMessage('Le nom est requis').trim(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const formattedErrors = errors.array();
        res.status(400).json({
          error: String(formattedErrors[0]?.msg ?? 'Donnees invalides'),
          errors: formattedErrors,
        });
        return;
      }

      const { token, password, name } = req.body;

      const invitation = await Invitation.findOne({ 
        token, 
        status: 'pending' 
      }).populate('invitedBy', 'name email');

      if (!invitation) {
        res.status(404).json({ error: 'Invitation non trouvée ou déjà utilisée' });
        return;
      }

      if (invitation.expiresAt < new Date()) {
        invitation.status = 'expired';
        await invitation.save();
        res.status(400).json({ error: 'Cette invitation a expiré' });
        return;
      }

      // Vérifier si l'utilisateur existe déjà
      const existingUser = await User.findOne({ email: invitation.email });
      if (existingUser) {
        res.status(400).json({ error: 'Un compte existe déjà avec cet email' });
        return;
      }

      // Créer l'utilisateur
      const user = new User({
        email: invitation.email,
        password,
        name,
        role: invitation.role,
        invitedBy: invitation.invitedBy,
      });

      await user.save();

      // Marquer l'invitation comme acceptée
      invitation.status = 'accepted';
      await invitation.save();

      if (!jwtSecret) {
        res.status(500).json({ error: 'Configuration serveur invalide: JWT_SECRET manquant' });
        return;
      }

      const authToken = jwt.sign(
        { userId: user._id },
        jwtSecret,
        { expiresIn: jwtExpiresIn }
      );

      res.status(201).json({
        message: 'Compte créé avec succès',
        token: authToken,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      });
    } catch (error: any) {
      console.error('Erreur acceptation invitation:', error);
      res.status(500).json({ error: 'Erreur lors de l\'acceptation de l\'invitation' });
    }
  }
);

/**
 * GET /api/auth/me
 * Obtenir les informations de l'utilisateur connecté
 */
router.get(
  '/me',
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      res.json({
        user: {
          id: req.user!._id,
          email: req.user!.email,
          name: req.user!.name,
          role: req.user!.role,
        },
      });
    } catch (error: any) {
      console.error('Erreur récupération profil:', error);
      res.status(500).json({ error: 'Erreur lors de la récupération du profil' });
    }
  }
);

export default router;
