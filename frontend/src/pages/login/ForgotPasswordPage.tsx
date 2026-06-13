import { Eye, EyeOff } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import unlockIcon from '../../images/unlock.png';
import LanguageSwitcher from "../../components/LanguageSwitcher";
import { useAppLanguage } from "../../lib/language";
import './ForgotPasswordPage.css';

interface ForgotPasswordPageProps {
  onResetPassword: (payload: { email: string; newPassword: string; confirmPassword: string }) => Promise<string | null>;
}

function ForgotPasswordPage({ onResetPassword }: ForgotPasswordPageProps) {
  const { t } = useAppLanguage();
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    setSubmitError(null);

    if (email.trim() === '') {
      setSubmitError(t("settings.errorEmailRequired"));
      return;
    }

    if (newPassword.length < 6) {
      setSubmitError(t("settings.errorPasswordMinLength"));
      return;
    }

    if (newPassword !== confirmPassword) {
      setSubmitError(t("settings.errorPasswordMismatch"));
      return;
    }

    setIsSubmitting(true);

    const error = await onResetPassword({
      email: email.trim(),
      newPassword,
      confirmPassword,
    });

    if (error) {
      setSubmitError(error);
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
  };

  return (
    <main className="forgot-password-page">
      <LanguageSwitcher />
      <div className="forgot-password-shell">
        <section className="forgot-password-content">
          <p className="forgot-password-brand">Monitoring</p>

          <div className="forgot-password-lock" aria-hidden="true">
            <img className="forgot-password-lock-image" src={unlockIcon} alt="" />
          </div>

          <h1 className="forgot-password-title">{t("auth.createNewPassword")}</h1>
          <p className="forgot-password-subtitle">
            {t("auth.createNewPasswordSubtitle")}
          </p>

          <form className="forgot-password-form" onSubmit={handleSubmit}>
            <label htmlFor="forgot-email">{t("common.email")}</label>
            <div className="forgot-password-input-wrap">
              <input
                id="forgot-email"
                type="email"
                autoComplete="email"
                placeholder={t("auth.emailPlaceholder")}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <label htmlFor="forgot-new-password">{t("settings.newPassword")}</label>
            <div className="forgot-password-input-wrap">
              <input
                id="forgot-new-password"
                type={showNewPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder={t("auth.passwordRequirementsPlaceholder")}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                disabled={isSubmitting}
              />
              <button
                type="button"
                className="forgot-password-toggle"
                aria-label={
                  showNewPassword ? t("auth.hidePassword") : t("auth.showPassword")
                }
                onClick={() => setShowNewPassword((prev) => !prev)}
                disabled={isSubmitting}
              >
                {showNewPassword ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
            </div>

            <label htmlFor="forgot-confirm-password">
              {t("settings.confirmPassword")}
            </label>
            <div className="forgot-password-input-wrap">
              <input
                id="forgot-confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder={t("auth.repeatPassword")}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                disabled={isSubmitting}
              />
              <button
                type="button"
                className="forgot-password-toggle"
                aria-label={
                  showConfirmPassword
                    ? t("auth.hidePassword")
                    : t("auth.showPassword")
                }
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                disabled={isSubmitting}
              >
                {showConfirmPassword ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
            </div>

            {submitError ? <p className="login-form-error">{submitError}</p> : null}

            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t("auth.resetting") : t("auth.resetPassword")}
            </button>
          </form>

          <p className="forgot-password-footer">
            {t("auth.footer")}
            <strong>MONITORING</strong>
          </p>
        </section>
      </div>
    </main>
  );
}

export default ForgotPasswordPage;
