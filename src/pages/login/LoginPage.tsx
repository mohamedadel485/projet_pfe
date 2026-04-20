import { ArrowLeft, Eye, EyeOff, X } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import cap1Preview from "../../images/cap1 (1).png";
import tileA from "../../images/login-tile-a.png";
import tileB from "../../images/login-tile-b.png";
import tileC from "../../images/login-tile-c.png";
import tileD from "../../images/login-tile-d.png";
import tileE from "../../images/login-tile-e.png";
import tileF from "../../images/login-tile-f.png";
import tileG from "../../images/login-tile-g.png";
import tileH from "../../images/login-tile-h.png";
import "./LoginPage.css";

interface LoginCredentials {
  email: string;
  password: string;
  rememberMe: boolean;
}

interface AccountRequestData {
  email: string;
  name: string;
  message?: string;
}

export type LoginSubmissionResult = {
  error: string;
  code?: string;
} | null;

interface LoginPageProps {
  onSignIn: (credentials: LoginCredentials) => Promise<LoginSubmissionResult>;
  onRequestAccount?: (data: AccountRequestData) => Promise<string | null>;
  onSendVerificationCode: (email: string) => Promise<string | null>;
  onVerifyCode: (email: string, code: string) => Promise<boolean>;
  onResetPassword: (
    email: string,
    newPassword: string,
  ) => Promise<string | null>;
}

const isDisabledAccountError = (result: LoginSubmissionResult): boolean => {
  if (!result || typeof result.error !== "string") return false;

  const normalizedError = result.error.toLowerCase();
  return (
    result.code === "ACCOUNT_DISABLED" ||
    normalizedError.includes("compte desactiv") ||
    normalizedError.includes("account disabled")
  );
};

function LoginPage({
  onSignIn,
  onRequestAccount,
  onSendVerificationCode,
  onVerifyCode,
  onResetPassword,
}: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [accountDisabledPopupOpen, setAccountDisabledPopupOpen] =
    useState(false);
  const [accountDisabledMessage, setAccountDisabledMessage] = useState<
    string | null
  >(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // États pour la popup de demande de compte
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [requestEmail, setRequestEmail] = useState("");
  const [requestName, setRequestName] = useState("");
  const [requestMessage, setRequestMessage] = useState("");
  const [isRequestSubmitting, setIsRequestSubmitting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestSuccess, setRequestSuccess] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  // États pour le modal forgot password
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState<1 | 2 | 3>(1);
  const [forgotEmail, setForgotEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);
  const [isForgotSubmitting, setIsForgotSubmitting] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Validation email
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleEmailChange = (value: string) => {
    setRequestEmail(value);
    if (value.trim() && !validateEmail(value.trim())) {
      setEmailError(
        "Veuillez entrer une adresse email valide (ex: user@example.com)",
      );
    } else {
      setEmailError(null);
    }
  };

  const isFormValid = useMemo(
    () => email.trim() !== "" && password.trim() !== "",
    [email, password],
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isFormValid || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError(null);
    setAccountDisabledPopupOpen(false);
    setAccountDisabledMessage(null);

    try {
      const result = await onSignIn({
        email: email.trim(),
        password,
        rememberMe,
      });

      if (!result) return;

      if (isDisabledAccountError(result)) {
        setAccountDisabledMessage(result.error);
        setAccountDisabledPopupOpen(true);
      } else if (result.error) {
        setSubmitError(result.error);
      }
    } finally {
      setIsSubmitting(false);
    }
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
              name="email"
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
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="XXXXXXXXXX"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={isSubmitting}
              />
              <button
                type="button"
                className="login-password-toggle"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((prev) => !prev)}
                disabled={isSubmitting}
              >
                {showPassword ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
            </div>

            <div className="login-meta-row">
              <label className="login-remember">
                <input
                  id="login-remember-me"
                  name="rememberMe"
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
                  setIsForgotPasswordOpen(true);
                  setForgotStep(1);
                  setForgotEmail("");
                  setVerificationCode("");
                  setNewPassword("");
                  setConfirmPassword("");
                  setForgotError(null);
                  setForgotSuccess(null);
                }}
              >
                Forget password ?
              </a>
            </div>

            {submitError ? (
              <p className="login-form-error">{submitError}</p>
            ) : null}

            <div className="login-buttons-row">
              <button
                type="submit"
                className="login-btn-primary"
                disabled={!isFormValid || isSubmitting}
              >
                {isSubmitting ? "Signing in..." : "Log in"}
              </button>
              <button
                type="button"
                className="login-btn-secondary"
                disabled={isSubmitting}
                onClick={() => {
                  setIsRequestModalOpen(true);
                  setRequestError(null);
                  setRequestSuccess(null);
                }}
              >
                Create account
              </button>
            </div>
          </form>

          <p className="login-footer">
            Privacy policy | Terms of service Status page by{" "}
            <strong>MONITORING</strong>
          </p>

          {/* Modal de demande de création de compte */}
          {isRequestModalOpen && (
            <div
              className="login-modal-overlay"
              onClick={(e) => {
                if (e.target === e.currentTarget) setIsRequestModalOpen(false);
              }}
            >
              <div className="login-modal-container">
                <div className="login-modal-header">
                  <h2>Demande de création de compte</h2>
                  <button
                    type="button"
                    className="login-modal-close"
                    onClick={() => setIsRequestModalOpen(false)}
                    aria-label="Fermer"
                  >
                    <X size={20} />
                  </button>
                </div>
                <div className="login-modal-body">
                  <p className="login-modal-description">
                    Veuillez remplir le formulaire ci-dessous pour envoyer une
                    demande de création de compte au super administrateur.
                  </p>

                  <label className="login-modal-label" htmlFor="request-name">
                    Nom complet *
                  </label>
                  <input
                    id="request-name"
                    className="login-modal-input"
                    type="text"
                    placeholder="John Doe"
                    value={requestName}
                    onChange={(e) => setRequestName(e.target.value)}
                    disabled={isRequestSubmitting}
                  />

                  <label className="login-modal-label" htmlFor="request-email">
                    Email *
                  </label>
                  <input
                    id="request-email"
                    className={`login-modal-input ${emailError ? "login-modal-input-error" : ""}`}
                    type="email"
                    placeholder="john.doe@example.com"
                    value={requestEmail}
                    onChange={(e) => handleEmailChange(e.target.value)}
                    disabled={isRequestSubmitting}
                  />
                  {emailError && (
                    <p className="login-modal-field-error">{emailError}</p>
                  )}

                  <label
                    className="login-modal-label"
                    htmlFor="request-message"
                  >
                    Message (optionnel)
                  </label>
                  <textarea
                    id="request-message"
                    className="login-modal-textarea"
                    placeholder="Expliquez brièvement pourquoi vous avez besoin d'un compte..."
                    value={requestMessage}
                    onChange={(e) => setRequestMessage(e.target.value)}
                    disabled={isRequestSubmitting}
                    rows={3}
                  />

                  {requestError && (
                    <p className="login-modal-error">{requestError}</p>
                  )}
                  {requestSuccess && (
                    <p className="login-modal-success">{requestSuccess}</p>
                  )}

                  <button
                    type="button"
                    className="login-modal-submit"
                    disabled={
                      isRequestSubmitting ||
                      !requestEmail.trim() ||
                      !requestName.trim()
                    }
                    onClick={async () => {
                      if (!onRequestAccount) {
                        setRequestError("Fonctionnalité non disponible.");
                        return;
                      }
                      // Validation email avant envoi
                      if (!validateEmail(requestEmail.trim())) {
                        setEmailError(
                          "Veuillez entrer une adresse email valide",
                        );
                        return;
                      }
                      setIsRequestSubmitting(true);
                      setRequestError(null);
                      setRequestSuccess(null);
                      const error = await onRequestAccount({
                        email: requestEmail.trim(),
                        name: requestName.trim(),
                        message: requestMessage.trim() || undefined,
                      });
                      if (error) {
                        setRequestError(error);
                      } else {
                        setRequestSuccess(
                          "Votre demande a été envoyée au super administrateur. Vous recevrez une réponse par email.",
                        );
                        // Réinitialiser le formulaire après succès
                        setRequestEmail("");
                        setRequestName("");
                        setRequestMessage("");
                      }
                      setIsRequestSubmitting(false);
                    }}
                  >
                    {isRequestSubmitting
                      ? "Envoi en cours..."
                      : "Envoyer la demande"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal Forgot Password */}
          {isForgotPasswordOpen && (
            <div
              className="login-modal-overlay"
              onClick={(e) => {
                if (e.target === e.currentTarget)
                  setIsForgotPasswordOpen(false);
              }}
            >
              <div className="login-modal-container">
                <div className="login-modal-header">
                  <button
                    type="button"
                    className="login-modal-back"
                    onClick={() => {
                      if (forgotStep > 1) {
                        setForgotStep((prev) => (prev - 1) as 1 | 2 | 3);
                        setForgotError(null);
                      } else {
                        setIsForgotPasswordOpen(false);
                      }
                    }}
                    aria-label="Retour"
                  >
                    <ArrowLeft size={20} />
                  </button>
                  <h2>
                    {forgotStep === 1 && "Mot de passe oublié"}
                    {forgotStep === 2 && "Code de vérification"}
                    {forgotStep === 3 && "Nouveau mot de passe"}
                  </h2>
                  <button
                    type="button"
                    className="login-modal-close"
                    onClick={() => setIsForgotPasswordOpen(false)}
                    aria-label="Fermer"
                  >
                    <X size={20} />
                  </button>
                </div>
                <div className="login-modal-body">
                  {/* Étape 1: Email */}
                  {forgotStep === 1 && (
                    <>
                      <p className="login-modal-description">
                        Entrez votre adresse email pour recevoir un code de
                        vérification.
                      </p>
                      <label
                        className="login-modal-label"
                        htmlFor="forgot-email"
                      >
                        Email *
                      </label>
                      <input
                        id="forgot-email"
                        className={`login-modal-input ${forgotError ? "login-modal-input-error" : ""}`}
                        type="email"
                        placeholder="john.doe@example.com"
                        value={forgotEmail}
                        onChange={(e) => {
                          setForgotEmail(e.target.value);
                          setForgotError(null);
                        }}
                        disabled={isForgotSubmitting}
                      />
                      {forgotError && (
                        <p className="login-modal-field-error">{forgotError}</p>
                      )}
                      <button
                        type="button"
                        className="login-modal-submit"
                        disabled={isForgotSubmitting || !forgotEmail.trim()}
                        onClick={async () => {
                          setForgotError(null);
                          // Validation format email
                          if (!validateEmail(forgotEmail.trim())) {
                            setForgotError(
                              "Veuillez entrer une adresse email valide",
                            );
                            return;
                          }
                          setIsForgotSubmitting(true);
                          try {
                            // Envoyer le code
                            const error = await onSendVerificationCode(
                              forgotEmail.trim(),
                            );
                            if (error) {
                              setForgotError(error);
                            } else {
                              setForgotStep(2);
                            }
                          } catch {
                            setForgotError(
                              "Impossible d envoyer le code de verification.",
                            );
                          } finally {
                            setIsForgotSubmitting(false);
                          }
                        }}
                      >
                        {isForgotSubmitting
                          ? "Envoi en cours..."
                          : "Envoyer le code"}
                      </button>
                    </>
                  )}

                  {/* Étape 2: Code de vérification */}
                  {forgotStep === 2 && (
                    <>
                      <p className="login-modal-description">
                        Un code de 6 chiffres a été envoyé à{" "}
                        <strong>{forgotEmail}</strong>. Entrez-le ci-dessous.
                      </p>
                      <label
                        className="login-modal-label"
                        htmlFor="verification-code"
                      >
                        Code de vérification *
                      </label>
                      <input
                        id="verification-code"
                        className={`login-modal-input ${forgotError ? "login-modal-input-error" : ""}`}
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="000000"
                        value={verificationCode}
                        onChange={(e) => {
                          const value = e.target.value
                            .replace(/\D/g, "")
                            .slice(0, 6);
                          setVerificationCode(value);
                          setForgotError(null);
                        }}
                        disabled={isForgotSubmitting}
                      />
                      {forgotError && (
                        <p className="login-modal-field-error">{forgotError}</p>
                      )}
                      <button
                        type="button"
                        className="login-modal-submit"
                        disabled={
                          isForgotSubmitting || verificationCode.length !== 6
                        }
                        onClick={async () => {
                          setForgotError(null);
                          setIsForgotSubmitting(true);
                          try {
                            const isValid = await onVerifyCode(
                              forgotEmail,
                              verificationCode,
                            );
                            if (!isValid) {
                              setForgotError("Code invalide ou expiré");
                            } else {
                              setForgotStep(3);
                            }
                          } catch {
                            setForgotError("Code invalide ou expiré");
                          } finally {
                            setIsForgotSubmitting(false);
                          }
                        }}
                      >
                        {isForgotSubmitting ? "Vérification..." : "Vérifier"}
                      </button>
                      <button
                        type="button"
                        className="login-modal-resend"
                        disabled={isForgotSubmitting}
                        onClick={async () => {
                          setForgotError(null);
                          setIsForgotSubmitting(true);
                          try {
                            const error =
                              await onSendVerificationCode(forgotEmail);
                            if (error) {
                              setForgotError(error);
                            } else {
                              setForgotSuccess("Un nouveau code a été envoyé");
                              setTimeout(() => setForgotSuccess(null), 3000);
                            }
                          } catch {
                            setForgotError("Impossible de renvoyer le code.");
                          } finally {
                            setIsForgotSubmitting(false);
                          }
                        }}
                      >
                        Renvoyer le code
                      </button>
                      {forgotSuccess && (
                        <p className="login-modal-success">{forgotSuccess}</p>
                      )}
                    </>
                  )}

                  {/* Étape 3: Nouveau mot de passe */}
                  {forgotStep === 3 && (
                    <>
                      <p className="login-modal-description">
                        Créez un nouveau mot de passe sécurisé.
                      </p>
                      <label
                        className="login-modal-label"
                        htmlFor="new-password"
                      >
                        Nouveau mot de passe *
                      </label>
                      <div className="login-password-wrap">
                        <input
                          id="new-password"
                          className="login-modal-input"
                          type={showNewPassword ? "text" : "password"}
                          autoComplete="new-password"
                          placeholder="Min. 6 caractères, 1 majuscule, 1 chiffre, 1 caractère spécial"
                          value={newPassword}
                          onChange={(e) => {
                            setNewPassword(e.target.value);
                            setForgotError(null);
                          }}
                          disabled={isForgotSubmitting}
                        />
                        <button
                          type="button"
                          className="login-password-toggle"
                          aria-label={showNewPassword ? "Masquer" : "Afficher"}
                          onClick={() => setShowNewPassword((prev) => !prev)}
                          disabled={isForgotSubmitting}
                        >
                          {showNewPassword ? (
                            <Eye size={16} />
                          ) : (
                            <EyeOff size={16} />
                          )}
                        </button>
                      </div>

                      <label
                        className="login-modal-label"
                        htmlFor="confirm-password"
                      >
                        Confirmer le mot de passe *
                      </label>
                      <div className="login-password-wrap">
                        <input
                          id="confirm-password"
                          className="login-modal-input"
                          type={showConfirmPassword ? "text" : "password"}
                          autoComplete="new-password"
                          placeholder="Confirmez votre mot de passe"
                          value={confirmPassword}
                          onChange={(e) => {
                            setConfirmPassword(e.target.value);
                            setForgotError(null);
                          }}
                          disabled={isForgotSubmitting}
                        />
                        <button
                          type="button"
                          className="login-password-toggle"
                          aria-label={
                            showConfirmPassword ? "Masquer" : "Afficher"
                          }
                          onClick={() =>
                            setShowConfirmPassword((prev) => !prev)
                          }
                          disabled={isForgotSubmitting}
                        >
                          {showConfirmPassword ? (
                            <Eye size={16} />
                          ) : (
                            <EyeOff size={16} />
                          )}
                        </button>
                      </div>

                      {/* Indicateur de force du mot de passe */}
                      {newPassword && (
                        <div className="password-strength">
                          <p>Le mot de passe doit contenir :</p>
                          <ul>
                            <li
                              className={newPassword.length >= 6 ? "valid" : ""}
                            >
                              Au moins 6 caractères
                            </li>
                            <li
                              className={
                                /[A-Z]/.test(newPassword) ? "valid" : ""
                              }
                            >
                              Une lettre majuscule
                            </li>
                            <li
                              className={
                                /[0-9]/.test(newPassword) ? "valid" : ""
                              }
                            >
                              Un chiffre
                            </li>
                            <li
                              className={
                                /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(
                                  newPassword,
                                )
                                  ? "valid"
                                  : ""
                              }
                            >
                              Un caractère spécial
                            </li>
                          </ul>
                        </div>
                      )}

                      {forgotError && (
                        <p className="login-modal-field-error">{forgotError}</p>
                      )}
                      <button
                        type="button"
                        className="login-modal-submit"
                        disabled={
                          isForgotSubmitting ||
                          !newPassword ||
                          !confirmPassword ||
                          newPassword !== confirmPassword ||
                          newPassword.length < 6 ||
                          !/[A-Z]/.test(newPassword) ||
                          !/[0-9]/.test(newPassword) ||
                          !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(
                            newPassword,
                          )
                        }
                        onClick={async () => {
                          setForgotError(null);
                          if (newPassword !== confirmPassword) {
                            setForgotError(
                              "Les mots de passe ne correspondent pas",
                            );
                            return;
                          }
                          setIsForgotSubmitting(true);
                          const error = await onResetPassword(
                            forgotEmail,
                            newPassword,
                          );
                          if (error) {
                            setForgotError(error);
                          } else {
                            setForgotSuccess(
                              "Votre mot de passe a été réinitialisé avec succès !",
                            );
                            setTimeout(() => {
                              setIsForgotPasswordOpen(false);
                              setEmail(forgotEmail);
                            }, 2000);
                          }
                          setIsForgotSubmitting(false);
                        }}
                      >
                        {isForgotSubmitting
                          ? "Réinitialisation..."
                          : "Réinitialiser le mot de passe"}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {accountDisabledPopupOpen && (
            <div
              className="login-modal-overlay"
              role="presentation"
              onClick={(e) => {
                if (e.target === e.currentTarget)
                  setAccountDisabledPopupOpen(false);
              }}
            >
              <div
                className="login-modal-container"
                role="dialog"
                aria-modal="true"
                aria-labelledby="account-disabled-title"
                style={{ maxWidth: 460 }}
              >
                <div className="login-modal-header">
                  <h2 id="account-disabled-title">Compte désactivé</h2>
                  <button
                    type="button"
                    className="login-modal-close"
                    onClick={() => setAccountDisabledPopupOpen(false)}
                    aria-label="Fermer"
                  >
                    <X size={20} />
                  </button>
                </div>
                <div
                  className="login-modal-body"
                  style={{ textAlign: "center" }}
                >
                  <div
                    aria-hidden="true"
                    style={{ fontSize: 56, lineHeight: 1, marginBottom: 16 }}
                  >
                    🚫
                  </div>
                  <p className="login-modal-description">
                    {accountDisabledMessage ?? "Votre compte a été désactivé."}
                  </p>
                  <p style={{ marginTop: 12, color: "#5b6472" }}>
                    Contactez un administrateur pour réactiver l’accès.
                  </p>
                  <button
                    type="button"
                    className="login-modal-submit"
                    onClick={() => setAccountDisabledPopupOpen(false)}
                  >
                    Compris
                  </button>
                </div>
              </div>
            </div>
          )}
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
