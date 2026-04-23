import { Router, Response } from "express";
import { body, validationResult } from "express-validator";
import User from "../models/User";
import Monitor from "../models/Monitor";
import MonitorLog from "../models/MonitorLog";
import emailService from "../services/emailService";
import monitorService from "../services/monitorService";
import { authenticate, AuthRequest } from "../middleware/auth";

const router = Router();
const METHODS_WITHOUT_BODY = new Set(["HEAD", "GET", "DELETE", "OPTIONS"]);

/**
 * POST /api/monitors
 * Créer un nouveau monitor
 */
router.post(
  "/",
  authenticate,
  [
    body("name").notEmpty().trim(),
    body("url").isURL({
      protocols: ["http", "https", "ws", "wss"],
      require_protocol: true,
    }),
    body("type").optional().isIn(["http", "https", "ws", "wss"]),
    body("interval").optional().isInt({ min: 1 }),
    body("timeout").optional().isInt({ min: 5, max: 300 }),
    body("httpMethod")
      .optional()
      .isIn(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]),
    body("expectedStatusCode").optional().isInt({ min: 100, max: 599 }),
    body("ipVersion")
      .optional()
      .isIn([
        "IPv4 / IPv6 (IPv4 Priority)",
        "IPv6 / IPv4 (IPv6 Priority)",
        "IPv4 only",
        "IPv6 only",
      ]),
    body("followRedirections").optional().isBoolean(),
    body("upStatusCodeGroups").optional().isArray({ min: 1 }),
    body("upStatusCodeGroups.*").optional().isIn(["2xx", "3xx"]),
    body("domainExpiryMode").optional().isIn(["enabled", "disabled"]),
    body("sslExpiryMode").optional().isIn(["enabled", "disabled"]),
    body("body").optional().isString(),
    body("headers").optional().isObject(),
    body("responseValidation").optional().isObject(),
    body("responseValidation.field").optional().isIn(["status"]),
    body("responseValidation.mode").optional().isIn(["value", "type"]),
    body("responseValidation.expectedValue").optional().isString(),
    body("responseValidation.expectedType")
      .optional()
      .isIn(["string", "boolean", "number"]),
  ],
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const monitorData = {
        ...req.body,
        owner: req.user!._id,
      };
      if (
        METHODS_WITHOUT_BODY.has(
          String(monitorData.httpMethod ?? "").toUpperCase(),
        )
      ) {
        delete monitorData.body;
      }
      if (monitorData.responseValidation) {
        const responseValidation = monitorData.responseValidation as {
          field?: string;
          mode?: string;
          expectedValue?: unknown;
          expectedType?: unknown;
        };
        const mode = String(responseValidation.mode ?? "").toLowerCase();
        responseValidation.field = "status";

        if (mode === "value") {
          const expectedValue = String(
            responseValidation.expectedValue ?? "",
          ).trim();
          if (expectedValue === "") {
            res
              .status(400)
              .json({
                error:
                  "responseValidation.expectedValue est requis pour le mode value",
              });
            return;
          }
          responseValidation.mode = "value";
          responseValidation.expectedValue = expectedValue;
          delete responseValidation.expectedType;
        } else if (mode === "type") {
          const expectedType = String(responseValidation.expectedType ?? "")
            .trim()
            .toLowerCase();
          if (!["string", "boolean", "number"].includes(expectedType)) {
            res
              .status(400)
              .json({
                error:
                  "responseValidation.expectedType invalide pour le mode type",
              });
            return;
          }
          responseValidation.mode = "type";
          responseValidation.expectedType = expectedType;
          delete responseValidation.expectedValue;
        } else {
          delete monitorData.responseValidation;
        }
      }

      const monitor = new Monitor(monitorData);
      await monitor.save();

      // Execute a first check immediately so new monitors do not stay pending
      // while waiting for the next scheduler cycle.
      try {
        const firstResult = await monitorService.checkMonitor(monitor);
        await monitorService.logCheckResult(monitor, firstResult);
      } catch (error) {
        console.warn("Erreur verification immediate (creation monitor):", error);
      }

      if (
        monitor.domainExpiryMode === "enabled" ||
        monitor.sslExpiryMode === "enabled"
      ) {
        try {
          await monitorService.refreshSecurityChecks(monitor);
        } catch (error) {
          console.warn(
            "Erreur verification SSL/WHOIS (creation monitor):",
            error,
          );
        }
      }

      res.status(201).json({
        message: "Monitor créé avec succès",
        monitor,
      });
    } catch (error: any) {
      console.error("Erreur création monitor:", error);
      res.status(500).json({ error: "Erreur lors de la création du monitor" });
    }
  },
);

/**
 * GET /api/monitors
 * Lister tous les monitors de l'utilisateur
 */
router.get(
  "/",
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { status, type } = req.query;

      const query: any = {
        $or: [{ owner: req.user!._id }, { sharedWith: req.user!._id }],
      };

      if (status) {
        query.status = status;
      }
      if (type) {
        query.type = type;
      }

      const monitors = await Monitor.find(query)
        .populate("owner", "name email")
        .sort({ createdAt: -1 });

      res.json({ monitors });
    } catch (error: any) {
      console.error("Erreur récupération monitors:", error);
      res
        .status(500)
        .json({ error: "Erreur lors de la récupération des monitors" });
    }
  },
);

/**
 * GET /api/monitors/:id
 * Obtenir un monitor par ID
 */
router.get(
  "/:id",
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const monitor = await Monitor.findOne({
        _id: id,
        $or: [{ owner: req.user!._id }, { sharedWith: req.user!._id }],
      }).populate("owner", "name email");

      if (!monitor) {
        res.status(404).json({ error: "Monitor non trouvé" });
        return;
      }

      res.json({ monitor });
    } catch (error: any) {
      console.error("Erreur récupération monitor:", error);
      res
        .status(500)
        .json({ error: "Erreur lors de la récupération du monitor" });
    }
  },
);

/**
 * PUT /api/monitors/:id
 * Mettre à jour un monitor
 */
router.put(
  "/:id",
  authenticate,
  [
    body("name").optional().trim().notEmpty(),
    body("url")
      .optional()
      .isURL({
        protocols: ["http", "https", "ws", "wss"],
        require_protocol: true,
      }),
    body("type").optional().isIn(["http", "https", "ws", "wss"]),
    body("interval").optional().isInt({ min: 1 }),
    body("timeout").optional().isInt({ min: 5, max: 300 }),
    body("httpMethod")
      .optional()
      .isIn(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]),
    body("ipVersion")
      .optional()
      .isIn([
        "IPv4 / IPv6 (IPv4 Priority)",
        "IPv6 / IPv4 (IPv6 Priority)",
        "IPv4 only",
        "IPv6 only",
      ]),
    body("followRedirections").optional().isBoolean(),
    body("upStatusCodeGroups").optional().isArray({ min: 1 }),
    body("upStatusCodeGroups.*").optional().isIn(["2xx", "3xx"]),
    body("domainExpiryMode").optional().isIn(["enabled", "disabled"]),
    body("sslExpiryMode").optional().isIn(["enabled", "disabled"]),
    body("body").optional().isString(),
    body("headers").optional().isObject(),
    body("responseValidation").optional().isObject(),
    body("responseValidation.field").optional().isIn(["status"]),
    body("responseValidation.mode").optional().isIn(["value", "type"]),
    body("responseValidation.expectedValue").optional().isString(),
    body("responseValidation.expectedType")
      .optional()
      .isIn(["string", "boolean", "number"]),
  ],
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { id } = req.params;

      const monitor = await Monitor.findOne({
        _id: id,
        owner: req.user!._id,
      });

      if (!monitor) {
        res
          .status(404)
          .json({
            error: "Monitor non trouvé ou vous n'êtes pas le propriétaire",
          });
        return;
      }

      const updatePayload = { ...req.body } as Record<string, unknown>;
      if (
        METHODS_WITHOUT_BODY.has(
          String(
            updatePayload.httpMethod ?? monitor.httpMethod ?? "",
          ).toUpperCase(),
        )
      ) {
        delete updatePayload.body;
      }
      if (
        updatePayload.responseValidation &&
        typeof updatePayload.responseValidation === "object"
      ) {
        const responseValidation = updatePayload.responseValidation as {
          field?: string;
          mode?: string;
          expectedValue?: unknown;
          expectedType?: unknown;
        };
        const mode = String(responseValidation.mode ?? "").toLowerCase();
        responseValidation.field = "status";

        if (mode === "value") {
          const expectedValue = String(
            responseValidation.expectedValue ?? "",
          ).trim();
          if (expectedValue === "") {
            res
              .status(400)
              .json({
                error:
                  "responseValidation.expectedValue est requis pour le mode value",
              });
            return;
          }
          responseValidation.mode = "value";
          responseValidation.expectedValue = expectedValue;
          delete responseValidation.expectedType;
        } else if (mode === "type") {
          const expectedType = String(responseValidation.expectedType ?? "")
            .trim()
            .toLowerCase();
          if (!["string", "boolean", "number"].includes(expectedType)) {
            res
              .status(400)
              .json({
                error:
                  "responseValidation.expectedType invalide pour le mode type",
              });
            return;
          }
          responseValidation.mode = "type";
          responseValidation.expectedType = expectedType;
          delete responseValidation.expectedValue;
        } else {
          delete updatePayload.responseValidation;
        }
      }

      Object.assign(monitor, updatePayload);
      await monitor.save();

      if (
        monitor.domainExpiryMode === "enabled" ||
        monitor.sslExpiryMode === "enabled"
      ) {
        try {
          await monitorService.refreshSecurityChecks(monitor);
        } catch (error) {
          console.warn(
            "Erreur verification SSL/WHOIS (update monitor):",
            error,
          );
        }
      }

      res.json({
        message: "Monitor mis à jour avec succès",
        monitor,
      });
    } catch (error: any) {
      console.error("Erreur mise à jour monitor:", error);
      res
        .status(500)
        .json({ error: "Erreur lors de la mise à jour du monitor" });
    }
  },
);

/**
 * DELETE /api/monitors/:id
 * Supprimer un monitor
 */
router.delete(
  "/:id",
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const monitor = await Monitor.findOne({
        _id: id,
        owner: req.user!._id,
      });

      if (!monitor) {
        res
          .status(404)
          .json({
            error: "Monitor non trouvé ou vous n'êtes pas le propriétaire",
          });
        return;
      }

      await monitor.deleteOne();
      await MonitorLog.deleteMany({ monitor: id });

      res.json({ message: "Monitor supprimé avec succès" });
    } catch (error: any) {
      console.error("Erreur suppression monitor:", error);
      res
        .status(500)
        .json({ error: "Erreur lors de la suppression du monitor" });
    }
  },
);

/**
 * POST /api/monitors/:id/pause
 * Mettre en pause un monitor
 */
router.post(
  "/:id/pause",
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const monitor = await Monitor.findOne({
        _id: id,
        owner: req.user!._id,
      });

      if (!monitor) {
        res.status(404).json({ error: "Monitor non trouvé" });
        return;
      }

      monitor.status = "paused";
      monitor.pausedByMaintenance = false;
      await monitor.save();

      res.json({
        message: "Monitor mis en pause",
        monitor,
      });
    } catch (error: any) {
      console.error("Erreur pause monitor:", error);
      res
        .status(500)
        .json({ error: "Erreur lors de la mise en pause du monitor" });
    }
  },
);

/**
 * POST /api/monitors/:id/resume
 * Reprendre un monitor en pause
 */
router.post(
  "/:id/resume",
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const monitor = await Monitor.findOne({
        _id: id,
        owner: req.user!._id,
      });

      if (!monitor) {
        res.status(404).json({ error: "Monitor non trouvé" });
        return;
      }

      monitor.status = "pending";
      monitor.pausedByMaintenance = false;
      await monitor.save();

      // Trigger an immediate check on resume to refresh status right away.
      try {
        const resumeResult = await monitorService.checkMonitor(monitor);
        await monitorService.logCheckResult(monitor, resumeResult);
      } catch (error) {
        console.warn("Erreur verification immediate (resume monitor):", error);
      }

      res.json({
        message: "Monitor repris",
        monitor,
      });
    } catch (error: any) {
      console.error("Erreur reprise monitor:", error);
      res.status(500).json({ error: "Erreur lors de la reprise du monitor" });
    }
  },
);

/**
 * POST /api/monitors/:id/check
 * Vérifier manuellement un monitor
 */
router.post(
  "/:id/check",
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const monitor = await Monitor.findOne({
        _id: id,
        $or: [{ owner: req.user!._id }, { sharedWith: req.user!._id }],
      });

      if (!monitor) {
        res.status(404).json({ error: "Monitor non trouvé" });
        return;
      }

      const result = await monitorService.checkMonitor(monitor);
      await monitorService.logCheckResult(monitor, result);
      try {
        await monitorService.refreshSecurityChecks(monitor);
      } catch (error) {
        console.warn("Erreur verification SSL/WHOIS (manual check):", error);
      }

      res.json({
        message: "Vérification effectuée",
        result: {
          status: result.status,
          responseTime: result.responseTime,
          statusCode: result.statusCode,
          errorMessage: result.errorMessage,
        },
        monitor,
      });
    } catch (error: any) {
      console.error("Erreur vérification monitor:", error);
      res
        .status(500)
        .json({ error: "Erreur lors de la vérification du monitor" });
    }
  },
);

/**
 * GET /api/monitors/:id/logs
 * Obtenir l'historique des vérifications
 */
router.get(
  "/:id/logs",
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { limit = 100, page = 1, startDate, endDate } = req.query;

      const monitor = await Monitor.findOne({
        _id: id,
        $or: [{ owner: req.user!._id }, { sharedWith: req.user!._id }],
      });

      if (!monitor) {
        res.status(404).json({ error: "Monitor non trouvé" });
        return;
      }

      const parsedLimit = Number(limit);
      const parsedPage = Number(page);

      const safeLimit =
        Number.isFinite(parsedLimit) && parsedLimit >= 0
          ? Math.min(Math.floor(parsedLimit), 50000)
          : 100;
      const safePage =
        Number.isFinite(parsedPage) && parsedPage > 0
          ? Math.floor(parsedPage)
          : 1;

      const query: Record<string, unknown> = { monitor: id };
      const checkedAtFilter: Record<string, Date> = {};

      if (typeof startDate === "string" && startDate.trim() !== "") {
        const parsedStartDate = new Date(startDate);
        if (!Number.isNaN(parsedStartDate.getTime())) {
          checkedAtFilter.$gte = parsedStartDate;
        }
      }

      if (typeof endDate === "string" && endDate.trim() !== "") {
        const parsedEndDate = new Date(endDate);
        if (!Number.isNaN(parsedEndDate.getTime())) {
          checkedAtFilter.$lte = parsedEndDate;
        }
      }

      if (Object.keys(checkedAtFilter).length > 0) {
        query.checkedAt = checkedAtFilter;
      }

      const total = await MonitorLog.countDocuments(query);

      let logsQuery = MonitorLog.find(query).sort({ checkedAt: -1 });
      let currentPage = safePage;
      let currentLimit = safeLimit;

      if (safeLimit > 0) {
        const skip = (safePage - 1) * safeLimit;
        logsQuery = logsQuery.limit(safeLimit).skip(skip);
      } else {
        currentPage = 1;
        currentLimit = total;
      }

      const logs = await logsQuery;

      res.json({
        logs,
        pagination: {
          total,
          page: currentPage,
          limit: currentLimit,
          pages: currentLimit > 0 ? Math.ceil(total / currentLimit) : 1,
        },
      });
    } catch (error: any) {
      console.error("Erreur récupération logs:", error);
      res
        .status(500)
        .json({ error: "Erreur lors de la récupération des logs" });
    }
  },
);

/**
 * POST /api/monitors/:id/share
 * Partager un monitor avec un utilisateur
 */
router.post(
  "/:id/share",
  authenticate,
  [body("userId").notEmpty()],
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { userId } = req.body;
      const normalizedUserId = String(userId).trim();

      const monitor = await Monitor.findOne({
        _id: id,
        owner: req.user!._id,
      });

      if (!monitor) {
        res.status(404).json({ error: "Monitor non trouvé" });
        return;
      }

      const targetUser = await User.findById(normalizedUserId).select(
        "name email isActive",
      );
      if (!targetUser) {
        res.status(404).json({ error: "Utilisateur non trouve" });
        return;
      }

      if (!targetUser.isActive) {
        res.status(400).json({ error: "Cet utilisateur est desactive" });
        return;
      }

      const alreadyShared = monitor.sharedWith.some(
        (sharedUserId) => sharedUserId.toString() === normalizedUserId,
      );
      if (alreadyShared) {
        res
          .status(400)
          .json({ error: "Monitor déjà partagé avec cet utilisateur" });
        return;
      }

      monitor.sharedWith.push(targetUser._id);
      await monitor.save();

      try {
        await emailService.sendMonitorAccessNotification(
          targetUser.email,
          targetUser.name,
          monitor.name,
          monitor.id,
          req.user?.name,
        );
      } catch (mailError) {
        console.error("Notification email partage monitor echouee:", mailError);
        res.json({
          message: "Monitor partage avec succes.",
          warning:
            "Acces ajoute, mais la notification email n'a pas pu etre envoyee.",
          monitor,
        });
        return;
      }

      res.json({
        message:
          "Monitor partage avec succes et notification envoyee par email.",
        monitor,
      });
    } catch (error: any) {
      console.error("Erreur partage monitor:", error);
      res.status(500).json({ error: "Erreur lors du partage du monitor" });
    }
  },
);

/**
 * DELETE /api/monitors/:id/share/:userId
 * Retirer le partage d'un monitor
 */
router.delete(
  "/:id/share/:userId",
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id, userId } = req.params;

      const monitor = await Monitor.findOne({
        _id: id,
        owner: req.user!._id,
      });

      if (!monitor) {
        res.status(404).json({ error: "Monitor non trouvé" });
        return;
      }

      monitor.sharedWith = monitor.sharedWith.filter(
        (uid) => uid.toString() !== userId,
      );
      await monitor.save();

      res.json({
        message: "Partage retiré avec succès",
        monitor,
      });
    } catch (error: any) {
      console.error("Erreur retrait partage:", error);
      res.status(500).json({ error: "Erreur lors du retrait du partage" });
    }
  },
);

export default router;
