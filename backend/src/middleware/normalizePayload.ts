import { Request, Response, NextFunction } from "express";

export const normalizeRegisterPayload = (
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

export const normalizeUserPayload = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  const body = req.body as Record<string, unknown>;

  if (typeof body.nom === "string" && typeof body.name !== "string") {
    body.name = body.nom;
  }

  next();
};

export const normalizeMonitorPayload = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  const body = req.body as Record<string, unknown>;

  if (typeof body.nom === "string" && typeof body.name !== "string") {
    body.name = body.nom;
  }

  if (typeof body.protocole === "string" && typeof body.type !== "string") {
    body.type = body.protocole;
  }

  if (
    typeof body.typeHTTP === "string" &&
    typeof body.httpMethod !== "string"
  ) {
    body.httpMethod = body.typeHTTP.toUpperCase();
  }

  if (typeof body.statut === "string" && typeof body.status !== "string") {
    body.status = body.statut;
  }

  next();
};

export const normalizeMaintenancePayload = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  const body = req.body as Record<string, unknown>;

  if (typeof body.nom === "string" && typeof body.name !== "string") {
    body.name = body.nom;
  }

  if (typeof body.raison === "string" && typeof body.reason !== "string") {
    body.reason = body.raison;
  }

  if (typeof body.dateDebut === "string" && typeof body.startAt !== "string") {
    body.startAt = body.dateDebut;
  }

  if (typeof body.dateFin === "string" && typeof body.endAt !== "string") {
    body.endAt = body.dateFin;
  }

  if (
    typeof body.statutMaintenance === "string" &&
    typeof body.status !== "string"
  ) {
    body.status = body.statutMaintenance;
  }

  next();
};

export const normalizeIntegrationPayload = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  const body = req.body as Record<string, unknown>;

  if (
    typeof body.integrationType === "string" &&
    typeof body.type !== "string"
  ) {
    body.type = body.integrationType;
  }

  if (typeof body.eventType === "string" && !Array.isArray(body.events)) {
    body.events = body.eventType
      .split(",")
      .map((event) => event.trim())
      .filter((event) => event === "up" || event === "down");
  }

  next();
};
