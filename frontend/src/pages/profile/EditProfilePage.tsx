import React, { useState, useEffect, useRef } from "react";
import {
  ApiError,
  AuthUser,
  changePassword,
  resetAvatar,
  updateMe,
  uploadAvatar,
  isApiError,
  resolveAvatarUrl,
} from "../../lib/api";
import { useAppLanguage } from "../../lib/language";
import LanguageSwitcher from "../../components/LanguageSwitcher";

const THEME_CACHE_KEY = "uptimewarden_theme";
type AppTheme = "light" | "dark";
type SettingsSection = "profile" | "password" | "theme" | "language";

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
  const { language, setLanguage, t } = useAppLanguage();
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
  const clearAvatarInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const passwordRules = [
    {
      label: t("settings.passwordRuleLength"),
      valid: newPassword.length >= 6,
    },
    {
      label: t("settings.passwordRuleUppercase"),
      valid: /[A-Z]/.test(newPassword),
    },
    {
      label: t("settings.passwordRuleNumber"),
      valid: /\d/.test(newPassword),
    },
    {
      label: t("settings.passwordRuleSpecial"),
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
      setError(t("settings.errorAuthRequired"));
      return;
    }

    const nextFieldErrors: { name?: string; email?: string } = {};
    if (name.trim() === "") nextFieldErrors.name = t("settings.errorNameRequired");
    if (email.trim() === "") nextFieldErrors.email = t("settings.errorEmailRequired");
    else if (!validateEmail(email.trim()))
      nextFieldErrors.email = t("settings.errorInvalidEmail");

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
      setSuccess(t("settings.successProfileUpdated"));
      setTimeout(() => {
        onBack();
      }, 700);
    } catch (err) {
      if (isApiError(err)) {
        setError(err.message || t("settings.errorProfileUpdate"));
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(t("settings.errorProfileUpdate"));
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
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    try {
      if (!authToken) {
        setError(t("settings.errorAuthRequired"));
        return;
      }
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
      setSuccess(t("settings.successAvatarUpdated"));
    } catch (err) {
      if (isApiError(err))
        setError(err.message || t("settings.errorAvatarReset"));
      else if (err instanceof Error) setError(err.message);
      else setError(t("settings.errorAvatarReset"));
    } finally {
      clearAvatarInput();
      setSaving(false);
    }
  };

  const handleResetAvatar = async () => {
    setError(null);
    setSuccess(null);

    try {
      if (!authToken) {
        setError(t("settings.errorAuthRequired"));
        return;
      }

      setSaving(true);
      const response = await resetAvatar(authToken);
      const updated = response.user;
      const authUser: AuthUser = {
        id: String(updated.id),
        email: updated.email,
        name: updated.name,
        role: updated.role,
        avatar: updated.avatar ?? null,
      };
      onUpdateUser(authUser);
      setSuccess(t("settings.successAvatarReset"));
    } catch (err) {
      if (isApiError(err)) setError(err.message || t("settings.errorUpload"));
      else if (err instanceof Error) setError(err.message);
      else setError(t("settings.errorUpload"));
    } finally {
      clearAvatarInput();
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
      setPasswordError(t("settings.errorCurrentPasswordRequired"));
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError(t("settings.errorPasswordMinLength"));
      return;
    }

    if (!/[A-Z]/.test(newPassword)) {
      setPasswordError(t("settings.errorPasswordUppercase"));
      return;
    }

    if (!/\d/.test(newPassword)) {
      setPasswordError(t("settings.errorPasswordNumber"));
      return;
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]/.test(newPassword)) {
      setPasswordError(t("settings.errorPasswordSpecial"));
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError(t("settings.errorPasswordMismatch"));
      return;
    }

    if (currentPassword === newPassword) {
      setPasswordError(t("settings.errorPasswordDifferent"));
      return;
    }

    setIsChangingPassword(true);
    try {
      const response = await changePassword(currentPassword, newPassword);
      setPasswordSuccess(
        response.message || t("settings.successPasswordChanged"),
      );
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      if (isApiError(err)) {
        setPasswordError(err.message || t("settings.errorChangePassword"));
      } else if (err instanceof ApiError) {
        setPasswordError(err.message);
      } else if (err instanceof Error) {
        setPasswordError(err.message);
      } else {
        setPasswordError(t("settings.errorChangePassword"));
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="panel-main settings-page-shell">
      <LanguageSwitcher />
      <header className="workspace-top">
        <button type="button" className="settings-back-button" onClick={onBack}>
          <span aria-hidden="true">&larr;</span>
          {t("settings.back")}
        </button>
        <div>
          <span className="profile-page-badge">{t("settings.badge")}</span>
          <h1>{t("settings.title")}</h1>
          <p>{t("settings.subtitle")}</p>
        </div>
        <div />
      </header>

      <div className="settings-layout">
        <aside className="panel-card settings-sidebar-card">
          <div className="settings-sidebar-header">
            <strong>{t("settings.menuTitle")}</strong>
            <span>{t("settings.menuHint")}</span>
          </div>

          <nav className="settings-sidebar-nav" aria-label={t("common.settings")}>
            <button
              type="button"
              className={`settings-sidebar-item ${activeSection === "profile" ? "active" : ""}`}
              onClick={() => setActiveSection("profile")}
            >
              <span>{t("settings.sectionProfile")}</span>
              <small>{t("settings.sectionProfileHint")}</small>
            </button>
            <button
              type="button"
              className={`settings-sidebar-item ${activeSection === "password" ? "active" : ""}`}
              onClick={() => setActiveSection("password")}
            >
              <span>{t("settings.sectionPassword")}</span>
              <small>{t("settings.sectionPasswordHint")}</small>
            </button>
            <button
              type="button"
              className={`settings-sidebar-item ${activeSection === "theme" ? "active" : ""}`}
              onClick={() => setActiveSection("theme")}
            >
              <span>{t("settings.sectionTheme")}</span>
              <small>{t("settings.sectionThemeHint")}</small>
            </button>
            <button
              type="button"
              className={`settings-sidebar-item ${activeSection === "language" ? "active" : ""}`}
              onClick={() => setActiveSection("language")}
            >
              <span>{t("settings.sectionLanguage")}</span>
              <small>{t("settings.sectionLanguageHint")}</small>
            </button>
          </nav>
        </aside>

        <section className="panel-card settings-content-card">
          {activeSection === "profile" ? (
            <div className="settings-profile-grid">
              <div className="settings-avatar-block">
                <div className="settings-avatar">
                  {avatarSrc ? <img src={avatarSrc} alt={t("common.profile")} /> : initials}
                </div>
                <div className="settings-avatar-copy">
                  <strong>{currentUser?.name}</strong>
                  <span>{currentUser?.email}</span>
                </div>
                <div className="settings-avatar-actions">
                  <label
                    className="secondary-button settings-avatar-button"
                    style={{ cursor: "pointer" }}
                  >
                    {t("settings.changeAvatar")}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      disabled={saving || isChangingPassword}
                      style={{ display: "none" }}
                      onChange={handleFileChange}
                    />
                  </label>
                  <button
                    type="button"
                    className="secondary-button settings-avatar-reset-button"
                    onClick={handleResetAvatar}
                    disabled={saving || isChangingPassword || !currentUser?.avatar}
                  >
                    {t("settings.resetAvatar")}
                  </button>
                </div>
              </div>

              <div className="settings-form-block">
                <div>
                  <label className="form-label">{t("settings.name")}</label>
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
                  <label className="form-label">{t("settings.email")}</label>
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
                    {t("settings.cancel")}
                  </button>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={handleSave}
                    disabled={saving || isChangingPassword}
                  >
                    {saving ? t("settings.saving") : t("settings.save")}
                  </button>
                </div>
              </div>
            </div>
          ) : activeSection === "password" ? (
            <div className="settings-section-stack">
              <div className="settings-section-header">
                <h2>{t("settings.passwordTitle")}</h2>
                <p>{t("settings.passwordSubtitle")}</p>
              </div>

              <form
                className="settings-form-stack"
                onSubmit={handlePasswordChange}
              >
                <label className="form-label" htmlFor="current-password">
                  {t("settings.currentPassword")}
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
                  {t("settings.newPassword")}
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
                    <p>{t("settings.passwordGuidanceIntro")}</p>
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
                            {rule.valid ? "+" : "-"}
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
                  {t("settings.confirmPassword")}
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
                      ? t("common.saving")
                      : t("settings.changePassword")}
                  </button>
                </div>
              </form>
            </div>
          ) : activeSection === "theme" ? (
            <div className="settings-section-stack">
              <div className="settings-section-header">
                <h2>{t("settings.appTheme")}</h2>
                <p>{t("settings.themeSubtitle")}</p>
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
                  <strong>{t("settings.light")}</strong>
                  <span>{t("settings.lightDescription")}</span>
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
                  <strong>{t("settings.dark")}</strong>
                  <span>{t("settings.darkDescription")}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="settings-section-stack">
              <div className="settings-section-header">
                <h2>{t("settings.languageTitle")}</h2>
                <p>{t("settings.languageSubtitle")}</p>
              </div>

              <div className="settings-theme-grid">
                <button
                  type="button"
                  className={`settings-theme-card ${language === "fr" ? "active" : ""}`}
                  onClick={() => setLanguage("fr")}
                  aria-pressed={language === "fr"}
                >
                  <span
                    className="settings-theme-preview settings-theme-preview-light"
                    aria-hidden="true"
                  />
                  <strong>{t("settings.languageFrench")}</strong>
                  <span>{t("settings.languageFrenchDescription")}</span>
                </button>

                <button
                  type="button"
                  className={`settings-theme-card ${language === "ar" ? "active" : ""}`}
                  onClick={() => setLanguage("ar")}
                  aria-pressed={language === "ar"}
                >
                  <span
                    className="settings-theme-preview settings-theme-preview-dark"
                    aria-hidden="true"
                  />
                  <strong>{t("settings.languageArabic")}</strong>
                  <span>{t("settings.languageArabicDescription")}</span>
                </button>
              </div>

              <p className="profile-tip">{t("settings.languageNote")}</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default EditProfilePage;
