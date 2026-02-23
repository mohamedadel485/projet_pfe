import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import User from '../models/User';
import Invitation from '../models/Invitation';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const jwtSecret = process.env.JWT_SECRET as string;
const jwtExpiresIn = (process.env.JWT_EXPIRE ?? '7d') as SignOptions['expiresIn'];

/**
 * POST /api/auth/register
 * Inscription (premier admin uniquement)
 */
router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('name').notEmpty().trim(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
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
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
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
 * POST /api/auth/accept-invitation
 * Accepter une invitation et créer un compte
 */
router.post(
  '/accept-invitation',
  [
    body('token').notEmpty(),
    body('password').isLength({ min: 6 }),
    body('name').notEmpty().trim(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
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
