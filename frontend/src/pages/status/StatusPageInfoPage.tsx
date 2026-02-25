import { type ChangeEvent, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import './status-page-info-page.css';
import arabicFlag from '../../images/arabic.jpg';
import englishFlag from '../../images/English.jpg';
import franceFlag from '../../images/france.svg';

interface StatusPageInfoPageProps {
  statusPageId: string;
  onBackToMonitoring: () => void;
  onBackToStatusPages: () => void;
}

interface ToggleOption {
  id: string;
  label: string;
  description: string;
  checked?: boolean;
}

interface StatusPageFormValues {
  pageName: string;
  homepageUrl: string;
  customDomain: string;
  googleAnalytics: string;
  password: string;
  language: LanguageValue;
}

const EMPTY_STATUS_PAGE_FORM: StatusPageFormValues = {
  pageName: '',
  homepageUrl: '',
  customDomain: '',
  googleAnalytics: '',
  password: '',
  language: 'english',
};

type LanguageValue = 'english' | 'french' | 'arabic';

interface LanguageOption {
  value: LanguageValue;
  label: string;
  flag: string;
  flagImage?: string;
}

const languageOptions: LanguageOption[] = [
  { value: 'english', label: 'English', flag: '🇬🇧' },
  { value: 'french', label: 'French', flag: '🇫🇷' },
  { value: 'arabic', label: 'Arabic', flag: '🇲🇦' },
];

const languageOptionsWithAssets: LanguageOption[] = languageOptions.map((languageOption) =>
  languageOption.value === 'english'
    ? { ...languageOption, flagImage: englishFlag }
    : languageOption.value === 'french'
      ? { ...languageOption, flagImage: franceFlag }
      : languageOption.value === 'arabic'
        ? { ...languageOption, flagImage: arabicFlag }
        : languageOption,
);

const renderLanguageFlag = (languageOption: LanguageOption) => {
  if (languageOption.flagImage) {
    return <img src={languageOption.flagImage} alt="" className="status-page-language-flag-image" />;
  }

  return languageOption.flag;
};

const whiteLabelOptions: ToggleOption[] = [
  {
    id: 'remove-monitoring-logo',
    label: 'Remove Monitoring logo',
    description: 'This will hide "Powered by Monitoring" link in footer.',
    checked: true,
  },
  {
    id: 'remove-cookie-consent',
    label: 'Remove cookie consent',
    description: 'Available only for a Custom Domain status page',
    checked: true,
  },
];

const featureOptions: ToggleOption[] = [
  {
    id: 'show-bar-charts',
    label: 'Show bar charts',
    description: 'Show uptime charts on the status page home screen.',
    checked: true,
  },
  {
    id: 'show-outage-details',
    label: 'Show outage details',
    description: 'Display outage reason details for users.',
    checked: true,
  },
  {
    id: 'show-uptime-percentage',
    label: 'Show uptime percentage',
    description: 'Display uptime percentage near each monitor.',
    checked: true,
  },
  {
    id: 'enable-details-page',
    label: 'Enable details page',
    description: 'Show uptime, response times and event history.',
    checked: true,
  },
  {
    id: 'enable-floating-bar',
    label: 'Enable floating status bar',
    description: 'Keep overall status visible at the bottom.',
    checked: true,
  },
  {
    id: 'show-monitor-url',
    label: 'Show monitor URL',
    description: 'Display each monitor URL to users.',
    checked: true,
  },
];

const privacyOptions: ToggleOption[] = [
  {
    id: 'help-improve',
    label: 'Help us improve',
    description: 'Share anonymous usage analytics.',
  },
  {
    id: 'small-cookie-dialog',
    label: 'Use small cookie dialog',
    description: 'Compact consent dialog for public pages.',
  },
];

function StatusPageInfoPage({
  statusPageId,
  onBackToMonitoring,
  onBackToStatusPages,
}: StatusPageInfoPageProps) {
  const [formValues, setFormValues] = useState<StatusPageFormValues>(EMPTY_STATUS_PAGE_FORM);
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
  const languageMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setFormValues(EMPTY_STATUS_PAGE_FORM);
  }, [statusPageId]);

  useEffect(() => {
    if (!isLanguageMenuOpen) return;

    const handleDocumentMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (target && !languageMenuRef.current?.contains(target)) {
        setIsLanguageMenuOpen(false);
      }
    };

    const handleDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsLanguageMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleDocumentMouseDown);
    document.addEventListener('keydown', handleDocumentKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleDocumentMouseDown);
      document.removeEventListener('keydown', handleDocumentKeyDown);
    };
  }, [isLanguageMenuOpen]);

  const handleInputChange =
    (field: keyof StatusPageFormValues) => (event: ChangeEvent<HTMLInputElement>) => {
      const { value } = event.target;
      setFormValues((currentValues) => ({
        ...currentValues,
        [field]: value,
      }));
    };

  const selectedLanguage =
    languageOptionsWithAssets.find((languageOption) => languageOption.value === formValues.language) ??
    languageOptionsWithAssets[0];

  const handleLanguageSelect = (language: LanguageValue) => {
    setFormValues((currentValues) => ({
      ...currentValues,
      language,
    }));
    setIsLanguageMenuOpen(false);
  };

  return (
    <section className="status-page-info-page">
      <header className="status-page-info-header">
        <nav aria-label="Breadcrumb" className="status-page-info-breadcrumb">
          <button type="button" onClick={onBackToMonitoring}>
            Monitoring
          </button>
          <ChevronRight size={12} />
          <button type="button" onClick={onBackToStatusPages}>
            Status pages
          </button>
        </nav>
        <h1>Edit Status pages</h1>
      </header>

      <div className="status-page-info-layout">
        <div className="status-page-info-main">
          <section className="status-page-info-card">
            <h2>Name & homepage</h2>
            <div className="status-page-field status-page-primary-field">
              <span>Name of the status page</span>
              <small>Use HTTP (S) monitor to monitor your website, API endpoint, or anything running on HTTP.</small>
            </div>
            <div className="status-page-field-grid two-columns status-page-homepage-row">
              <label className="status-page-field status-page-input-only">
                <input
                  type="text"
                  value={formValues.pageName}
                  onChange={handleInputChange('pageName')}
                  placeholder="Status page"
                  autoComplete="off"
                />
              </label>
              <label className="status-page-field status-page-input-only">
                <input
                  type="text"
                  value={formValues.homepageUrl}
                  onChange={handleInputChange('homepageUrl')}
                  placeholder="E.g. https://"
                  autoComplete="off"
                />
              </label>
            </div>
          </section>

          <section className="status-page-info-card">
            <h2>White-label</h2>
            <div className="status-page-field-grid two-columns">
              <label className="status-page-field">
                <span>Custom domain</span>
                <small>
                  Host status page on your domain. Make sure you create a CNAME DNS record for your domain to
                  stats.metal2000.com
                </small>
                <input
                  type="text"
                  value={formValues.customDomain}
                  onChange={handleInputChange('customDomain')}
                  placeholder="E.g. status.yourdomain.com"
                  autoComplete="off"
                />
              </label>
              <label className="status-page-field">
                <span>Google Analytics</span>
                <small>
                  Available only for custom Domain status page Please use format G-XXXXXX We
                  <br />
                  use{' '}
                  <a
                    href="https://developers.google.com/analytics/devguides/collection/gtagjs"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Global site tag (gtag.js) - Google analytics implementation
                  </a>
                </small>
                <input
                  type="text"
                  value={formValues.googleAnalytics}
                  onChange={handleInputChange('googleAnalytics')}
                  placeholder="XXXXXXXXXX"
                  autoComplete="off"
                />
              </label>
            </div>
            <div className="status-page-switch-grid two-columns">
              {whiteLabelOptions.map((option) => (
                <label className="status-page-switch-item" key={option.id}>
                  <span className="status-page-switch-control">
                    <input type="checkbox" defaultChecked={option.checked} />
                    <span className="status-page-switch-slider" />
                  </span>
                  <span className="status-page-switch-copy">
                    <strong>{option.label}</strong>
                    <small>{option.description}</small>
                  </span>
                </label>
              ))}
            </div>
          </section>

          <section className="status-page-info-card">
            <h2>Access</h2>
            <div className="status-page-field-grid two-columns">
              <label className="status-page-field span-two">
                <span>Password</span>
                <small>
                  Host status page on your domain. Make sure you create a CNAME DNS record for your domain to
                  stats.metal2000.com
                </small>
                <input
                  type="password"
                  value={formValues.password}
                  onChange={handleInputChange('password')}
                  placeholder="Enter password"
                  autoComplete="new-password"
                />
              </label>
              <label className="status-page-field">
                <span>Language</span>
                <small>Language used on this public page.</small>
                <div className="status-page-language-select" ref={languageMenuRef}>
                  <button
                    type="button"
                    className={`status-page-language-trigger ${isLanguageMenuOpen ? 'open' : ''}`}
                    aria-haspopup="listbox"
                    aria-expanded={isLanguageMenuOpen}
                    onClick={() => setIsLanguageMenuOpen((currentOpen) => !currentOpen)}
                  >
                    <span className="status-page-language-current">
                      <span className="status-page-language-flag" aria-hidden="true">
                        {renderLanguageFlag(selectedLanguage)}
                      </span>
                      <span>{selectedLanguage.label}</span>
                    </span>
                    <ChevronDown size={14} />
                  </button>

                  {isLanguageMenuOpen && (
                    <div className="status-page-language-menu" role="listbox" aria-label="Language">
                      {languageOptionsWithAssets.map((languageOption) => (
                        <button
                          key={languageOption.value}
                          type="button"
                          role="option"
                          aria-selected={formValues.language === languageOption.value}
                          className={`status-page-language-item ${
                            formValues.language === languageOption.value ? 'selected' : ''
                          }`}
                          onClick={() => handleLanguageSelect(languageOption.value)}
                        >
                          <span className="status-page-language-flag" aria-hidden="true">
                            {renderLanguageFlag(languageOption)}
                          </span>
                          <span>{languageOption.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </label>
              <label className="status-page-field">
                <span>Robots meta tag</span>
                <small>Control indexing of this status page in search engines.</small>
                <select defaultValue="index">
                  <option value="index">Index (visible in search engines)</option>
                  <option value="noindex">Noindex (hidden from search engines)</option>
                </select>
              </label>
            </div>
          </section>

          <section className="status-page-info-card">
            <h2>Features</h2>
            <div className="status-page-switch-grid two-columns">
              {featureOptions.map((option) => (
                <label className="status-page-switch-item" key={option.id}>
                  <span className="status-page-switch-control">
                    <input type="checkbox" defaultChecked={option.checked} />
                    <span className="status-page-switch-slider" />
                  </span>
                  <span className="status-page-switch-copy">
                    <strong>{option.label}</strong>
                    <small>{option.description}</small>
                  </span>
                </label>
              ))}
            </div>
          </section>

          <section className="status-page-info-card">
            <h2>Privacy</h2>
            <div className="status-page-switch-grid two-columns">
              {privacyOptions.map((option) => (
                <label className="status-page-switch-item" key={option.id}>
                  <span className="status-page-switch-control">
                    <input type="checkbox" defaultChecked={option.checked} />
                    <span className="status-page-switch-slider" />
                  </span>
                  <span className="status-page-switch-copy">
                    <strong>{option.label}</strong>
                    <small>{option.description}</small>
                  </span>
                </label>
              ))}
            </div>
          </section>

          <div className="status-page-info-actions">
            <button type="button" className="status-page-info-primary">
              Create monitor
            </button>
          </div>
        </div>

        <aside className="status-page-info-sidebar" aria-label="Status page sections">
          <p className="status-page-info-sidebar-title">Monitor details</p>
          <button type="button">Integrations & Team</button>
          <button type="button">Maintenance info</button>
        </aside>
      </div>
    </section>
  );
}

export default StatusPageInfoPage;
