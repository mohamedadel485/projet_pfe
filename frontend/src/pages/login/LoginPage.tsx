import { Eye, EyeOff } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import cap1Preview from '../../images/cap1 (1).png';
import tileA from '../../images/login-tile-a.png';
import tileB from '../../images/login-tile-b.png';
import tileC from '../../images/login-tile-c.png';
import tileD from '../../images/login-tile-d.png';
import tileE from '../../images/login-tile-e.png';
import tileF from '../../images/login-tile-f.png';
import tileG from '../../images/login-tile-g.png';
import tileH from '../../images/login-tile-h.png';
import './LoginPage.css';

interface LoginCredentials {
  email: string;
  password: string;
  rememberMe: boolean;
}

interface LoginPageProps {
  onSignIn: (credentials: LoginCredentials) => Promise<string | null>;
  onForgotPassword: () => void;
}

function LoginPage({ onSignIn, onForgotPassword }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isFormValid = useMemo(() => email.trim() !== '' && password.trim() !== '', [email, password]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isFormValid || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError(null);

    const error = await onSignIn({
      email: email.trim(),
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
    <main className="login-page">
      <div className="login-shell">
        <section className="login-left">
          <p className="login-brand">Monitoring</p>
          <h1 className="login-title">
            Welcome to
            <span>Monitiring</span>
          </h1>

          <form className="login-form" onSubmit={handleSubmit}>
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              placeholder="username@gmail.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={isSubmitting}
            />

            <label htmlFor="login-password">Password</label>
            <div className="login-password-wrap">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="XXXXXXXXXX"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={isSubmitting}
              />
              <button
                type="button"
                className="login-password-toggle"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword((prev) => !prev)}
                disabled={isSubmitting}
              >
                {showPassword ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
            </div>

            <div className="login-meta-row">
              <label className="login-remember">
                <input
                  className="login-remember-checkbox"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                  disabled={isSubmitting}
                />
                <span>Remember me</span>
              </label>
              <a
                href="#"
                onClick={(event) => {
                  event.preventDefault();
                  if (isSubmitting) return;
                  onForgotPassword();
                }}
              >
                Forget password ?
              </a>
            </div>

            {submitError ? <p className="login-form-error">{submitError}</p> : null}

            <button type="submit" disabled={!isFormValid || isSubmitting}>
              {isSubmitting ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <p className="login-footer">
            Privacy policy | Terms of service Status page by <strong>MONITORING</strong>
          </p>
        </section>

        <aside className="login-visual" aria-hidden="true">
          <div className="login-visual-grid">
            <article className="visual-card visual-card-a">
              <img src={tileA} alt="" />
            </article>
            <article className="visual-card visual-card-b">
              <img src={tileB} alt="" />
            </article>
            <article className="visual-card visual-card-c">
              <img src={tileC} alt="" />
            </article>
            <article className="visual-card visual-card-d">
              <img src={tileD} alt="" />
            </article>
            <article className="visual-card visual-card-e">
              <img src={tileE} alt="" />
            </article>
            <article className="visual-card visual-card-f">
              <img src={tileF} alt="" />
            </article>
            <article className="visual-card visual-card-g">
              <img src={tileG} alt="" />
            </article>
            <article className="visual-card visual-card-h">
              <img src={tileH} alt="" />
            </article>
          </div>
          <img className="login-visual-overlay" src={cap1Preview} alt="" />
        </aside>
      </div>
    </main>
  );
}

export default LoginPage;
