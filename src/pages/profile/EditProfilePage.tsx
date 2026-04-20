import React, { useState, useEffect, useRef } from "react";
import {
  AuthUser,
  updateMe,
  uploadAvatar,
  isApiError,
  resolveAvatarUrl,
} from "../../lib/api";

interface Props {
  authToken?: string | null;
  currentUser?: AuthUser | null;
  onBack: () => void;
  onUpdateUser: (user: AuthUser) => void;
}

const validateEmail = (value: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
};

const EditProfilePage: React.FC<Props> = ({
  authToken,
  currentUser,
  onBack,
  onUpdateUser,
}) => {
  const [name, setName] = useState(currentUser?.name ?? "");
  const [email, setEmail] = useState(currentUser?.email ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    email?: string;
  }>({});
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setName(currentUser?.name ?? "");
    setEmail(currentUser?.email ?? "");
  }, [currentUser]);

  const initials =
    (currentUser?.name ?? currentUser?.email ?? "")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s.charAt(0).toUpperCase())
      .join("") || "-";
  const avatarSrc = resolveAvatarUrl(currentUser?.avatar);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleSave = async () => {
    setError(null);
    setFieldErrors({});
    setSuccess(null);

    if (!authToken) {
      setError("Authentification requise.");
      return;
    }

    const nextFieldErrors: { name?: string; email?: string } = {};
    if (name.trim() === "") nextFieldErrors.name = "Le nom est requis.";
    if (email.trim() === "") nextFieldErrors.email = "L'email est requis.";
    else if (!validateEmail(email.trim()))
      nextFieldErrors.email = "Format d'email invalide.";

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      return;
    }

    setSaving(true);
    try {
      const payload = {} as Record<string, string>;
      if (name.trim() !== (currentUser?.name ?? "").trim())
        payload.name = name.trim();
      if (email.trim() !== (currentUser?.email ?? "").trim())
        payload.email = email.trim();

      const response = await updateMe(payload, authToken);
      const updated = response.user;
      const authUser: AuthUser = {
        id: String(updated.id),
        email: updated.email,
        name: updated.name,
        role: updated.role,
        avatar: currentUser?.avatar,
      };
      onUpdateUser(authUser);
      setSuccess("Profil mis à jour.");
      setTimeout(() => {
        onBack();
      }, 700);
    } catch (err) {
      if (isApiError(err)) {
        setError(err.message || "Erreur lors de la mise à jour.");
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Erreur lors de la mise à jour.");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!authToken) {
      setError("Authentification requise.");
      return;
    }
    try {
      setSaving(true);
      const resp = await uploadAvatar(file, authToken);
      const newUser: AuthUser = {
        id: currentUser!.id,
        email: currentUser!.email,
        name: currentUser!.name,
        role: currentUser!.role,
        avatar: resp.avatarUrl,
      };
      onUpdateUser(newUser);
      setSuccess("Avatar mis à jour.");
    } catch (err) {
      if (isApiError(err)) setError(err.message || "Erreur upload");
      else if (err instanceof Error) setError(err.message);
      else setError("Erreur upload");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="panel-main">
      <header className="workspace-top">
        <h1>Éditer le profil</h1>
        <div />
      </header>

      <div className="panel-card">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "180px 1fr",
            gap: 24,
            alignItems: "start",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <div
              style={{
                width: 120,
                height: 120,
                borderRadius: "50%",
                background: "linear-gradient(145deg,#0e1f3d,#3f6bc0)",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 36,
                fontWeight: 700,
              }}
              aria-hidden
            >
              {avatarSrc ? (
                <img
                  src={avatarSrc}
                  alt="Avatar"
                  style={{
                    width: "100%",
                    height: "100%",
                    borderRadius: "50%",
                    objectFit: "cover",
                  }}
                />
              ) : (
                initials
              )}
            </div>
            <div style={{ marginTop: 12, textAlign: "center" }}>
              <div style={{ fontSize: 14, color: "#333" }}>
                {currentUser?.name}
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>
                {currentUser?.email}
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <label className="secondary-button" style={{ cursor: "pointer" }}>
                Modifier l'avatar
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={handleFileChange}
                />
              </label>
            </div>
          </div>

          <div>
            <div style={{ display: "grid", gap: 12 }}>
              <div>
                <label className="form-label">Nom</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="form-input"
                />
                {fieldErrors.name ? (
                  <div className="form-error">{fieldErrors.name}</div>
                ) : null}
              </div>

              <div>
                <label className="form-label">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="form-input"
                />
                {fieldErrors.email ? (
                  <div className="form-error">{fieldErrors.email}</div>
                ) : null}
              </div>

              {error ? <div className="form-error">{error}</div> : null}
              {success ? <div className="form-success">{success}</div> : null}

              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={onBack}
                  disabled={saving}
                >
                  Annuler
                </button>
                <button
                  type="button"
                  className="primary-button"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? "Enregistrement…" : "Enregistrer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditProfilePage;
