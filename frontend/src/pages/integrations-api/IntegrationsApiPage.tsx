import { ChevronDown, Plus, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import slackLogo from '../../assets/slack-logo.svg';
import telegramLogo from '../../assets/telegram-logo.svg';
import webhookLogo from '../../images/webhook.png';
import './IntegrationsApiPage.css';

type IntegrationCategory = 'All' | 'Chat platforms' | 'Webhooks' | 'Connectors & Incident manag.' | 'Push notifications' | 'API';
type IntegrationIcon = 'slack' | 'telegram' | 'webhook';

interface IntegrationsApiPageProps {
  onOpenIntegrationsTeam?: () => void;
}

interface IntegrationCard {
  id: string;
  name: string;
  description: string;
  category: Exclude<IntegrationCategory, 'All'>;
  icon: IntegrationIcon;
}

interface IntegrationModalPreset {
  endpointLabel: string;
  endpointHint: string;
  endpointPlaceholder: string;
  customHint: string;
}

const integrationCards: IntegrationCard[] = [
  {
    id: 'slack',
    name: 'Slack',
    description: 'Slack messages are a great way to inform the entire team of a downtime.',
    category: 'Chat platforms',
    icon: 'slack',
  },
  {
    id: 'telegram',
    name: 'Telegram',
    description: 'Telegram messages are a great way to inform the entire team of a downtime.',
    category: 'Chat platforms',
    icon: 'telegram',
  },
  {
    id: 'webhook-primary',
    name: 'Webhook',
    description: 'Webhook calls are a great way to connect your incident workflow and automations.',
    category: 'Webhooks',
    icon: 'webhook',
  },
  {
    id: 'webhook-secondary',
    name: 'Webhook',
    description: 'Webhook calls are a great way to connect your incident workflow and automations.',
    category: 'Connectors & Incident manag.',
    icon: 'webhook',
  },
];

const integrationCategories: IntegrationCategory[] = [
  'All',
  'Chat platforms',
  'Webhooks',
  'Connectors & Incident manag.',
  'Push notifications',
  'API',
];

const integrationEventOptions = [
  'Up events, Down events, SSL & Domain expiry',
  'Up events only',
  'Down events only',
  'SSL & Domain expiry only',
];

const modalPresetByIcon: Record<IntegrationIcon, IntegrationModalPreset> = {
  slack: {
    endpointLabel: 'Slack webhook URL',
    endpointHint: 'Generate it from your Slack app Incoming Webhooks configuration.',
    endpointPlaceholder: 'https://hooks.slack.com/services/',
    customHint: 'Optional. Additional text appended to each notification message.',
  },
  telegram: {
    endpointLabel: 'Telegram bot token or endpoint URL',
    endpointHint: 'Use your BotFather token and channel settings, or your relay endpoint.',
    endpointPlaceholder: '123456789:AAExampleToken',
    customHint: 'Optional. Additional context sent with each Telegram notification.',
  },
  webhook: {
    endpointLabel: 'Webhook URL',
    endpointHint: 'Endpoint that will receive alert payloads from your monitors.',
    endpointPlaceholder: 'https://example.com/webhook',
    customHint: 'Optional. Value added to each payload for filtering/routing.',
  },
};

function IntegrationsApiPage({ onOpenIntegrationsTeam: _onOpenIntegrationsTeam }: IntegrationsApiPageProps) {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<IntegrationCategory>('All');
  const [activeCard, setActiveCard] = useState<IntegrationCard | null>(null);
  const [endpointValue, setEndpointValue] = useState('');
  const [customValue, setCustomValue] = useState('');
  const [eventsValue, setEventsValue] = useState(integrationEventOptions[0]);
  const endpointInputRef = useRef<HTMLInputElement | null>(null);

  const visibleCards = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return integrationCards.filter((card) => {
      const matchesCategory = activeCategory === 'All' || card.category === activeCategory;
      const matchesQuery =
        normalizedQuery.length === 0 ||
        card.name.toLowerCase().includes(normalizedQuery) ||
        card.description.toLowerCase().includes(normalizedQuery);

      return matchesCategory && matchesQuery;
    });
  }, [activeCategory, query]);

  const activePreset = useMemo(() => {
    if (!activeCard) return null;
    return modalPresetByIcon[activeCard.icon];
  }, [activeCard]);

  const renderCardIcon = (icon: IntegrationIcon) => {
    if (icon === 'slack') {
      return <img src={slackLogo} alt="Slack" className="integration-icon-image" />;
    }
    if (icon === 'telegram') {
      return <img src={telegramLogo} alt="Telegram" className="integration-icon-image" />;
    }
    return <img src={webhookLogo} alt="Webhook" className="integration-icon-image" />;
  };

  const closeIntegrationModal = () => {
    setActiveCard(null);
  };

  const openIntegrationModal = (card: IntegrationCard) => {
    setActiveCard(card);
    setEndpointValue('');
    setCustomValue('');
    setEventsValue(integrationEventOptions[0]);
  };

  const handleCreateIntegration = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!endpointValue.trim()) {
      endpointInputRef.current?.focus();
      return;
    }

    closeIntegrationModal();
  };

  useEffect(() => {
    if (!activeCard) return;

    const previousOverflow = document.body.style.overflow;
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeIntegrationModal();
      }
    };

    document.addEventListener('keydown', handleEscapeKey);
    document.body.style.overflow = 'hidden';
    endpointInputRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [activeCard]);

  return (
    <section className="integrations-api-page">
      <header className="integrations-api-header">
        <h1>Edit Status pages</h1>
      </header>

      <div className="integrations-api-layout">
        <div className="integrations-api-main">
          <label className="integrations-api-search">
            <Search size={14} />
            <input
              type="text"
              placeholder="Search by integration type"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>

          <div className="integrations-api-list">
            {visibleCards.map((card) => (
              <article className="integrations-api-card" key={card.id}>
                <div className="integrations-api-card-main">
                  <span className={`integration-icon ${card.icon}`} aria-hidden="true">
                    {renderCardIcon(card.icon)}
                  </span>
                  <div className="integrations-api-card-copy">
                    <h3>{card.name}</h3>
                    <p>{card.description}</p>
                  </div>
                </div>

                <button
                  className="integration-add-button"
                  type="button"
                  onClick={() => {
                    openIntegrationModal(card);
                  }}
                >
                  <Plus size={12} />
                  Add
                </button>
              </article>
            ))}

            {visibleCards.length === 0 && (
              <div className="integrations-api-empty">
                <p>No integration found for this filter.</p>
              </div>
            )}
          </div>
        </div>

        <aside className="integrations-api-filter-panel">
          {integrationCategories.map((category) => (
            <button
              key={category}
              type="button"
              className={`integrations-api-filter ${activeCategory === category ? 'active' : ''}`}
              onClick={() => setActiveCategory(category)}
            >
              {category}
            </button>
          ))}
        </aside>
      </div>

      {activeCard && activePreset ? (
        <div
          className="integrations-modal-overlay"
          role="presentation"
          onClick={closeIntegrationModal}
        >
          <section
            className="integrations-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="integration-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="integrations-modal-head">
              <div className="integrations-modal-title-group">
                <span className={`integration-icon ${activeCard.icon} integration-modal-icon`} aria-hidden="true">
                  {renderCardIcon(activeCard.icon)}
                </span>
                <h2 id="integration-modal-title">
                  Add <span>{activeCard.name}</span> integration
                </h2>
              </div>
              <button type="button" aria-label="Close integration modal" onClick={closeIntegrationModal}>
                <X size={16} />
              </button>
            </header>

            <form className="integrations-modal-form" onSubmit={handleCreateIntegration}>
              <div className="integrations-modal-field">
                <label htmlFor="integration-endpoint">{activePreset.endpointLabel}</label>
                <p>{activePreset.endpointHint}</p>
                <input
                  id="integration-endpoint"
                  ref={endpointInputRef}
                  type="text"
                  placeholder={activePreset.endpointPlaceholder}
                  value={endpointValue}
                  onChange={(event) => setEndpointValue(event.target.value)}
                  required
                />
              </div>

              <div className="integrations-modal-field">
                <label htmlFor="integration-custom-value">Custom value</label>
                <p>{activePreset.customHint}</p>
                <input
                  id="integration-custom-value"
                  type="text"
                  placeholder="e.g."
                  value={customValue}
                  onChange={(event) => setCustomValue(event.target.value)}
                />
              </div>

              <div className="integrations-modal-field">
                <label htmlFor="integration-events">Events to notify about</label>
                <div className="integrations-modal-select-shell">
                  <select
                    id="integration-events"
                    value={eventsValue}
                    onChange={(event) => setEventsValue(event.target.value)}
                  >
                    {integrationEventOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={15} aria-hidden="true" />
                </div>
              </div>

              <footer className="integrations-modal-actions">
                <button type="button" className="integrations-modal-cancel" onClick={closeIntegrationModal}>
                  Cancel
                </button>
                <button type="submit" className="integrations-modal-submit">
                  Create integration
                </button>
              </footer>
            </form>
          </section>
        </div>
      ) : null}
    </section>
  );
}

export default IntegrationsApiPage;
