import { Response, Router } from 'express';
import Monitor from '../models/Monitor';
import { authenticate, AuthRequest } from '../middleware/auth';
import monitorService from '../services/monitorService';
import {
  analyzeAssistantChat,
  buildWorkspaceSummary,
  createAssistantSuccessReply,
  generateGenericChatReply,
  type GenericChatOptions,
  type AssistantChatMessage,
  type AssistantMonitorDraft,
} from '../services/assistantService';

const router = Router();

const clampInteger = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, Math.round(value)));

const normalizeMessageArray = (input: unknown): AssistantChatMessage[] => {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .filter((message) => message && typeof message === 'object')
    .map((message): AssistantChatMessage => {
      const record = message as Record<string, unknown>;
      const role: AssistantChatMessage['role'] = record.role === 'assistant' ? 'assistant' : 'user';
      const content = typeof record.content === 'string' ? record.content.trim() : '';
      return { role, content };
    })
    .filter((message) => message.content !== '');
};

const parseGenericChatOptions = (body: Record<string, unknown>): GenericChatOptions => {
  const temperatureValue = Number(body.temperature);

  return {
    model: typeof body.model === 'string' && body.model.trim() !== '' ? body.model.trim() : null,
    temperature: Number.isFinite(temperatureValue) ? temperatureValue : null,
    systemInstruction:
      typeof body.systemInstruction === 'string' && body.systemInstruction.trim() !== ''
        ? body.systemInstruction.trim()
        : null,
  };
};

const buildMonitorPayload = (
  draft: AssistantMonitorDraft,
  ownerId: unknown,
): Record<string, unknown> => {
  const interval = clampInteger(draft.intervalMinutes ?? 5, 1, 1440);
  const timeout = clampInteger(draft.timeoutSeconds ?? 30, 5, 300);
  const normalizedType = draft.type === 'http' || draft.type === 'https' || draft.type === 'ws' || draft.type === 'wss'
    ? draft.type
    : 'https';

  return {
    name: draft.name?.trim() || 'New monitor',
    url: draft.url?.trim() || '',
    type: normalizedType,
    interval,
    timeout,
    httpMethod:
      draft.httpMethod ||
      (normalizedType === 'ws' || normalizedType === 'wss' ? 'GET' : 'HEAD'),
    domainExpiryMode: draft.domainExpiryMode || 'disabled',
    sslExpiryMode: draft.sslExpiryMode || 'disabled',
    owner: ownerId,
  };
};

router.post(
  '/chat',
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const rawMessages = normalizeMessageArray(req.body?.messages);
      const fallbackMessage =
        typeof req.body?.message === 'string' && req.body.message.trim() !== ''
          ? [{ role: 'user' as const, content: req.body.message.trim() }]
          : [];
      const messages = rawMessages.length > 0 ? rawMessages : fallbackMessage;

      if (messages.length === 0) {
        res.status(400).json({ error: 'Le message du chat est requis.' });
        return;
      }

      const mode =
        typeof req.body?.mode === 'string' && req.body.mode.trim() === 'generic'
          ? 'generic'
          : 'assistant';

      if (mode === 'generic') {
        const reply = await generateGenericChatReply(
          messages,
          parseGenericChatOptions((req.body ?? {}) as Record<string, unknown>)
        );

        res.json({
          intent: 'answer',
          reply,
          missingFields: [],
          createdMonitor: null,
          actions: [],
        });
        return;
      }

      const workspace = await buildWorkspaceSummary(req.user!);
      const analysis = await analyzeAssistantChat(messages, workspace);

      if (analysis.intent === 'create_monitor' && analysis.monitor?.url) {
        const monitorPayload = buildMonitorPayload(analysis.monitor, req.user!._id);
        const monitor = new Monitor(monitorPayload);
        await monitor.save();

        if (monitor.domainExpiryMode === 'enabled' || monitor.sslExpiryMode === 'enabled') {
          try {
            await monitorService.refreshSecurityChecks(monitor);
          } catch (error) {
            console.warn('Erreur verification SSL/WHOIS (assistant):', error);
          }
        }

        res.status(201).json({
          intent: 'create_monitor',
          reply: createAssistantSuccessReply({
            name: monitor.name,
            url: monitor.url,
            interval: monitor.interval,
            timeout: monitor.timeout,
            httpMethod: monitor.httpMethod,
            domainExpiryMode: monitor.domainExpiryMode,
            sslExpiryMode: monitor.sslExpiryMode,
          }),
          missingFields: [],
          createdMonitor: monitor,
          actions: [],
        });
        return;
      }

      res.json({
        intent: analysis.intent,
        reply: analysis.reply,
        missingFields: analysis.missingFields,
        createdMonitor: null,
        actions: analysis.actions,
      });
    } catch (error) {
      console.error('Erreur assistant chat:', error);
      res.status(500).json({
        error: 'Erreur lors du traitement du chat',
      });
    }
  },
);

export default router;
