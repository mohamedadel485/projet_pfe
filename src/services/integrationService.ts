import axios from 'axios';
import Integration, { IntegrationEvent, IIntegration } from '../models/Integration';
import { IMonitor } from '../models/Monitor';

interface CheckResultLike {
  status: 'up' | 'down';
  responseTime: number;
  statusCode?: number;
  errorMessage?: string;
}

interface MonitorStatusChangePayload {
  monitor: IMonitor;
  previousStatus: 'up' | 'down';
  result: CheckResultLike;
}

interface IntegrationNotification {
  event: 'monitor.up' | 'monitor.down' | 'integration.test';
  sentAt: string;
  message: string;
  severity: 'critical' | 'success' | 'info';
  monitor?: {
    id: string;
    name: string;
    url: string;
    type: string;
    previousStatus?: 'up' | 'down';
    currentStatus?: 'up' | 'down';
    responseTime?: number;
    expectedStatusCode?: number;
    httpMethod?: string;
    interval?: number;
    timeout?: number;
    uptime?: number;
  };
  check?: {
    responseTime?: number;
    statusCode?: number;
    errorMessage?: string;
    checkedAt?: string;
  };
}

class IntegrationService {
  private static readonly DISCORD_WEBHOOK_PATTERN =
    /^https?:\/\/(?:canary\.|ptb\.)?discord(?:app)?\.com\/api\/webhooks\//i;
  private static readonly SLACK_WEBHOOK_PATTERN = /^https?:\/\/hooks\.slack\.com\/services\//i;

  private isDiscordWebhook(endpointUrl: string): boolean {
    return IntegrationService.DISCORD_WEBHOOK_PATTERN.test(endpointUrl);
  }

  private isSlackWebhook(endpointUrl: string): boolean {
    return IntegrationService.SLACK_WEBHOOK_PATTERN.test(endpointUrl);
  }

  private buildGenericPayload(integration: IIntegration, notification: IntegrationNotification): Record<string, unknown> {
    return {
      event: notification.event,
      sentAt: notification.sentAt,
      severity: notification.severity,
      message: notification.message,
      monitor: notification.monitor ?? null,
      check: notification.check ?? null,
      integration: {
        id: integration._id.toString(),
        type: integration.type,
        customValue: integration.customValue ?? null,
      },
    };
  }

  private buildDiscordPayload(integration: IIntegration, notification: IntegrationNotification): Record<string, unknown> {
    const color =
      notification.severity === 'critical' ? 15158332 : notification.severity === 'success' ? 3066993 : 3447003;

    const monitorFields = notification.monitor
      ? [
          { name: 'Monitor', value: notification.monitor.name, inline: true },
          { name: 'URL', value: notification.monitor.url, inline: false },
          {
            name: 'Status',
            value:
              notification.monitor.currentStatus && notification.monitor.previousStatus
                ? `${notification.monitor.previousStatus.toUpperCase()} -> ${notification.monitor.currentStatus.toUpperCase()}`
                : notification.monitor.currentStatus?.toUpperCase() ?? '-',
            inline: true,
          },
          {
            name: 'Response time',
            value:
              typeof notification.monitor.responseTime === 'number'
                ? `${notification.monitor.responseTime} ms`
                : '-',
            inline: true,
          },
        ]
      : [];

    if (integration.customValue && integration.customValue.trim() !== '') {
      monitorFields.push({ name: 'Custom value', value: integration.customValue.trim(), inline: false });
    }

    return {
      content: notification.message,
      embeds: [
        {
          title: notification.event === 'integration.test' ? 'Integration test' : 'Monitor event',
          color,
          timestamp: notification.sentAt,
          fields: monitorFields,
          footer: {
            text: `UptimeWarden - ${integration.type}`,
          },
        },
      ],
    };
  }

  private buildSlackPayload(integration: IIntegration, notification: IntegrationNotification): Record<string, unknown> {
    const statusLabel =
      notification.severity === 'critical' ? 'danger' : notification.severity === 'success' ? 'good' : '#2f6feb';

    const baseFields = [];
    if (notification.monitor) {
      baseFields.push(
        {
          type: 'mrkdwn',
          text: `*Monitor*\n${notification.monitor.name}`,
        },
        {
          type: 'mrkdwn',
          text: `*Status*\n${
            notification.monitor.currentStatus
              ? notification.monitor.currentStatus.toUpperCase()
              : notification.severity.toUpperCase()
          }`,
        }
      );
      if (notification.monitor.url) {
        baseFields.push({
          type: 'mrkdwn',
          text: `*URL*\n${notification.monitor.url}`,
        });
      }
    }

    if (integration.customValue && integration.customValue.trim() !== '') {
      baseFields.push({
        type: 'mrkdwn',
        text: `*Custom value*\n${integration.customValue.trim()}`,
      });
    }

    return {
      text: notification.message,
      attachments: [
        {
          color: statusLabel,
          fields: baseFields,
          footer: 'UptimeWarden',
          ts: Math.floor(new Date(notification.sentAt).getTime() / 1000),
        },
      ],
    };
  }

  private buildPayloadForIntegration(
    integration: IIntegration,
    notification: IntegrationNotification
  ): Record<string, unknown> {
    if (this.isDiscordWebhook(integration.endpointUrl)) {
      return this.buildDiscordPayload(integration, notification);
    }

    if (integration.type === 'slack' || this.isSlackWebhook(integration.endpointUrl)) {
      return this.buildSlackPayload(integration, notification);
    }

    return this.buildGenericPayload(integration, notification);
  }

  private async postToIntegration(
    integration: IIntegration,
    notification: IntegrationNotification
  ): Promise<boolean> {
    const payload = this.buildPayloadForIntegration(integration, notification);

    try {
      const response = await axios.post(integration.endpointUrl, payload, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'UptimeWarden/1.0',
        },
        validateStatus: () => true,
      });

      if (response.status >= 400) {
        console.error(
          `Echec envoi webhook integration ${integration._id} (HTTP ${response.status}) vers ${integration.endpointUrl}`
        );
        return false;
      }

      return true;
    } catch (error: any) {
      console.error(
        `Erreur envoi webhook integration ${integration._id} vers ${integration.endpointUrl}:`,
        error?.message || error
      );
      return false;
    }
  }

  private async notifyIntegrations(
    integrations: IIntegration[],
    notification: IntegrationNotification
  ): Promise<void> {
    if (integrations.length === 0) {
      return;
    }

    await Promise.all(
      integrations.map(async (integration) => {
        const isSent = await this.postToIntegration(integration, notification);
        if (!isSent) return;

        integration.lastTriggeredAt = new Date();
        await integration.save();
      })
    );
  }

  async notifyMonitorStatusChange(payload: MonitorStatusChangePayload): Promise<void> {
    const event: IntegrationEvent = payload.result.status;
    const recipientUserIds = Array.from(
      new Set([
        payload.monitor.owner.toString(),
        ...(payload.monitor.sharedWith ?? []).map((userId) => userId.toString()),
      ])
    );

    const integrations = await Integration.find({
      owner: { $in: recipientUserIds },
      isActive: true,
      events: event,
    });

    if (integrations.length === 0) {
      return;
    }

    const sentAt = new Date().toISOString();
    const monitorStatusEvent = payload.result.status === 'down' ? 'monitor.down' : 'monitor.up' as const;
    const statusText = payload.result.status === 'down' ? 'DOWN' : 'UP';
    const statusEmoji = payload.result.status === 'down' ? '🔴' : '🟢';

    const notification: IntegrationNotification = {
      event: monitorStatusEvent,
      sentAt,
      severity: payload.result.status === 'down' ? 'critical' : 'success',
      message: `${statusEmoji} ${payload.monitor.name} is ${statusText} (${payload.monitor.url})`,
      monitor: {
        id: payload.monitor._id.toString(),
        name: payload.monitor.name,
        url: payload.monitor.url,
        type: payload.monitor.type,
        previousStatus: payload.previousStatus,
        currentStatus: payload.result.status,
        responseTime: payload.result.responseTime,
        expectedStatusCode: payload.monitor.expectedStatusCode,
        httpMethod: payload.monitor.httpMethod,
        interval: payload.monitor.interval,
        timeout: payload.monitor.timeout,
        uptime: payload.monitor.uptime,
      },
      check: {
        responseTime: payload.result.responseTime,
        statusCode: payload.result.statusCode,
        errorMessage: payload.result.errorMessage,
        checkedAt: payload.monitor.lastChecked?.toISOString() ?? sentAt,
      },
    };

    await this.notifyIntegrations(integrations, notification);
  }

  async sendIntegrationTest(integration: IIntegration): Promise<void> {
    const notification: IntegrationNotification = {
      event: 'integration.test',
      sentAt: new Date().toISOString(),
      severity: 'info',
      message: '🔔 UptimeWarden test notification: integration is connected.',
    };

    await this.notifyIntegrations([integration], notification);
  }
}

export default new IntegrationService();
