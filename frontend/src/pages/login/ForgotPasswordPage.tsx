import { Eye, EyeOff } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import unlockIcon from '../../images/unlock.png';
import './ForgotPasswordPage.css';

interface ForgotPasswordPageProps {
  onResetPassword: () => void;
}

function ForgotPasswordPage({ onResetPassword }: ForgotPasswordPageProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onResetPassword();
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
            Please choose a password that hasn&apos;t been used before. Must be <strong>at least 8 characters</strong>
          </p>

          <form className="forgot-password-form" onSubmit={handleSubmit}>
            <label htmlFor="forgot-new-password">New password</label>
            <div className="forgot-password-input-wrap">
              <input
                id="forgot-new-password"
                type={showNewPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="XXXXXXXXXX"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
              <button
                type="button"
                className="forgot-password-toggle"
                aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowNewPassword((prev) => !prev)}
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
              />
              <button
                type="button"
                className="forgot-password-toggle"
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowConfirmPassword((prev) => !prev)}
              >
                {showConfirmPassword ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
            </div>

            <button type="submit">Reset password</button>
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
