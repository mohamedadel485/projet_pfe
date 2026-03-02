import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import User from '../models/User';
import { authenticate, isAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

/**
 * GET /api/users
 * Lister tous les utilisateurs (admin uniquement)
 */
router.get(
  '/',
  authenticate,
  isAdmin,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { role, isActive } = req.query;

      const query: any = {};
      if (role) {
        query.role = role;
      }
      if (isActive !== undefined) {
        query.isActive = isActive === 'true';
      }

      const users = await User.find(query)
        .select('-password')
        .populate('invitedBy', 'name email')
        .sort({ createdAt: -1 });

      res.json({ users });
    } catch (error: any) {
      console.error('Erreur récupération utilisateurs:', error);
      res.status(500).json({ error: 'Erreur lors de la récupération des utilisateurs' });
    }
  }
);

/**
 * GET /api/users/:id
 * Obtenir un utilisateur par ID (admin uniquement)
 */
router.get(
  '/:id',
  authenticate,
  isAdmin,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const user = await User.findById(id)
        .select('-password')
        .populate('invitedBy', 'name email');

      if (!user) {
        res.status(404).json({ error: 'Utilisateur non trouvé' });
        return;
      }

      res.json({ user });
    } catch (error: any) {
      console.error('Erreur récupération utilisateur:', error);
      res.status(500).json({ error: 'Erreur lors de la récupération de l\'utilisateur' });
    }
  }
);

/**
 * PUT /api/users/:id
 * Mettre à jour un utilisateur (admin uniquement)
 */
router.put(
  '/:id',
  authenticate,
  isAdmin,
  [
    body('name').optional().trim().notEmpty(),
    body('email').optional().isEmail().normalizeEmail(),
    body('role').optional().isIn(['admin', 'user']),
    body('isActive').optional().isBoolean(),
  ],
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { id } = req.params;
      const { name, email, role, isActive } = req.body;

      const user = await User.findById(id);
      if (!user) {
        res.status(404).json({ error: 'Utilisateur non trouvé' });
        return;
      }

      // Empêcher l'admin de se désactiver lui-même
      if (user._id.toString() === req.user!._id.toString() && isActive === false) {
        res.status(400).json({ error: 'Vous ne pouvez pas vous désactiver vous-même' });
        return;
      }

      // Vérifier si l'email est déjà utilisé
      if (email && email !== user.email) {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
          res.status(400).json({ error: 'Cet email est déjà utilisé' });
          return;
        }
        user.email = email;
      }

      if (name) user.name = name;
      if (role) user.role = role;
      if (isActive !== undefined) user.isActive = isActive;

      await user.save();

      res.json({
        message: 'Utilisateur mis à jour avec succès',
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          isActive: user.isActive,
        },
      });
    } catch (error: any) {
      console.error('Erreur mise à jour utilisateur:', error);
      res.status(500).json({ error: 'Erreur lors de la mise à jour de l\'utilisateur' });
    }
  }
);

/**
 * DELETE /api/users/:id
 * Supprimer un utilisateur (admin uniquement)
 */
router.delete(
  '/:id',
  authenticate,
  isAdmin,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const user = await User.findById(id);
      if (!user) {
        res.status(404).json({ error: 'Utilisateur non trouvé' });
        return;
      }

      // Empêcher l'admin de se supprimer lui-même
      if (user._id.toString() === req.user!._id.toString()) {
        res.status(400).json({ error: 'Vous ne pouvez pas vous supprimer vous-même' });
        return;
      }

      await user.deleteOne();

      res.json({ message: 'Utilisateur supprimé avec succès' });
    } catch (error: any) {
      console.error('Erreur suppression utilisateur:', error);
      res.status(500).json({ error: 'Erreur lors de la suppression de l\'utilisateur' });
    }
  }
);

/**
 * GET /api/users/stats/overview
 * Obtenir les statistiques des utilisateurs (admin uniquement)
 */
router.get(
  '/stats/overview',
  authenticate,
  isAdmin,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { role, isActive, from, to } = req.query;

      const baseQuery: any = {};

      if (role !== undefined) {
        if (role !== 'admin' && role !== 'user') {
          res.status(400).json({ error: "Le paramètre 'role' doit être 'admin' ou 'user'" });
          return;
        }
        baseQuery.role = role;
      }

      if (isActive !== undefined) {
        if (isActive !== 'true' && isActive !== 'false') {
          res.status(400).json({ error: "Le paramètre 'isActive' doit être 'true' ou 'false'" });
          return;
        }
        baseQuery.isActive = isActive === 'true';
      }

      if (from !== undefined || to !== undefined) {
        const createdAt: any = {};

        if (from !== undefined) {
          const fromDate = new Date(String(from));
          if (Number.isNaN(fromDate.getTime())) {
            res.status(400).json({ error: "Le paramètre 'from' doit être une date valide" });
            return;
          }
          createdAt.$gte = fromDate;
        }

        if (to !== undefined) {
          const toDate = new Date(String(to));
          if (Number.isNaN(toDate.getTime())) {
            res.status(400).json({ error: "Le paramètre 'to' doit être une date valide" });
            return;
          }
          createdAt.$lte = toDate;
        }

        baseQuery.createdAt = createdAt;
      }

      const totalUsers = await User.countDocuments(baseQuery);
      const activeUsers = await User.countDocuments({ ...baseQuery, isActive: true });
      const inactiveUsers = await User.countDocuments({ ...baseQuery, isActive: false });
      const adminUsers = await User.countDocuments({ ...baseQuery, role: 'admin' });
      const regularUsers = await User.countDocuments({ ...baseQuery, role: 'user' });

      res.json({
        stats: {
          total: totalUsers,
          active: activeUsers,
          inactive: inactiveUsers,
          admins: adminUsers,
          users: regularUsers,
        },
        filters: {
          role: role ?? null,
          isActive: isActive ?? null,
          from: from ?? null,
          to: to ?? null,
        },
      });
    } catch (error: any) {
      console.error('Erreur récupération statistiques:', error);
      res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
    }
  }
);

export default router;
