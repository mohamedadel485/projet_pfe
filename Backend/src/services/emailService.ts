import nodemailer from 'nodemailer';

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    const port = parseInt(process.env.EMAIL_PORT || '587', 10);

    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port,
      secure: port === 465,
      requireTLS: port === 587,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
  }

  private getSmtpUser(): string {
    return String(process.env.EMAIL_USER ?? '').trim();
  }

  private getMailFrom(): { name: string; address: string } {
    const smtpUser = this.getSmtpUser();
    const rawFrom = String(process.env.EMAIL_FROM ?? '').trim();
    const cleanedDisplayName = rawFrom
      .replace(/<[^>]+>/g, '')
      .replace(/([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi, '')
      .trim()
      .replace(/^"+|"+$/g, '');

    return {
      name: cleanedDisplayName || 'Uptime Monitor',
      address: smtpUser,
    };
  }

  private ensureSmtpConfigured(): void {
    const required = ['EMAIL_HOST', 'EMAIL_PORT', 'EMAIL_USER', 'EMAIL_PASSWORD', 'EMAIL_FROM'];
    const missing = required.filter((key) => {
      const value = String(process.env[key] ?? '').trim();
      if (value === '') return true;
      if (key === 'EMAIL_PASSWORD' && value === 'REPLACE_WITH_GOOGLE_APP_PASSWORD') return true;
      return false;
    });

    if (missing.length > 0) {
      throw new Error(`Configuration SMTP incomplete: ${missing.join(', ')}`);
    }
  }

  private buildInvitationLink(token: string): string {
    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').trim();
    const baseUrl = frontendUrl.endsWith('/') ? frontendUrl : `${frontendUrl}/`;
    const invitationUrl = new URL('accept-invitation', baseUrl);
    invitationUrl.searchParams.set('token', token);
    return invitationUrl.toString();
  }

  private buildMonitorLink(monitorId: string): string {
    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').trim();
    const baseUrl = frontendUrl.endsWith('/') ? frontendUrl : `${frontendUrl}/`;
    const monitorUrl = new URL(`monitoring/${encodeURIComponent(monitorId)}`, baseUrl);
    return monitorUrl.toString();
  }

  private buildFromAddress(): string {
    const rawFrom = String(process.env.EMAIL_FROM ?? '').trim();
    if (rawFrom === '') return rawFrom;

    if (rawFrom.includes('<') && rawFrom.includes('>')) {
      return rawFrom;
    }

    const match = rawFrom.match(/^(.*?)([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})$/i);
    if (!match) {
      return rawFrom;
    }

    const displayName = match[1]?.trim().replace(/^"+|"+$/g, '') ?? '';
    const email = match[2]?.trim() ?? '';

    if (displayName === '') {
      return email;
    }

    return `${displayName} <${email}>`;
  }

  getInvitationLink(token: string): string {
    return this.buildInvitationLink(token);
  }

  private buildInvitationText(inviterName: string, invitationLink: string): string {
    return [
      'You have been invited to join Uptime Monitor.',
      '',
      `${inviterName} invited you to join the Uptime Monitor app.`,
      'Use this link to accept the invitation and create your account:',
      invitationLink,
      '',
      'This invitation expires in 7 days.',
    ].join('\n');
  }

  private buildMonitorAccessText(
    recipientName: string,
    monitorName: string,
    monitorLink: string,
    grantedByName?: string
  ): string {
    return [
      `Hello ${recipientName},`,
      '',
      `You now have access to the monitor ${monitorName}.`,
      grantedByName ? `Granted by: ${grantedByName}.` : null,
      'Open the monitor here:',
      monitorLink,
      '',
      'If you were not expecting this access, you can ignore this email.',
    ]
      .filter(Boolean)
      .join('\n');
  }

  private buildPasswordResetText(userName: string | undefined, resetCode: string): string {
    return [
      `Hello${userName ? ` ${userName}` : ''},`,
      '',
      'Here is your password reset code:',
      resetCode,
      '',
      'This code expires in 10 minutes.',
    ].join('\n');
  }

  private buildMonitorAlertText(monitorName: string, url: string, errorMessage?: string): string {
    return [
      'Monitor down alert',
      '',
      `Monitor: ${monitorName}`,
      `URL: ${url}`,
      errorMessage ? `Error: ${errorMessage}` : null,
      '',
      'This email was sent automatically by Uptime Monitor.',
    ]
      .filter(Boolean)
      .join('\n');
  }

  /**
   * Envoie un email d'invitation
   */
  async sendInvitation(
    email: string,
    token: string,
    inviterName: string
  ): Promise<void> {
    this.ensureSmtpConfigured();

    const invitationLink = this.buildInvitationLink(token);
    const fromAddress = this.getMailFrom();
    const smtpUser = this.getSmtpUser();
    const recipientEmail = email.trim().toLowerCase();

    const mailOptions = {
      from: fromAddress,
      replyTo: smtpUser,
      envelope: {
        from: smtpUser,
        to: recipientEmail,
      },
      to: recipientEmail,
      subject: 'Invitation a rejoindre Uptime Monitor',
      text: this.buildInvitationText(inviterName, invitationLink),
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">You are invited!</h2>
          <p>Hello,</p>
          <p><strong>${inviterName}</strong> invited you to join the Uptime Monitor app.</p>
          <p>Click the button below to accept the invitation and create your account:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${invitationLink}"
               style="background-color: #4CAF50; color: white; padding: 14px 28px;
                      text-decoration: none; border-radius: 4px; display: inline-block;">
              Accept invitation
            </a>
          </div>
          <p style="color: #666; font-size: 12px;">
            Or copy this link into your browser:<br>
            <a href="${invitationLink}">${invitationLink}</a>
          </p>
          <p style="color: #666; font-size: 12px;">
            This invitation expires in 7 days.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #999; font-size: 11px;">
            If you did not request this invitation, you can ignore this email.
          </p>
        </div>
      `,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      const accepted = Array.isArray(info.accepted) ? info.accepted : [];
      const rejected = Array.isArray(info.rejected) ? info.rejected : [];

      console.log(
        `Invitation mail sent to ${email} | accepted=${accepted.join(', ') || '-'} | rejected=${rejected.join(', ') || '-'}`
      );
    } catch (error) {
      console.error('Erreur lors de l\'envoi de l\'email:', error);
      throw new Error('Erreur lors de l\'envoi de l\'email d\'invitation');
    }
  }

  /**
   * Envoie un email de notification pour un acces a un monitor deja partage
   */
  async sendMonitorAccessNotification(
    email: string,
    recipientName: string,
    monitorName: string,
    monitorId: string,
    grantedByName?: string
  ): Promise<void> {
    this.ensureSmtpConfigured();

    const monitorLink = this.buildMonitorLink(monitorId);
    const fromAddress = this.getMailFrom();
    const smtpUser = this.getSmtpUser();
    const recipientEmail = email.trim().toLowerCase();

    const mailOptions = {
      from: fromAddress,
      replyTo: smtpUser,
      envelope: {
        from: smtpUser,
        to: recipientEmail,
      },
      to: recipientEmail,
      subject: `Acces au monitor ${monitorName}`,
      text: this.buildMonitorAccessText(recipientName, monitorName, monitorLink, grantedByName),
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Access granted</h2>
          <p>Hello ${recipientName},</p>
          <p>You now have access to the monitor <strong>${monitorName}</strong>.</p>
          ${
            grantedByName
              ? `<p style="color: #666; font-size: 13px;">Granted by: ${grantedByName}</p>`
              : ''
          }
          <div style="text-align: center; margin: 30px 0;">
            <a href="${monitorLink}"
               style="background-color: #4CAF50; color: white; padding: 14px 28px;
                      text-decoration: none; border-radius: 4px; display: inline-block;">
              Open monitor
            </a>
          </div>
          <p style="color: #666; font-size: 12px;">
            Or copy this link into your browser:<br>
            <a href="${monitorLink}">${monitorLink}</a>
          </p>
          <p style="color: #666; font-size: 12px;">
            If you were not expecting this access, you can ignore this email.
          </p>
        </div>
      `,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      const accepted = Array.isArray(info.accepted) ? info.accepted : [];
      const rejected = Array.isArray(info.rejected) ? info.rejected : [];

      console.log(
        `Monitor access mail sent to ${email} | accepted=${accepted.join(', ') || '-'} | rejected=${rejected.join(', ') || '-'}`
      );
    } catch (error) {
      console.error('Erreur lors de l\'envoi de la notification d\'accès au monitor:', error);
      throw new Error('Erreur lors de l\'envoi de la notification d\'accès au monitor');
    }
  }

  /**
   * Envoie le code de reinitialisation du mot de passe
   */
  async sendPasswordResetCode(email: string, resetCode: string, userName?: string): Promise<void> {
    this.ensureSmtpConfigured();

    const fromAddress = this.getMailFrom();
    const smtpUser = this.getSmtpUser();
    const recipientEmail = email.trim().toLowerCase();
    const mailOptions = {
      from: fromAddress,
      replyTo: smtpUser,
      envelope: {
        from: smtpUser,
        to: recipientEmail,
      },
      to: recipientEmail,
      subject: 'Code de reinitialisation de mot de passe',
      text: this.buildPasswordResetText(userName, resetCode),
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Reinitialisation du mot de passe</h2>
          <p>Bonjour${userName ? ` ${userName}` : ''},</p>
          <p>Voici votre code de verification :</p>
          <div style="text-align: center; margin: 24px 0;">
            <span style="font-size: 30px; font-weight: 700; letter-spacing: 8px; color: #1f4aa8;">
              ${resetCode}
            </span>
          </div>
          <p>Ce code expire dans 10 minutes.</p>
          <p style="color: #666; font-size: 12px;">
            Si vous n'etes pas a l'origine de cette demande, ignorez simplement cet email.
          </p>
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`Code de reinitialisation envoye a ${email}`);
    } catch (error) {
      console.error('Erreur lors de l\'envoi du code de reinitialisation:', error);
      throw new Error('Erreur lors de l\'envoi du code de reinitialisation');
    }
  }

  /**
   * Envoie une alerte pour un monitor down
   */
  async sendMonitorAlert(
    email: string,
    monitorName: string,
    url: string,
    errorMessage?: string
  ): Promise<void> {
    const fromAddress = this.getMailFrom();
    const smtpUser = this.getSmtpUser();
    const recipientEmail = email.trim().toLowerCase();
    const mailOptions = {
      from: fromAddress,
      replyTo: smtpUser,
      envelope: {
        from: smtpUser,
        to: recipientEmail,
      },
      to: recipientEmail,
      subject: `Alerte: ${monitorName} est DOWN`,
      text: this.buildMonitorAlertText(monitorName, url, errorMessage),
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #f44336;">Monitor Down</h2>
          <p>Le monitor <strong>${monitorName}</strong> est actuellement indisponible.</p>
          <div style="background-color: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0;">
            <p style="margin: 0;"><strong>URL:</strong> ${url}</p>
            ${errorMessage ? `<p style="margin: 10px 0 0 0;"><strong>Erreur:</strong> ${errorMessage}</p>` : ''}
          </div>
          <p style="color: #666; font-size: 12px;">
            Cet email a ete envoye automatiquement par Uptime Monitor.
          </p>
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`Alerte envoyee a ${email} pour ${monitorName}`);
    } catch (error) {
      console.error('Erreur lors de l\'envoi de l\'alerte:', error);
    }
  }
}

export default new EmailService();
