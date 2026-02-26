import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import crypto from 'crypto';
import User from '../models/User';
import Invitation from '../models/Invitation';
import emailService from '../services/emailService';
import { authenticate, isAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

/**
 * POST /api/invitations
 * Créer une invitation (admin uniquement)
 */
router.post(
  '/',
  authenticate,
  isAdmin,
  [
    body('email').isEmail().normalizeEmail(),
  ],
  async (req: AuthRequest, res: Response): Promise<void> => {
    let createdInvitationId: string | null = null;
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { email } = req.body;

      // Vérifier si l'utilisateur existe déjà
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        res.status(400).json({ error: 'Un utilisateur avec cet email existe déjà' });
        return;
      }

      // Vérifier si une invitation est déjà en attente
      const existingInvitation = await Invitation.findOne({
        email,
        status: 'pending',
        expiresAt: { $gt: new Date() },
      });

      if (existingInvitation) {
        res.status(400).json({ error: 'Une invitation est déjà en attente pour cet email' });
        return;
      }

      // Générer un token unique
      const token = crypto.randomBytes(32).toString('hex');

      // Créer l'invitation
      const invitation = new Invitation({
        email,
        token,
        invitedBy: req.user!._id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 jours
      });

      await invitation.save();
      createdInvitationId = String(invitation._id);

      // Envoyer l'email d'invitation.
      // En cas d'echec SMTP, l'invitation reste creee et on renvoie un succes avec avertissement.
      try {
        await emailService.sendInvitation(email, token, req.user!.name);
      } catch (mailError) {
        console.error('Envoi email invitation échoué:', mailError);
        res.status(201).json({
          message: 'Invitation créée avec succès (email non envoye).',
          warning: "SMTP indisponible: l'invitation a ete creee sans envoi d'email.",
          invitation: {
            id: invitation._id,
            email: invitation.email,
            status: invitation.status,
            expiresAt: invitation.expiresAt,
            createdAt: invitation.createdAt,
          },
        });
        return;
      }

      res.status(201).json({
        message: 'Invitation envoyée avec succès',
        invitation: {
          id: invitation._id,
          email: invitation.email,
          status: invitation.status,
          expiresAt: invitation.expiresAt,
          createdAt: invitation.createdAt,
        },
      });
    } catch (error: any) {
      if (createdInvitationId) {
        try {
          await Invitation.findByIdAndDelete(createdInvitationId);
        } catch (cleanupError) {
          console.error('Erreur nettoyage invitation après exception:', cleanupError);
        }
      }
      console.error('Erreur création invitation:', error);
      res.status(500).json({
        error: 'Erreur lors de la création de l\'invitation',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined,
      });
    }
  }
);

/**
 * GET /api/invitations
 * Lister toutes les invitations (admin uniquement)
 */
router.get(
  '/',
  authenticate,
  isAdmin,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { status } = req.query;

      const query: any = {};
      if (status) {
        query.status = status;
      }

      const invitations = await Invitation.find(query)
        .populate('invitedBy', 'name email')
        .sort({ createdAt: -1 });

      res.json({ invitations });
    } catch (error: any) {
      console.error('Erreur récupération invitations:', error);
      res.status(500).json({ error: 'Erreur lors de la récupération des invitations' });
    }
  }
);

/**
 * GET /api/invitations/:token
 * Vérifier une invitation par token
 */
router.get(
  '/:token',
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { token } = req.params;

      const invitation = await Invitation.findOne({ 
        token,
        status: 'pending' 
      }).populate('invitedBy', 'name');

      if (!invitation) {
        res.status(404).json({ error: 'Invitation non trouvée' });
        return;
      }

      if (invitation.expiresAt < new Date()) {
        res.status(400).json({ error: 'Cette invitation a expiré' });
        return;
      }

      res.json({
        invitation: {
          email: invitation.email,
          invitedBy: invitation.invitedBy,
          expiresAt: invitation.expiresAt,
        },
      });
    } catch (error: any) {
      console.error('Erreur vérification invitation:', error);
      res.status(500).json({ error: 'Erreur lors de la vérification de l\'invitation' });
    }
  }
);

/**
 * DELETE /api/invitations/:id
 * Supprimer une invitation (admin uniquement)
 */
router.delete(
  '/:id',
  authenticate,
  isAdmin,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const invitation = await Invitation.findById(id);
      if (!invitation) {
        res.status(404).json({ error: 'Invitation non trouvée' });
        return;
      }

      await invitation.deleteOne();

      res.json({ message: 'Invitation supprimée avec succès' });
    } catch (error: any) {
      console.error('Erreur suppression invitation:', error);
      res.status(500).json({ error: 'Erreur lors de la suppression de l\'invitation' });
    }
  }
);

/**
 * POST /api/invitations/:id/resend
 * Renvoyer une invitation (admin uniquement)
 */
router.post(
  '/:id/resend',
  authenticate,
  isAdmin,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      if (!/^[a-fA-F0-9]{24}$/.test(id)) {
        res.status(400).json({ error: 'ID invitation invalide' });
        return;
      }

      const invitation = await Invitation.findById(id);
      if (!invitation) {
        res.status(404).json({ error: 'Invitation non trouvée' });
        return;
      }

      if (invitation.status === 'accepted') {
        res.status(400).json({ error: 'Cette invitation a déjà été acceptée' });
        return;
      }

      // Générer un nouveau token et prolonger l'expiration
      invitation.token = crypto.randomBytes(32).toString('hex');
      invitation.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      invitation.status = 'pending';
      await invitation.save();

      // Renvoyer l'email.
      // En cas d'echec SMTP, on conserve l'invitation mise a jour et on renvoie un succes avec avertissement.
      try {
        await emailService.sendInvitation(
          invitation.email,
          invitation.token,
          req.user!.name
        );
      } catch (mailError) {
        console.error('Renvoi email invitation échoué:', mailError);
        res.status(200).json({
          message: 'Invitation renvoyée avec succès (email non envoye).',
          warning: "SMTP indisponible: l'invitation a ete renvoyee sans envoi d'email.",
          invitation: {
            id: invitation._id,
            email: invitation.email,
            status: invitation.status,
            expiresAt: invitation.expiresAt,
          },
        });
        return;
      }

      res.json({ 
        message: 'Invitation renvoyée avec succès',
        invitation: {
          id: invitation._id,
          email: invitation.email,
          status: invitation.status,
          expiresAt: invitation.expiresAt,
        },
      });
    } catch (error: any) {
      console.error('Erreur renvoi invitation:', error);
      res.status(500).json({
        error: 'Erreur lors du renvoi de l\'invitation',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined,
      });
    }
  }
);

export default router;
