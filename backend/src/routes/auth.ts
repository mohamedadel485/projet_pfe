import { Router, Request, Response, NextFunction } from "express";
import { body, validationResult } from "express-validator";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import User from "../models/User";
import Invitation from "../models/Invitation";
import AccountRequest from "../models/AccountRequest";
import Tokens, { type TokenType } from "../models/Tokens";
import Monitor from "../models/Monitor";
import emailService from "../services/emailService";
import { authenticate, AuthRequest } from "../middleware/auth";
import {
  buildAuthCookieClearOptions,
  buildAuthCookieOptions,
  getAuthCookieName,
} from "../config/auth";

const router = Router();
const jwtSecret = process.env.JWT_SECRET as string;
const jwtExpiresIn = (process.env.JWT_EXPIRE ??
  "7d") as SignOptions["expiresIn"];
const PASSWORD_RESET_CODE_LENGTH = 6;
const LOGIN_OTP_CODE_LENGTH = 6;
const passwordResetCodeExpireMinutes = Number(
  process.env.PASSWORD_RESET_CODE_EXPIRE_MINUTES ?? 10,
);
const loginOtpExpireMinutes = Number(
  process.env.LOGIN_OTP_EXPIRE_MINUTES ?? 10,
);
const exposeDebugDetails =
  (process.env.NODE_ENV ?? "development") !== "production";

const generateNumericCode = (length: number): string => {
  const min = 10 ** (length - 1);
  const max = 10 ** length;
  return String(crypto.randomInt(min, max));
};

const generatePasswordResetCode = (): string =>
  generateNumericCode(PASSWORD_RESET_CODE_LENGTH);

const generateLoginOtpCode = (): string =>
  generateNumericCode(LOGIN_OTP_CODE_LENGTH);

const parseCookieHeader = (header?: string): Record<string, string> => {
  if (!header) return {};

  return header.split(";").reduce<Record<string, string>>((acc, part) => {
    const trimmed = part.trim();
    if (trimmed === "") return acc;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      acc[trimmed] = "";
      return acc;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (!key) return acc;

    try {
      acc[key] = decodeURIComponent(value);
    } catch {
      acc[key] = value;
    }
    return acc;
  }, {});
};

const parseRememberMe = (value: unknown): boolean => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["false", "0", "no", "n", "off"].includes(normalized)) return false;
  }
  return true;
};

const getIssuedTokenExpirationDate = (token: string): Date | null => {
  const decoded = jwt.decode(token);
  if (!decoded || typeof decoded !== "object" || decoded === null) {
    return null;
  }

  const exp = "exp" in decoded ? decoded.exp : undefined;
  if (typeof exp !== "number") {
    return null;
  }

  return new Date(exp * 1000);
};

const mirrorTokenRecord = async ({
  userId,
  token,
  type,
  expiresAt,
}: {
  userId: string;
  token: string;
  type: TokenType;
  expiresAt: Date;
}): Promise<void> => {
  try {
    await Tokens.deleteMany({ user: userId, type });
    await Tokens.create({
      user: userId,
      token,
      type,
      expiresAt,
    });
  } catch (error) {
    console.warn(`Impossible de synchroniser le jeton ${type}:`, error);
  }
};

const deleteTokenRecord = async (
  token: string | undefined,
  type?: TokenType,
  userId?: string,
): Promise<void> => {
  if (!token) return;

  try {
    const query: Record<string, unknown> = userId
      ? { user: userId }
      : { token };
    if (type) {
      query.type = type;
    }
    await Tokens.deleteMany(query);
  } catch (error) {
    console.warn(`Impossible de supprimer le jeton ${type ?? "unknown"}:`, error);
  }
};

const getAuthTokenFromRequest = (req: Request): string | null => {
  const headerToken = req.header("Authorization")?.replace("Bearer ", "");
  if (headerToken) {
    return headerToken;
  }

  const cookies = parseCookieHeader(req.headers.cookie);
  return cookies[getAuthCookieName()] || null;
};

const normalizeRegisterPayload = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  const body = req.body as Record<string, unknown>;

  if (typeof body.nom === "string" && typeof body.name !== "string") {
    body.name = body.nom;
  }

  if (
    typeof body.motDePasse === "string" &&
    typeof body.password !== "string"
  ) {
    body.password = body.motDePasse;
  }

  next();
};

/**
 * POST /api/auth/register
 * Inscription (premier super admin uniquement)
 */
router.post(
  "/register",
  normalizeRegisterPayload,
  [
    body("email").isEmail().withMessage("Email invalide").normalizeEmail(),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Le mot de passe doit contenir au moins 6 caracteres")
      .matches(/[A-Z]/)
      .withMessage("Le mot de passe doit contenir au moins une majuscule")
      .matches(/\d/)
      .withMessage("Le mot de passe doit contenir au moins un chiffre")
      .matches(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/)
      .withMessage(
        "Le mot de passe doit contenir au moins un caractere special",
      ),
    body("name").notEmpty().withMessage("Le nom est requis").trim(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const formattedErrors = errors.array();
        res.status(400).json({
          error: String(formattedErrors[0]?.msg ?? "Donnees invalides"),
          errors: formattedErrors,
        });
        return;
      }

      const {
        email,
        password,
        name,
        rememberMe: rawRememberMe,
      } = req.body as {
        email: string;
        password: string;
        name: string;
        rememberMe?: unknown;
      };
      const rememberMe = parseRememberMe(rawRememberMe);

      // Vérifier si un utilisateur existe déjà
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        res.status(400).json({ error: "Cet email est déjà utilisé" });
        return;
      }

      // Verifier si c'est le premier utilisateur (sera super admin)
      const userCount = await User.countDocuments();
      const role = userCount === 0 ? "super_admin" : "user";

      // Si ce n'est pas le premier utilisateur, refuser (seules les invitations sont autorisées)
      if (role === "user") {
        res.status(403).json({
          error:
            "L'inscription directe est désactivée. Vous devez être invité par un administrateur.",
        });
        return;
      }

      const user =
        existingUser ??
        new User({
          email,
          password,
          name,
          role,
        });

      await user.save();

      if (!jwtSecret) {
        res.status(500).json({
          error: "Configuration serveur invalide: JWT_SECRET manquant",
        });
        return;
      }

      const token = jwt.sign({ userId: user._id }, jwtSecret, {
        expiresIn: jwtExpiresIn,
      });
      const cookieName = getAuthCookieName();
      res.cookie(cookieName, token, buildAuthCookieOptions({ rememberMe }));

      const tokenExpiresAt = getIssuedTokenExpirationDate(token);
      if (tokenExpiresAt) {
        void mirrorTokenRecord({
          userId: user._id.toString(),
          token,
          type: "access",
          expiresAt: tokenExpiresAt,
        });
      }

      res.status(201).json({
        message: "Compte super administrateur cree avec succes",
        token,
        user: user.consulterProfil(),
      });
    } catch (error: any) {
      console.error("Erreur inscription:", error);
      res.status(500).json({ error: "Erreur lors de l'inscription" });
    }
  },
);

/**
 * POST /api/auth/login
 * Connexion
 */
router.post(
  "/login",
  normalizeRegisterPayload,
  [
    body("email").isEmail().withMessage("Email invalide").normalizeEmail(),
    body("password").notEmpty().withMessage("Mot de passe requis"),
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const formattedErrors = errors.array();
        res.status(400).json({
          error: String(formattedErrors[0]?.msg ?? "Donnees invalides"),
          errors: formattedErrors,
        });
        return;
      }

      const {
        email,
        password,
        rememberMe: rawRememberMe,
      } = req.body as {
        email: string;
        password: string;
        rememberMe?: unknown;
      };
      const rememberMe = parseRememberMe(rawRememberMe);

      const user = await User.findOne({ email });
      if (!user) {
        res.status(401).json({ error: "Email introuvable" });
        return;
      }

      if (!user.isActive) {
        res.status(403).json({
          error: "Compte désactivé",
          code: "ACCOUNT_DISABLED",
        });
        return;
      }

      const isMatch = await user.authenticate(password);
      if (!isMatch) {
        res.status(401).json({ error: "Mot de passe incorrect" });
        return;
      }

      if (!jwtSecret) {
        res.status(500).json({
          error: "Configuration serveur invalide: JWT_SECRET manquant",
        });
        return;
      }

      const loginOtpCode = generateLoginOtpCode();
      user.loginOtpCode = loginOtpCode;
      user.loginOtpExpires = new Date(
        Date.now() + loginOtpExpireMinutes * 60 * 1000,
      );
      await user.save();
      void mirrorTokenRecord({
        userId: user._id.toString(),
        token: loginOtpCode,
        type: "verify_email",
        expiresAt: user.loginOtpExpires!,
      });

      try {
        await emailService.sendLoginOtpCode(
          user.email,
          loginOtpCode,
          user.name,
        );
      } catch (mailError: any) {
        user.loginOtpCode = undefined;
        user.loginOtpExpires = undefined;
        await user.save();
        void deleteTokenRecord(
          loginOtpCode,
          "verify_email",
          user._id.toString(),
        );

        res.status(502).json({
          error:
            "Le code OTP n'a pas pu etre envoye. Verifiez la configuration SMTP.",
          details: exposeDebugDetails ? mailError?.message : undefined,
        });
        return;
      }

      res.json({
        message: "Code OTP envoye par email.",
        requiresOtp: true,
        email: user.email,
      });
    } catch (error: any) {
      console.error("Erreur connexion:", error);
      res.status(500).json({ error: "Erreur lors de la connexion" });
    }
  },
);

/**
 * POST /api/auth/login/verify-otp
 * Verifier le code OTP de connexion et ouvrir la session
 */
router.post(
  "/login/verify-otp",
  [
    body("email").isEmail().withMessage("Email invalide").normalizeEmail(),
    body("code")
      .isLength({ min: LOGIN_OTP_CODE_LENGTH, max: LOGIN_OTP_CODE_LENGTH })
      .withMessage("Code OTP invalide")
      .trim(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const formattedErrors = errors.array();
        res.status(400).json({
          error: String(formattedErrors[0]?.msg ?? "Donnees invalides"),
          errors: formattedErrors,
        });
        return;
      }

      const {
        email,
        code,
        rememberMe: rawRememberMe,
      } = req.body as {
        email: string;
        code: string;
        rememberMe?: unknown;
      };
      const rememberMe = parseRememberMe(rawRememberMe);

      const normalizedEmail = email.trim().toLowerCase();
      const user = await User.findOne({ email: normalizedEmail });

      if (!user || !user.isActive) {
        res.status(400).json({ error: "Code OTP invalide ou expire" });
        return;
      }

      if (!user.loginOtpCode || !user.loginOtpExpires) {
        res.status(400).json({ error: "Code OTP invalide ou expire" });
        return;
      }

      if (user.loginOtpExpires < new Date()) {
        user.loginOtpCode = undefined;
        user.loginOtpExpires = undefined;
        await user.save();
        void deleteTokenRecord(code.trim(), "verify_email", user._id.toString());
        res.status(400).json({ error: "Code OTP invalide ou expire" });
        return;
      }

      if (user.loginOtpCode !== code.trim()) {
        res.status(400).json({ error: "Code OTP invalide ou expire" });
        return;
      }

      user.loginOtpCode = undefined;
      user.loginOtpExpires = undefined;
      await user.save();
      void deleteTokenRecord(code.trim(), "verify_email", user._id.toString());

      if (!jwtSecret) {
        res.status(500).json({
          error: "Configuration serveur invalide: JWT_SECRET manquant",
        });
        return;
      }

      const token = jwt.sign({ userId: user._id }, jwtSecret, {
        expiresIn: jwtExpiresIn,
      });
      const cookieName = getAuthCookieName();
      res.cookie(cookieName, token, buildAuthCookieOptions({ rememberMe }));
      const tokenExpiresAt = getIssuedTokenExpirationDate(token);
      if (tokenExpiresAt) {
        void mirrorTokenRecord({
          userId: user._id.toString(),
          token,
          type: "access",
          expiresAt: tokenExpiresAt,
        });
      }

      res.json({
        message: "Connexion reussie",
        token,
        user: user.consulterProfil(),
      });
    } catch (error: any) {
      console.error("Erreur verification OTP connexion:", error);
      res
        .status(500)
        .json({ error: "Erreur lors de la verification du code OTP" });
    }
  },
);

/**
 * POST /api/auth/forgot-password
 * Envoie un code de reinitialisation de mot de passe
 */
router.post(
  "/forgot-password",
  [body("email").isEmail().withMessage("Email invalide").normalizeEmail()],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const formattedErrors = errors.array();
        res.status(400).json({
          error: String(formattedErrors[0]?.msg ?? "Donnees invalides"),
          errors: formattedErrors,
        });
        return;
      }

      const { email } = req.body as { email: string };
      const normalizedEmail = email.trim().toLowerCase();
      const user = await User.findOne({ email: normalizedEmail });

      // Reponse volontairement generique pour ne pas exposer les comptes existants.
      if (!user || !user.isActive) {
        res.json({
          message:
            "Si un compte existe pour cet email, un code de verification a ete envoye.",
        });
        return;
      }

      const resetCode = generatePasswordResetCode();
      user.passwordResetCode = resetCode;
      user.passwordResetExpires = new Date(
        Date.now() + passwordResetCodeExpireMinutes * 60 * 1000,
      );
      await user.save();
      void mirrorTokenRecord({
        userId: user._id.toString(),
        token: resetCode,
        type: "reset_password",
        expiresAt: user.passwordResetExpires!,
      });

      try {
        await emailService.sendPasswordResetCode(
          user.email,
          resetCode,
          user.name,
        );
        res.json({
          message: "Code de verification envoye par email.",
          delivery: "smtp",
        });
        return;
      } catch (mailError: any) {
        user.passwordResetCode = undefined;
        user.passwordResetExpires = undefined;
        await user.save();
        void deleteTokenRecord(
          resetCode,
          "reset_password",
          user._id.toString(),
        );

        res.status(502).json({
          error:
            "Le code de reinitialisation n'a pas pu etre envoye. Verifiez la configuration SMTP.",
          details: exposeDebugDetails ? mailError?.message : undefined,
        });
        return;
      }
    } catch (error: any) {
      console.error("Erreur forgot-password:", error);
      res.status(500).json({
        error: "Erreur lors de la demande de reinitialisation",
        details:
          process.env.NODE_ENV === "development" ? error?.message : undefined,
      });
    }
  },
);

/**
 * POST /api/auth/check-email
 * Verifier si un email existe dans la base de donnees
 */
router.post(
  "/check-email",
  [body("email").isEmail().withMessage("Email invalide")],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ error: errors.array()[0]?.msg });
        return;
      }

      const { email } = req.body;
      const normalizedEmail = String(email ?? "")
        .trim()
        .toLowerCase();
      const user = await User.findOne({ email: normalizedEmail });

      res.json({ exists: !!user });
    } catch (error: any) {
      console.error("Erreur check-email:", error);
      res.status(500).json({ error: "Erreur lors de la verification" });
    }
  },
);

/**
 * POST /api/auth/reset-password
 * Reinitialiser le mot de passe avec le code recu par email
 */
router.post(
  "/reset-password",
  [
    body("email").isEmail().withMessage("Email invalide").normalizeEmail(),
    body("code")
      .isLength({
        min: PASSWORD_RESET_CODE_LENGTH,
        max: PASSWORD_RESET_CODE_LENGTH,
      })
      .withMessage("Code invalide")
      .trim(),
    body("newPassword")
      .isLength({ min: 6 })
      .withMessage("Le mot de passe doit contenir au moins 6 caracteres")
      .matches(/[A-Z]/)
      .withMessage("Le mot de passe doit contenir au moins une majuscule")
      .matches(/\d/)
      .withMessage("Le mot de passe doit contenir au moins un chiffre")
      .matches(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/)
      .withMessage(
        "Le mot de passe doit contenir au moins un caractere special",
      ),
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const formattedErrors = errors.array();
        res.status(400).json({
          error: String(formattedErrors[0]?.msg ?? "Donnees invalides"),
          errors: formattedErrors,
        });
        return;
      }

      const { email, code, newPassword } = req.body as {
        email: string;
        code: string;
        newPassword: string;
      };

      const normalizedEmail = email.trim().toLowerCase();
      const user = await User.findOne({ email: normalizedEmail });
      if (!user || !user.isActive) {
        res.status(400).json({ error: "Code invalide ou expire" });
        return;
      }

      if (!user.passwordResetCode || !user.passwordResetExpires) {
        res.status(400).json({ error: "Code invalide ou expire" });
        return;
      }

      if (user.passwordResetExpires < new Date()) {
        user.passwordResetCode = undefined;
        user.passwordResetExpires = undefined;
        await user.save();
        void deleteTokenRecord(
          code.trim(),
          "reset_password",
          user._id.toString(),
        );
        res.status(400).json({ error: "Code invalide ou expire" });
        return;
      }

      if (user.passwordResetCode !== code.trim()) {
        res.status(400).json({ error: "Code invalide ou expire" });
        return;
      }

      await user.reinitialiserMotDePasse(newPassword);
      user.passwordResetCode = undefined;
      user.passwordResetExpires = undefined;
      await user.save();
      void deleteTokenRecord(
        code.trim(),
        "reset_password",
        user._id.toString(),
      );

      res.json({ message: "Mot de passe reinitialise avec succes" });
    } catch (error: any) {
      console.error("Erreur reset-password:", error);
      res.status(500).json({
        error: "Erreur lors de la reinitialisation du mot de passe",
        details:
          process.env.NODE_ENV === "development" ? error?.message : undefined,
      });
    }
  },
);

/**
 * POST /api/auth/change-password
 * Changer le mot de passe de l'utilisateur authentifie
 */
router.post(
  "/change-password",
  authenticate,
  [
    body("currentPassword")
      .notEmpty()
      .withMessage("Le mot de passe actuel est requis"),
    body("newPassword")
      .isLength({ min: 6 })
      .withMessage(
        "Le nouveau mot de passe doit contenir au moins 6 caracteres",
      )
      .matches(/[A-Z]/)
      .withMessage("Le mot de passe doit contenir au moins une majuscule")
      .matches(/\d/)
      .withMessage("Le mot de passe doit contenir au moins un chiffre")
      .matches(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/)
      .withMessage(
        "Le mot de passe doit contenir au moins un caractere special",
      ),
  ],
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const formattedErrors = errors.array();
        res.status(400).json({
          error: String(formattedErrors[0]?.msg ?? "Donnees invalides"),
          errors: formattedErrors,
        });
        return;
      }

      const { currentPassword, newPassword } = req.body as {
        currentPassword: string;
        newPassword: string;
      };

      const user = await User.findById(req.user!._id);
      if (!user || !user.isActive) {
        res.status(404).json({ error: "Utilisateur non trouvé" });
        return;
      }

      const isCurrentPasswordValid = await user.authenticate(currentPassword);
      if (!isCurrentPasswordValid) {
        res.status(400).json({ error: "Mot de passe actuel incorrect" });
        return;
      }

      const isSamePassword = await user.authenticate(newPassword);
      if (isSamePassword) {
        res
          .status(400)
          .json({ error: "Le nouveau mot de passe doit etre different" });
        return;
      }

      await user.reinitialiserMotDePasse(newPassword);

      res.json({ message: "Mot de passe modifie avec succes" });
    } catch (error: any) {
      console.error("Erreur change-password:", error);
      res
        .status(500)
        .json({ error: "Erreur lors du changement de mot de passe" });
    }
  },
);

/**
 * POST /api/auth/accept-invitation
 * Accepter une invitation et créer un compte
 */
router.post(
  "/accept-invitation",
  normalizeRegisterPayload,
  [
    body("token").notEmpty().withMessage("Token d'invitation requis"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Le mot de passe doit contenir au moins 6 caracteres")
      .matches(/[A-Z]/)
      .withMessage("Le mot de passe doit contenir au moins une majuscule")
      .matches(/\d/)
      .withMessage("Le mot de passe doit contenir au moins un chiffre")
      .matches(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/)
      .withMessage(
        "Le mot de passe doit contenir au moins un caractere special",
      ),
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const formattedErrors = errors.array();
        res.status(400).json({
          error: String(formattedErrors[0]?.msg ?? "Donnees invalides"),
          errors: formattedErrors,
        });
        return;
      }

      const {
        token,
        password,
        rememberMe: rawRememberMe,
      } = req.body as {
        token: string;
        password: string;
        rememberMe?: unknown;
      };
      const rememberMe = parseRememberMe(rawRememberMe);

      const invitation = await Invitation.findOne({
        token,
        status: "pending",
      }).populate("invitedBy", "name email");

      if (!invitation) {
        res
          .status(404)
          .json({ error: "Invitation non trouvée ou déjà utilisée" });
        return;
      }

      if (invitation.expiresAt < new Date()) {
        await invitation.refuser();
        res.status(400).json({ error: "Cette invitation a expiré" });
        return;
      }

      // Vérifier si l'utilisateur existe déjà
      const existingUser = await User.findOne({ email: invitation.email });
      if (existingUser) {
        res.status(400).json({ error: "Un compte existe déjà avec cet email" });
        return;
      }

      const fallbackName = invitation.email.split("@")[0] || "User";
      const invitedName =
        typeof invitation.name === "string" && invitation.name.trim() !== ""
          ? invitation.name.trim()
          : fallbackName;

      // Créer l'utilisateur
      const user = new User({
        email: invitation.email,
        password,
        name: invitedName,
        role: invitation.role ?? "user",
        invitedBy: invitation.invitedBy,
      });

      await user.save();

      const invitationMonitorIds = Array.isArray(invitation.monitorIds)
        ? invitation.monitorIds.map((monitorId) => String(monitorId))
        : [];

      if (invitationMonitorIds.length > 0) {
        await Monitor.updateMany(
          {
            _id: { $in: invitationMonitorIds },
            owner: invitation.invitedBy,
          },
          {
            $addToSet: { sharedWith: user._id },
          },
        );
      }

      // Marquer l'invitation comme acceptée
      await invitation.accepter();

      if (!jwtSecret) {
        res.status(500).json({
          error: "Configuration serveur invalide: JWT_SECRET manquant",
        });
        return;
      }

      const authToken = jwt.sign({ userId: user._id }, jwtSecret, {
        expiresIn: jwtExpiresIn,
      });
      const cookieName = getAuthCookieName();
      res.cookie(cookieName, authToken, buildAuthCookieOptions({ rememberMe }));
      const authTokenExpiresAt = getIssuedTokenExpirationDate(authToken);
      if (authTokenExpiresAt) {
        void mirrorTokenRecord({
          userId: user._id.toString(),
          token: authToken,
          type: "access",
          expiresAt: authTokenExpiresAt,
        });
      }

      res.status(201).json({
        message: "Compte créé avec succès",
        token: authToken,
        user: user.consulterProfil(),
      });
    } catch (error: any) {
      console.error("Erreur acceptation invitation:", error);
      res
        .status(500)
        .json({ error: "Erreur lors de l'acceptation de l'invitation" });
    }
  },
);

/**
 * GET /api/auth/me
 * Obtenir les informations de l'utilisateur connecté
 */
router.get(
  "/me",
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      res.json({
        user: req.user!.consulterProfil(),
      });
    } catch (error: any) {
      console.error("Erreur récupération profil:", error);
      res
        .status(500)
        .json({ error: "Erreur lors de la récupération du profil" });
    }
  },
);

/**
 * POST /api/auth/request-account
 * Demande de creation de compte envoye au super admin
 */
router.post(
  "/request-account",
  [
    body("email")
      .isEmail()
      .withMessage("Veuillez fournir une adresse email valide")
      .normalizeEmail(),
    body("name")
      .trim()
      .notEmpty()
      .withMessage("Le nom est requis")
      .isLength({ min: 2, max: 100 })
      .withMessage("Le nom doit contenir entre 2 et 100 caracteres"),
    body("message")
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage("Le message ne doit pas depasser 500 caracteres"),
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const messages = errors.array().map((e) => e.msg);
        res.status(400).json({
          error: messages.join(". "),
          code: "VALIDATION_ERROR",
        });
        return;
      }

      const { email, name, message } = req.body;
      const normalizedEmail = String(email ?? "")
        .trim()
        .toLowerCase();
      const normalizedName = String(name ?? "").trim();
      const normalizedMessage =
        typeof message === "string" ? message.trim() : undefined;

      // Si le compte existe deja, on conserve quand meme la demande pour le suivi admin.
      const existingUser = await User.findOne({ email: normalizedEmail });

      // Verifier si une demande en attente existe deja pour cet email
      const existingPendingRequest = await AccountRequest.findOne({
        email: normalizedEmail,
        status: "pending",
      });

      if (existingPendingRequest) {
        res.status(409).json({
          error:
            "Une demande de création de compte est déjà en attente pour cet email. Veuillez attendre la réponse du super administrateur.",
          code: "REQUEST_ALREADY_PENDING",
        });
        return;
      }

      // Créer la demande en base de données
      const accountRequest = new AccountRequest({
        email: normalizedEmail,
        name: normalizedName,
        message: normalizedMessage,
        status: "pending",
      });
      await accountRequest.save();

      // Envoyer une notification au super admin sans bloquer l'enregistrement.
      const superAdmins = await User.find({
        role: "super_admin",
        isActive: true,
      })
        .select("email")
        .sort({ createdAt: 1 });

      if (superAdmins.length > 0) {
        const deliveries = await Promise.allSettled(
          superAdmins
            .filter(
              (admin) =>
                typeof admin.email === "string" && admin.email.trim() !== "",
            )
            .map((admin) =>
              emailService.sendAccountRequestEmail({
                to: admin.email,
                requesterEmail: normalizedEmail,
                requesterName: normalizedName,
                requesterMessage: normalizedMessage,
              }),
            ),
        );

        const failedDeliveries = deliveries.filter(
          (result): result is PromiseRejectedResult =>
            result.status === "rejected",
        );

        if (failedDeliveries.length > 0) {
          console.error(
            "Erreur lors de l'envoi de la notification de demande:",
            failedDeliveries[0]?.reason,
          );
        }
      }

      res.status(200).json({
        message:
          "Votre demande de creation de compte a ete envoyee au super administrateur.",
        warning: existingUser
          ? "Un compte avec cet email existe deja, mais la demande a ete enregistree pour suivi."
          : undefined,
        request: {
          id: accountRequest._id,
          email: accountRequest.email,
          name: accountRequest.name,
          status: accountRequest.status,
          createdAt: accountRequest.createdAt,
        },
      });
    } catch (error) {
      console.error("Erreur lors de la demande de compte:", error);
      res.status(500).json({
        error: "Impossible d'envoyer la demande. Veuillez reessayer plus tard.",
        code: "REQUEST_FAILED",
      });
    }
  },
);

/**
 * GET /api/auth/account-requests
 * Récupérer toutes les demandes de création de compte (super admin uniquement)
 */
router.get(
  "/account-requests",
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      // Vérifier que l'utilisateur est super admin
      if (req.user!.role !== "super_admin") {
        res.status(403).json({
          error: "Accès refusé. Seul le super admin peut voir les demandes.",
        });
        return;
      }

      const requests = await AccountRequest.find().sort({ createdAt: -1 });
      const serializedRequests = requests.map((request) => ({
        id: request._id.toString(),
        email: request.email,
        name: request.name,
        message: request.message,
        status: request.status,
        createdAt: request.createdAt,
        approvedAt: request.approvedAt,
        approvedBy: request.approvedBy?.toString(),
      }));

      res.json({ requests: serializedRequests });
    } catch (error) {
      console.error("Erreur lors de la récupération des demandes:", error);
      res.status(500).json({ error: "Impossible de récupérer les demandes" });
    }
  },
);

/**
 * POST /api/auth/approve-request
 * Approuver une demande de création de compte (super admin uniquement)
 */
router.post(
  "/approve-request",
  authenticate,
  [
    body("requestId").notEmpty().withMessage("L'ID de la demande est requis"),
    body("tempPassword")
      .isLength({ min: 6 })
      .withMessage("Le mot de passe doit contenir au moins 6 caractères"),
    body("role")
      .optional()
      .isIn(["user", "admin"])
      .withMessage("Le rôle doit être 'user' ou 'admin'"),
    body("monitorIds")
      .optional()
      .isArray()
      .withMessage("monitorIds doit être un tableau"),
  ],
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ error: errors.array()[0]?.msg });
        return;
      }

      // Vérifier que l'utilisateur est super admin
      if (req.user!.role !== "super_admin") {
        res.status(403).json({
          error:
            "Accès refusé. Seul le super admin peut approuver les demandes.",
        });
        return;
      }

      const {
        requestId,
        tempPassword,
        role = "user",
        monitorIds = [],
      } = req.body;
      const uniqueMonitorIds = Array.isArray(monitorIds)
        ? Array.from(
            new Set(
              monitorIds
                .map((monitorId: unknown) => String(monitorId).trim())
                .filter((monitorId: string) => monitorId !== ""),
            ),
          )
        : [];

      const normalizedMonitorIds = uniqueMonitorIds.filter((monitorId) =>
        /^[a-f\d]{24}$/i.test(monitorId),
      );

      if (normalizedMonitorIds.length !== uniqueMonitorIds.length) {
        res.status(400).json({ error: "Un monitorId est invalide" });
        return;
      }

      if (normalizedMonitorIds.length > 0) {
        const allowedMonitorCount = await Monitor.countDocuments({
          _id: { $in: normalizedMonitorIds },
          owner: req.user!._id,
        });

        if (allowedMonitorCount !== normalizedMonitorIds.length) {
          res
            .status(403)
            .json({ error: "Certains monitors ne vous appartiennent pas" });
          return;
        }
      }

      // RÃ©cupÃ©rer la demande
      const request = await AccountRequest.findById(requestId);
      if (!request) {
        res.status(404).json({ error: "Demande non trouvÃ©e" });
        return;
      }

      if (request.status !== "pending") {
        res
          .status(400)
          .json({ error: "Cette demande a dÃ©jÃ  Ã©tÃ© traitÃ©e" });
        return;
      }

      // VÃ©rifier si l'utilisateur existe dÃ©jÃ
      const existingUser = await User.findOne({ email: request.email });
      if (existingUser && !existingUser.isActive) {
        existingUser.isActive = true;
      }

      // CrÃ©er l'utilisateur uniquement s'il n'existe pas encore
      const user =
        existingUser ??
        new User({
          email: request.email,
          name: request.name,
          password: tempPassword,
          role: role,
        });
      await user.save();

      if (normalizedMonitorIds.length > 0) {
        await Monitor.updateMany(
          {
            _id: { $in: normalizedMonitorIds },
            owner: req.user!._id,
          },
          {
            $addToSet: { sharedWith: user._id },
          },
        );
      }

      // Mettre à jour la demande
      await request.accepter(req.user!._id);

      if (!existingUser) {
        // Envoyer un email Ã  l'utilisateur avec ses credentials uniquement pour un nouveau compte
        await emailService.sendAccountApprovedEmail({
          to: request.email,
          name: request.name,
          email: request.email,
          tempPassword,
        });
      }

      res.json({
        message: existingUser
          ? "Demande approuvÃ©e avec succÃ¨s. Le compte existait dÃ©jÃ ."
          : "Demande approuvÃ©e avec succÃ¨s. Un email a Ã©tÃ© envoyÃ© Ã  l'utilisateur.",
        user: user.consulterProfil(),
        assignedMonitorCount: normalizedMonitorIds.length,
      });
    } catch (error) {
      console.error("Erreur lors de l'approbation de la demande:", error);
      res.status(500).json({ error: "Impossible d'approuver la demande" });
    }
  },
);

/**
 * POST /api/auth/reject-request
 * Rejeter une demande de création de compte (super admin uniquement)
 */
router.post(
  "/reject-request",
  authenticate,
  [body("requestId").notEmpty().withMessage("L'ID de la demande est requis")],
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ error: errors.array()[0]?.msg });
        return;
      }

      // Vérifier que l'utilisateur est super admin
      if (req.user!.role !== "super_admin") {
        res.status(403).json({
          error: "Accès refusé. Seul le super admin peut rejeter les demandes.",
        });
        return;
      }

      const { requestId } = req.body;

      // Récupérer la demande
      const request = await AccountRequest.findById(requestId);
      if (!request) {
        res.status(404).json({ error: "Demande non trouvée" });
        return;
      }

      if (request.status !== "pending") {
        res.status(400).json({ error: "Cette demande a déjà été traitée" });
        return;
      }

      // Mettre à jour la demande
      await request.refuser();

      res.json({ message: "Demande rejetée avec succès" });
    } catch (error) {
      console.error("Erreur lors du rejet de la demande:", error);
      res.status(500).json({ error: "Impossible de rejeter la demande" });
    }
  },
);

/**
 * DELETE /api/auth/account-requests
 * Supprimer les demandes de création de compte par statut (super admin uniquement)
 */
router.delete(
  "/account-requests",
  authenticate,
  [
    body("status")
      .optional()
      .isIn(["approved", "rejected"])
      .withMessage("Le statut doit être 'approved' ou 'rejected'"),
  ],
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ error: errors.array()[0]?.msg });
        return;
      }

      // Vérifier que l'utilisateur est super admin
      if (req.user!.role !== "super_admin") {
        res.status(403).json({
          error:
            "Accès refusé. Seul le super admin peut supprimer les demandes.",
        });
        return;
      }

      const { status } = req.body as { status?: "approved" | "rejected" };

      // Construire la requête de suppression
      const query: any = {};
      if (status) {
        query.status = status;
      } else {
        // Si pas de statut spécifié, supprimer toutes les demandes traitées (approved ou rejected)
        query.status = { $in: ["approved", "rejected"] };
      }

      const result = await AccountRequest.deleteMany(query);

      res.json({
        message: `${result.deletedCount} demande(s) supprimée(s) avec succès`,
        deletedCount: result.deletedCount,
      });
    } catch (error) {
      console.error("Erreur lors de la suppression des demandes:", error);
      res.status(500).json({ error: "Impossible de supprimer les demandes" });
    }
  },
);

/**
 * POST /api/auth/logout
 * Deconnexion (supprime le cookie)
 */
router.post("/logout", (_req: Request, res: Response): void => {
  const cookieName = getAuthCookieName();
  res.clearCookie(cookieName, buildAuthCookieClearOptions());
  const token = getAuthTokenFromRequest(_req);
  void deleteTokenRecord(token ?? undefined, "access");
  res.json({ message: "Deconnexion reussie" });
});

export default router;
