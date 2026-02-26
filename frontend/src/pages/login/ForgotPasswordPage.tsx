import { Eye, EyeOff } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import unlockIcon from '../../images/unlock.png';
import './ForgotPasswordPage.css';

interface ForgotPasswordPageProps {
  onResetPassword: (payload: { email: string; newPassword: string; confirmPassword: string }) => Promise<string | null>;
}

function ForgotPasswordPage({ onResetPassword }: ForgotPasswordPageProps) {
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
      setSubmitError('Email requis');
      return;
    }

    if (newPassword.length < 6) {
      setSubmitError('Le mot de passe doit contenir au moins 6 caracteres');
      return;
    }

    if (newPassword !== confirmPassword) {
      setSubmitError('Les mots de passe ne correspondent pas');
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
      <div className="forgot-password-shell">
        <section className="forgot-password-content">
          <p className="forgot-password-brand">Monitoring</p>

          <div className="forgot-password-lock" aria-hidden="true">
            <img className="forgot-password-lock-image" src={unlockIcon} alt="" />
          </div>

          <h1 className="forgot-password-title">Create a new password</h1>
          <p className="forgot-password-subtitle">
            Please choose a password that hasn&apos;t been used before. Must be <strong>at least 6 characters</strong>
          </p>

          <form className="forgot-password-form" onSubmit={handleSubmit}>
            <label htmlFor="forgot-email">Email</label>
            <div className="forgot-password-input-wrap">
              <input
                id="forgot-email"
                type="email"
                autoComplete="email"
                placeholder="username@gmail.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <label htmlFor="forgot-new-password">New password</label>
            <div className="forgot-password-input-wrap">
              <input
                id="forgot-new-password"
                type={showNewPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="XXXXXXXXXX"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                disabled={isSubmitting}
              />
              <button
                type="button"
                className="forgot-password-toggle"
                aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowNewPassword((prev) => !prev)}
                disabled={isSubmitting}
              >
                {showNewPassword ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
            </div>

            <label htmlFor="forgot-confirm-password">Confirm new password</label>
            <div className="forgot-password-input-wrap">
              <input
                id="forgot-confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="XXXXXXXXXX"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                disabled={isSubmitting}
              />
              <button
                type="button"
                className="forgot-password-toggle"
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                disabled={isSubmitting}
              >
                {showConfirmPassword ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
            </div>

            {submitError ? <p className="login-form-error">{submitError}</p> : null}

            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Sending code...' : 'Reset password'}
            </button>
          </form>

          <p className="forgot-password-footer">
            Privacy policy | Terms of service Status page by <strong>MONITORING</strong>
          </p>
        </section>
      </div>
    </main>
  );
}

export default ForgotPasswordPage;
