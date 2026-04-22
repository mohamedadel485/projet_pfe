import { Router, Response } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { body, validationResult } from "express-validator";
import User from "../models/User";
import { authenticate, isAdmin, AuthRequest } from "../middleware/auth";
import { isUserRole } from "../utils/roles";

const router = Router();

// Setup uploads directory and multer for avatar uploads
const uploadsRoot = path.resolve(__dirname, "..", "..", "uploads");
const avatarsDir = path.join(uploadsRoot, "avatars");
if (!fs.existsSync(avatarsDir)) {
  fs.mkdirSync(avatarsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req: any, _file: any, cb: any) => cb(null, avatarsDir),
  filename: (_req: any, file: any, cb: any) => {
    const ext = path.extname(file?.originalname || "") || "";
    const safeName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, safeName);
  },
});

const upload = multer({ storage });

/**
 * GET /api/users
 * Lister tous les utilisateurs (admin uniquement)
 */
router.get(
  "/",
  authenticate,
  isAdmin,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { role, isActive } = req.query;

      const query: any = {};
      if (role !== undefined) {
        if (typeof role !== "string" || !isUserRole(role)) {
          res.status(400).json({
            error:
              "Le parametre 'role' doit etre 'super_admin', 'admin' ou 'user'",
          });
          return;
        }
        query.role = role;
      }
      if (isActive !== undefined) {
        query.isActive = isActive === "true";
      }

      const users = await User.find(query)
        .select("-password")
        .populate("invitedBy", "name email")
        .sort({ createdAt: -1 });

      res.json({ users });
    } catch (error: any) {
      console.error("Erreur récupération utilisateurs:", error);
      res
        .status(500)
        .json({ error: "Erreur lors de la récupération des utilisateurs" });
    }
  },
);

/**
 * GET /api/users/:id
 * Obtenir un utilisateur par ID (admin uniquement)
 */
router.get(
  "/:id",
  authenticate,
  isAdmin,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const user = await User.findById(id)
        .select("-password")
        .populate("invitedBy", "name email");

      if (!user) {
        res.status(404).json({ error: "Utilisateur non trouvé" });
        return;
      }

      res.json({ user });
    } catch (error: any) {
      console.error("Erreur récupération utilisateur:", error);
      res
        .status(500)
        .json({ error: "Erreur lors de la récupération de l'utilisateur" });
    }
  },
);

/**
 * PUT /api/users/me
 * Mettre à jour le profil de l'utilisateur authentifié
 */
router.put(
  "/me",
  authenticate,
  [
    body("name").optional().trim().notEmpty(),
    body("email").optional().isEmail().normalizeEmail(),
  ],
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const userId = req.user!._id;
      const { name, email } = req.body;

      const user = await User.findById(userId);
      if (!user) {
        res.status(404).json({ error: "Utilisateur non trouvé" });
        return;
      }

      // Vérifier si l'email est déjà utilisé par un autre compte
      if (email && email !== user.email) {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
          res.status(400).json({ error: "Cet email est déjà utilisé" });
          return;
        }
        user.email = email;
      }

      if (name) user.name = name;

      await user.save();

      res.json({
        message: "Profil mis à jour avec succès",
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          isActive: user.isActive,
          avatar: user.avatar || null,
        },
      });
    } catch (error: any) {
      console.error("Erreur mise à jour profil:", error);
      res
        .status(500)
        .json({ error: "Erreur lors de la mise à jour du profil" });
    }
  },
);

/**
 * PUT /api/users/:id
 * Mettre à jour un utilisateur (admin uniquement)
 */
router.put(
  "/:id",
  authenticate,
  isAdmin,
  [
    body("name").optional().trim().notEmpty(),
    body("email").optional().isEmail().normalizeEmail(),
    body("role").optional().isIn(["admin", "user"]),
    body("isActive").optional().isBoolean(),
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
        res.status(404).json({ error: "Utilisateur non trouvé" });
        return;
      }

      // Seul le super admin peut gerer les comptes admin.
      if (user.role === "admin" && req.user!.role !== "super_admin") {
        res.status(403).json({
          error:
            "Acces refuse. Seul le super administrateur peut modifier un compte administrateur.",
        });
        return;
      }

      if (role === "admin" && req.user!.role !== "super_admin") {
        res.status(403).json({
          error:
            "Acces refuse. Seul le super administrateur peut attribuer le role administrateur.",
        });
        return;
      }

      // Empêcher l'admin de se désactiver lui-même
      if (
        user._id.toString() === req.user!._id.toString() &&
        isActive === false
      ) {
        res
          .status(400)
          .json({ error: "Vous ne pouvez pas vous désactiver vous-même" });
        return;
      }

      // Vérifier si l'email est déjà utilisé
      if (email && email !== user.email) {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
          res.status(400).json({ error: "Cet email est déjà utilisé" });
          return;
        }
        user.email = email;
      }

      if (user.role === "super_admin" && req.user!.role !== "super_admin") {
        res.status(403).json({
          error:
            "Le super administrateur ne peut pas etre modifie par un administrateur standard.",
        });
        return;
      }

      if (user.role === "super_admin" && role && role !== "super_admin") {
        res.status(400).json({
          error: "Le role du super administrateur ne peut pas etre modifie.",
        });
        return;
      }

      if (user.role === "super_admin" && isActive === false) {
        res.status(400).json({
          error: "Le super administrateur ne peut pas etre desactive.",
        });
        return;
      }

      if (name) user.name = name;
      if (role) user.role = role;
      if (isActive !== undefined) user.isActive = isActive;

      await user.save();

      res.json({
        message: "Utilisateur mis à jour avec succès",
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          isActive: user.isActive,
          avatar: user.avatar || null,
        },
      });
    } catch (error: any) {
      console.error("Erreur mise à jour utilisateur:", error);
      res
        .status(500)
        .json({ error: "Erreur lors de la mise à jour de l'utilisateur" });
    }
  },
);

/**
 * DELETE /api/users/:id
 * Supprimer un utilisateur (admin uniquement)
 */
router.delete(
  "/:id",
  authenticate,
  isAdmin,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const user = await User.findById(id);
      if (!user) {
        res.status(404).json({ error: "Utilisateur non trouvé" });
        return;
      }

      // Seul le super admin peut supprimer un compte admin.
      if (user.role === "admin" && req.user!.role !== "super_admin") {
        res.status(403).json({
          error:
            "Acces refuse. Seul le super administrateur peut supprimer un compte administrateur.",
        });
        return;
      }

      // Empêcher l'admin de se supprimer lui-même
      if (user.role === "super_admin") {
        res.status(403).json({
          error: "Le super administrateur ne peut pas etre supprime.",
        });
        return;
      }

      if (user._id.toString() === req.user!._id.toString()) {
        res
          .status(400)
          .json({ error: "Vous ne pouvez pas vous supprimer vous-même" });
        return;
      }

      await user.deleteOne();

      res.json({ message: "Utilisateur supprimé avec succès" });
    } catch (error: any) {
      console.error("Erreur suppression utilisateur:", error);
      res
        .status(500)
        .json({ error: "Erreur lors de la suppression de l'utilisateur" });
    }
  },
);

/**
 * GET /api/users/stats/overview
 * Obtenir les statistiques des utilisateurs (admin uniquement)
 */
router.get(
  "/stats/overview",
  authenticate,
  isAdmin,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { role, isActive, from, to } = req.query;

      const baseQuery: any = {};

      if (role !== undefined) {
        if (typeof role !== "string" || !isUserRole(role)) {
          res.status(400).json({
            error:
              "Le parametre 'role' doit etre 'super_admin', 'admin' ou 'user'",
          });
          return;
        }
        baseQuery.role = role;
      }

      if (isActive !== undefined) {
        if (isActive !== "true" && isActive !== "false") {
          res.status(400).json({
            error: "Le paramètre 'isActive' doit être 'true' ou 'false'",
          });
          return;
        }
        baseQuery.isActive = isActive === "true";
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

      const totalUsers = await User.countDocuments(baseQuery);
      const activeUsers = await User.countDocuments({
        ...baseQuery,
        isActive: true,
      });
      const inactiveUsers = await User.countDocuments({
        ...baseQuery,
        isActive: false,
      });
      const superAdminUsers = await User.countDocuments({
        ...baseQuery,
        role: "super_admin",
      });
      const adminUsers = await User.countDocuments({
        ...baseQuery,
        role: "admin",
      });
      const regularUsers = await User.countDocuments({
        ...baseQuery,
        role: "user",
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
      console.error("Erreur récupération statistiques:", error);
      res
        .status(500)
        .json({ error: "Erreur lors de la récupération des statistiques" });
    }
  },
);

/**
 * POST /api/users/me/avatar
 * Upload avatar for authenticated user
 */
router.post(
  "/me/avatar",
  authenticate,
  upload.single("avatar"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const file = (req as any).file;
      if (!file) {
        res.status(400).json({ error: "Aucun fichier fourni" });
        return;
      }

      const userId = req.user!._id;
      const user = await User.findById(userId);
      if (!user) {
        // Remove uploaded file if user not found
        try {
          fs.unlinkSync(file.path);
        } catch {}
        res.status(404).json({ error: "Utilisateur non trouvé" });
        return;
      }

      // Remove previous avatar file if present
      if ((user as any).avatar && typeof (user as any).avatar === "string") {
        try {
          const previous = (user as any).avatar.replace(/^\/?uploads\//, "");
          const previousPath = path.join(uploadsRoot, previous);
          if (fs.existsSync(previousPath)) fs.unlinkSync(previousPath);
        } catch (e) {
          // ignore remove errors
        }
      }

      // Store new avatar path (served under /uploads)
      const avatarPath = `/uploads/avatars/${file.filename}`;
      (user as any).avatar = avatarPath;
      await user.save();

      // Construire l'URL complète
      const protocol = req.protocol;
      const host = req.get("host");
      const fullAvatarUrl = `${protocol}://${host}${avatarPath}`;

      res.json({ message: "Avatar uploaded", avatarUrl: fullAvatarUrl });
    } catch (error: any) {
      console.error("Erreur upload avatar:", error);
      res.status(500).json({ error: "Erreur lors de l upload de l avatar" });
    }
  },
);

export default router;
