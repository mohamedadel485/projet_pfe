import { Request, Response } from "express";
import { validationResult } from "express-validator";
import jwt from "jsonwebtoken";
import Utilisateur from "../models/Utilisateur";
import Invitation from "../models/Invitation";
import DemandeCompte from "../models/DemandeCompte";
import Monitor from "../models/Moniteur";
import emailService from "../services/emailService";
import { AuthRequest } from "../middleware/auth";
import { findUserByEmail } from "../utils/email";
import {
  jwtSecret,
  jwtExpiresIn,
  generatePasswordResetCode,
  generateLoginOtpCode,
  parseRememberMe,
  getIssuedTokenExpirationDate,
  mirrorTokenRecord,
  deleteTokenRecord,
  getAuthTokenFromRequest,
  PASSWORD_RESET_CODE_LENGTH,
  LOGIN_OTP_CODE_LENGTH,
  passwordResetCodeExpireMinutes,
  loginOtpExpireMinutes,
  exposeDebugDetails,
} from "../utils/authTokenHelpers";
import {
  buildAuthCookieClearOptions,
  buildAuthCookieOptions,
  getAuthCookieName,
} from "../config/auth";

const authController = {
  register: async (req: Request, res: Response): Promise<void> => {
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

      const existingUser = await findUserByEmail(email);
      if (existingUser) {
        res.status(400).json({ error: "Cet email est déjà utilisé" });
        return;
      }

      const userCount = await Utilisateur.countDocuments();
      const role = userCount === 0 ? "super_admin" : "user";

      if (role === "user") {
        res.status(403).json({
          error:
            "L'inscription directe est désactivée. Vous devez être invité par un administrateur.",
        });
        return;
      }

      const user =
        existingUser ??
        new Utilisateur({
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

  login: async (req: Request, res: Response): Promise<void> => {
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

      const user = await findUserByEmail(email);
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

  verifyLoginOtp: async (req: Request, res: Response): Promise<void> => {
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

      const user = await findUserByEmail(email);

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
        void deleteTokenRecord(
          code.trim(),
          "verify_email",
          user._id.toString(),
        );
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

  forgotPassword: async (req: Request, res: Response): Promise<void> => {
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
      const user = await findUserByEmail(email);

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

  checkEmail: async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ error: errors.array()[0]?.msg });
        return;
      }

      const { email } = req.body;
      const user = await findUserByEmail(email);

      res.json({ exists: !!user });
    } catch (error: any) {
      console.error("Erreur check-email:", error);
      res.status(500).json({ error: "Erreur lors de la verification" });
    }
  },

  resetPassword: async (req: Request, res: Response): Promise<void> => {
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

      const user = await findUserByEmail(email);
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

  changePassword: async (req: AuthRequest, res: Response): Promise<void> => {
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

      const user = await Utilisateur.findById(req.user!._id);
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

  acceptInvitation: async (req: Request, res: Response): Promise<void> => {
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

      const existingUser = await findUserByEmail(invitation.email);
      if (existingUser) {
        res.status(400).json({ error: "Un compte existe déjà avec cet email" });
        return;
      }

      const fallbackName = invitation.email.split("@")[0] || "User";
      const invitedName =
        typeof invitation.name === "string" && invitation.name.trim() !== ""
          ? invitation.name.trim()
          : fallbackName;

      const user = new Utilisateur({
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

  me: async (req: AuthRequest, res: Response): Promise<void> => {
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

  requestAccount: async (req: Request, res: Response): Promise<void> => {
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

      const existingUser = await Utilisateur.findOne({
        email: normalizedEmail,
      });

      const existingPendingRequest = await DemandeCompte.findOne({
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

      const accountRequest = new DemandeCompte({
        email: normalizedEmail,
        name: normalizedName,
        message: normalizedMessage,
        status: "pending",
      });
      await accountRequest.save();

      const superAdmins = await Utilisateur.find({
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

  getAccountRequests: async (
    req: AuthRequest,
    res: Response,
  ): Promise<void> => {
    try {
      if (req.user!.role !== "super_admin") {
        res.status(403).json({
          error: "Accès refusé. Seul le super admin peut voir les demandes.",
        });
        return;
      }

      const requests = await DemandeCompte.find().sort({ createdAt: -1 });
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

  approveRequest: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ error: errors.array()[0]?.msg });
        return;
      }

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

      const request = await DemandeCompte.findById(requestId);
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

      const existingUser = await findUserByEmail(request.email);
      if (existingUser && !existingUser.isActive) {
        existingUser.isActive = true;
      }

      const user =
        existingUser ??
        new Utilisateur({
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

      await request.accepter(req.user!._id);

      if (!existingUser) {
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

  rejectRequest: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ error: errors.array()[0]?.msg });
        return;
      }

      if (req.user!.role !== "super_admin") {
        res.status(403).json({
          error: "Accès refusé. Seul le super admin peut rejeter les demandes.",
        });
        return;
      }

      const { requestId } = req.body;

      const request = await DemandeCompte.findById(requestId);
      if (!request) {
        res.status(404).json({ error: "Demande non trouvée" });
        return;
      }

      if (request.status !== "pending") {
        res.status(400).json({ error: "Cette demande a déjà été traitée" });
        return;
      }

      await request.refuser();

      try {
        await emailService.sendAccountRejectedEmail({
          to: request.email,
          name: request.name,
        });
        res.json({
          message:
            "Demande rejetée avec succès. Un email d'information a été envoyé au demandeur.",
        });
      } catch (mailError) {
        console.error(
          "Erreur envoi email de refus de demande:",
          mailError,
        );
        res.json({
          message: "Demande rejetée avec succès.",
          warning:
            "L'email d'information n'a pas pu être envoyé au demandeur. Vérifiez la configuration SMTP.",
        });
      }
    } catch (error) {
      console.error("Erreur lors du rejet de la demande:", error);
      res.status(500).json({ error: "Impossible de rejeter la demande" });
    }
  },

  deleteAccountRequests: async (
    req: AuthRequest,
    res: Response,
  ): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ error: errors.array()[0]?.msg });
        return;
      }

      if (req.user!.role !== "super_admin") {
        res.status(403).json({
          error:
            "Accès refusé. Seul le super admin peut supprimer les demandes.",
        });
        return;
      }

      const { status } = req.body as { status?: "approved" | "rejected" };

      const query: any = {};
      if (status) {
        query.status = status;
      } else {
        query.status = { $in: ["approved", "rejected"] };
      }

      const result = await DemandeCompte.deleteMany(query);

      res.json({
        message: `${result.deletedCount} demande(s) supprimée(s) avec succès`,
        deletedCount: result.deletedCount,
      });
    } catch (error) {
      console.error("Erreur lors de la suppression des demandes:", error);
      res.status(500).json({ error: "Impossible de supprimer les demandes" });
    }
  },

  logout: (req: Request, res: Response): void => {
    const cookieName = getAuthCookieName();
    res.clearCookie(cookieName, buildAuthCookieClearOptions());
    const token = getAuthTokenFromRequest(req);
    void deleteTokenRecord(token ?? undefined, "access");
    res.json({ message: "Deconnexion reussie" });
  },
};

export default authController;
