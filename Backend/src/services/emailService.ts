import nodemailer from 'nodemailer';

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
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
      throw new Error(`Configuration SMTP incomplète: ${missing.join(', ')}`);
    }
  }

  private buildInvitationLink(token: string): string {
    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').trim();
    const baseUrl = frontendUrl.endsWith('/') ? frontendUrl : `${frontendUrl}/`;
    const invitationUrl = new URL('accept-invitation', baseUrl);
    invitationUrl.searchParams.set('token', token);
    return invitationUrl.toString();
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

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: 'Invitation à rejoindre Uptime Monitor',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Vous êtes invité!</h2>
          <p>Bonjour,</p>
          <p><strong>${inviterName}</strong> vous invite à rejoindre l'application Uptime Monitor.</p>
          <p>Cliquez sur le bouton ci-dessous pour accepter l'invitation et créer votre compte:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${invitationLink}" 
               style="background-color: #4CAF50; color: white; padding: 14px 28px; 
                      text-decoration: none; border-radius: 4px; display: inline-block;">
              Accepter l'invitation
            </a>
          </div>
          <p style="color: #666; font-size: 12px;">
            Ou copiez ce lien dans votre navigateur:<br>
            <a href="${invitationLink}">${invitationLink}</a>
          </p>
          <p style="color: #666; font-size: 12px;">
            Cette invitation expirera dans 7 jours.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #999; font-size: 11px;">
            Si vous n'avez pas demandé cette invitation, vous pouvez ignorer cet email.
          </p>
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`Email d'invitation envoyé à ${email}`);
    } catch (error) {
      console.error('Erreur lors de l\'envoi de l\'email:', error);
      throw new Error('Erreur lors de l\'envoi de l\'email d\'invitation');
    }
  }

  /**
   * Envoie le code de reinitialisation du mot de passe
   */
  async sendPasswordResetCode(email: string, resetCode: string, userName?: string): Promise<void> {
    this.ensureSmtpConfigured();

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: 'Code de reinitialisation de mot de passe',
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
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: `🔴 Alerte: ${monitorName} est DOWN`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #f44336;">⚠️ Monitor Down</h2>
          <p>Le monitor <strong>${monitorName}</strong> est actuellement indisponible.</p>
          <div style="background-color: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0;">
            <p style="margin: 0;"><strong>URL:</strong> ${url}</p>
            ${errorMessage ? `<p style="margin: 10px 0 0 0;"><strong>Erreur:</strong> ${errorMessage}</p>` : ''}
          </div>
          <p style="color: #666; font-size: 12px;">
            Cet email a été envoyé automatiquement par Uptime Monitor.
          </p>
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`Alerte envoyée à ${email} pour ${monitorName}`);
    } catch (error) {
      console.error('Erreur lors de l\'envoi de l\'alerte:', error);
    }
  }
}

export default new EmailService();
