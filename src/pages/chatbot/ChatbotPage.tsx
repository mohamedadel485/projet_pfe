import { Bot, LoaderCircle, RefreshCcw, Send, Sparkles, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { fetchChatResponse, parseChatStreamText, readChatResponseError } from '../../lib/chatApi';
import { fetchBackendHealth, type BackendHealthResponse } from '../../lib/api';
import './ChatbotPage.css';

type ChatRole = 'user' | 'assistant';

interface ChatMessageEntry {
  id: string;
  role: ChatRole;
  content: string;
  isError?: boolean;
}

interface ChatbotSettings {
  model: string;
  temperature: number;
  systemPrompt: string;
}

interface ChatbotPageProps {
  userName?: string | null;
}

interface HealthState {
  status: 'checking' | 'ready' | 'offline';
  detail: string;
  apiKeyConfigured: boolean;
  model: string;
}

const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
const DEFAULT_MODEL = DEFAULT_GEMINI_MODEL;
const DEFAULT_SYSTEM_PROMPT =
  "Tu es un assistant utile, clair et sympathique. Reponds en francais sauf si l'utilisateur demande une autre langue.";

const normalizeGeminiModel = (value?: string | null): string => {
  const model = typeof value === 'string' ? value.trim() : '';
  if (model === '' || model.toLowerCase().startsWith('grok-')) {
    return DEFAULT_GEMINI_MODEL;
  }

  return model;
};

const STORAGE_KEYS = {
  settings: 'uptimewarden-chatbot-settings',
  messages: 'uptimewarden-chatbot-messages',
};

const QUICK_PROMPTS = [
  'Explique ce projet en un paragraphe.',
  "Ecris une checklist de debug pour un chatbot Gemini.",
  "Donne 5 prompts pour tester la qualite d'une reponse.",
];

const createMessageId = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

const formatUptime = (uptimeSeconds: number): string => {
  if (!Number.isFinite(uptimeSeconds) || uptimeSeconds <= 0) {
    return '0s';
  }

  const totalSeconds = Math.floor(uptimeSeconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
};

const readJson = <T,>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return fallback;
    }

    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const loadSettings = (): ChatbotSettings => {
  const saved = readJson<Partial<ChatbotSettings>>(STORAGE_KEYS.settings, {});

  return {
    model:
      typeof saved.model === 'string' && saved.model.trim() !== ''
        ? normalizeGeminiModel(saved.model)
        : DEFAULT_MODEL,
    temperature: Number.isFinite(saved.temperature) ? Number(saved.temperature) : 0.7,
    systemPrompt:
      typeof saved.systemPrompt === 'string' && saved.systemPrompt.trim() !== ''
        ? saved.systemPrompt.trim()
        : DEFAULT_SYSTEM_PROMPT,
  };
};

const loadMessages = (): ChatMessageEntry[] => {
  const saved = readJson<unknown>(STORAGE_KEYS.messages, []);
  if (!Array.isArray(saved)) {
    return [];
  }

  return saved
    .map((message): ChatMessageEntry | null => {
      if (!message || typeof message !== 'object') {
        return null;
      }

      const record = message as Record<string, unknown>;
      const role = record.role === 'assistant' ? 'assistant' : 'user';
      const content = typeof record.content === 'string' ? record.content.trim() : '';

      if (!content) {
        return null;
      }

      return {
        id:
          typeof record.id === 'string' && record.id.trim() !== ''
            ? record.id
            : createMessageId(role),
        role,
        content,
        isError: Boolean(record.isError),
      };
    })
    .filter((message): message is ChatMessageEntry => message !== null);
};

const buildWelcomeText = (userName?: string | null): string =>
  userName ? `Salut ${userName} ! Je suis pret a discuter. Utilise le panneau de gauche pour ajuster le modele et le ton.` : 'Salut ! Je suis pret a discuter. Utilise le panneau de gauche pour ajuster le modele et le ton.';

function ChatbotPage({ userName }: ChatbotPageProps) {
  const [settings, setSettings] = useState<ChatbotSettings>(() => loadSettings());
  const [messages, setMessages] = useState<ChatMessageEntry[]>(() => loadMessages());
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [health, setHealth] = useState<HealthState>({
    status: 'checking',
    detail: 'Verification du backend...',
    apiKeyConfigured: false,
    model: DEFAULT_MODEL,
  });
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(STORAGE_KEYS.messages, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      try {
        const response: BackendHealthResponse = await fetchBackendHealth();
        if (!isMounted) {
          return;
        }

        setHealth({
          status: response.ok || response.status === 'OK' ? 'ready' : 'offline',
          detail: response.apiKeyConfigured
            ? `Backend ${response.status} - uptime ${formatUptime(response.uptime)}`
            : 'Backend online, ajoute GEMINI_API_KEY dans le .env du backend',
          apiKeyConfigured: Boolean(response.apiKeyConfigured),
          model: normalizeGeminiModel(response.model) || DEFAULT_MODEL,
        });
      } catch {
        if (!isMounted) {
          return;
        }

        setHealth({
          status: 'offline',
          detail: 'Backend indisponible pour le moment',
          apiKeyConfigured: false,
          model: DEFAULT_MODEL,
        });
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    window.requestAnimationFrame(() => {
      const body = messagesRef.current;
      if (!body) {
        return;
      }

      body.scrollTo({
        top: body.scrollHeight,
        behavior: 'smooth',
      });
    });
  }, [messages, isSending]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const persistSettings = (nextSettings: ChatbotSettings): void => {
    setSettings(nextSettings);
  };

  const resetSettings = (): void => {
    persistSettings({
      model: DEFAULT_MODEL,
      temperature: 0.7,
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
    });
  };

  const resetChat = (): void => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setMessages([]);
    setDraft('');
  };

  const updateMessageContent = (
    messageId: string,
    updater: (message: ChatMessageEntry) => ChatMessageEntry,
  ): void => {
    setMessages((current) =>
      current.map((message) => (message.id === messageId ? updater(message) : message)),
    );
  };

  const sendMessage = async (rawMessage: string): Promise<void> => {
    const content = rawMessage.trim();
    if (content === '') {
      return;
    }

    const normalizedCommand = content.toLowerCase();
    if (normalizedCommand === '/reset') {
      resetChat();
      return;
    }

    if (normalizedCommand === '/quit' || normalizedCommand === '/exit') {
      setDraft('');
      return;
    }

    if (isSending) {
      return;
    }

    const nextMessages: ChatMessageEntry[] = [
      ...messages,
      {
        id: createMessageId('user'),
        role: 'user',
        content,
      },
    ];
    const assistantMessageId = createMessageId('assistant');

    setMessages([
      ...nextMessages,
      {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
      },
    ]);
    setDraft('');
    setIsSending(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetchChatResponse('/chat', {
        method: 'POST',
        cache: 'no-store',
        credentials: 'include',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
        },
        body: JSON.stringify({
          messages: nextMessages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
          model: settings.model,
          temperature: settings.temperature,
          systemInstruction: settings.systemPrompt,
        }),
      });

      if (!response.ok) {
        const errorMessage = await readChatResponseError(response);
        throw new Error(errorMessage);
      }

      const fallbackReply = 'Je n ai pas obtenu de reponse textuelle. Reessaie dans un instant.';

      if (!response.body) {
        const text = (await response.text()).trim();
        const parsedText = parseChatStreamText(text);
        const finalText = parsedText.errorMessage ?? (parsedText.content.trim() || fallbackReply);
        updateMessageContent(assistantMessageId, (message) => ({
          ...message,
          content: finalText,
          isError: parsedText.errorMessage !== null,
        }));
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let assistantText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        assistantText += decoder.decode(value, { stream: true });
        const parsedText = parseChatStreamText(assistantText);

        if (parsedText.errorMessage) {
          await reader.cancel().catch(() => undefined);
          updateMessageContent(assistantMessageId, (message) => ({
            ...message,
            content: parsedText.errorMessage ?? fallbackReply,
            isError: true,
          }));
          return;
        }

        updateMessageContent(assistantMessageId, (message) => ({
          ...message,
          content: parsedText.content,
          isError: false,
        }));
      }

      assistantText += decoder.decode();
      const parsedFinalText = parseChatStreamText(assistantText);

      if (parsedFinalText.errorMessage) {
        updateMessageContent(assistantMessageId, (message) => ({
          ...message,
          content: parsedFinalText.errorMessage ?? fallbackReply,
          isError: true,
        }));
        return;
      }

      const finalReply = parsedFinalText.content.trim() || fallbackReply;
      updateMessageContent(assistantMessageId, (message) => ({
        ...message,
        content: finalReply,
        isError: false,
      }));
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }

      const fallbackReply =
        error instanceof Error && error.message.trim() !== ''
          ? error.message
          : "Je n'arrive pas a joindre le chatbot pour le moment. Reessaie dans un instant.";

      updateMessageContent(assistantMessageId, (message) => ({
        ...message,
        content: fallbackReply,
        isError: true,
      }));
    } finally {
      abortControllerRef.current = null;
      setIsSending(false);
    }
  };

  const handlePromptClick = (prompt: string): void => {
    void sendMessage(prompt);
  };

  const showStarterCard = messages.length === 0;
  const welcomeCopy = buildWelcomeText(userName);

  return (
    <div className="chatbot-page">
      <div className="chatbot-page__glow chatbot-page__glow--one" aria-hidden="true" />
      <div className="chatbot-page__glow chatbot-page__glow--two" aria-hidden="true" />
      <div className="chatbot-page__glow chatbot-page__glow--three" aria-hidden="true" />

      <div className="chatbot-page__workspace">
        <aside className="chatbot-panel chatbot-sidebar">
          <div className="chatbot-brand">
            <div className="chatbot-brand__icon" aria-hidden="true">
              <Bot size={22} />
            </div>
            <div>
              <p className="chatbot-eyebrow">Gemini Lab</p>
              <h1>Chatbot</h1>
            </div>
          </div>

          <p className="chatbot-lede">
            Un espace de test integre a Uptime Warden. Le frontend reste local, et le chatbot utilise le backend
            existant en mode genereux et generique.
          </p>

          <div className={`chatbot-status chatbot-status--${health.status}`}>
            <span className="chatbot-status__dot" aria-hidden="true" />
            <div>
              <p className="chatbot-status__label">Etat du backend</p>
              <strong>
                {health.status === 'ready'
                  ? health.apiKeyConfigured
                    ? 'Key ok'
                    : 'Key missing'
                  : health.status === 'offline'
                    ? 'Hors ligne'
                    : 'Verification...'}
              </strong>
              <span>{health.detail}</span>
              <span>Model: {health.model}</span>
            </div>
          </div>

          <div className="chatbot-field">
            <div className="chatbot-field__row">
              <label htmlFor="chatbot-model">Model</label>
            </div>
            <input
              id="chatbot-model"
              value={settings.model}
              onChange={(event) =>
                persistSettings({
                  ...settings,
                  model: event.target.value,
                })
              }
              spellCheck="false"
              autoComplete="off"
            />
          </div>

          <div className="chatbot-field chatbot-field--range">
            <div className="chatbot-field__row">
              <label htmlFor="chatbot-temperature">Temperature</label>
              <output htmlFor="chatbot-temperature">{settings.temperature.toFixed(1)}</output>
            </div>
            <input
              id="chatbot-temperature"
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={settings.temperature}
              onChange={(event) =>
                persistSettings({
                  ...settings,
                  temperature: Number(event.target.value),
                })
              }
            />
          </div>

          <div className="chatbot-field">
            <div className="chatbot-field__row">
              <label htmlFor="chatbot-system-prompt">System prompt</label>
              <button type="button" className="chatbot-link-button" onClick={resetSettings}>
                Restore defaults
              </button>
            </div>
            <textarea
              id="chatbot-system-prompt"
              value={settings.systemPrompt}
              onChange={(event) =>
                persistSettings({
                  ...settings,
                  systemPrompt: event.target.value,
                })
              }
              rows={10}
              spellCheck="false"
            />
          </div>

          <div className="chatbot-actions">
            <button type="button" className="chatbot-secondary" onClick={resetChat}>
              <Trash2 size={15} />
              Reset chat
            </button>
            <button type="button" className="chatbot-secondary" onClick={() => void sendMessage('Salut !')}>
              <RefreshCcw size={15} />
              Demo
            </button>
          </div>

          <p className="chatbot-hint">
            Enter envoie le message. Shift+Enter ajoute une ligne. Les messages et les reglages restent dans ton
            navigateur.
          </p>
        </aside>

        <section className="chatbot-panel chatbot-conversation">
          <header className="chatbot-header">
            <div>
              <p className="chatbot-eyebrow">Conversation</p>
              <h2>Chat with Gemini</h2>
              <p className="chatbot-header__copy">{welcomeCopy}</p>
            </div>

            <div className="chatbot-header__meta">
              <span className="chatbot-pill">{messages.length} message{messages.length === 1 ? '' : 's'}</span>
              <span className="chatbot-pill chatbot-pill--accent">{settings.model}</span>
            </div>
          </header>

          <div className="chatbot-prompt-rail" aria-label="Quick prompts">
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                className="chatbot-prompt-chip"
                onClick={() => handlePromptClick(prompt)}
                disabled={isSending}
              >
                <Sparkles size={14} />
                <span>{prompt}</span>
              </button>
            ))}
          </div>

          <div className={`chatbot-empty-state ${showStarterCard ? 'show' : ''}`}>
            <div className="chatbot-empty-card">
              <p className="chatbot-eyebrow">Ready</p>
              <h3>Start a live test</h3>
              <p>
                Pose une question, modifie le system prompt ou le modele, puis regarde le backend repondre avec le
                contexte de l application.
              </p>
            </div>
          </div>

          <div className="chatbot-messages" ref={messagesRef} aria-live="polite">
            {messages.map((message) => (
              <article
                key={message.id}
                className={`chatbot-message ${message.role} ${message.isError ? 'error' : ''}`}
              >
                <div className={`chatbot-bubble ${message.role} ${message.isError ? 'error' : ''}`}>
                  <p>{message.content}</p>
                </div>
              </article>
            ))}

            {isSending ? (
              <div className="chatbot-typing">
                <span className="chatbot-typing__icon" aria-hidden="true">
                  <LoaderCircle size={15} />
                </span>
                <span>Gemini reflechit...</span>
              </div>
            ) : null}

          </div>

          <form
            className="chatbot-composer"
            onSubmit={(event) => {
              event.preventDefault();
              void sendMessage(draft);
            }}
          >
            <label className="chatbot-sr-only" htmlFor="chatbot-message">
              Message
            </label>
            <div className="chatbot-input-shell">
              <textarea
                id="chatbot-message"
                ref={inputRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage(draft);
                  }
                }}
                placeholder="Type your message..."
                rows={3}
                disabled={isSending}
              />
              <button
                type="submit"
                className="chatbot-send-button"
                disabled={isSending || draft.trim() === ''}
                aria-label="Envoyer le message"
              >
                {isSending ? <LoaderCircle size={16} className="chatbot-send-button__spinning" /> : <Send size={16} />}
              </button>
            </div>
            <p className="chatbot-footer-hint">
              Le mode generique utilise le backend Uptime Warden, mais tu peux changer le prompt, le modele et la
              temperature depuis le panneau de gauche.
            </p>
          </form>
        </section>
      </div>
    </div>
  );
}

export default ChatbotPage;
