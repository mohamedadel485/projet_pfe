import {
  Bot,
  ChevronLeft,
  Download,
  Image as ImageIcon,
  LoaderCircle,
  Mic,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  Paperclip,
  Send,
  Smile,
  MessageSquareText,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { fetchChatResponse } from '../../lib/chatApi';
import './AssistantChatbot.css';

type ChatRole = 'user' | 'assistant';
type MonitorIpVersion = 'IPv4 / IPv6 (IPv4 Priority)' | 'IPv6 / IPv4 (IPv6 Priority)' | 'IPv4 only' | 'IPv6 only';
type MonitorAuthType = 'none' | 'basic' | 'bearer';
type MonitorUpStatusCodeGroup = '2xx' | '3xx';

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
  intervalSeconds?: number;
  timeoutSeconds?: number;
  httpMethod?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD';
  domainExpiryMode?: 'enabled' | 'disabled';
  sslExpiryMode?: 'enabled' | 'disabled';
  sslCheckMode?: 'enabled' | 'disabled';
  tagsText?: string;
  slowResponseAlert?: boolean;
  slowResponseThresholdMs?: number;
  ipVersion?: MonitorIpVersion;
  followRedirections?: boolean;
  authType?: MonitorAuthType;
  authUsername?: string;
  authPassword?: string;
  requestBody?: string;
  sendAsJson?: boolean;
  headerKey?: string;
  headerValue?: string;
  upStatusCodeGroups?: MonitorUpStatusCodeGroup[];
}

type DraftAttachmentKind = 'file' | 'image';

interface DraftAttachment {
  id: string;
  file: File;
  kind: DraftAttachmentKind;
}

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  readonly [index: number]: SpeechRecognitionAlternativeLike;
  isFinal: boolean;
  length: number;
}

interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionErrorEventLike extends Event {
  error?: string;
  message?: string;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: ((event: Event) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: ((event: Event) => void) | null;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionLike;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

interface AssistantChatbotProps {
  enabled: boolean;
  userName?: string | null;
  onOpenMonitorCreator?: (draft: MonitorDraft) => void;
}

const DEFAULT_MODEL = 'gemini-3-flash-preview';
const DEFAULT_SYSTEM_PROMPT =
  "Tu es un assistant utile, clair et sympathique. Reponds en francais sauf si l'utilisateur demande une autre langue.";
const EMOJI_OPTIONS = ['😀', '😄', '😊', '😉', '🤖', '✨', '✅', '📎', '🖼️', '🎤', '⚡', '💡'];

const createMessageId = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

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

const buildAttachmentSummary = (attachments: DraftAttachment[]): string => {
  if (attachments.length === 0) {
    return '';
  }

  return [
    'Pièces jointes:',
    ...attachments.map((attachment) => {
      const label = attachment.kind === 'image' ? 'Image' : 'Fichier';
      const sizeLabel = formatFileSize(attachment.file.size);
      return `- ${label}: ${attachment.file.name} (${sizeLabel})`;
    }),
  ].join('\n');
};

const buildConversationTranscript = (messages: ChatMessageEntry[]): string => {
  const exportedAt = new Date().toLocaleString('fr-FR');
  const formattedMessages = messages.map((message, index) => {
    const speaker = message.role === 'user' ? 'User' : 'Assistant';
    const contentLines = message.content.split(/\r?\n/);
    const firstLine = contentLines[0] ?? '';
    const extraLines = contentLines.slice(1).map((line) => `   ${line}`);

    return [`${index + 1}. ${speaker}: ${firstLine}`, ...extraLines].join('\n');
  });

  return ['Conversation Uptime Warden', `Exportee le: ${exportedAt}`, '', ...formattedMessages].join('\n');
};

const createConversationFileName = (date = new Date()): string =>
  `conversation-uptime-warden-${date.toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/:/g, '-')}.txt`;

const formatFileSize = (value: number): string => {
  if (!Number.isFinite(value) || value < 0) {
    return '0 B';
  }

  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    const kilobytes = value / 1024;
    return `${kilobytes >= 10 ? kilobytes.toFixed(0) : kilobytes.toFixed(1)} KB`;
  }

  const megabytes = value / (1024 * 1024);
  return `${megabytes >= 10 ? megabytes.toFixed(0) : megabytes.toFixed(1)} MB`;
};

const URL_CANDIDATE_PATTERN = /((?:(?:https?|wss?)?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s]*)?)/i;
const URL_ONLY_PATTERN = /^\s*((?:(?:https?|wss?)?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s]*)?)\s*$/i;
const MONITOR_CREATION_KEYWORD_PATTERN =
  /\b(create|new|add|monitor|moniteur|monteur|surveille|surveiller|suivre|watch|track|creer)\b/i;

interface StructuredMonitorFields {
  name?: string;
  url?: string;
  intervalSeconds?: number;
  timeoutSeconds?: number;
  httpMethod?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD';
  domainExpiryMode?: 'enabled' | 'disabled';
  sslExpiryMode?: 'enabled' | 'disabled';
  sslCheckMode?: 'enabled' | 'disabled';
  tagsText?: string;
  slowResponseAlert?: boolean;
  slowResponseThresholdMs?: number;
  ipVersion?: MonitorIpVersion;
  followRedirections?: boolean;
  authType?: MonitorAuthType;
  authUsername?: string;
  authPassword?: string;
  requestBody?: string;
  sendAsJson?: boolean;
  headerKey?: string;
  headerValue?: string;
  upStatusCodeGroups?: MonitorUpStatusCodeGroup[];
}

const normalizeMonitorToken = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const readUrlCandidate = (rawText: string): string => {
  const match = rawText.match(URL_CANDIDATE_PATTERN);
  return typeof match?.[1] === 'string' ? match[1].trim().replace(/[),.;!?]+$/g, '') : '';
};

const parseDurationToSeconds = (value: string, defaultUnit: 'seconds' | 'minutes'): number | undefined => {
  const normalized = normalizeMonitorToken(value).replace(/\s+/g, '');
  const match = normalized.match(/^(\d+)(s|sec|secs|second|seconds|m|min|mins|minute|minutes|h|hr|hrs|hour|hours)?$/i);
  if (!match) {
    return undefined;
  }

  const amount = Number.parseInt(match[1] ?? '', 10);
  if (!Number.isFinite(amount) || amount <= 0) {
    return undefined;
  }

  const unit = match[2]?.toLowerCase() ?? (defaultUnit === 'minutes' ? 'm' : 's');
  if (unit.startsWith('h')) {
    return amount * 60 * 60;
  }

  if (unit.startsWith('m')) {
    return amount * 60;
  }

  return amount;
};

const parseDurationToMilliseconds = (value: string): number | undefined => {
  const normalized = normalizeMonitorToken(value).replace(/\s+/g, '');
  const match = normalized.match(
    /^(\d+)(ms|millisecond|milliseconds|s|sec|secs|second|seconds|m|min|mins|minute|minutes|h|hr|hrs|hour|hours)?$/i,
  );
  if (!match) {
    return undefined;
  }

  const amount = Number.parseInt(match[1] ?? '', 10);
  if (!Number.isFinite(amount) || amount <= 0) {
    return undefined;
  }

  const unit = match[2]?.toLowerCase() ?? 'ms';
  if (unit === 'ms' || unit.startsWith('millisecond')) {
    return amount;
  }

  if (unit.startsWith('h')) {
    return amount * 60 * 60 * 1000;
  }

  if (unit.startsWith('m')) {
    return amount * 60 * 1000;
  }

  return amount * 1000;
};

const parseMonitorMode = (value: string): 'enabled' | 'disabled' | undefined => {
  const normalized = normalizeMonitorToken(value);
  if (
    ['enabled', 'enable', 'on', 'true', 'yes', 'oui', 'active', 'actif', 'activer'].includes(normalized)
  ) {
    return 'enabled';
  }

  if (
    ['disabled', 'disable', 'off', 'false', 'no', 'non', 'inactive', 'inactif', 'desactiver'].includes(normalized)
  ) {
    return 'disabled';
  }

  return undefined;
};

const parseToggleValue = (value: string): boolean | undefined => {
  const mode = parseMonitorMode(value);
  if (mode === undefined) {
    return undefined;
  }

  return mode === 'enabled';
};

const parseHttpMethod = (value: string): 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD' | undefined => {
  const normalized = normalizeMonitorToken(value).toUpperCase();
  if (normalized === 'GET' || normalized === 'POST' || normalized === 'PUT' || normalized === 'DELETE' || normalized === 'HEAD') {
    return normalized;
  }

  return undefined;
};

const parseIpVersion = (value: string): MonitorIpVersion | undefined => {
  const normalized = normalizeMonitorToken(value);
  if (normalized === 'ipv4 only' || normalized === 'ipv4') {
    return 'IPv4 only';
  }

  if (normalized === 'ipv6 only' || normalized === 'ipv6') {
    return 'IPv6 only';
  }

  if (normalized.includes('ipv6') && normalized.includes('ipv4')) {
    return normalized.startsWith('ipv6') ? 'IPv6 / IPv4 (IPv6 Priority)' : 'IPv4 / IPv6 (IPv4 Priority)';
  }

  return undefined;
};

const parseAuthType = (value: string): MonitorAuthType | undefined => {
  const normalized = normalizeMonitorToken(value);
  if (normalized === 'none' || normalized === 'aucun') {
    return 'none';
  }

  if (normalized === 'basic' || normalized === 'basic auth') {
    return 'basic';
  }

  if (normalized === 'bearer' || normalized === 'bearer token' || normalized === 'token') {
    return 'bearer';
  }

  return undefined;
};

const parseHeaderEntry = (value: string): { key: string; value: string } | null => {
  const trimmed = value.trim();
  if (trimmed === '') {
    return null;
  }

  const separatorIndex = (() => {
    const equalsIndex = trimmed.indexOf('=');
    const colonIndex = trimmed.indexOf(':');
    if (equalsIndex < 0) {
      return colonIndex;
    }
    if (colonIndex < 0) {
      return equalsIndex;
    }

    return Math.min(equalsIndex, colonIndex);
  })();

  if (separatorIndex <= 0) {
    return null;
  }

  const key = trimmed.slice(0, separatorIndex).trim();
  const headerValue = trimmed.slice(separatorIndex + 1).trim();
  if (key === '') {
    return null;
  }

  return { key, value: headerValue };
};

const parseUpStatusCodeGroups = (value: string): MonitorUpStatusCodeGroup[] | undefined => {
  const normalized = normalizeMonitorToken(value);
  const groups: MonitorUpStatusCodeGroup[] = [];

  if (/\b2xx\b/.test(normalized) || /\b20\d\b/.test(normalized)) {
    groups.push('2xx');
  }

  if (/\b3xx\b/.test(normalized) || /\b30\d\b/.test(normalized)) {
    groups.push('3xx');
  }

  return groups.length > 0 ? groups : undefined;
};

const extractStructuredMonitorSegments = (rawText: string): string[] => {
  const rawValueKeys = new Set([
    'request body',
    'body',
    'header',
    'headers',
    'header key',
    'header value',
    'auth credentials',
    'tag',
    'tags',
  ]);

  return rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .flatMap((line) => {
      const separatorIndex = line.indexOf(':');
      if (separatorIndex < 0) {
        return [line];
      }

      const key = normalizeMonitorToken(line.slice(0, separatorIndex));
      if (rawValueKeys.has(key)) {
        return [line];
      }

      const segments = line
        .split(',')
        .map((segment) => segment.trim())
        .filter((segment) => segment !== '');

      if (segments.length > 1 && segments.every((segment) => segment.includes(':'))) {
        return segments;
      }

      return [line];
    });
};

const parseStructuredMonitorFields = (rawText: string): StructuredMonitorFields => {
  const fields: StructuredMonitorFields = {};
  const segments = extractStructuredMonitorSegments(rawText);

  for (const segment of segments) {
    const separatorIndex = segment.indexOf(':');
    if (separatorIndex < 0) {
      continue;
    }

    const key = normalizeMonitorToken(segment.slice(0, separatorIndex));
    const value = segment.slice(separatorIndex + 1).trim();
    if (value === '') {
      continue;
    }

    if (key === 'name' || key === 'nom' || key === 'monitor name' || key === 'nom monitor') {
      fields.name = value;
      continue;
    }

    if (key === 'url' || key === 'adresse' || key === 'address' || key === 'website') {
      fields.url = value;
      continue;
    }

    if (key === 'interval' || key === 'monitor interval' || key === 'intervalle') {
      fields.intervalSeconds = parseDurationToSeconds(value, 'minutes');
      continue;
    }

    if (key === 'timeout' || key === 'time out' || key === 'delai' || key === 'request timeout') {
      fields.timeoutSeconds = parseDurationToSeconds(value, 'seconds');
      continue;
    }

    if (key === 'http method' || key === 'method' || key === 'methode http' || key === 'methode') {
      fields.httpMethod = parseHttpMethod(value);
      continue;
    }

    if (
      key === 'check ssl errors' ||
      key === 'ssl errors' ||
      key === 'ssl error check' ||
      key === 'ssl check'
    ) {
      fields.sslCheckMode = parseMonitorMode(value);
      continue;
    }

    if (
      key === 'ssl expiry reminder' ||
      key === 'ssl expiry reminders' ||
      key === 'ssl reminder' ||
      key === 'ssl reminders' ||
      key === 'ssl expiry'
    ) {
      fields.sslExpiryMode = parseMonitorMode(value);
      continue;
    }

    if (
      key === 'domain expiry reminder' ||
      key === 'domain expiry reminders' ||
      key === 'domain reminder' ||
      key === 'domain reminders' ||
      key === 'domain expiry'
    ) {
      fields.domainExpiryMode = parseMonitorMode(value);
      continue;
    }

    if (key === 'tag' || key === 'tags' || key === 'etiquette' || key === 'etiquettes') {
      fields.tagsText = value;
      continue;
    }

    if (
      key === 'slow response alert' ||
      key === 'slow response time alert' ||
      key === 'slow response' ||
      key === 'alert lenteur'
    ) {
      fields.slowResponseAlert = parseToggleValue(value);
      continue;
    }

    if (
      key === 'slow response threshold' ||
      key === 'response threshold' ||
      key === 'threshold' ||
      key === 'slow threshold'
    ) {
      fields.slowResponseThresholdMs = parseDurationToMilliseconds(value);
      if (fields.slowResponseThresholdMs !== undefined && fields.slowResponseAlert === undefined) {
        fields.slowResponseAlert = true;
      }
      continue;
    }

    if (
      key === 'internet protocol version' ||
      key === 'ip version' ||
      key === 'protocol version' ||
      key === 'ipv'
    ) {
      fields.ipVersion = parseIpVersion(value);
      continue;
    }

    if (
      key === 'follow redirections' ||
      key === 'follow redirects' ||
      key === 'redirections' ||
      key === 'redirects'
    ) {
      fields.followRedirections = parseToggleValue(value);
      continue;
    }

    if (key === 'auth type' || key === 'authentication type' || key === 'type auth' || key === 'auth') {
      fields.authType = parseAuthType(value);
      continue;
    }

    if (key === 'username' || key === 'user' || key === 'auth username' || key === 'login') {
      fields.authUsername = value;
      continue;
    }

    if (key === 'password' || key === 'pass' || key === 'auth password') {
      fields.authPassword = value;
      continue;
    }

    if (key === 'token' || key === 'bearer token' || key === 'auth token') {
      fields.authType = 'bearer';
      fields.authPassword = value;
      continue;
    }

    if (key === 'auth credentials') {
      const credentialSeparatorIndex = value.indexOf(':');
      if (credentialSeparatorIndex > 0) {
        fields.authType = fields.authType ?? 'basic';
        fields.authUsername = value.slice(0, credentialSeparatorIndex).trim();
        fields.authPassword = value.slice(credentialSeparatorIndex + 1).trim();
      }
      continue;
    }

    if (key === 'request body' || key === 'body') {
      fields.requestBody = value;
      continue;
    }

    if (key === 'send as json' || key === 'json') {
      fields.sendAsJson = parseToggleValue(value);
      continue;
    }

    if (key === 'header key') {
      fields.headerKey = value;
      continue;
    }

    if (key === 'header value') {
      fields.headerValue = value;
      continue;
    }

    if (key === 'header' || key === 'headers') {
      const headerEntry = parseHeaderEntry(value);
      if (headerEntry) {
        fields.headerKey = headerEntry.key;
        fields.headerValue = headerEntry.value;
      }
      continue;
    }

    if (
      key === 'up http status code' ||
      key === 'up http status codes' ||
      key === 'upp http status code' ||
      key === 'upp http status codes' ||
      key === 'status code' ||
      key === 'status codes' ||
      key === 'up status code' ||
      key === 'up status codes'
    ) {
      fields.upStatusCodeGroups = parseUpStatusCodeGroups(value);
    }
  }

  if ((fields.authUsername || fields.authPassword) && fields.authType === undefined) {
    fields.authType = 'basic';
  }

  return fields;
};

const hasStructuredMonitorFields = (fields: StructuredMonitorFields): boolean =>
  Boolean(
    fields.name ||
      fields.url ||
      fields.intervalSeconds !== undefined ||
      fields.timeoutSeconds !== undefined ||
      fields.httpMethod ||
      fields.domainExpiryMode ||
      fields.sslExpiryMode ||
      fields.sslCheckMode ||
      fields.tagsText ||
      fields.slowResponseAlert !== undefined ||
      fields.slowResponseThresholdMs !== undefined ||
      fields.ipVersion ||
      fields.followRedirections !== undefined ||
      fields.authType ||
      fields.authUsername ||
      fields.authPassword ||
      fields.requestBody ||
      fields.sendAsJson !== undefined ||
      fields.headerKey ||
      fields.headerValue ||
      (fields.upStatusCodeGroups && fields.upStatusCodeGroups.length > 0),
  );

const buildMonitorDraft = (rawText: string): MonitorDraft | null => {
  const structuredFields = parseStructuredMonitorFields(rawText);
  const candidate = structuredFields.url ?? readUrlCandidate(rawText);
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
      name: structuredFields.name?.trim() || (host !== '' ? host : 'monitor'),
      protocol,
      url: normalizedUrl,
      intervalSeconds: structuredFields.intervalSeconds,
      timeoutSeconds: structuredFields.timeoutSeconds,
      httpMethod: structuredFields.httpMethod,
      domainExpiryMode: structuredFields.domainExpiryMode,
      sslExpiryMode: structuredFields.sslExpiryMode,
      sslCheckMode: structuredFields.sslCheckMode,
      tagsText: structuredFields.tagsText,
      slowResponseAlert: structuredFields.slowResponseAlert,
      slowResponseThresholdMs: structuredFields.slowResponseThresholdMs,
      ipVersion: structuredFields.ipVersion,
      followRedirections: structuredFields.followRedirections,
      authType: structuredFields.authType,
      authUsername: structuredFields.authUsername,
      authPassword: structuredFields.authPassword,
      requestBody: structuredFields.requestBody,
      sendAsJson: structuredFields.sendAsJson,
      headerKey: structuredFields.headerKey,
      headerValue: structuredFields.headerValue,
      upStatusCodeGroups: structuredFields.upStatusCodeGroups,
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

  if (URL_ONLY_PATTERN.test(text)) {
    return true;
  }

  const structuredFields = parseStructuredMonitorFields(text);
  const hasUrlCandidate = Boolean(structuredFields.url ?? readUrlCandidate(text));
  if (!hasUrlCandidate) {
    return false;
  }

  if (hasStructuredMonitorFields(structuredFields)) {
    return true;
  }

  return MONITOR_CREATION_KEYWORD_PATTERN.test(normalizeMonitorToken(text));
};

function AssistantChatbot({ enabled, userName, onOpenMonitorCreator }: AssistantChatbotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [draftAttachments, setDraftAttachments] = useState<DraftAttachment[]>([]);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isPanelExpanded, setIsPanelExpanded] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [composerNotice, setComposerNotice] = useState<string | null>(null);
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
  const composerShellRef = useRef<HTMLDivElement | null>(null);
  const headerActionsRef = useRef<HTMLDivElement | null>(null);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const speechRecognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const speechDraftRef = useRef('');
  const emojiPanelRef = useRef<HTMLDivElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!enabled) {
      setIsOpen(false);
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      setIsSending(false);
      setIsEmojiPickerOpen(false);
      setIsMoreMenuOpen(false);
      setIsPanelExpanded(false);
      setIsListening(false);
      setComposerNotice(null);
      setDraftAttachments([]);
      speechDraftRef.current = '';
      speechRecognitionRef.current?.abort();
      speechRecognitionRef.current = null;
      setDraft('');
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !isOpen) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (isMoreMenuOpen) {
          setIsMoreMenuOpen(false);
          return;
        }

        if (isEmojiPickerOpen) {
          setIsEmojiPickerOpen(false);
          return;
        }

        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [enabled, isEmojiPickerOpen, isMoreMenuOpen, isOpen]);

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

  useEffect(() => {
    if (!enabled) {
      setIsOpen(false);
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      setIsSending(false);
      setIsEmojiPickerOpen(false);
      setIsListening(false);
      setComposerNotice(null);
      setDraftAttachments([]);
      speechDraftRef.current = '';
      speechRecognitionRef.current?.abort();
      speechRecognitionRef.current = null;
      setDraft('');
    }
  }, [enabled]);

  useEffect(() => {
    if (!isEmojiPickerOpen) {
      return;
    }

    const handleDocumentMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (composerShellRef.current && !composerShellRef.current.contains(target)) {
        setIsEmojiPickerOpen(false);
      }
    };

    document.addEventListener('mousedown', handleDocumentMouseDown);
    return () => document.removeEventListener('mousedown', handleDocumentMouseDown);
  }, [isEmojiPickerOpen]);

  useEffect(() => {
    if (!isSending) {
      return;
    }

    setIsEmojiPickerOpen(false);
    setIsMoreMenuOpen(false);
  }, [isSending]);

  useEffect(() => {
    if (!isMoreMenuOpen) {
      return;
    }

    const handleDocumentMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (headerActionsRef.current && !headerActionsRef.current.contains(target)) {
        setIsMoreMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleDocumentMouseDown);
    return () => document.removeEventListener('mousedown', handleDocumentMouseDown);
  }, [isMoreMenuOpen]);

  useEffect(() => {
    if (isListening) {
      speechDraftRef.current = draft;
    }
  }, [draft, isListening]);

  const isSpeechRecognitionSupported = (): boolean => {
    if (typeof window === 'undefined') {
      return false;
    }

    const candidateWindow = window as Window;
    return Boolean(candidateWindow.SpeechRecognition || candidateWindow.webkitSpeechRecognition);
  };

  const stopSpeechRecognition = (): void => {
    const recognition = speechRecognitionRef.current;
    if (!recognition) {
      setIsListening(false);
      return;
    }

    try {
      recognition.stop();
    } catch {
      recognition.abort();
    }

    speechRecognitionRef.current = null;
    setIsListening(false);
  };

  const resetComposerState = (options?: { preserveDraft?: boolean }): void => {
    stopSpeechRecognition();
    setIsEmojiPickerOpen(false);
    setIsMoreMenuOpen(false);
    setComposerNotice(null);
    setDraftAttachments([]);
    speechDraftRef.current = '';
    if (!options?.preserveDraft) {
      setDraft('');
    }
  };

  const insertTextIntoDraft = (snippet: string): void => {
    const textarea = inputRef.current;
    if (!textarea) {
      setDraft((current) => `${current}${snippet}`);
      return;
    }

    const start = textarea.selectionStart ?? draft.length;
    const end = textarea.selectionEnd ?? start;

    setDraft((current) => {
      const safeStart = Math.max(0, Math.min(start, current.length));
      const safeEnd = Math.max(safeStart, Math.min(end, current.length));
      return `${current.slice(0, safeStart)}${snippet}${current.slice(safeEnd)}`;
    });

    window.requestAnimationFrame(() => {
      textarea.focus();
      const nextCursor = start + snippet.length;
      textarea.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const appendAttachments = (files: File[], kind: DraftAttachmentKind): void => {
    if (files.length === 0) {
      return;
    }

    setDraftAttachments((current) => [
      ...current,
      ...files.map((file) => ({
        id: createMessageId(kind),
        file,
        kind,
      })),
    ]);
    inputRef.current?.focus();
  };

  const handleAttachmentSelection = (
    event: ChangeEvent<HTMLInputElement>,
    kind: DraftAttachmentKind,
  ): void => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    appendAttachments(files, kind);
  };

  const handleRemoveAttachment = (attachmentId: string): void => {
    setDraftAttachments((current) => current.filter((attachment) => attachment.id !== attachmentId));
  };

  const openAttachmentPicker = (): void => {
    setIsMoreMenuOpen(false);
    setIsEmojiPickerOpen(false);
    attachmentInputRef.current?.click();
  };

  const openImagePicker = (): void => {
    setIsMoreMenuOpen(false);
    setIsEmojiPickerOpen(false);
    imageInputRef.current?.click();
  };

  const toggleEmojiPicker = (): void => {
    setIsMoreMenuOpen(false);
    setIsEmojiPickerOpen((current) => !current);
  };

  const handleEmojiSelect = (emoji: string): void => {
    insertTextIntoDraft(emoji);
    setIsEmojiPickerOpen(false);
    setIsMoreMenuOpen(false);
  };

  const startOrStopVoiceInput = (): void => {
    setIsMoreMenuOpen(false);
    if (isListening) {
      stopSpeechRecognition();
      setComposerNotice(null);
      return;
    }

    if (!isSpeechRecognitionSupported()) {
      setComposerNotice('La dictée vocale n\'est pas supportée par ce navigateur.');
      return;
    }

    const candidateWindow = window as Window;
    const RecognitionCtor = candidateWindow.SpeechRecognition ?? candidateWindow.webkitSpeechRecognition;
    if (!RecognitionCtor) {
      setComposerNotice('La dictée vocale n\'est pas supportée par ce navigateur.');
      return;
    }

    const recognition = new RecognitionCtor();
    speechDraftRef.current = draft;
    recognition.lang = 'fr-FR';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onstart = () => {
      setIsListening(true);
      setComposerNotice('Dictée vocale active. Parle maintenant.');
    };
    recognition.onresult = (event) => {
      let transcript = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const segment = result[0]?.transcript ?? '';
        transcript += segment;
      }

      const trimmedTranscript = transcript.trim();
      if (!trimmedTranscript) {
        return;
      }

      const base = speechDraftRef.current.trimEnd();
      const nextValue = base ? `${base} ${trimmedTranscript}` : trimmedTranscript;
      setDraft(nextValue);
      speechDraftRef.current = nextValue;

      window.requestAnimationFrame(() => {
        const textarea = inputRef.current;
        if (!textarea) {
          return;
        }

        textarea.focus();
        textarea.setSelectionRange(nextValue.length, nextValue.length);
      });
    };
    recognition.onerror = (event) => {
      setIsListening(false);
      speechRecognitionRef.current = null;
      setComposerNotice(
        event.error ? `Dictée vocale indisponible: ${event.error}.` : 'La dictée vocale a rencontré une erreur.',
      );
    };
    recognition.onend = () => {
      setIsListening(false);
      speechRecognitionRef.current = null;
      if (composerNotice?.startsWith('Dictée vocale active')) {
        setComposerNotice(null);
      }
    };

    speechRecognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      speechRecognitionRef.current = null;
      setIsListening(false);
      setComposerNotice('Impossible de démarrer la dictée vocale.');
    }
  };

  const toggleMoreMenu = (): void => {
    setIsEmojiPickerOpen(false);
    setIsMoreMenuOpen((current) => !current);
  };

  const togglePanelExpansion = (): void => {
    setIsEmojiPickerOpen(false);
    setIsMoreMenuOpen(false);
    setIsPanelExpanded((current) => !current);
  };

  const downloadConversation = (): void => {
    const transcript = buildConversationTranscript(messages);
    const blob = new Blob([transcript], { type: 'text/plain;charset=utf-8' });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = createConversationFileName();
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    setIsMoreMenuOpen(false);
  };

  const updateMessageContent = (
    messageId: string,
    updater: (message: ChatMessageEntry) => ChatMessageEntry,
  ): void => {
    setMessages((current) => current.map((message) => (message.id === messageId ? updater(message) : message)));
  };

  const closeChat = (): void => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    resetComposerState({ preserveDraft: true });
    setIsPanelExpanded(false);
    setIsOpen(false);
    setIsSending(false);
  };

  const submitMessage = async (rawMessage: string): Promise<void> => {
    const content = rawMessage.trim();
    const attachmentSummary = buildAttachmentSummary(draftAttachments);
    const outgoingContent = [content, attachmentSummary].filter((part) => part !== '').join('\n\n');
    if (outgoingContent === '' || isSending) {
      return;
    }

    const monitorDraft = looksLikeMonitorCreationRequest(content) ? buildMonitorDraft(content) : null;
    const nextMessages: ChatMessageEntry[] = [
      ...messages,
      {
        id: createMessageId('user'),
        role: 'user',
        content: outgoingContent,
      },
    ];

    if (monitorDraft && onOpenMonitorCreator) {
      setMessages([
        ...nextMessages,
        {
          id: createMessageId('assistant'),
          role: 'assistant',
          content: `I opened the monitor form and prefilled the details I recognized for ${monitorDraft.url}.`,
        },
      ]);
      resetComposerState();
      onOpenMonitorCreator(monitorDraft);
      setIsPanelExpanded(false);
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
    resetComposerState();
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
        <section
          className={`assistant-panel ${isPanelExpanded ? 'is-expanded' : ''}`}
          role="dialog"
          aria-label="Uptime Warden assistant"
        >
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

            <div className="assistant-header-actions" ref={headerActionsRef}>
              <div className="assistant-header-menu-anchor">
                <button
                  type="button"
                  className={`assistant-header-action ${isMoreMenuOpen ? 'is-active' : ''}`}
                  onClick={toggleMoreMenu}
                  aria-label="Options supplementaires"
                  aria-haspopup="menu"
                  aria-expanded={isMoreMenuOpen}
                >
                  <MoreHorizontal size={16} />
                </button>

                {isMoreMenuOpen ? (
                  <div className="assistant-header-menu" role="menu" aria-label="Options du chatbot">
                    <button
                      type="button"
                      className="assistant-header-menu-item"
                      onClick={togglePanelExpansion}
                      role="menuitem"
                    >
                      <span className="assistant-header-menu-item-icon" aria-hidden="true">
                        {isPanelExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                      </span>
                      <span className="assistant-header-menu-item-text">
                        {isPanelExpanded ? 'Reduire la fenetre' : 'Agrandir la fenetre'}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="assistant-header-menu-item"
                      onClick={downloadConversation}
                      aria-label="Telecharger la conversation"
                      role="menuitem"
                    >
                      <span className="assistant-header-menu-item-icon" aria-hidden="true">
                        <Download size={14} />
                      </span>
                      <span className="assistant-header-menu-item-text">Telecharger la conversation</span>
                    </button>
                  </div>
                ) : null}
              </div>

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
            <div className="assistant-input-shell" ref={composerShellRef}>
              <input
                ref={attachmentInputRef}
                className="assistant-file-input"
                type="file"
                multiple
                onChange={(event) => handleAttachmentSelection(event, 'file')}
              />
              <input
                ref={imageInputRef}
                className="assistant-file-input"
                type="file"
                accept="image/*"
                multiple
                onChange={(event) => handleAttachmentSelection(event, 'image')}
              />

              {draftAttachments.length > 0 ? (
                <div className="assistant-attachment-list" aria-label="Selected attachments">
                  {draftAttachments.map((attachment) => (
                    <div key={attachment.id} className="assistant-attachment-chip">
                      <span className="assistant-attachment-chip-icon" aria-hidden="true">
                        {attachment.kind === 'image' ? <ImageIcon size={12} /> : <Paperclip size={12} />}
                      </span>
                      <span className="assistant-attachment-chip-text">
                        <span className="assistant-attachment-chip-name">{attachment.file.name}</span>
                        <span className="assistant-attachment-chip-size">{formatFileSize(attachment.file.size)}</span>
                      </span>
                      <button
                        type="button"
                        className="assistant-attachment-remove"
                        onClick={() => handleRemoveAttachment(attachment.id)}
                        aria-label={`Remove ${attachment.file.name}`}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}

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

              {isEmojiPickerOpen ? (
                <div className="assistant-emoji-popover" ref={emojiPanelRef} role="dialog" aria-label="Emoji picker">
                  <div className="assistant-emoji-grid">
                    {EMOJI_OPTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        className="assistant-emoji-option"
                        onClick={() => handleEmojiSelect(emoji)}
                        aria-label={`Insert ${emoji}`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="assistant-input-toolbar">
                <div className="assistant-input-tools">
                  <button
                    type="button"
                    className="assistant-input-tool"
                    onClick={openAttachmentPicker}
                    disabled={isSending}
                    aria-label="Add a file"
                    title="Add a file"
                  >
                    <Paperclip size={14} />
                  </button>
                  <button
                    type="button"
                    className={`assistant-input-tool ${isEmojiPickerOpen ? 'is-active' : ''}`}
                    onClick={toggleEmojiPicker}
                    disabled={isSending}
                    aria-label="Add emoji"
                    aria-expanded={isEmojiPickerOpen}
                    aria-haspopup="dialog"
                    title="Add emoji"
                  >
                    <Smile size={14} />
                  </button>
                  <button
                    type="button"
                    className="assistant-input-tool"
                    onClick={openImagePicker}
                    disabled={isSending}
                    aria-label="Add an image"
                    title="Add an image"
                  >
                    <ImageIcon size={14} />
                  </button>
                  <button
                    type="button"
                    className={`assistant-input-tool ${isListening ? 'is-active' : ''}`}
                    onClick={startOrStopVoiceInput}
                    disabled={isSending}
                    aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
                    aria-pressed={isListening}
                    title={isListening ? 'Stop voice input' : 'Start voice input'}
                  >
                    <Mic size={14} />
                  </button>
                </div>
                <button
                  type="button"
                  className="assistant-send-button"
                  onClick={() => void submitMessage(draft)}
                  disabled={isSending || (draft.trim() === '' && draftAttachments.length === 0)}
                  aria-label="Send message"
                >
                  {isSending ? <LoaderCircle size={16} className="assistant-send-spinning" /> : <Send size={16} />}
                </button>
              </div>

              {composerNotice ? (
                <p className="assistant-composer-notice" aria-live="polite">
                  {composerNotice}
                </p>
              ) : null}
            </div>

            <p className="assistant-footer-hint">Powered by Uptime Warden</p>
          </footer>
        </section>
      ) : null}
    </div>
  );
}

export default AssistantChatbot;
