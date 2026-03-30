import { GoogleGenAI } from '@google/genai';
import Monitor from '../models/Monitor';
import type { UserRole } from '../models/User';
import { isAdminRole, isUserRole } from '../utils/roles';

export type AssistantIntent = 'answer' | 'create_monitor' | 'clarify';
export type AssistantMessageRole = 'user' | 'assistant';
export type AssistantResponseActionKind = 'navigate' | 'prompt' | 'reply';

export interface AssistantResponseAction {
  kind: AssistantResponseActionKind;
  label: string;
  description: string;
  value: string;
}

export interface AssistantChatMessage {
  role: AssistantMessageRole;
  content: string;
}

export interface AssistantWorkspaceSummary {
  userName: string;
  userEmail: string;
  userRole: UserRole;
  monitorCount: number;
  upCount: number;
  downCount: number;
  pausedCount: number;
  recentMonitors: Array<{
    name: string;
    url: string;
    status: 'up' | 'down' | 'paused' | 'pending';
    type: 'http' | 'https' | 'ws' | 'wss';
  }>;
}

export interface AssistantMonitorDraft {
  name?: string | null;
  url?: string | null;
  type?: 'http' | 'https' | 'ws' | 'wss' | null;
  intervalMinutes?: number | null;
  timeoutSeconds?: number | null;
  httpMethod?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD' | null;
  domainExpiryMode?: 'enabled' | 'disabled' | null;
  sslExpiryMode?: 'enabled' | 'disabled' | null;
}

export interface AssistantAnalysisResult {
  intent: AssistantIntent;
  reply: string;
  missingFields: string[];
  monitor: AssistantMonitorDraft | null;
  actions: AssistantResponseAction[];
}

interface RawAssistantAnalysisResult {
  intent?: unknown;
  reply?: unknown;
  missingFields?: unknown;
  monitor?: unknown;
}

const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || 'gemini-3.1-pro-preview';
const GEMINI_TIMEOUT_MS = 15000;
const MAX_CONVERSATION_TURNS = 12;

let ai: GoogleGenAI | null = null;
try {
  ai = new GoogleGenAI({});
} catch (error) {
  console.warn('Google GenAI initialization failed, local fallback will be used:', error);
}

const PRODUCT_KNOWLEDGE = [
  'Uptime Warden permet de surveiller des monitors HTTP, HTTPS, WS et WSS.',
  'Chaque monitor peut avoir un nom, une URL, un intervalle, un timeout et une methode HTTP.',
  'Le tableau de bord propose les actions creer, modifier, mettre en pause, reprendre, verifier manuellement et supprimer un monitor.',
  'Le projet contient aussi des pages pour les incidents, les status pages, la maintenance, les membres de l equipe et les integrations/API.',
  'Les invitations equipe, le reset du mot de passe et la connexion font aussi partie du produit.',
  'Le chatbot doit rester fidele au code existant et ne pas inventer de fonctionnalites non presentes.',
].join(' ');

const CREATE_MONITOR_OPTIONS: AssistantResponseAction[] = [
  {
    kind: 'reply',
    label: 'Creer manuellement',
    description: 'Je te montre les etapes dans le chat.',
    value: [
      'Bien sur. Pour creer un monitor manuellement dans Uptime Warden :',
      '1. Va dans `Monitoring`, puis clique sur `New monitor`.',
      '2. Choisis le type adapte: `HTTP`, `HTTPS`, `WS` ou `WSS`.',
      "3. Renseigne le nom du monitor et l URL du service a surveiller.",
      "4. Ajuste l intervalle de verification, le timeout et la methode HTTP si besoin.",
      '5. Active `SSL` ou `expiration de domaine` seulement si tu veux ces controles.',
      '6. Clique sur `Create monitor` pour enregistrer le monitor.',
      '',
      'Si tu veux, donne-moi l URL et je peux aussi te guider champ par champ.',
    ].join('\n'),
  },
  {
    kind: 'prompt',
    label: 'Creer avec le chatbot',
    description: 'Je te guide ici pas a pas.',
    value: 'Je veux creer un monitor',
  },
];

const normalizeWhitespace = (value: string): string => value.replace(/\s+/g, ' ').trim();

const normalizeSearchText = (value: string): string =>
  normalizeWhitespace(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const normalizeConversation = (messages: AssistantChatMessage[]): AssistantChatMessage[] =>
  messages
    .filter((message) => message && (message.role === 'user' || message.role === 'assistant'))
    .map((message) => ({
      role: message.role,
      content: normalizeWhitespace(String(message.content ?? '')),
    }))
    .filter((message) => message.content !== '')
    .slice(-MAX_CONVERSATION_TURNS);

const conversationToText = (messages: AssistantChatMessage[]): string =>
  messages
    .map((message) => `${message.role === 'assistant' ? 'Assistant' : 'User'}: ${message.content}`)
    .join('\n');

const getLatestUserMessage = (messages: AssistantChatMessage[]): string => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === 'user') {
      return normalizeWhitespace(messages[index]?.content ?? '');
    }
  }
  return '';
};

const stripTrailingPunctuation = (value: string): string => value.replace(/[)\].,!?;:]+$/g, '');

const isPrivateHost = (host: string): boolean =>
  /^(?:localhost|127(?:\.\d{1,3}){3}|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})$/i.test(
    host
  );

const normalizeMonitorUrl = (rawUrl: string): string => {
  const trimmed = normalizeWhitespace(rawUrl);
  if (trimmed === '') {
    return '';
  }

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
    return stripTrailingPunctuation(trimmed);
  }

  const hostCandidate = trimmed.split('/')[0] ?? trimmed;
  const hostWithoutPort = hostCandidate.replace(/:\d+$/, '');
  const withProtocol = isPrivateHost(hostWithoutPort) ? `http://${trimmed}` : `https://${trimmed}`;
  return stripTrailingPunctuation(withProtocol);
};

const inferMonitorType = (url: string): 'http' | 'https' | 'ws' | 'wss' => {
  try {
    const parsedUrl = new URL(url);
    switch (parsedUrl.protocol) {
      case 'http:':
        return 'http';
      case 'ws:':
        return 'ws';
      case 'wss:':
        return 'wss';
      case 'https:':
      default:
        return 'https';
    }
  } catch {
    return 'https';
  }
};

const inferMonitorName = (url: string): string => {
  try {
    const parsedUrl = new URL(url);
    const host = parsedUrl.hostname.replace(/^www\./i, '');
    const pathname = parsedUrl.pathname.replace(/\/+$/g, '');
    if (pathname && pathname !== '') {
      const pathLabel = pathname
        .split('/')
        .filter(Boolean)
        .slice(0, 2)
        .join(' / ');
      return `${host}${pathLabel ? ` (${pathLabel})` : ''}`;
    }
    return host || 'New monitor';
  } catch {
    return 'New monitor';
  }
};

const extractExplicitName = (text: string): string | null => {
  const matches = [
    text.match(/(?:nom|name)\s*[:=]\s*["']?([^"\n,;]+)["']?/i),
    text.match(/(?:appelle\s+)?(?:ce\s+)?monitor\s+(?:nomme|named)\s+["']?([^"\n,;]+)["']?/i),
  ];

  for (const match of matches) {
    const value = match?.[1]?.trim();
    if (value) {
      return value;
    }
  }

  return null;
};

const extractFirstUrl = (text: string): string | null => {
  const protocolMatch = text.match(/(?:https?|wss?|ws):\/\/[^\s<>"'`]+/i);
  if (protocolMatch?.[0]) {
    return stripTrailingPunctuation(protocolMatch[0]);
  }

  const bareDomainMatch = text.match(/\b(?:localhost|(?:[a-z0-9-]+\.)+[a-z]{2,})(?::\d+)?(?:\/[^\s<>"'`]+)?/i);
  if (bareDomainMatch?.[0]) {
    return stripTrailingPunctuation(bareDomainMatch[0]);
  }

  return null;
};

const extractIntervalMinutes = (text: string): number | null => {
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*(s|sec|secs|secondes?|m|min|mins|minutes?|h|hr|hrs|heures?)/i);
  if (!match) {
    return null;
  }

  const rawAmount = Number(match[1].replace(',', '.'));
  if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
    return null;
  }

  const unit = match[2].toLowerCase();
  if (unit.startsWith('s')) {
    return Math.max(1, Math.ceil(rawAmount / 60));
  }

  if (unit.startsWith('h')) {
    return Math.max(1, Math.ceil(rawAmount * 60));
  }

  return Math.max(1, Math.round(rawAmount));
};

const extractTimeoutSeconds = (text: string): number | null => {
  const match = text.match(/(?:timeout|delai|délai)\s*(?:de)?\s*(\d+(?:[.,]\d+)?)\s*(s|sec|secs|secondes?|m|min|mins|minutes?)/i);
  if (!match) {
    return null;
  }

  const rawAmount = Number(match[1].replace(',', '.'));
  if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
    return null;
  }

  const unit = match[2].toLowerCase();
  if (unit.startsWith('m')) {
    return Math.max(5, Math.round(rawAmount * 60));
  }

  return Math.max(5, Math.round(rawAmount));
};

const extractHttpMethod = (text: string): 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD' | null => {
  const methods: Array<'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD'> = ['GET', 'POST', 'PUT', 'DELETE', 'HEAD'];
  for (const method of methods) {
    if (new RegExp(`\\b${method}\\b`, 'i').test(text)) {
      return method;
    }
  }
  return null;
};

const defaultHttpMethodForUrl = (url: string): 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD' => {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.pathname.startsWith('/api/')) {
      return 'GET';
    }
  } catch {
    // Fallback below.
  }

  return 'HEAD';
};

const extractSslMode = (text: string, url: string): 'enabled' | 'disabled' => {
  if (!/ssl|tls|certificat|certificate|cert/i.test(text)) {
    return 'disabled';
  }

  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol === 'https:' || parsedUrl.protocol === 'wss:') {
      return 'enabled';
    }
  } catch {
    // Fallback below.
  }

  return 'disabled';
};

const extractDomainMode = (text: string): 'enabled' | 'disabled' => {
  if (/domaine|domain|whois|expir/i.test(text)) {
    return 'enabled';
  }
  return 'disabled';
};

const clampInteger = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, Math.round(value)));

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

const isExplicitCreateRequest = (messageText: string): boolean => {
  const text = normalizeSearchText(messageText);
  const hasCreateVerb = /\b(cree(?:r)?|ajoute(?:r)?|create|add|new|surveille(?:r)?|monitor(?:er)?)\b/.test(text);
  const hasMonitorWord = /\b(moniteur|monitor)\b/.test(text);
  return hasCreateVerb && hasMonitorWord;
};

const buildCreateMonitorOptionsReply = (): string =>
  'Bien sur. Tu peux creer un monitor de deux facons. Choisis celle qui te convient.';

const buildCreateMonitorOptionsResult = (): AssistantAnalysisResult => ({
  intent: 'answer',
  reply: buildCreateMonitorOptionsReply(),
  missingFields: [],
  monitor: null,
  actions: [...CREATE_MONITOR_OPTIONS],
});

const buildManualCreateGuideResult = (): AssistantAnalysisResult => ({
  intent: 'answer',
  reply: CREATE_MONITOR_OPTIONS[0].value,
  missingFields: [],
  monitor: null,
  actions: [],
});

const buildClarifyReply = (): string =>
  "J'ai besoin de l URL exacte du service a surveiller. Envoie-moi par exemple `https://example.com` et je le cree pour toi.";

const buildSuccessReply = (monitor: {
  name: string;
  url: string;
  interval: number;
  timeout: number;
  httpMethod: string;
  domainExpiryMode?: 'enabled' | 'disabled';
  sslExpiryMode?: 'enabled' | 'disabled';
}): string => {
  const parts = [
    `C'est fait, j'ai cree le monitor "${monitor.name}".`,
    `URL: ${monitor.url}.`,
    `Intervalle: ${monitor.interval} minute${monitor.interval > 1 ? 's' : ''}.`,
    `Timeout: ${monitor.timeout} seconde${monitor.timeout > 1 ? 's' : ''}.`,
    `Methode: ${monitor.httpMethod}.`,
  ];

  const extraChecks: string[] = [];
  if (monitor.sslExpiryMode === 'enabled') {
    extraChecks.push('SSL active');
  }
  if (monitor.domainExpiryMode === 'enabled') {
    extraChecks.push('expiration de domaine active');
  }
  if (extraChecks.length > 0) {
    parts.push(`Checks supplementaires: ${extraChecks.join(', ')}.`);
  }

  return parts.join(' ');
};

const buildFallbackAnswer = (messageText: string, workspace: AssistantWorkspaceSummary): string => {
  const lowerText = normalizeSearchText(messageText);

  if (lowerText === '' || /^(bonjour|salut|hello|hi|coucou)\b/.test(lowerText)) {
    return [
      'Bonjour ! Je peux t aider avec Uptime Warden.',
      'Tu peux me demander comment creer un monitor, voir les incidents, gerer les status pages, la maintenance ou les membres de l equipe.',
    ].join(' ');
  }

  if (/\b(comment|how|how to|quoi|what)\b/.test(lowerText) && /(?:\bmonitor\b|\bmoniteur\b)/.test(lowerText)) {
    return [
      'Tu peux me demander de te guider pas a pas ou de creer directement un monitor.',
      'Exemple: `Creer un monitor avec l URL https://example.com et un intervalle de 5 minutes`.',
      `Tu as actuellement ${workspace.monitorCount} monitor${workspace.monitorCount > 1 ? 's' : ''} dans ton espace.`,
    ].join(' ');
  }

  if (/\bincident|incidents?\b/.test(lowerText)) {
    return 'La page Incidents te montre les pannes detectees, leur duree et les monitors concernes.';
  }

  if (/\bstatus\s*page|page de statut|status pages?\b/.test(lowerText)) {
    return 'Les status pages servent a afficher publiquement l etat de tes services et de tes monitors.';
  }

  if (/\bmaintenance\b/.test(lowerText)) {
    return 'La section Maintenance te permet de planifier une periode de maintenance et de mettre les monitors en pause temporaire.';
  }

  if (/\bteam|equipe|member|membre\b/.test(lowerText)) {
    if (workspace.userRole === 'super_admin') {
      return 'En tant que super admin, tu peux inviter et gerer les membres de l equipe depuis Team members.';
    }

    return isAdminRole(workspace.userRole)
      ? 'En tant qu admin, tu peux inviter et gerer les membres de l equipe depuis Team members.'
      : 'La gestion de l equipe est reservee aux administrateurs.';
  }

  if (/\bintegration|integrations|api\b/.test(lowerText)) {
    return 'La section Integrations & API te permet de connecter Uptime Warden a des outils externes comme les webhooks.';
  }

  return [
    'Je peux t aider a comprendre Uptime Warden et a creer un monitor.',
    'Dis-moi simplement ce que tu veux surveiller, par exemple une URL, un intervalle et une methode HTTP.',
  ].join(' ');
};

const sanitizeMonitorDraft = (draft: unknown, messageText: string): AssistantMonitorDraft | null => {
  const text = normalizeWhitespace(messageText);
  const fallbackUrl = extractFirstUrl(text);
  const fallbackName = extractExplicitName(text);

  const fromUrl = (inputUrl: string): AssistantMonitorDraft | null => {
    const normalizedUrl = normalizeMonitorUrl(inputUrl);
    if (normalizedUrl === '') {
      return null;
    }

    try {
      const parsedUrl = new URL(normalizedUrl);
      const type = inferMonitorType(parsedUrl.toString());
      return {
        name: fallbackName || inferMonitorName(normalizedUrl),
        url: normalizedUrl,
        type,
        intervalMinutes: extractIntervalMinutes(text) ?? 5,
        timeoutSeconds: extractTimeoutSeconds(text) ?? 30,
        httpMethod: extractHttpMethod(text) ?? defaultHttpMethodForUrl(normalizedUrl),
        domainExpiryMode: extractDomainMode(text),
        sslExpiryMode: extractSslMode(text, normalizedUrl),
      };
    } catch {
      return null;
    }
  };

  if (draft === null || draft === undefined) {
    return fallbackUrl ? fromUrl(fallbackUrl) : null;
  }

  if (typeof draft !== 'object') {
    return fallbackUrl ? fromUrl(fallbackUrl) : null;
  }

  const record = draft as Record<string, unknown>;
  const rawUrl = typeof record.url === 'string' && record.url.trim() !== '' ? record.url.trim() : fallbackUrl;
  if (!rawUrl) {
    return null;
  }

  const normalizedUrl = normalizeMonitorUrl(rawUrl);
  try {
    new URL(normalizedUrl);
  } catch {
    return null;
  }

  const parsedType = typeof record.type === 'string' ? record.type : inferMonitorType(normalizedUrl);
  const type: AssistantMonitorDraft['type'] = ['http', 'https', 'ws', 'wss'].includes(parsedType)
    ? (parsedType as AssistantMonitorDraft['type'])
    : inferMonitorType(normalizedUrl);

  const parsedName = typeof record.name === 'string' && record.name.trim() !== '' ? record.name.trim() : fallbackName;
  const parsedInterval = typeof record.intervalMinutes === 'number' ? record.intervalMinutes : extractIntervalMinutes(text);
  const parsedTimeout = typeof record.timeoutSeconds === 'number' ? record.timeoutSeconds : extractTimeoutSeconds(text);
  const parsedMethod =
    typeof record.httpMethod === 'string' && ['GET', 'POST', 'PUT', 'DELETE', 'HEAD'].includes(record.httpMethod)
      ? (record.httpMethod as AssistantMonitorDraft['httpMethod'])
      : extractHttpMethod(text);
  const parsedDomainMode =
    typeof record.domainExpiryMode === 'string' && ['enabled', 'disabled'].includes(record.domainExpiryMode)
      ? (record.domainExpiryMode as AssistantMonitorDraft['domainExpiryMode'])
      : extractDomainMode(text);
  const parsedSslMode =
    typeof record.sslExpiryMode === 'string' && ['enabled', 'disabled'].includes(record.sslExpiryMode)
      ? (record.sslExpiryMode as AssistantMonitorDraft['sslExpiryMode'])
      : extractSslMode(text, normalizedUrl);

  return {
    name: parsedName || inferMonitorName(normalizedUrl),
    url: normalizedUrl,
    type,
    intervalMinutes: clampInteger(parsedInterval ?? 5, 1, 1440),
    timeoutSeconds: clampInteger(parsedTimeout ?? 30, 5, 300),
    httpMethod: parsedMethod || defaultHttpMethodForUrl(normalizedUrl),
    domainExpiryMode: parsedDomainMode ?? 'disabled',
    sslExpiryMode: parsedSslMode ?? 'disabled',
  };
};

const parseIntent = (value: unknown): AssistantIntent | null => {
  if (value === 'answer' || value === 'create_monitor' || value === 'clarify') {
    return value;
  }
  return null;
};

const parseMissingFields = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
        .filter((entry) => entry !== '')
    )
  );
};

const safeJsonParse = (value: string): unknown => {
  const trimmed = value.trim();
  const withoutFence = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();

  try {
    return JSON.parse(withoutFence);
  } catch {
    const firstBrace = withoutFence.indexOf('{');
    const lastBrace = withoutFence.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        return JSON.parse(withoutFence.slice(firstBrace, lastBrace + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
};

const buildSystemPrompt = (workspace: AssistantWorkspaceSummary): string => {
  const recentMonitors = workspace.recentMonitors.length
    ? workspace.recentMonitors
        .map((monitor) => `- ${monitor.name} | ${monitor.status} | ${monitor.type.toUpperCase()} | ${monitor.url}`)
        .join('\n')
    : '- Aucun monitor recent';

  return [
    'Tu es l assistant officiel de Uptime Warden.',
    'Reponds en francais clair, naturel et utile.',
    'Retourne uniquement un objet JSON valide, sans markdown, sans texte autour.',
    'Le JSON doit avoir cette forme:',
    '{',
    '  "intent": "answer" | "create_monitor" | "clarify",',
    '  "reply": "string",',
    '  "missingFields": ["string"],',
    '  "monitor": null | {',
    '    "name": "string",',
    '    "url": "string",',
    '    "type": "http" | "https" | "ws" | "wss",',
    '    "intervalMinutes": number,',
    '    "timeoutSeconds": number,',
    '    "httpMethod": "GET" | "POST" | "PUT" | "DELETE" | "HEAD",',
    '    "domainExpiryMode": "enabled" | "disabled",',
    '    "sslExpiryMode": "enabled" | "disabled"',
    '  }',
    '}',
    'Regles:',
    '- Si l utilisateur veut creer un monitor mais que l URL manque, mets intent a clarify et missingFields doit contenir url.',
    '- Si l URL est presente, tu peux remplir monitor avec des valeurs plausibles.',
    '- Valeurs par defaut recommandees: intervalMinutes 5, timeoutSeconds 30, httpMethod HEAD pour HTTP/HTTPS et GET pour WS/WSS.',
    '- Ne jamais inventer de fonctionnalites qui n existent pas dans le produit.',
    '- Si l utilisateur demande seulement de l aide, reponds avec une explication claire dans reply.',
    '',
    `Utilisateur: ${workspace.userName} <${workspace.userEmail}>`,
    `Role: ${workspace.userRole}`,
    `Monitors: ${workspace.monitorCount} total, ${workspace.upCount} up, ${workspace.downCount} down, ${workspace.pausedCount} paused`,
    '',
    'Monitors recents:',
    recentMonitors,
    '',
    'Contexte produit:',
    PRODUCT_KNOWLEDGE,
  ].join('\n');
};

const buildGeminiPrompt = (messages: AssistantChatMessage[], workspace: AssistantWorkspaceSummary): string =>
  [
    buildSystemPrompt(workspace),
    '',
    'Conversation recente:',
    conversationToText(messages),
  ].join('\n');

const buildCreateMonitorHelpResult = (): AssistantAnalysisResult => buildCreateMonitorOptionsResult();

const fallbackAnalyze = (latestUserMessage: string, workspace: AssistantWorkspaceSummary): AssistantAnalysisResult => {
  if (isManualCreateGuideRequest(latestUserMessage)) {
    return buildManualCreateGuideResult();
  }

  if (isCreateMonitorHelpRequest(latestUserMessage) && !extractFirstUrl(latestUserMessage)) {
    return buildCreateMonitorHelpResult();
  }

  const wantsCreation = isExplicitCreateRequest(latestUserMessage);
  const fallbackUrl = extractFirstUrl(latestUserMessage);

  if (wantsCreation && !fallbackUrl) {
    return {
      intent: 'clarify',
      reply: buildClarifyReply(),
      missingFields: ['url'],
      monitor: null,
      actions: [],
    };
  }

  if (wantsCreation && fallbackUrl) {
    const monitorDraft = sanitizeMonitorDraft(
      {
        url: fallbackUrl,
        name: extractExplicitName(latestUserMessage),
        type: inferMonitorType(fallbackUrl),
        intervalMinutes: extractIntervalMinutes(latestUserMessage) ?? 5,
        timeoutSeconds: extractTimeoutSeconds(latestUserMessage) ?? 30,
        httpMethod: extractHttpMethod(latestUserMessage) ?? defaultHttpMethodForUrl(fallbackUrl),
        domainExpiryMode: extractDomainMode(latestUserMessage),
        sslExpiryMode: extractSslMode(latestUserMessage, fallbackUrl),
      },
      latestUserMessage
    );

    return {
      intent: 'create_monitor',
      reply: buildFallbackAnswer(latestUserMessage, workspace),
      missingFields: [],
      monitor: monitorDraft,
      actions: [],
    };
  }

  return {
    intent: 'answer',
    reply: buildFallbackAnswer(latestUserMessage, workspace),
    missingFields: [],
    monitor: null,
    actions: [],
  };
};

const sanitizeAnalysisResult = (
  parsed: RawAssistantAnalysisResult,
  latestUserMessage: string,
  workspace: AssistantWorkspaceSummary
): AssistantAnalysisResult => {
  const normalizedLatestMessage = normalizeWhitespace(latestUserMessage);

  if (isManualCreateGuideRequest(normalizedLatestMessage)) {
    return buildManualCreateGuideResult();
  }

  if (isCreateMonitorHelpRequest(normalizedLatestMessage) && !extractFirstUrl(normalizedLatestMessage)) {
    return buildCreateMonitorHelpResult();
  }

  const explicitCreate = isExplicitCreateRequest(normalizedLatestMessage);
  const parsedIntent = parseIntent(parsed.intent);
  let intent: AssistantIntent = parsedIntent ?? 'answer';
  let reply =
    typeof parsed.reply === 'string' && parsed.reply.trim() !== ''
      ? parsed.reply.trim()
      : buildFallbackAnswer(normalizedLatestMessage, workspace);
  let missingFields = parseMissingFields(parsed.missingFields);
  let monitor = sanitizeMonitorDraft(parsed.monitor, normalizedLatestMessage);

  if (explicitCreate && !monitor?.url) {
    const fallbackUrl = extractFirstUrl(normalizedLatestMessage);
    if (fallbackUrl) {
      monitor = sanitizeMonitorDraft(
        {
          url: fallbackUrl,
          name: extractExplicitName(normalizedLatestMessage),
          type: inferMonitorType(fallbackUrl),
          intervalMinutes: extractIntervalMinutes(normalizedLatestMessage) ?? 5,
          timeoutSeconds: extractTimeoutSeconds(normalizedLatestMessage) ?? 30,
          httpMethod: extractHttpMethod(normalizedLatestMessage) ?? defaultHttpMethodForUrl(fallbackUrl),
          domainExpiryMode: extractDomainMode(normalizedLatestMessage),
          sslExpiryMode: extractSslMode(normalizedLatestMessage, fallbackUrl),
        },
        normalizedLatestMessage
      );
    }
  }

  if (explicitCreate) {
    if (!monitor?.url) {
      return {
        intent: 'clarify',
        reply: buildClarifyReply(),
        missingFields: ['url'],
        monitor: null,
        actions: [],
      };
    }
    intent = 'create_monitor';
  }

  if (intent === 'create_monitor' && !monitor?.url) {
    return {
      intent: 'clarify',
      reply: buildClarifyReply(),
      missingFields: ['url'],
      monitor: null,
      actions: [],
    };
  }

  if (intent === 'clarify' && missingFields.length === 0 && !monitor?.url) {
    missingFields = ['url'];
  }

  if (intent === 'answer' && monitor?.url && explicitCreate) {
    intent = 'create_monitor';
  }

  if (intent === 'create_monitor' && monitor?.url) {
    reply = buildFallbackAnswer(normalizedLatestMessage, workspace);
  }

  return {
    intent,
    reply,
    missingFields,
    monitor,
    actions: [],
  };
};

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timeout`)), timeoutMs);
    });

    return (await Promise.race([promise, timeoutPromise])) as T;
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
};

export const buildWorkspaceSummary = async (
  user: {
    _id: unknown;
    name?: string;
    email?: string;
    role?: UserRole;
  }
): Promise<AssistantWorkspaceSummary> => {
  const userId = user._id;
  const baseQuery = {
    $or: [{ owner: userId }, { sharedWith: userId }],
  };

  const [monitorCount, upCount, downCount, pausedCount, recentMonitors] = await Promise.all([
    Monitor.countDocuments(baseQuery),
    Monitor.countDocuments({ ...baseQuery, status: 'up' }),
    Monitor.countDocuments({ ...baseQuery, status: 'down' }),
    Monitor.countDocuments({ ...baseQuery, status: 'paused' }),
    Monitor.find(baseQuery).sort({ updatedAt: -1 }).limit(6).select('name url status type').lean(),
  ]);

  return {
    userName: user.name?.trim() || user.email?.trim() || 'Utilisateur',
    userEmail: user.email?.trim() || 'unknown@example.com',
    userRole: isUserRole(user.role) ? user.role : 'user',
    monitorCount,
    upCount,
    downCount,
    pausedCount,
    recentMonitors: recentMonitors.map((monitor) => ({
      name: typeof monitor.name === 'string' && monitor.name.trim() !== '' ? monitor.name : monitor.url,
      url: typeof monitor.url === 'string' ? monitor.url : '',
      status:
        monitor.status === 'up' || monitor.status === 'down' || monitor.status === 'paused'
          ? monitor.status
          : 'pending',
      type:
        monitor.type === 'http' || monitor.type === 'https' || monitor.type === 'ws' || monitor.type === 'wss'
          ? monitor.type
          : 'https',
    })),
  };
};

export const analyzeAssistantChat = async (
  messages: AssistantChatMessage[],
  workspace: AssistantWorkspaceSummary
): Promise<AssistantAnalysisResult> => {
  const normalizedMessages = normalizeConversation(messages);
  const latestUserMessage = getLatestUserMessage(normalizedMessages);

  if (latestUserMessage === '') {
    return {
      intent: 'answer',
      reply: 'Je suis pret. Dis-moi ce que tu veux surveiller ou pose-moi une question sur Uptime Warden.',
      missingFields: [],
      monitor: null,
      actions: [],
    };
  }

  if (isManualCreateGuideRequest(latestUserMessage)) {
    return buildManualCreateGuideResult();
  }

  if (isCreateMonitorHelpRequest(latestUserMessage) && !extractFirstUrl(latestUserMessage)) {
    return buildCreateMonitorHelpResult();
  }

  if (!ai) {
    return fallbackAnalyze(latestUserMessage, workspace);
  }

  try {
    const response = await withTimeout(
      ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: buildGeminiPrompt(normalizedMessages, workspace),
      }),
      GEMINI_TIMEOUT_MS,
      'Gemini assistant'
    );

    const rawText = typeof response.text === 'string' ? response.text.trim() : '';
    if (!rawText) {
      return fallbackAnalyze(latestUserMessage, workspace);
    }

    const parsed = safeJsonParse(rawText);
    if (!parsed || typeof parsed !== 'object') {
      return fallbackAnalyze(latestUserMessage, workspace);
    }

    return sanitizeAnalysisResult(parsed as RawAssistantAnalysisResult, latestUserMessage, workspace);
  } catch (error) {
    console.warn('Gemini assistant unavailable, fallback local parser used:', error);
    return fallbackAnalyze(latestUserMessage, workspace);
  }
};

export const createAssistantSuccessReply = (monitor: {
  name: string;
  url: string;
  interval: number;
  timeout: number;
  httpMethod: string;
  domainExpiryMode?: 'enabled' | 'disabled';
  sslExpiryMode?: 'enabled' | 'disabled';
}): string => buildSuccessReply(monitor);
