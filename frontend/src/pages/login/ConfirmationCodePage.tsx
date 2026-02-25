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
  onContinue: () => void;
  onResend?: () => void;
}

function ConfirmationCodePage({
  email = "username@gmail.com",
  onBack,
  onContinue,
  onResend,
}: ConfirmationCodePageProps) {
  const [digits, setDigits] = useState(["", "", "", ""]);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

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
      .slice(0, 4)
      .split("");

    if (pastedDigits.length === 0) return;

    const next = ["", "", "", ""];
    pastedDigits.forEach((digit, index) => {
      next[index] = digit;
    });

    setDigits(next);
    const targetIndex = Math.min(pastedDigits.length, 4) - 1;
    inputRefs.current[targetIndex]?.focus();
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onContinue();
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
                />
              ))}
            </div>

            <p className="confirmation-code-resend">
              Didn&apos;t receive the email?{" "}
              <a
                href="#"
                onClick={(event) => {
                  event.preventDefault();
                  onResend?.();
                }}
              >
                Click to resend
              </a>
            </p>

            <button type="submit" style={{ margin: "50px 0" }}>
              Continue
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
