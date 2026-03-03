import { ArrowLeft } from "lucide-react";
import {
  useRef,
  useState,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import lockIcon from "../../images/lock@2x.png";
import "./ConfirmationCodePage.css";

interface ConfirmationCodePageProps {
  email?: string;
  onBack: () => void;
  onContinue: (code: string) => Promise<string | null>;
  onResend?: () => Promise<string | null>;
}

function ConfirmationCodePage({
  email = "username@gmail.com",
  onBack,
  onContinue,
  onResend,
}: ConfirmationCodePageProps) {
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [resendFeedback, setResendFeedback] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const handleDigitChange = (index: number, value: string) => {
    const cleaned = value.replace(/\D/g, "").slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[index] = cleaned;
      return next;
    });

    if (cleaned && index < inputRefs.current.length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleDigitKeyDown = (
    index: number,
    event: KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const pastedDigits = event.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6)
      .split("");

    if (pastedDigits.length === 0) return;

    const next = ["", "", "", "", "", ""];
    pastedDigits.forEach((digit, index) => {
      next[index] = digit;
    });

    setDigits(next);
    const targetIndex = Math.min(pastedDigits.length, 6) - 1;
    inputRefs.current[targetIndex]?.focus();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    const code = digits.join("");
    if (code.length !== 6) {
      setSubmitError("Entrez le code complet");
      return;
    }

    setSubmitError(null);
    setResendFeedback(null);
    setIsSubmitting(true);

    const error = await onContinue(code);
    if (error) {
      setSubmitError(error);
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
  };

  return (
    <main className="confirmation-code-page">
      <div className="confirmation-code-shell">
        <button
          type="button"
          className="confirmation-code-back"
          onClick={onBack}
          aria-label="Back"
        >
          <ArrowLeft size={16} />
        </button>

        <section className="confirmation-code-content">
          <p className="confirmation-code-brand" style={{ marginTop: "40px" }}>
            Monitoring
          </p>

          <div className="confirmation-code-badge" aria-hidden="true">
            <img
              style={{ margin: "20px" }}
              className="confirmation-code-badge-image"
              src={lockIcon}
              alt=""
            />
          </div>

          <h1 className="confirmation-code-title">Enter confirmation code</h1>
          <p
            className="confirmation-code-subtitle"
            style={{ marginTop: "30px" }}
          >
            We sent you a code to <strong>{email}</strong>
          </p>

          <form className="confirmation-code-form" onSubmit={handleSubmit}>
            <div className="confirmation-code-inputs">
              {digits.map((digit, index) => (
                <input
                  key={index}
                  ref={(element) => {
                    inputRefs.current[index] = element;
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(event) =>
                    handleDigitChange(index, event.target.value)
                  }
                  onKeyDown={(event) => handleDigitKeyDown(index, event)}
                  onPaste={handlePaste}
                  aria-label={`Code digit ${index + 1}`}
                  disabled={isSubmitting || isResending}
                />
              ))}
            </div>

            <p className="confirmation-code-resend">
              Didn&apos;t receive the email?{" "}
              <a
                href="#"
                onClick={async (event) => {
                  event.preventDefault();
                  if (!onResend || isResending) return;

                  setSubmitError(null);
                  setResendFeedback(null);
                  setIsResending(true);
                  const error = await onResend();

                  if (error) {
                    setSubmitError(error);
                  } else {
                    setResendFeedback("Code resent successfully.");
                  }
                  setIsResending(false);
                }}
              >
                Click to resend
              </a>
            </p>

            {submitError ? <p className="login-form-error">{submitError}</p> : null}
            {resendFeedback ? <p>{resendFeedback}</p> : null}

            <button type="submit" style={{ margin: "50px 0" }} disabled={isSubmitting || isResending}>
              {isSubmitting ? 'Verifying...' : 'Continue'}
            </button>
          </form>

          <p className="confirmation-code-footer">
            Privacy policy | Terms of service Status page by{" "}
            <strong>MONITORING</strong>
          </p>
        </section>
      </div>
    </main>
  );
}

export default ConfirmationCodePage;
