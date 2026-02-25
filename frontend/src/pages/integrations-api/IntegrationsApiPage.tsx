import { Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
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

function IntegrationsApiPage({ onOpenIntegrationsTeam }: IntegrationsApiPageProps) {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<IntegrationCategory>('All');

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

  const renderCardIcon = (icon: IntegrationIcon) => {
    if (icon === 'slack') {
      return <img src={slackLogo} alt="Slack" className="integration-icon-image" />;
    }
    if (icon === 'telegram') {
      return <img src={telegramLogo} alt="Telegram" className="integration-icon-image" />;
    }
    return <img src={webhookLogo} alt="Webhook" className="integration-icon-image" />;
  };

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
                    onOpenIntegrationsTeam?.();
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
    </section>
  );
}

export default IntegrationsApiPage;
