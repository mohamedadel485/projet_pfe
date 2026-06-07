import { Eye, EyeOff } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import LanguageSwitcher from "../../components/LanguageSwitcher";
import { useAppLanguage } from "../../lib/language";
import './AcceptInvitationPage.css';

interface AcceptInvitationPayload {
  token: string;
  password: string;
  rememberMe: boolean;
}

interface AcceptInvitationPageProps {
  token?: string | null;
  onAcceptInvitation: (payload: AcceptInvitationPayload) => Promise<string | null>;
  onBackToLogin: () => void;
}

function AcceptInvitationPage({ token, onAcceptInvitation, onBackToLogin }: AcceptInvitationPageProps) {
  const { t } = useAppLanguage();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Password validation
  const hasMinLength = password.length >= 6;
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  const isPasswordValid = hasMinLength && hasUppercase && hasNumber && hasSpecial;

  const isTokenValid = Boolean(token && token.trim() !== '');
  const isFormValid = useMemo(
    () =>
      isTokenValid &&
      isPasswordValid &&
      password === confirmPassword &&
      confirmPassword.length > 0,
    [confirmPassword, isPasswordValid, isTokenValid, password],
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isFormValid || isSubmitting || !token) return;

    setIsSubmitting(true);
    setSubmitError(null);

    const error = await onAcceptInvitation({
      token: token.trim(),
      password,
      rememberMe,
    });

    if (error) {
      setSubmitError(error);
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
  };

  return (
    <main className="accept-invitation-page">
      <LanguageSwitcher />
      <div className="accept-invitation-shell">
        <section className="accept-invitation-card">
          <p className="accept-invitation-brand">Monitoring</p>
          <h1 className="accept-invitation-title">
            {t("auth.acceptInvitationTitle")}
            <span>{t("auth.createYourAccount")}</span>
          </h1>

          <form className="accept-invitation-form" onSubmit={handleSubmit}>
            {!isTokenValid ? (
              <p className="accept-invitation-error">{t("auth.invalidInvitationLink")}</p>
            ) : null}

            <label htmlFor="accept-invite-password">{t("auth.password")}</label>
            <div className="accept-invitation-password-wrap">
              <input
                id="accept-invite-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                placeholder={t("auth.password")}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={isSubmitting || !isTokenValid}
              />
              <button
                type="button"
                className="accept-invitation-password-toggle"
                aria-label={
                  showPassword ? t("auth.hidePassword") : t("auth.showPassword")
                }
                onClick={() => setShowPassword((prev) => !prev)}
                disabled={isSubmitting || !isTokenValid}
              >
                {showPassword ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
            </div>

            {/* Password strength indicator */}
            {password && (
              <div className="password-strength">
                <p>{t("auth.passwordMustContain")}</p>
                <ul>
                  <li className={hasMinLength ? 'valid' : ''}>{t("settings.passwordRuleLength")}</li>
                  <li className={hasUppercase ? 'valid' : ''}>{t("settings.passwordRuleUppercase")}</li>
                  <li className={hasNumber ? 'valid' : ''}>{t("settings.passwordRuleNumber")}</li>
                  <li className={hasSpecial ? 'valid' : ''}>{t("settings.passwordRuleSpecial")}</li>
                </ul>
              </div>
            )}

            <label htmlFor="accept-invite-confirm-password">
              {t("settings.confirmPassword")}
            </label>
            <div className="accept-invitation-password-wrap">
              <input
                id="accept-invite-confirm-password"
                name="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder={t("auth.repeatPassword")}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                disabled={isSubmitting || !isTokenValid}
              />
              <button
                type="button"
                className="accept-invitation-password-toggle"
                aria-label={
                  showConfirmPassword
                    ? t("auth.hidePassword")
                    : t("auth.showPassword")
                }
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                disabled={isSubmitting || !isTokenValid}
              >
                {showConfirmPassword ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
            </div>

            {confirmPassword && password !== confirmPassword && (
              <p className="accept-invitation-field-error">
                {t("settings.errorPasswordMismatch")}
              </p>
            )}

            <label className="accept-invitation-remember">
              <input
                id="accept-invite-remember-me"
                name="rememberMe"
                type="checkbox"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
                disabled={isSubmitting || !isTokenValid}
              />
              <span>{t("auth.rememberMe")}</span>
            </label>

            {submitError ? <p className="accept-invitation-error">{submitError}</p> : null}

            <button type="submit" disabled={!isFormValid || isSubmitting}>
              {isSubmitting ? t("auth.creatingAccount") : t("auth.createAccount")}
            </button>

            <button
              type="button"
              className="accept-invitation-back"
              onClick={() => onBackToLogin()}
              disabled={isSubmitting}
            >
              {t("auth.backToSignIn")}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}

export default AcceptInvitationPage;
