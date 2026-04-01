import { Eye, EyeOff } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
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
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isTokenValid = Boolean(token && token.trim() !== '');
  const isFormValid = useMemo(
    () =>
      isTokenValid &&
      password.trim().length >= 6 &&
      confirmPassword.trim().length >= 6 &&
      password === confirmPassword,
    [confirmPassword, isTokenValid, password],
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
      <div className="accept-invitation-shell">
        <section className="accept-invitation-card">
          <p className="accept-invitation-brand">Monitoring</p>
          <h1 className="accept-invitation-title">
            Accept invitation
            <span>Create your account</span>
          </h1>

          <form className="accept-invitation-form" onSubmit={handleSubmit}>
            {!isTokenValid ? (
              <p className="accept-invitation-error">Lien d'invitation invalide. Demandez un nouveau lien a l'admin.</p>
            ) : null}

            <label htmlFor="accept-invite-password">Password</label>
            <div className="accept-invitation-password-wrap">
              <input
                id="accept-invite-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="At least 6 characters"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={isSubmitting || !isTokenValid}
              />
              <button
                type="button"
                className="accept-invitation-password-toggle"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword((prev) => !prev)}
                disabled={isSubmitting || !isTokenValid}
              >
                {showPassword ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
            </div>

            <label htmlFor="accept-invite-confirm-password">Confirm password</label>
            <div className="accept-invitation-password-wrap">
              <input
                id="accept-invite-confirm-password"
                name="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Repeat password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                disabled={isSubmitting || !isTokenValid}
              />
              <button
                type="button"
                className="accept-invitation-password-toggle"
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                disabled={isSubmitting || !isTokenValid}
              >
                {showConfirmPassword ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
            </div>

            <label className="accept-invitation-remember">
              <input
                id="accept-invite-remember-me"
                name="rememberMe"
                type="checkbox"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
                disabled={isSubmitting || !isTokenValid}
              />
              <span>Remember me</span>
            </label>

            {submitError ? <p className="accept-invitation-error">{submitError}</p> : null}

            <button type="submit" disabled={!isFormValid || isSubmitting}>
              {isSubmitting ? 'Creating account...' : 'Create account'}
            </button>

            <button
              type="button"
              className="accept-invitation-back"
              onClick={() => onBackToLogin()}
              disabled={isSubmitting}
            >
              Back to sign in
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}

export default AcceptInvitationPage;
