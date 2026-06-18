import { Router, type Request, type Response } from 'express';

const router = Router();

const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash';
const DEFAULT_SYSTEM_INSTRUCTION =
  "Tu es un assistant conversationnel utile, clair et sympathique. Reponds en francais sauf si l'utilisateur demande une autre langue.";

type ChatMessageRole = 'user' | 'model';

interface ChatMessage {
  role: ChatMessageRole;
  text: string;
}

const getApiKey = (): string =>
  process.env.GEMINI_API_KEY?.trim() ||
  process.env.GOOGLE_API_KEY?.trim() ||
  process.env.API_KEY?.trim() ||
  '';

const sendJson = (res: Response, statusCode: number, payload: unknown): void => {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(payload));
};

const normalizeMessages = (messages: unknown): ChatMessage[] => {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .map((message): ChatMessage | null => {
      if (!message || typeof message !== 'object') {
        return null;
      }

      const record = message as Record<string, unknown>;
      const role: ChatMessageRole =
        record.role === 'model' || record.role === 'assistant' ? 'model' : 'user';
      const rawText =
        typeof record.text === 'string'
          ? record.text
          : typeof record.content === 'string'
            ? record.content
            : '';
      const text = rawText.trim();

      if (text === '') {
        return null;
      }

      return { role, text };
    })
    .filter((message): message is ChatMessage => message !== null);
};

const toHistory = (messages: ChatMessage[]) =>
  messages.map((message) => ({
    role: message.role,
    parts: [{ text: message.text }],
  }));

const clampTemperature = (value: unknown): number => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0.7;
  }

  return Math.max(0, Math.min(numeric, 2));
};

const parseJsonMaybe = (value: string): unknown => {
  const trimmed = value.trim();
  if (trimmed === '') {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  return value as Record<string, unknown>;
};

const readNumber = (...values: unknown[]): number | null => {
  for (const value of values) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return numeric;
    }
  }

  return null;
};

const readString = (...values: unknown[]): string | null => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim() !== '') {
      return value.trim();
    }
  }

  return null;
};

const isGeminiQuotaError = (error: unknown): boolean => {
  const rawMessage = error instanceof Error ? error.message : String(error);
  return /quota/i.test(rawMessage) || /RESOURCE_EXHAUSTED/i.test(rawMessage) || /\b429\b/.test(rawMessage);
};

const formatGeminiErrorMessage = (error: unknown): string => {
  const rawMessage = error instanceof Error ? error.message : String(error);
  const parsedOuter = asRecord(parseJsonMaybe(rawMessage));
  const outerError = parsedOuter && asRecord(parsedOuter.error) ? asRecord(parsedOuter.error) : parsedOuter;

  const parsedInner =
    outerError && typeof outerError.message === 'string' ? asRecord(parseJsonMaybe(outerError.message)) : null;
  const innerError = parsedInner && asRecord(parsedInner.error) ? asRecord(parsedInner.error) : parsedInner;

  const code = readNumber(outerError?.code, innerError?.code, parsedInner?.code, parsedOuter?.code);
  const status = readString(outerError?.status, innerError?.status, parsedInner?.status, parsedOuter?.status) ?? '';
  const message =
    readString(innerError?.message, parsedInner?.message, outerError?.message, rawMessage) ?? rawMessage.trim();

  if (code === 429 || /RESOURCE_EXHAUSTED/i.test(status) || /quota/i.test(message)) {
    return 'Quota Gemini atteint. Reessaie dans un moment ou verifie ton plan et ta facturation.';
  }

  return message || 'Erreur lors de la communication avec Gemini.';
};

const buildFallbackReply = (messageText: string): string => {
  const normalized = messageText.trim().toLowerCase();

  if (normalized === '' || /^(bonjour|salut|hello|hi|coucou)\b/.test(normalized)) {
    return "Salut ! Je suis temporairement en mode limite, mais je peux quand meme t'aider avec Uptime Warden.";
  }

  if (/\b(projet|uptime warden|application)\b/.test(normalized)) {
    return "Uptime Warden est une application de monitoring pour surveiller des services, suivre les incidents, gerer la maintenance, les status pages et les membres de l'equipe.";
  }

  if (/\b(checklist|debug|diagnostic)\b/.test(normalized)) {
    return 'Checklist rapide: verifie la cle Gemini, le backend, la route /api/health, le port 3002, puis relance le frontend.';
  }

  if (/\b(prompt|prompts)\b/.test(normalized)) {
    return 'Tu peux essayer: "Explique Uptime Warden", "Aide-moi a depanner le chatbot", ou "Donne-moi 5 idees de prompts".';
  }

  return 'Gemini est temporairement limite pour le moment. Reessaie plus tard ou demande-moi quelque chose sur Uptime Warden.';
};

const sanitizeGeminiModel = (value: unknown): string => {
  if (typeof value !== 'string') {
    return DEFAULT_GEMINI_MODEL;
  }

  const model = value.trim();
  if (model === '' || model.toLowerCase().startsWith('grok-')) {
    return DEFAULT_GEMINI_MODEL;
  }

  return model;
};

router.post('/chat', async (req: Request, res: Response): Promise<void> => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const messages = normalizeMessages(body.messages);

  if (messages.length === 0) {
    sendJson(res, 400, { error: 'Send at least one user message.' });
    return;
  }

  const lastMessage = messages[messages.length - 1];
  if (!lastMessage || lastMessage.role !== 'user') {
    sendJson(res, 400, { error: 'The last message must come from the user.' });
    return;
  }

  const geminiApiKey = getApiKey();

  const model = sanitizeGeminiModel(body.model);
  const systemInstruction =
    typeof body.systemInstruction === 'string' && body.systemInstruction.trim() !== ''
      ? body.systemInstruction.trim()
      : DEFAULT_SYSTEM_INSTRUCTION;
  const temperature = clampTemperature(body.temperature);

  if (!geminiApiKey) {
    sendJson(res, 500, {
      error: 'Missing AI API key. Set GEMINI_API_KEY (or GOOGLE_API_KEY).',
    });
    return;
  }

  try {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: geminiApiKey });
    const chat = ai.chats.create({
      model,
      config: {
        systemInstruction,
        temperature,
      },
      history: toHistory(messages.slice(0, -1)),
    });

    const stream = await chat.sendMessageStream({
      message: lastMessage.text,
    });

    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });

    for await (const chunk of stream) {
      const text = chunk.text ?? '';
      if (text) {
        res.write(text);
      }
    }
    res.end();
  } catch (error) {
    if (isGeminiQuotaError(error)) {
      res.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end(buildFallbackReply(lastMessage.text));
      return;
    }

    sendJson(res, 500, {
      error: formatGeminiErrorMessage(error),
    });
  }
});

export default router;
