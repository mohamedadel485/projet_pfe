import React, { useMemo, useState } from "react";
import { ApiError, changePassword, isApiError } from "../../lib/api";
import { Check, X } from "lucide-react";
import { useAppLanguage } from "../../lib/language";

interface PasswordRequirement {
  label: string;
  isValid: boolean;
}

const SettingsPage: React.FC = () => {
  const { t } = useAppLanguage();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Real-time password validation
  const passwordRequirements: PasswordRequirement[] = useMemo(() => {
    return [
      {
        label: t("settings.passwordRuleLength"),
        isValid: newPassword.length >= 6,
      },
      {
        label: t("settings.passwordRuleUppercase"),
        isValid: /[A-Z]/.test(newPassword),
      },
      {
        label: t("settings.passwordRuleNumber"),
        isValid: /\d/.test(newPassword),
      },
      {
        label: t("settings.passwordRuleSpecial"),
        isValid: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword),
      },
    ];
  }, [newPassword, t]);

  const isPasswordValid = useMemo(() => {
    return passwordRequirements.every((req) => req.isValid);
  }, [passwordRequirements]);

  const canSubmit = useMemo(() => {
    return (
      !isSubmitting &&
      currentPassword.trim() !== "" &&
      newPassword.trim() !== "" &&
      confirmPassword.trim() !== "" &&
      isPasswordValid
    );
  }, [confirmPassword, currentPassword, isSubmitting, newPassword, isPasswordValid]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (newPassword.length < 6) {
      setErrorMessage(t("settings.errorPasswordMinLength"));
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage(t("settings.errorPasswordMismatch"));
      return;
    }

    if (currentPassword === newPassword) {
      setErrorMessage(t("settings.errorPasswordDifferent"));
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await changePassword(currentPassword, newPassword);
      setSuccessMessage(response.message || t("settings.successPasswordChanged"));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      if (isApiError(error)) {
        setErrorMessage(error.message);
      } else if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage(t("settings.errorChangePassword"));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="panel-main">
      <header className="workspace-top">
        <h1>{t("common.settings")}</h1>
        <div />
      </header>

      <div className="panel-card">
        <h2
          style={{
            fontSize: "1.05rem",
            fontWeight: 800,
            color: "#2a4f96",
            marginBottom: "12px",
          }}
        >
          {t("settings.changePassword")}
        </h2>
        <form onSubmit={handleSubmit}>
          <label className="form-label" htmlFor="current-password">
            {t("settings.currentPassword")}
          </label>
          <input
            id="current-password"
            className="form-input"
            type="password"
            autoComplete="current-password"
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
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            style={{
              borderColor: newPassword && !isPasswordValid ? "#e74c3c" : undefined,
            }}
          />

          {/* Password validation indicators */}
          {newPassword && (
            <div
              style={{
                marginTop: "8px",
                padding: "10px 12px",
                background: "#f8fafc",
                borderRadius: "8px",
                fontSize: "0.85rem",
              }}
            >
              <p
                style={{
                  margin: "0 0 8px 0",
                  fontWeight: 600,
                  color: "#475569",
                  fontSize: "0.8rem",
                }}
              >
                {t("settings.passwordGuidanceIntro")}
              </p>
              {passwordRequirements.map((req, index) => (
                <div
                  key={index}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    marginBottom: "4px",
                    color: req.isValid ? "#16a34a" : "#94a3b8",
                    transition: "color 0.2s ease",
                  }}
                >
                  {req.isValid ? (
                    <Check size={14} style={{ color: "#16a34a" }} />
                  ) : (
                    <X size={14} style={{ color: "#94a3b8" }} />
                  )}
                  <span>{req.label}</span>
                </div>
              ))}
            </div>
          )}

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
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />

          {/* Confirmation validation */}
          {confirmPassword && newPassword !== confirmPassword && (
            <p
              className="form-error"
              style={{ marginTop: "8px", fontSize: "0.85rem" }}
            >
              {t("settings.errorPasswordMismatch")}
            </p>
          )}

          {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
          {successMessage ? <p className="form-success">{successMessage}</p> : null}

          <div style={{ marginTop: "14px" }}>
            <button
              type="submit"
              className="secondary-button"
              disabled={!canSubmit}
              style={{
                opacity: canSubmit ? 1 : 0.7,
                cursor: canSubmit ? "pointer" : "not-allowed",
              }}
            >
              {isSubmitting ? t("settings.saving") : t("settings.changePassword")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SettingsPage;
