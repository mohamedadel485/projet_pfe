import { Response } from 'express';
import fs from 'fs';
import path from 'path';
import { validationResult } from 'express-validator';
import Utilisateur from '../models/Utilisateur';
import { AuthRequest } from '../middleware/auth';
import { uploadsRoot } from '../middleware/upload';
import { isUserRole, canManageUser, canAssignRole } from '../utils/roles';
import { findUserByEmail, normalizeEmailAddress } from '../utils/email';

const resolveStoredAvatarFilePath = (avatar: string): string | null => {
  const trimmedAvatar = avatar.trim();
  if (trimmedAvatar === '') return null;

  const pathname = /^https?:\/\//i.test(trimmedAvatar)
    ? (() => {
        try {
          return new URL(trimmedAvatar).pathname;
        } catch {
          return '';
        }
      })()
    : trimmedAvatar;

  if (pathname === '') return null;

  const relativePath = pathname.replace(/^\/?uploads\//, '');
  if (relativePath === pathname) return null;

  return path.join(uploadsRoot, relativePath);
};

const deleteStoredAvatarFile = (avatar?: string | null): void => {
  if (typeof avatar !== 'string' || avatar.trim() === '') return;

  const avatarFilePath = resolveStoredAvatarFilePath(avatar);
  if (!avatarFilePath) return;

  try {
    if (fs.existsSync(avatarFilePath)) {
      fs.unlinkSync(avatarFilePath);
    }
  } catch {
    // Ignore file removal errors so the API stays resilient.
  }
};

const userController = {
  list: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { role, isActive } = req.query;

      const query: any = {};
      if (role !== undefined) {
        if (typeof role !== 'string' || !isUserRole(role)) {
          res.status(400).json({
            error:
              "Le parametre 'role' doit etre 'super_admin', 'admin' ou 'user'",
          });
          return;
        }
        query.role = role;
      }
      if (isActive !== undefined) {
        query.isActive = isActive === 'true';
      }

      const users = await Utilisateur.find(query)
        .select('-password')
        .populate('invitedBy', 'name email')
        .sort({ createdAt: -1 });

      res.json({ users });
    } catch (error: any) {
      console.error('Erreur récupération utilisateurs:', error);
      res
        .status(500)
        .json({ error: 'Erreur lors de la récupération des utilisateurs' });
    }
  },

  getById: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const user = await Utilisateur.findById(id)
        .select('-password')
        .populate('invitedBy', 'name email');

      if (!user) {
        res.status(404).json({ error: 'Utilisateur non trouvé' });
        return;
      }

      res.json({ user });
    } catch (error: any) {
      console.error('Erreur récupération utilisateur:', error);
      res
        .status(500)
        .json({ error: 'Erreur lors de la récupération de l\'utilisateur' });
    }
  },

  updateMe: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const userId = req.user!._id;
      const { name, email } = req.body;

      const user = await Utilisateur.findById(userId);
      if (!user) {
        res.status(404).json({ error: 'Utilisateur non trouvé' });
        return;
      }

      const normalizedEmail = typeof email === 'string' ? normalizeEmailAddress(email) : '';
      if (normalizedEmail && normalizedEmail !== normalizeEmailAddress(user.email)) {
        const existingUser = await findUserByEmail(normalizedEmail);
        if (existingUser && existingUser._id.toString() !== user._id.toString()) {
          res.status(400).json({ error: 'Cet email est déjà utilisé' });
          return;
        }
        user.email = normalizedEmail;
      }

      if (name) user.name = name;

      await user.save();

      res.json({
        message: 'Profil mis à jour avec succès',
        user: {
          ...user.consulterProfil(),
          isActive: user.isActive,
        },
      });
    } catch (error: any) {
      console.error('Erreur mise à jour profil:', error);
      res
        .status(500)
        .json({ error: 'Erreur lors de la mise à jour du profil' });
    }
  },

  updateById: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { id } = req.params;
      const { name, email, role, isActive } = req.body;

      const user = await Utilisateur.findById(id);
      if (!user) {
        res.status(404).json({ error: 'Utilisateur non trouvé' });
        return;
      }

      if (!canManageUser(req.user!.role, user.role)) {
        res.status(403).json({
          error:
            "Acces refuse. Vous n'avez pas les permissions necessaires pour modifier cet utilisateur.",
        });
        return;
      }

      if (role && !canAssignRole(req.user!.role, role)) {
        res.status(403).json({
          error:
            "Acces refuse. Vous n'avez pas les permissions necessaires pour attribuer ce role.",
        });
        return;
      }

      if (
        user._id.toString() === req.user!._id.toString() &&
        isActive === false
      ) {
        res
          .status(400)
          .json({ error: 'Vous ne pouvez pas vous désactiver vous-même' });
        return;
      }

      const normalizedEmail = typeof email === 'string' ? normalizeEmailAddress(email) : '';
      if (normalizedEmail && normalizedEmail !== normalizeEmailAddress(user.email)) {
        const existingUser = await findUserByEmail(normalizedEmail);
        if (existingUser && existingUser._id.toString() !== user._id.toString()) {
          res.status(400).json({ error: 'Cet email est déjà utilisé' });
          return;
        }
        user.email = normalizedEmail;
      }

      if (user.role === 'super_admin' && req.user!.role !== 'super_admin') {
        res.status(403).json({
          error:
            'Le super administrateur ne peut pas etre modifie par un administrateur standard.',
        });
        return;
      }

      if (user.role === 'super_admin' && role && role !== 'super_admin') {
        res.status(400).json({
          error: 'Le role du super administrateur ne peut pas etre modifie.',
        });
        return;
      }

      if (user.role === 'super_admin' && isActive === false) {
        res.status(400).json({
          error: 'Le super administrateur ne peut pas etre desactive.',
        });
        return;
      }

      if (name) user.name = name;
      if (role) user.role = role;
      if (isActive !== undefined) user.isActive = isActive;

      await user.save();

      res.json({
        message: 'Utilisateur mis à jour avec succès',
        user: {
          ...user.consulterProfil(),
          isActive: user.isActive,
        },
      });
    } catch (error: any) {
      console.error('Erreur mise à jour utilisateur:', error);
      res
        .status(500)
        .json({ error: 'Erreur lors de la mise à jour de l\'utilisateur' });
    }
  },

  deleteById: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const user = await Utilisateur.findById(id);
      if (!user) {
        res.status(404).json({ error: 'Utilisateur non trouvé' });
        return;
      }

      if (!canManageUser(req.user!.role, user.role)) {
        res.status(403).json({
          error:
            "Acces refuse. Vous n'avez pas les permissions necessaires pour supprimer cet utilisateur.",
        });
        return;
      }

      if (user.role === 'super_admin') {
        res.status(403).json({
          error: 'Le super administrateur ne peut pas etre supprime.',
        });
        return;
      }

      if (user._id.toString() === req.user!._id.toString()) {
        res
          .status(400)
          .json({ error: 'Vous ne pouvez pas vous supprimer vous-même' });
        return;
      }

      await user.deleteOne();

      res.json({ message: 'Utilisateur supprimé avec succès' });
    } catch (error: any) {
      console.error('Erreur suppression utilisateur:', error);
      res
        .status(500)
        .json({ error: 'Erreur lors de la suppression de l\'utilisateur' });
    }
  },

  statsOverview: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { role, isActive, from, to } = req.query;

      const baseQuery: any = {};

      if (role !== undefined) {
        if (typeof role !== 'string' || !isUserRole(role)) {
          res.status(400).json({
            error:
              "Le parametre 'role' doit etre 'super_admin', 'admin' ou 'user'",
          });
          return;
        }
        baseQuery.role = role;
      }

      if (isActive !== undefined) {
        if (isActive !== 'true' && isActive !== 'false') {
          res.status(400).json({
            error: "Le paramètre 'isActive' doit être 'true' ou 'false'",
          });
          return;
        }
        baseQuery.isActive = isActive === 'true';
      }

      if (from !== undefined || to !== undefined) {
        const createdAt: any = {};

        if (from !== undefined) {
          const fromDate = new Date(String(from));
          if (Number.isNaN(fromDate.getTime())) {
            res
              .status(400)
              .json({ error: "Le paramètre 'from' doit être une date valide" });
            return;
          }
          createdAt.$gte = fromDate;
        }

        if (to !== undefined) {
          const toDate = new Date(String(to));
          if (Number.isNaN(toDate.getTime())) {
            res
              .status(400)
              .json({ error: "Le paramètre 'to' doit être une date valide" });
            return;
          }
          createdAt.$lte = toDate;
        }

        baseQuery.createdAt = createdAt;
      }

      const totalUsers = await Utilisateur.countDocuments(baseQuery);
      const activeUsers = await Utilisateur.countDocuments({
        ...baseQuery,
        isActive: true,
      });
      const inactiveUsers = await Utilisateur.countDocuments({
        ...baseQuery,
        isActive: false,
      });
      const superAdminUsers = await Utilisateur.countDocuments({
        ...baseQuery,
        role: 'super_admin',
      });
      const adminUsers = await Utilisateur.countDocuments({
        ...baseQuery,
        role: 'admin',
      });
      const regularUsers = await Utilisateur.countDocuments({
        ...baseQuery,
        role: 'user',
      });

      res.json({
        stats: {
          total: totalUsers,
          active: activeUsers,
          inactive: inactiveUsers,
          superAdmins: superAdminUsers,
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
      res
        .status(500)
        .json({ error: 'Erreur lors de la récupération des statistiques' });
    }
  },

  uploadAvatar: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: 'Aucun fichier fourni' });
        return;
      }

      const userId = req.user!._id;
      const user = await Utilisateur.findById(userId);
      if (!user) {
        try {
          fs.unlinkSync(file.path);
        } catch {}
        res.status(404).json({ error: 'Utilisateur non trouvé' });
        return;
      }

      deleteStoredAvatarFile((user as any).avatar);

      const avatarPath = `/uploads/avatars/${file.filename}`;
      (user as any).avatar = avatarPath;
      await user.save();

      const protocol = req.protocol;
      const host = req.get('host');
      const fullAvatarUrl = `${protocol}://${host}${avatarPath}`;

      res.json({ message: 'Avatar uploaded', avatarUrl: fullAvatarUrl });
    } catch (error: any) {
      console.error('Erreur upload avatar:', error);
      res.status(500).json({ error: 'Erreur lors de l upload de l avatar' });
    }
  },

  deleteAvatar: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!._id;
      const user = await Utilisateur.findById(userId);
      if (!user) {
        res.status(404).json({ error: 'Utilisateur non trouvé' });
        return;
      }

      deleteStoredAvatarFile((user as any).avatar);
      (user as any).avatar = null;
      await user.save();

      res.json({
        message: 'Avatar supprimé avec succès',
        user: {
          ...user.consulterProfil(),
          isActive: user.isActive,
        },
      });
    } catch (error: any) {
      console.error('Erreur suppression avatar:', error);
      res.status(500).json({ error: 'Erreur lors de la suppression de l avatar' });
    }
  },
};

export default userController;
