import Utilisateur from "../models/Utilisateur";
import type { Utilisateur as UtilisateurDocument } from "../models/Utilisateur";

const EMAIL_REGEX_SPECIAL_CHARS = /[.*+?^${}()|[\]\\]/g;

export const normalizeEmailAddress = (value: string): string =>
  String(value ?? "").trim().toLowerCase();

const escapeRegExp = (value: string): string =>
  value.replace(EMAIL_REGEX_SPECIAL_CHARS, "\\$&");

export const findUserByEmail = async (
  email: string,
): Promise<UtilisateurDocument | null> => {
  const normalizedEmail = normalizeEmailAddress(email);
  if (normalizedEmail === "") {
    return null;
  }

  const exactMatch = await Utilisateur.findOne({ email: normalizedEmail });
  if (exactMatch) {
    return exactMatch;
  }

  return Utilisateur.findOne({
    email: new RegExp(`^\\s*${escapeRegExp(normalizedEmail)}\\s*$`, "i"),
  });
};
