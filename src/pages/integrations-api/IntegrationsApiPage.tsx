import { ChevronDown, Plus, Search, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import slackLogo from '../../assets/slack-logo.svg';
import telegramLogo from '../../assets/telegram-logo.svg';
import webhookLogo from '../../images/webhook.png';
import {
  createIntegration,
  deleteIntegration,
  fetchIntegrations,
  type BackendIntegration,
  type IntegrationEvent,
  type IntegrationProvider,
} from '../../lib/api';
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
  categories: Exclude<IntegrationCategory, 'All'>[];
  icon: IntegrationIcon;
  isAvailable: boolean;
}

interface IntegrationModalPreset {
  endpointLabel: string;
  endpointHint: string;
  endpointPlaceholder: string;
  customHint: string;
}

type IntegrationEventSelection = 'up-and-down' | 'up-only' | 'down-only';
interface IntegrationEventOption {
  label: string;
  value: IntegrationEventSelection;
}

const integrationCards: IntegrationCard[] = [
  {
    id: 'slack',
    name: 'Slack',
    description: 'Slack messages are a great way to inform the entire team of a downtime.',
    categories: ['Chat platforms'],
    icon: 'slack',
    isAvailable: false,
  },
  {
    id: 'telegram',
    name: 'Telegram',
    description: 'Telegram messages are a great way to inform the entire team of a downtime.',
    categories: ['Chat platforms'],
    icon: 'telegram',
    isAvailable: false,
  },
  {
    id: 'webhook',
    name: 'Webhook',
    description: 'Webhook calls are a great way to connect your incident workflow and automations.',
    categories: ['Webhooks', 'Connectors & Incident manag.'],
    icon: 'webhook',
    isAvailable: true,
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

const integrationEventOptions: IntegrationEventOption[] = [
  { label: 'Up events, Down events', value: 'up-and-down' },
  { label: 'Up events only', value: 'up-only' },
  { label: 'Down events only', value: 'down-only' },
];

const modalPresetByIcon: Record<IntegrationIcon, IntegrationModalPreset> = {
  slack: {
    endpointLabel: 'Slack webhook URL',
    endpointHint: 'Generate it from your Slack app Incoming Webhooks configuration.',
    endpointPlaceholder: 'https://hooks.slack.com/services/',
    customHint: 'Optional. Additional text appended to each notification message.',
  },
  telegram: {
    endpointLabel: 'Telegram webhook relay URL',
    endpointHint: 'URL endpoint that forwards notifications to your Telegram bot/channel.',
    endpointPlaceholder: 'https://example.com/telegram-alerts',
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
  const [savedIntegrations, setSavedIntegrations] = useState<BackendIntegration[]>([]);
  const [isIntegrationsLoading, setIsIntegrationsLoading] = useState(false);
  const [integrationsLoadError, setIntegrationsLoadError] = useState<string | null>(null);
  const [createSuccessMessage, setCreateSuccessMessage] = useState<string | null>(null);
  const [deletingIntegrationId, setDeletingIntegrationId] = useState<string | null>(null);
  const [activeCard, setActiveCard] = useState<IntegrationCard | null>(null);
  const [endpointValue, setEndpointValue] = useState('');
  const [customValue, setCustomValue] = useState('');
  const [eventsValue, setEventsValue] = useState<IntegrationEventSelection>(integrationEventOptions[0].value);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const endpointInputRef = useRef<HTMLInputElement | null>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const visibleCards = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return integrationCards.filter((card) => {
      const matchesCategory = activeCategory === 'All' || card.categories.includes(activeCategory);
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
    if (!card.isAvailable) return;

    setActiveCard(card);
    setEndpointValue('');
    setCustomValue('');
    setEventsValue(integrationEventOptions[0].value);
    setSubmitError(null);
    setIsSubmitting(false);
  };

  const toIntegrationEvents = (selection: IntegrationEventSelection): IntegrationEvent[] => {
    if (selection === 'up-only') return ['up'];
    if (selection === 'down-only') return ['down'];
    return ['up', 'down'];
  };

  const loadIntegrations = useCallback(async () => {
    try {
      setIsIntegrationsLoading(true);
      setIntegrationsLoadError(null);

      const response = await fetchIntegrations();
      setSavedIntegrations(response.integrations);
    } catch (error) {
      if (error instanceof Error && error.message.trim() !== '') {
        setIntegrationsLoadError(error.message);
      } else {
        setIntegrationsLoadError('Impossible de charger les integrations.');
      }
    } finally {
      setIsIntegrationsLoading(false);
    }
  }, []);

  const handleCreateIntegration = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!endpointValue.trim()) {
      endpointInputRef.current?.focus();
      return;
    }

    if (!activeCard || isSubmitting) {
      return;
    }

    try {
      setSubmitError(null);
      setIsSubmitting(true);
      setCreateSuccessMessage(null);

      const response = await createIntegration({
        type: activeCard.icon as IntegrationProvider,
        endpointUrl: endpointValue.trim(),
        customValue: customValue.trim() || undefined,
        events: toIntegrationEvents(eventsValue),
      });

      await loadIntegrations();
      setCreateSuccessMessage(response.message || `${activeCard.name} integration created.`);
      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current);
      }
      successTimerRef.current = setTimeout(() => {
        setCreateSuccessMessage(null);
        successTimerRef.current = null;
      }, 4500);
      closeIntegrationModal();
    } catch (error) {
      if (error instanceof Error && error.message.trim() !== '') {
        setSubmitError(error.message);
      } else {
        setSubmitError('Impossible de creer l integration.');
      }
    } finally {
      setIsSubmitting(false);
    }
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

  useEffect(() => {
    void loadIntegrations();
  }, [loadIntegrations]);

  useEffect(() => {
    return () => {
      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current);
      }
    };
  }, []);

  const formatEventsLabel = (events: IntegrationEvent[]): string => {
    if (events.includes('up') && events.includes('down')) return 'Up, Down';
    if (events.includes('up')) return 'Up only';
    if (events.includes('down')) return 'Down only';
    return '-';
  };

  const formatProviderLabel = (provider: IntegrationProvider): string =>
    provider.charAt(0).toUpperCase() + provider.slice(1);

  const handleDeleteIntegration = async (integrationId: string) => {
    if (deletingIntegrationId) return;

    const shouldDelete = window.confirm('Delete this integration?');
    if (!shouldDelete) return;

    try {
      setIntegrationsLoadError(null);
      setDeletingIntegrationId(integrationId);

      await deleteIntegration(integrationId);
      setSavedIntegrations((current) => current.filter((integration) => integration._id !== integrationId));
    } catch (error) {
      if (error instanceof Error && error.message.trim() !== '') {
        setIntegrationsLoadError(error.message);
      } else {
        setIntegrationsLoadError('Impossible de supprimer l integration.');
      }
    } finally {
      setDeletingIntegrationId(null);
    }
  };

  return (
    <section className="integrations-api-page">
      <header className="integrations-api-header">
        <h1>Edit Status pages</h1>
      </header>

      <div className="integrations-api-layout">
        <div className="integrations-api-main">
          {createSuccessMessage ? (
            <p className="integrations-api-notice success">{createSuccessMessage}</p>
          ) : null}

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
                  className={`integration-add-button${card.isAvailable ? '' : ' coming-soon'}`}
                  type="button"
                  disabled={!card.isAvailable}
                  onClick={() => {
                    openIntegrationModal(card);
                  }}
                >
                  {card.isAvailable ? (
                    <>
                      <Plus size={12} />
                      Add
                    </>
                  ) : (
                    'Coming soon'
                  )}
                </button>
              </article>
            ))}

            {visibleCards.length === 0 && (
              <div className="integrations-api-empty">
                <p>No integration found for this filter.</p>
              </div>
            )}
          </div>

          <section className="integrations-api-configured">
            <header className="integrations-api-configured-head">
              <h2>Configured integrations</h2>
              <button type="button" onClick={() => void loadIntegrations()} disabled={isIntegrationsLoading}>
                Refresh
              </button>
            </header>

            {isIntegrationsLoading ? (
              <p className="integrations-api-configured-feedback">Loading integrations...</p>
            ) : integrationsLoadError ? (
              <p className="integrations-api-configured-feedback error">{integrationsLoadError}</p>
            ) : savedIntegrations.length === 0 ? (
              <p className="integrations-api-configured-feedback">No integration configured yet.</p>
            ) : (
              <div className="integrations-api-configured-list">
                {savedIntegrations.map((integration) => (
                  <article className="integrations-api-configured-item" key={integration._id}>
                    <div className="integrations-api-configured-row">
                      <div className="integrations-api-configured-main">
                        <span className={`integration-icon ${integration.type}`} aria-hidden="true">
                          {renderCardIcon(integration.type)}
                        </span>
                        <div className="integrations-api-configured-copy">
                          <h3>{formatProviderLabel(integration.type)}</h3>
                          <p className="endpoint">{integration.endpointUrl}</p>
                          <p>
                            Events: <strong>{formatEventsLabel(integration.events)}</strong>
                          </p>
                          <p>
                            Last sent:{' '}
                            <strong>
                              {integration.lastTriggeredAt ? new Date(integration.lastTriggeredAt).toLocaleString() : 'Never'}
                            </strong>
                          </p>
                        </div>
                      </div>

                      <div className="integrations-api-configured-actions">
                        <button
                          type="button"
                          onClick={() => {
                            void handleDeleteIntegration(integration._id);
                          }}
                          disabled={deletingIntegrationId !== null}
                        >
                          <Trash2 size={13} />
                          {deletingIntegrationId === integration._id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
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
                    onChange={(event) => setEventsValue(event.target.value as IntegrationEventSelection)}
                  >
                    {integrationEventOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={15} aria-hidden="true" />
                </div>
              </div>

              {submitError ? <p className="integrations-modal-error">{submitError}</p> : null}

              <footer className="integrations-modal-actions">
                <button
                  type="button"
                  className="integrations-modal-cancel"
                  onClick={closeIntegrationModal}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button type="submit" className="integrations-modal-submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Creating...' : 'Create integration'}
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
