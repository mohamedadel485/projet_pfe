import { Bot, LoaderCircle, Send, Sparkles, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  isApiError,
  sendAssistantChat,
  type AssistantChatAction,
  type BackendMonitor,
} from '../../lib/api';
import './AssistantChatbot.css';

type ChatRole = 'user' | 'assistant';

interface ChatMessageEntry {
  id: string;
  role: ChatRole;
  content: string;
  createdMonitor?: BackendMonitor | null;
  actions?: AssistantChatAction[];
  isError?: boolean;
}

interface AssistantChatbotProps {
  enabled: boolean;
  userName?: string;
  authToken?: string | null;
  onOpenManualCreatePage?: () => void;
  onMonitorCreated?: (monitor: BackendMonitor) => Promise<void> | void;
}

const createMessageId = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

const buildWelcomeMessage = (userName?: string): string =>
  [
    `${userName ? `Salut ${userName}` : 'Salut'} ! Je peux t'aider avec Uptime Warden.`,
    'Dis-moi ce que tu veux surveiller, ou demande-moi de creer un monitor directement.',
    'Exemple: "Creer un monitor avec l\'url https://example.com et un intervalle de 5 minutes".',
  ].join(' ');

const quickPrompts = [
  'Creer un monitor avec l\'url https://example.com et un intervalle de 5 minutes',
  'Que puis-je faire dans Uptime Warden ?',
  'Comment fonctionnent les incidents et les status pages ?',
];

const ASSISTANT_AUTH_ERROR_MESSAGE = 'Ta session a expire. Recharge la page ou reconnecte-toi.';
const ASSISTANT_FALLBACK_ERROR_MESSAGE =
  "Je n'arrive pas a joindre le chatbot pour le moment. Reessaie dans un instant.";

const normalizeSearchText = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const isCreateMonitorHelpRequest = (messageText: string): boolean => {
  const text = normalizeSearchText(messageText);

  if (text === '') {
    return false;
  }

  if (!/\b(moniteur|monitor)\b/.test(text)) {
    return false;
  }

  if (/\bhttps?:\/\//.test(text) || /\bwww\./.test(text)) {
    return false;
  }

  const helpPatterns = [
    /\bcomment\b/,
    /\bhow\b/,
    /\bhow to\b/,
    /\bhow do i\b/,
    /\bhow can i\b/,
    /\bcomment\s+puis[-\s]?je\b/,
    /\bcomment\s+faire\b/,
    /\bguide\b/,
    /\bprocedure\b/,
    /\bpas\s+a\s+pas\b/,
    /\bstep\s+by\s+step\b/,
  ];

  return helpPatterns.some((pattern) => pattern.test(text));
};

const isManualCreateGuideRequest = (messageText: string): boolean => {
  const text = normalizeSearchText(messageText);

  if (text === '') {
    return false;
  }

  if (!/\b(moniteur|monitor)\b/.test(text)) {
    return false;
  }

  const manualPatterns = [
    /\bmanuel(?:lement)?\b/,
    /\bmanual(?:ly)?\b/,
    /\bguide manuel\b/,
    /\bcreation manuelle\b/,
    /\bcreer manuellement\b/,
    /\bcreer le monitor manuellement\b/,
    /\bdashboard\b/,
    /\badd new monitor\b/,
    /\bnew monitor\b/,
    /\bformulaire\b/,
  ];

  return manualPatterns.some((pattern) => pattern.test(text));
};

const buildCreateMonitorHelpReply = (): string =>
  'Bien sur. Tu peux creer un monitor de deux facons. Choisis celle qui te convient.';

const buildManualCreateMonitorReply = (): string =>
  [
    'Bien sur. Pour creer un monitor manuellement dans Uptime Warden :',
    '1. Va dans `Monitoring`, puis clique sur `New monitor`.',
    '2. Choisis le type adapte: `HTTP`, `HTTPS`, `WS` ou `WSS`.',
    "3. Renseigne le nom du monitor et l URL du service a surveiller.",
    "4. Ajuste l intervalle de verification, le timeout et la methode HTTP si besoin.",
    '5. Active `SSL` ou `expiration de domaine` seulement si tu veux ces controles.',
    '6. Clique sur `Create monitor` pour enregistrer le monitor.',
    '',
    'Si tu veux, donne-moi l URL et je peux aussi te guider champ par champ.',
  ].join('\n');

const buildCreateMonitorHelpActions = (): AssistantChatAction[] => [
  {
    kind: 'reply',
    label: 'Creer manuellement',
    description: 'Je te montre les etapes dans le chat.',
    value: buildManualCreateMonitorReply(),
  },
  {
    kind: 'prompt',
    label: 'Creer avec le chatbot',
    description: 'Je te guide ici pas a pas.',
    value: 'Je veux creer un monitor',
  },
];

const buildLocalFallbackReply = (messageText: string): string => {
  const text = normalizeSearchText(messageText);

  if (text === '' || /^(bonjour|salut|hello|hi|coucou)\b/.test(text)) {
    return [
      'Bonjour ! Je peux t aider avec Uptime Warden.',
      'Tu peux me demander comment creer un monitor, voir les incidents, gerer les status pages, la maintenance ou les membres de l equipe.',
    ].join(' ');
  }

  if (/\b(cr[eé]er|create|add|new|ajoute(?:r)?)\b/.test(text) && /\b(moniteur|monitor)\b/.test(text)) {
    return 'Parfait. Envoie-moi l URL du service a surveiller et je te guide pour creer le monitor.';
  }

  if (/\bincident|incidents?\b/.test(text)) {
    return 'La page Incidents te permet de voir les pannes detectees, leur duree et les monitors concernes.';
  }

  if (/\bstatus\s*page|page de statut|status pages?\b/.test(text)) {
    return 'Les status pages servent a afficher publiquement l etat de tes services et de tes monitors.';
  }

  if (/\bmaintenance\b/.test(text)) {
    return 'La section Maintenance te permet de planifier une periode de maintenance et de mettre les monitors en pause temporairement.';
  }

  if (/\bteam|equipe|member|membre\b/.test(text)) {
    return 'La gestion de l equipe te permet d inviter des membres, modifier leurs droits et suivre qui a acces a ton espace.';
  }

  if (/\bintegration|integrations|api\b/.test(text)) {
    return 'La section Integrations & API te permet de connecter Uptime Warden a des outils externes comme les webhooks.';
  }

  return [
    'Je peux t aider avec Uptime Warden.',
    'Tu peux me parler d un monitor, des incidents, des status pages, de la maintenance ou de la gestion de l equipe.',
  ].join(' ');
};

function AssistantChatbot({
  enabled,
  userName,
  authToken,
  onOpenManualCreatePage,
  onMonitorCreated,
}: AssistantChatbotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<ChatMessageEntry[]>(() => [
    {
      id: createMessageId('welcome'),
      role: 'assistant',
      content: buildWelcomeMessage(userName),
    },
  ]);
  const [isSending, setIsSending] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const scrollToBottom = () => {
    window.requestAnimationFrame(() => {
      const body = bodyRef.current;
      if (!body) {
        return;
      }

      body.scrollTo({
        top: body.scrollHeight,
        behavior: 'smooth',
      });
    });
  };

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    scrollToBottom();
  }, [enabled, messages, isOpen, isSending]);

  useEffect(() => {
    if (enabled && isOpen) {
      inputRef.current?.focus();
    }
  }, [enabled, isOpen]);

  const pushAssistantMessageWithActions = (
    content: string,
    createdMonitor?: BackendMonitor | null,
    actions: AssistantChatAction[] = [],
    isError = false,
  ): void => {
    setMessages((currentMessages) => [
      ...currentMessages,
      {
        id: createMessageId(isError ? 'error' : 'assistant'),
        role: 'assistant',
        content,
        createdMonitor,
        actions,
        isError,
      },
    ]);
  };

  const submitMessage = async (rawMessage: string): Promise<void> => {
    const content = rawMessage.trim();
    if (content === '' || isSending) {
      return;
    }

    const nextMessages = [
      ...messages,
      {
        id: createMessageId('user'),
        role: 'user' as const,
        content,
      },
    ];

    setMessages(nextMessages);
    setDraft('');
    setLastError(null);

    if (isManualCreateGuideRequest(content)) {
      pushAssistantMessageWithActions(buildManualCreateMonitorReply(), null, []);
      return;
    }

    if (isCreateMonitorHelpRequest(content)) {
      pushAssistantMessageWithActions(buildCreateMonitorHelpReply(), null, buildCreateMonitorHelpActions());
      return;
    }

    setIsSending(true);

    try {
      const response = await sendAssistantChat(
        nextMessages.slice(-12).map((message) => ({
          role: message.role,
          content: message.content,
        })),
        authToken,
      );

      if (response.createdMonitor && onMonitorCreated) {
        try {
          await onMonitorCreated(response.createdMonitor);
        } catch {
          // Keep the successful chat reply even if the refresh callback fails.
        }
      }

      pushAssistantMessageWithActions(
        response.reply,
        response.createdMonitor ?? null,
        response.actions ?? [],
      );
    } catch (error) {
      let message = ASSISTANT_FALLBACK_ERROR_MESSAGE;
      if (isApiError(error) && error.status === 401) {
        message = ASSISTANT_AUTH_ERROR_MESSAGE;
        setLastError(message);
        pushAssistantMessageWithActions(message, null, [], true);
      } else {
        const fallbackReply = buildLocalFallbackReply(content);
        setLastError(null);
        pushAssistantMessageWithActions(fallbackReply, null, []);
      }
    } finally {
      setIsSending(false);
    }
  };

  const handlePromptClick = (prompt: string): void => {
    setDraft(prompt);
    void submitMessage(prompt);
  };

  const handleAssistantAction = (action: AssistantChatAction): void => {
    setLastError(null);

    if (action.kind === 'navigate') {
      setIsOpen(false);
      onOpenManualCreatePage?.();
      return;
    }

    if (action.kind === 'reply') {
      pushAssistantMessageWithActions(action.value, null, []);
      return;
    }

    setDraft('');
    void submitMessage(action.value);
  };

  if (!enabled) {
    return null;
  }

  const showStarterPanel = messages.length <= 1;

  return (
    <div className="assistant-chatbot" aria-live="polite">
      {!isOpen ? (
        <button
          type="button"
          className="assistant-launcher"
          onClick={() => setIsOpen(true)}
          aria-label="Ouvrir le chatbot Uptime Warden"
        >
          <span className="assistant-launcher-orb" aria-hidden="true">
            <Bot size={20} />
          </span>
          <span className="assistant-launcher-text">
            <strong>Assistant</strong>
            <span>Assistant IA</span>
          </span>
          <span className="assistant-launcher-badge" aria-hidden="true">
            <Sparkles size={12} />
          </span>
        </button>
      ) : null}

      {isOpen ? (
        <section className="assistant-panel" role="dialog" aria-label="Chatbot Uptime Warden">
          <header className="assistant-header">
            <div className="assistant-header-main">
              <div className="assistant-header-icon" aria-hidden="true">
                <Bot size={18} />
              </div>
              <div>
                <h2>Uptime Warden Assistant</h2>
                <p>Questions produit, aide monitor et creation guidee.</p>
              </div>
            </div>
            <button
              type="button"
              className="assistant-close-button"
              onClick={() => setIsOpen(false)}
              aria-label="Fermer le chatbot"
            >
              <X size={16} />
            </button>
          </header>

          <div className="assistant-body" ref={bodyRef}>
            {showStarterPanel ? (
              <section className="assistant-starter-card">
                <span className="assistant-starter-label">
                  <Sparkles size={14} />
                  <span>Commence ici</span>
                </span>
                <p>
                  Tu peux demander une explication sur le site ou ecrire directement une instruction pour creer un
                  monitor.
                </p>
                <div className="assistant-prompt-grid">
                  {quickPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      className="assistant-prompt-chip"
                      onClick={() => handlePromptClick(prompt)}
                      disabled={isSending}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            {messages.map((message) => (
              <article
                key={message.id}
                className={`assistant-message-row ${message.role} ${message.isError ? 'error' : ''}`}
              >
                <div className={`assistant-bubble ${message.role} ${message.isError ? 'error' : ''}`}>
                  <p>{message.content}</p>
                  {message.createdMonitor ? (
                    <div className="assistant-monitor-card">
                      <span className="assistant-monitor-card-label">Monitor cree</span>
                      <strong>{message.createdMonitor.name}</strong>
                      <span>{message.createdMonitor.url}</span>
                      <span>
                        Intervalle {message.createdMonitor.interval} min, timeout {message.createdMonitor.timeout} sec
                      </span>
                    </div>
                  ) : null}
                  {message.actions && message.actions.length > 0 ? (
                    <div className="assistant-action-grid" role="group" aria-label="Actions du chatbot">
                      {message.actions.map((action) => (
                        <button
                          key={`${message.id}-${action.kind}-${action.value}`}
                          type="button"
                          className={`assistant-action-button ${action.kind}`}
                          onClick={() => handleAssistantAction(action)}
                        >
                          <strong>{action.label}</strong>
                          <span>{action.description}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </article>
            ))}

            {isSending ? (
              <div className="assistant-typing">
                <span className="assistant-typing-icon">
                  <LoaderCircle size={14} />
                </span>
                <span>L'assistant reflechit...</span>
              </div>
            ) : null}

            {lastError ? <p className="assistant-inline-error">{lastError}</p> : null}
          </div>

          <footer className="assistant-footer">
            <div className="assistant-input-shell">
              <textarea
                ref={inputRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void submitMessage(draft);
                  }
                }}
                placeholder="Ecris ta demande ici..."
                rows={2}
                disabled={isSending}
              />
              <button
                type="button"
                className="assistant-send-button"
                onClick={() => void submitMessage(draft)}
                disabled={isSending || draft.trim() === ''}
                aria-label="Envoyer le message"
              >
                {isSending ? <LoaderCircle size={16} className="assistant-send-spinning" /> : <Send size={16} />}
              </button>
            </div>
            <p className="assistant-footer-hint">
              Astuce: tu peux ecrire "creer un monitor avec l'URL ..." et je le cree directement.
            </p>
          </footer>
        </section>
      ) : null}
    </div>
  );
}

export default AssistantChatbot;
