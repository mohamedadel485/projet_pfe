import React, { useState, useEffect, useRef } from "react";
import {
  ApiError,
  AuthUser,
  changePassword,
  updateMe,
  uploadAvatar,
  isApiError,
  resolveAvatarUrl,
} from "../../lib/api";

const THEME_CACHE_KEY = "uptimewarden_theme";
type AppTheme = "light" | "dark";
type SettingsSection = "profile" | "password" | "theme";

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
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const showPasswordGuidance = newPassword.length > 0;

  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [appTheme, setAppTheme] = useState<AppTheme>(() => {
    if (typeof window === "undefined") return "light";
    return window.localStorage.getItem(THEME_CACHE_KEY) === "dark"
      ? "dark"
      : "light";
  });
  const [activeSection, setActiveSection] =
    useState<SettingsSection>("profile");

  useEffect(() => {
    setName(currentUser?.name ?? "");
    setEmail(currentUser?.email ?? "");
  }, [currentUser]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.dataset.theme = appTheme;
    window.localStorage.setItem(THEME_CACHE_KEY, appTheme);
  }, [appTheme]);

  const initials =
    (currentUser?.name ?? currentUser?.email ?? "")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s.charAt(0).toUpperCase())
      .join("") || "-";
  const avatarSrc = resolveAvatarUrl(currentUser?.avatar);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const passwordRules = [
    {
      label: "Au moins 6 caracteres",
      valid: newPassword.length >= 6,
    },
    {
      label: "Au moins une majuscule",
      valid: /[A-Z]/.test(newPassword),
    },
    {
      label: "Au moins un chiffre",
      valid: /\d/.test(newPassword),
    },
    {
      label: "Au moins un caractere special",
      valid: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(newPassword),
    },
  ];
  const passwordReady =
    currentPassword.trim().length > 0 &&
    newPassword.trim().length > 0 &&
    confirmPassword.trim().length > 0 &&
    passwordRules.every((rule) => rule.valid);

  const handleSave = async () => {
    setError(null);
    setFieldErrors({});
    setSuccess(null);

    if (!authToken) {
      setError("Authentication required.");
      return;
    }

    const nextFieldErrors: { name?: string; email?: string } = {};
    if (name.trim() === "") nextFieldErrors.name = "Name is required.";
    if (email.trim() === "") nextFieldErrors.email = "Email is required.";
    else if (!validateEmail(email.trim()))
      nextFieldErrors.email = "Invalid email format.";

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
      setSuccess("Profile updated.");
      setTimeout(() => {
        onBack();
      }, 700);
    } catch (err) {
      if (isApiError(err)) {
        setError(err.message || "Error while updating profile.");
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Error while updating profile.");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleThemeChange = (nextTheme: AppTheme) => {
    setAppTheme(nextTheme);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!authToken) {
      setError("Authentication required.");
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
      setSuccess("Avatar updated.");
    } catch (err) {
      if (isApiError(err)) setError(err.message || "Upload error");
      else if (err instanceof Error) setError(err.message);
      else setError("Upload error");
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (currentPassword.trim() === "") {
      setPasswordError("Current password is required.");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError("The new password must contain at least 6 characters.");
      return;
    }

    if (!/[A-Z]/.test(newPassword)) {
      setPasswordError(
        "The new password must contain at least one uppercase letter.",
      );
      return;
    }

    if (!/\d/.test(newPassword)) {
      setPasswordError("The new password must contain at least one number.");
      return;
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]/.test(newPassword)) {
      setPasswordError(
        "The new password must contain at least one special character.",
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("Password confirmation does not match.");
      return;
    }

    if (currentPassword === newPassword) {
      setPasswordError(
        "The new password must be different from the current one.",
      );
      return;
    }

    setIsChangingPassword(true);
    try {
      const response = await changePassword(currentPassword, newPassword);
      setPasswordSuccess(
        response.message || "Mot de passe modifie avec succes.",
      );
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      if (isApiError(err)) {
        setPasswordError(
          err.message || "Impossible de changer le mot de passe.",
        );
      } else if (err instanceof ApiError) {
        setPasswordError(err.message);
      } else if (err instanceof Error) {
        setPasswordError(err.message);
      } else {
        setPasswordError("Unable to change password.");
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="panel-main settings-page-shell">
      <header className="workspace-top">
        <button type="button" className="settings-back-button" onClick={onBack}>
          <span aria-hidden="true">&larr;</span>
          Retour
        </button>
        <div>
          <span className="profile-page-badge">SETTINGS</span>
          <h1>Profil, mot de passe et theme</h1>
          <p>
            Gerez votre profil, votre securite et l apparence de l application.
          </p>
        </div>
        <div />
      </header>

      <div className="settings-layout">
        <aside className="panel-card settings-sidebar-card">
          <div className="settings-sidebar-header">
            <strong>Menu des reglages</strong>
            <span>Choisissez une section</span>
          </div>

          <nav className="settings-sidebar-nav" aria-label="Parametres">
            <button
              type="button"
              className={`settings-sidebar-item ${activeSection === "profile" ? "active" : ""}`}
              onClick={() => setActiveSection("profile")}
            >
              <span>Profil</span>
              <small>Nom, email, avatar</small>
            </button>
            <button
              type="button"
              className={`settings-sidebar-item ${activeSection === "password" ? "active" : ""}`}
              onClick={() => setActiveSection("password")}
            >
              <span>Mot de passe</span>
              <small>Changer votre mot de passe</small>
            </button>
            <button
              type="button"
              className={`settings-sidebar-item ${activeSection === "theme" ? "active" : ""}`}
              onClick={() => setActiveSection("theme")}
            >
              <span>Theme</span>
              <small>Clair ou sombre</small>
            </button>
          </nav>
        </aside>

        <section className="panel-card settings-content-card">
          {activeSection === "profile" ? (
            <div className="settings-profile-grid">
              <div className="settings-avatar-block">
                <div className="settings-avatar">
                  {avatarSrc ? <img src={avatarSrc} alt="Avatar" /> : initials}
                </div>
                <div className="settings-avatar-copy">
                  <strong>{currentUser?.name}</strong>
                  <span>{currentUser?.email}</span>
                </div>
                <label
                  className="secondary-button settings-avatar-button"
                  style={{ cursor: "pointer" }}
                >
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

              <div className="settings-form-block">
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

                <div className="settings-actions-row">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={onBack}
                    disabled={saving || isChangingPassword}
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={handleSave}
                    disabled={saving || isChangingPassword}
                  >
                    {saving ? "Enregistrement…" : "Enregistrer"}
                  </button>
                </div>
              </div>
            </div>
          ) : activeSection === "password" ? (
            <div className="settings-section-stack">
              <div className="settings-section-header">
                <h2>Changement de mot de passe</h2>
                <p>Renforcez la securite de votre compte.</p>
              </div>

              <form
                className="settings-form-stack"
                onSubmit={handlePasswordChange}
              >
                <label className="form-label" htmlFor="current-password">
                  Mot de passe actuel
                </label>
                <input
                  id="current-password"
                  className="form-input"
                  type="password"
                  autoComplete="current-password"
                  required
                  minLength={1}
                  aria-describedby="password-guidance"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                />

                <label
                  className="form-label"
                  htmlFor="new-password"
                  style={{ marginTop: "12px" }}
                >
                  Nouveau mot de passe
                </label>
                <input
                  id="new-password"
                  className="form-input"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  aria-describedby="password-guidance"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                />

                {showPasswordGuidance ? (
                  <div
                    id="password-guidance"
                    className="settings-password-guidance"
                    aria-live="polite"
                  >
                    <p>Le nouveau mot de passe doit respecter ces criteres :</p>
                    <ul className="settings-password-rules">
                      {passwordRules.map((rule) => (
                        <li
                          key={rule.label}
                          className={`settings-password-rule ${rule.valid ? "valid" : "invalid"}`}
                        >
                          <span
                            className="settings-password-rule-icon"
                            aria-hidden="true"
                          >
                            {rule.valid ? "✓" : "•"}
                          </span>
                          <span>{rule.label}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <label
                  className="form-label"
                  htmlFor="confirm-password"
                  style={{ marginTop: "12px" }}
                >
                  Confirmer le nouveau mot de passe
                </label>
                <input
                  id="confirm-password"
                  className="form-input"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />

                {passwordError ? (
                  <p className="form-error">{passwordError}</p>
                ) : null}
                {passwordSuccess ? (
                  <p className="form-success">{passwordSuccess}</p>
                ) : null}

                <div style={{ marginTop: "14px" }}>
                  <button
                    type="submit"
                    className="secondary-button"
                    disabled={isChangingPassword || saving || !passwordReady}
                  >
                    {isChangingPassword
                      ? "Mise a jour..."
                      : "Changer le mot de passe"}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="settings-section-stack">
              <div className="settings-section-header">
                <h2>Theme de l application</h2>
                <p>
                  Choisissez l apparence globale qui vous convient le mieux.
                </p>
              </div>

              <div className="settings-theme-grid">
                <button
                  type="button"
                  className={`settings-theme-card ${appTheme === "light" ? "active" : ""}`}
                  onClick={() => handleThemeChange("light")}
                  aria-pressed={appTheme === "light"}
                >
                  <span
                    className="settings-theme-preview settings-theme-preview-light"
                    aria-hidden="true"
                  />
                  <strong>Clair</strong>
                  <span>Fond lumineux et contrastes doux</span>
                </button>

                <button
                  type="button"
                  className={`settings-theme-card ${appTheme === "dark" ? "active" : ""}`}
                  onClick={() => handleThemeChange("dark")}
                  aria-pressed={appTheme === "dark"}
                >
                  <span
                    className="settings-theme-preview settings-theme-preview-dark"
                    aria-hidden="true"
                  />
                  <strong>Sombre</strong>
                  <span>Interface plus calme pour les longues sessions</span>
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default EditProfilePage;
