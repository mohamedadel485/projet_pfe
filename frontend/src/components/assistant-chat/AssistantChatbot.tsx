import {
  Bot,
  ChevronLeft,
  Image as ImageIcon,
  LoaderCircle,
  Mic,
  MoreHorizontal,
  Paperclip,
  Send,
  Smile,
  MessageSquareText,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import './AssistantChatbot.css';

type ChatRole = 'user' | 'assistant';

interface ChatMessageEntry {
  id: string;
  role: ChatRole;
  content: string;
  isError?: boolean;
}

interface MonitorDraft {
  name: string;
  protocol: 'http' | 'https' | 'ws' | 'wss';
  url: string;
}

interface AssistantChatbotProps {
  enabled: boolean;
  userName?: string | null;
  onOpenMonitorCreator?: (draft: MonitorDraft) => void;
}

const CHAT_API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || '/api';
const DEFAULT_MODEL = 'gemini-3-flash-preview';
const DEFAULT_SYSTEM_PROMPT =
  "Tu es un assistant utile, clair et sympathique. Reponds en francais sauf si l'utilisateur demande une autre langue.";

const createMessageId = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

const buildChatEndpoint = (path: string): string => {
  const base = CHAT_API_BASE_URL.replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
};

const readErrorMessage = async (response: Response): Promise<string> => {
  const rawBody = (await response.text()).trim();
  if (rawBody === '') {
    return `Request failed (${response.status})`;
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    try {
      const payload = JSON.parse(rawBody) as Record<string, unknown>;
      const directError =
        typeof payload.error === 'string'
          ? payload.error
          : typeof payload.message === 'string'
            ? payload.message
            : '';
      if (directError !== '') {
        return directError;
      }
    } catch {
      // Fall back to the raw text below.
    }
  }

  return rawBody;
};

const buildWelcomeMessage = (userName?: string | null): string =>
  userName
    ? `Hi ${userName}! I'm ready to help with Uptime Warden.`
    : "Hi there! I'm ready to help with Uptime Warden.";

const URL_CANDIDATE_PATTERN = /((?:(?:https?|wss?)?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s]*)?)/i;

const buildMonitorDraft = (rawText: string): MonitorDraft | null => {
  const match = rawText.match(URL_CANDIDATE_PATTERN);
  const candidate = typeof match?.[1] === 'string' ? match[1].trim().replace(/[),.;!?]+$/g, '') : '';
  if (candidate === '') {
    return null;
  }

  const normalizedUrl = /^(?:https?:\/\/|wss?:\/\/)/i.test(candidate) ? candidate : `https://${candidate}`;

  try {
    const parsedUrl = new URL(normalizedUrl);
    const protocol = parsedUrl.protocol.replace(/:$/, '') as MonitorDraft['protocol'];
    if (!['http', 'https', 'ws', 'wss'].includes(protocol)) {
      return null;
    }

    const host = parsedUrl.hostname.replace(/^www\./i, '').trim();
    return {
      name: host !== '' ? host : 'monitor',
      protocol,
      url: normalizedUrl,
    };
  } catch {
    return null;
  }
};

const looksLikeMonitorCreationRequest = (rawText: string): boolean => {
  const text = rawText.trim();
  if (text === '') {
    return false;
  }

  if (/^\s*((?:(?:https?|wss?)?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s]*)?)\s*$/i.test(text)) {
    return true;
  }

  if (/\b(create|new|add|monitor|surveille|suivre|watch|track)\b/i.test(text)) {
    return Boolean(text.match(URL_CANDIDATE_PATTERN));
  }

  return false;
};

function AssistantChatbot({ enabled, userName, onOpenMonitorCreator }: AssistantChatbotProps) {
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
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!enabled) {
      setIsOpen(false);
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      setIsSending(false);
      setDraft('');
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !isOpen) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [enabled, isOpen]);

  useEffect(() => {
    if (enabled && isOpen) {
      inputRef.current?.focus();
    }
  }, [enabled, isOpen]);

  useEffect(() => {
    if (!enabled || !isOpen) {
      return;
    }

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
  }, [enabled, isOpen, messages, isSending]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const updateMessageContent = (
    messageId: string,
    updater: (message: ChatMessageEntry) => ChatMessageEntry,
  ): void => {
    setMessages((current) => current.map((message) => (message.id === messageId ? updater(message) : message)));
  };

  const closeChat = (): void => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsOpen(false);
    setIsSending(false);
  };

  const submitMessage = async (rawMessage: string): Promise<void> => {
    const content = rawMessage.trim();
    if (content === '' || isSending) {
      return;
    }

    const monitorDraft = looksLikeMonitorCreationRequest(content) ? buildMonitorDraft(content) : null;
    const nextMessages: ChatMessageEntry[] = [
      ...messages,
      {
        id: createMessageId('user'),
        role: 'user',
        content,
      },
    ];

    if (monitorDraft && onOpenMonitorCreator) {
      setMessages([
        ...nextMessages,
        {
          id: createMessageId('assistant'),
          role: 'assistant',
          content: `I opened the monitor form with ${monitorDraft.url} prefilled.`,
        },
      ]);
      setDraft('');
      onOpenMonitorCreator(monitorDraft);
      setIsOpen(false);
      return;
    }

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
      const response = await fetch(buildChatEndpoint('/chat'), {
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
          model: DEFAULT_MODEL,
          temperature: 0.7,
          systemInstruction: DEFAULT_SYSTEM_PROMPT,
        }),
      });

      if (!response.ok) {
        const errorMessage = await readErrorMessage(response);
        throw new Error(errorMessage);
      }

      const fallbackReply = "I could not get a text response right now. Please try again.";

      if (!response.body) {
        const text = (await response.text()).trim();
        updateMessageContent(assistantMessageId, (message) => ({
          ...message,
          content: text || fallbackReply,
          isError: false,
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
        updateMessageContent(assistantMessageId, (message) => ({
          ...message,
          content: assistantText,
          isError: false,
        }));
      }

      assistantText += decoder.decode();
      const finalReply = assistantText.trim() || fallbackReply;
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
          : "I can't reach the chatbot right now. Please try again in a moment.";

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

  if (!enabled) {
    return null;
  }

  return (
    <div className="assistant-chatbot" aria-live="polite">
      {!isOpen ? (
        <button
          type="button"
          className="assistant-launcher"
          onClick={() => setIsOpen(true)}
          aria-label="Open assistant"
          title="Open assistant"
        >
          <span className="assistant-launcher-orb" aria-hidden="true">
            <MessageSquareText size={26} strokeWidth={2} />
          </span>
          <span className="assistant-sr-only">Open assistant</span>
        </button>
      ) : null}

      {isOpen ? (
        <section className="assistant-panel" role="dialog" aria-label="Uptime Warden assistant">
          <header className="assistant-header">
            <button type="button" className="assistant-header-back" onClick={closeChat} aria-label="Back">
              <ChevronLeft size={16} />
            </button>

            <div className="assistant-header-main">
              <div className="assistant-header-icon" aria-hidden="true">
                <Bot size={18} />
              </div>
              <div>
                <h2>Assistant</h2>
                <p>The team can also help</p>
              </div>
            </div>

            <div className="assistant-header-actions">
              <button type="button" className="assistant-header-action" aria-label="More options">
                <MoreHorizontal size={16} />
              </button>
              <button type="button" className="assistant-header-action" onClick={closeChat} aria-label="Close">
                <X size={16} />
              </button>
            </div>
          </header>

          <div className="assistant-body" ref={bodyRef}>
            {messages.map((message, index) => (
              <article
                key={message.id}
                className={`assistant-message-row ${message.role} ${message.isError ? 'error' : ''}`}
              >
                <div className={`assistant-bubble ${message.role} ${message.isError ? 'error' : ''}`}>
                  <p>{message.content}</p>
                </div>
                {index === 0 && message.role === 'assistant' ? (
                  <p className="assistant-message-meta">Uptime Warden · AI Agent · Just now</p>
                ) : null}
              </article>
            ))}

            {isSending ? (
              <div className="assistant-typing">
                <span className="assistant-typing-icon">
                  <LoaderCircle size={14} />
                </span>
                <span>Assistant is typing...</span>
              </div>
            ) : null}
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
                placeholder="Ask a question..."
                rows={2}
                disabled={isSending}
              />

              <div className="assistant-input-toolbar">
                <div className="assistant-input-tools" aria-hidden="true">
                  <button type="button" className="assistant-input-tool" tabIndex={-1} disabled>
                    <Paperclip size={14} />
                  </button>
                  <button type="button" className="assistant-input-tool" tabIndex={-1} disabled>
                    <Smile size={14} />
                  </button>
                  <button type="button" className="assistant-input-tool" tabIndex={-1} disabled>
                    <ImageIcon size={14} />
                  </button>
                  <button type="button" className="assistant-input-tool" tabIndex={-1} disabled>
                    <Mic size={14} />
                  </button>
                </div>
                <button
                  type="button"
                  className="assistant-send-button"
                  onClick={() => void submitMessage(draft)}
                  disabled={isSending || draft.trim() === ''}
                  aria-label="Send message"
                >
                  {isSending ? <LoaderCircle size={16} className="assistant-send-spinning" /> : <Send size={16} />}
                </button>
              </div>
            </div>

            <p className="assistant-footer-hint">Powered by Uptime Warden</p>
          </footer>
        </section>
      ) : null}
    </div>
  );
}

export default AssistantChatbot;
