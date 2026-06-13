import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Globe } from "lucide-react";
import {
  useAppLanguage,
  type AppLanguage,
  type TranslationKey,
} from "../lib/language";

const languageOptions: Array<{
  code: AppLanguage;
  shortLabel: string;
}> = [
  { code: "en", shortLabel: "EN" },
  { code: "fr", shortLabel: "FR" },
  { code: "ar", shortLabel: "AR" },
];

const languageLabelKeys: Record<AppLanguage, TranslationKey> = {
  en: "settings.languageEnglish",
  fr: "settings.languageFrench",
  ar: "settings.languageArabic",
};

const LanguageSwitcher = () => {
  const { language, setLanguage, t } = useAppLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleDocumentMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current && !menuRef.current.contains(target)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleDocumentMouseDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleDocumentMouseDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div className="language-switcher" ref={menuRef}>
      <button
        type="button"
        className="language-switcher-button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={isOpen ? t("common.closeMenu") : t("common.openMenu")}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <Globe size={14} aria-hidden="true" />
        <span className="language-switcher-code">
          {language.toUpperCase()}
        </span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>

      {isOpen ? (
        <div className="language-switcher-menu" role="menu">
          {languageOptions.map((option) => {
            const isSelected = language === option.code;

            return (
              <button
                key={option.code}
                type="button"
                role="menuitemradio"
                aria-checked={isSelected}
                className={isSelected ? "selected" : ""}
                onClick={() => {
                  setLanguage(option.code);
                  setIsOpen(false);
                }}
              >
                <span className="language-switcher-menu-short">
                  {option.shortLabel}
                </span>
                <span className="language-switcher-menu-label">
                  {t(languageLabelKeys[option.code])}
                </span>
                {isSelected ? <Check size={14} aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};

export default LanguageSwitcher;
