import nodemailer from "nodemailer";

export class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  private getTransporter(): nodemailer.Transporter {
    this.ensureSmtpConfigured();

    if (!this.transporter) {
      const port = parseInt(process.env.EMAIL_PORT || "587", 10);
      const smtpUser = String(process.env.EMAIL_USER ?? "").trim();
      // Gmail App Passwords are often copied with spaces (xxxx xxxx xxxx xxxx).
      // Nodemailer expects the raw password without spaces.
      const smtpPass = String(process.env.EMAIL_PASSWORD ?? "")
        .replace(/\s+/g, "")
        .trim();

      this.transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port,
        secure: port === 465,
        requireTLS: port === 587,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });
    }

    return this.transporter;
  }

  private getSmtpUser(): string {
    return String(process.env.EMAIL_USER ?? "").trim();
  }

  private getMailFrom(): { name: string; address: string } {
    const smtpUser = this.getSmtpUser();
    const rawFrom = String(process.env.EMAIL_FROM ?? "").trim();
    const cleanedDisplayName = rawFrom
      .replace(/<[^>]+>/g, "")
      .replace(/([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi, "")
      .trim()
      .replace(/^"+|"+$/g, "");

    return {
      name: cleanedDisplayName || "Uptime Monitor",
      address: smtpUser,
    };
  }

  private ensureSmtpConfigured(): void {
    const required = [
      "EMAIL_HOST",
      "EMAIL_PORT",
      "EMAIL_USER",
      "EMAIL_PASSWORD",
      "EMAIL_FROM",
    ];
    const missing = required.filter((key) => {
      const value = String(process.env[key] ?? "").trim();
      if (value === "") return true;
      if (
        key === "EMAIL_PASSWORD" &&
        value === "REPLACE_WITH_GOOGLE_APP_PASSWORD"
      )
        return true;
      return false;
    });

    if (missing.length > 0) {
      throw new Error(`Configuration SMTP incomplete: ${missing.join(", ")}`);
    }
  }

  private buildInvitationLink(token: string): string {
    const frontendUrl = (
      process.env.FRONTEND_URL || "http://localhost:5173"
    ).trim();
    const baseUrl = frontendUrl.endsWith("/") ? frontendUrl : `${frontendUrl}/`;
    const invitationUrl = new URL("accept-invitation", baseUrl);
    invitationUrl.searchParams.set("token", token);
    return invitationUrl.toString();
  }

  private buildMonitorLink(monitorId: string): string {
    const frontendUrl = (
      process.env.FRONTEND_URL || "http://localhost:5173"
    ).trim();
    const baseUrl = frontendUrl.endsWith("/") ? frontendUrl : `${frontendUrl}/`;
    const monitorUrl = new URL(
      `monitoring/${encodeURIComponent(monitorId)}`,
      baseUrl,
    );
    return monitorUrl.toString();
  }

  private buildFromAddress(): string {
    const rawFrom = String(process.env.EMAIL_FROM ?? "").trim();
    if (rawFrom === "") return rawFrom;

    if (rawFrom.includes("<") && rawFrom.includes(">")) {
      return rawFrom;
    }

    const match = rawFrom.match(
      /^(.*?)([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})$/i,
    );
    if (!match) {
      return rawFrom;
    }

    const displayName = match[1]?.trim().replace(/^"+|"+$/g, "") ?? "";
    const email = match[2]?.trim() ?? "";

    if (displayName === "") {
      return email;
    }

    return `${displayName} <${email}>`;
  }

  getInvitationLink(token: string): string {
    return this.buildInvitationLink(token);
  }

  private buildInvitationText(
    inviterName: string,
    invitationLink: string,
  ): string {
    return [
      "You have been invited to join Uptime Monitor.",
      "",
      `${inviterName} invited you to join the Uptime Monitor app.`,
      "Use this link to accept the invitation and create your account:",
      invitationLink,
      "",
      "This invitation expires in 7 days.",
    ].join("\n");
  }

  private buildMonitorAccessText(
    recipientName: string,
    monitorName: string,
    monitorLink: string,
    grantedByName?: string,
  ): string {
    return [
      `Hello ${recipientName},`,
      "",
      `You now have access to the monitor ${monitorName}.`,
      grantedByName ? `Granted by: ${grantedByName}.` : null,
      "Open the monitor here:",
      monitorLink,
      "",
      "If you were not expecting this access, you can ignore this email.",
    ]
      .filter(Boolean)
      .join("\n");
  }

  private buildPasswordResetText(
    userName: string | undefined,
    resetCode: string,
  ): string {
    return [
      `Hello${userName ? ` ${userName}` : ""},`,
      "",
      "Here is your password reset code:",
      resetCode,
      "",
      "This code expires in 10 minutes.",
    ].join("\n");
  }

  private buildLoginOtpText(
    userName: string | undefined,
    otpCode: string,
  ): string {
    const expireMinutes = Number(process.env.LOGIN_OTP_EXPIRE_MINUTES ?? 10);
    return [
      `Bonjour${userName ? ` ${userName}` : ""},`,
      "",
      "Voici votre code de connexion à Uptime Monitor :",
      otpCode,
      "",
      `Ce code expire dans ${expireMinutes} minute${expireMinutes > 1 ? "s" : ""}.`,
      "",
      "Si vous n'êtes pas à l'origine de cette demande, ignorez cet email ou contactez votre administrateur.",
    ].join("\n");
  }

  private buildMonitorAlertText(
    monitorName: string,
    url: string,
    status: "up" | "down",
    previousStatus: "up" | "down",
    errorMessage?: string,
    responseTime?: number,
  ): string {
    const statusLabel = status === "down" ? "DOWN" : "UP";
    const previousLabel = previousStatus === "down" ? "DOWN" : "UP";

    return [
      `Alerte monitor: ${monitorName} est ${statusLabel}`,
      "",
      `Monitor: ${monitorName}`,
      `URL: ${url}`,
      `Changement: ${previousLabel} -> ${statusLabel}`,
      typeof responseTime === "number"
        ? `Temps de reponse: ${responseTime} ms`
        : null,
      errorMessage ? `Erreur: ${errorMessage}` : null,
      "",
      "Cet email a ete envoye automatiquement par Uptime Monitor.",
    ]
      .filter(Boolean)
      .join("\n");
  }

  /**
   * Envoie un email d'invitation
   */
  async sendInvitation(
    email: string,
    token: string,
    inviterName: string,
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
      subject: "Invitation a rejoindre Uptime Monitor",
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
      const info = await this.getTransporter().sendMail(mailOptions);
      const accepted = Array.isArray(info.accepted) ? info.accepted : [];
      const rejected = Array.isArray(info.rejected) ? info.rejected : [];

      console.log(
        `Invitation mail sent to ${email} | accepted=${accepted.join(", ") || "-"} | rejected=${rejected.join(", ") || "-"}`,
      );
    } catch (error) {
      console.error("Erreur lors de l'envoi de l'email:", error);
      throw new Error("Erreur lors de l'envoi de l'email d'invitation");
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
    grantedByName?: string,
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
      text: this.buildMonitorAccessText(
        recipientName,
        monitorName,
        monitorLink,
        grantedByName,
      ),
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Access granted</h2>
          <p>Hello ${recipientName},</p>
          <p>You now have access to the monitor <strong>${monitorName}</strong>.</p>
          ${
            grantedByName
              ? `<p style="color: #666; font-size: 13px;">Granted by: ${grantedByName}</p>`
              : ""
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
      const info = await this.getTransporter().sendMail(mailOptions);
      const accepted = Array.isArray(info.accepted) ? info.accepted : [];
      const rejected = Array.isArray(info.rejected) ? info.rejected : [];

      console.log(
        `Monitor access mail sent to ${email} | accepted=${accepted.join(", ") || "-"} | rejected=${rejected.join(", ") || "-"}`,
      );
    } catch (error) {
      console.error(
        "Erreur lors de l'envoi de la notification d'accès au monitor:",
        error,
      );
      throw new Error(
        "Erreur lors de l'envoi de la notification d'accès au monitor",
      );
    }
  }

  /**
   * Envoie le code de reinitialisation du mot de passe
   */
  async sendPasswordResetCode(
    email: string,
    resetCode: string,
    userName?: string,
  ): Promise<void> {
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
      subject: "Code de reinitialisation de mot de passe",
      text: this.buildPasswordResetText(userName, resetCode),
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Reinitialisation du mot de passe</h2>
          <p>Bonjour${userName ? ` ${userName}` : ""},</p>
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
      await this.getTransporter().sendMail(mailOptions);
      console.log(`Code de reinitialisation envoye a ${email}`);
    } catch (error) {
      console.error(
        "Erreur lors de l'envoi du code de reinitialisation:",
        error,
      );
      throw new Error("Erreur lors de l'envoi du code de reinitialisation");
    }
  }

  /**
   * Envoie le code OTP de connexion
   */
  async sendLoginOtpCode(
    email: string,
    otpCode: string,
    userName?: string,
  ): Promise<void> {
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
      subject: "Code de connexion — Uptime Monitor",
      text: this.buildLoginOtpText(userName, otpCode),
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Code de connexion</h2>
          <p>Bonjour${userName ? ` ${userName}` : ""},</p>
          <p>Voici votre code de connexion à <strong>Uptime Monitor</strong> :</p>
          <div style="text-align: center; margin: 24px 0;">
            <span style="display:inline-block; font-size: 36px; font-weight: 700; letter-spacing: 6px; color: #1f4aa8; padding: 8px 18px; border: 1px solid #e6eef9; border-radius: 6px; background: #f6fbff;">
              ${otpCode}
            </span>
          </div>
          <p>Ce code expire dans ${process.env.LOGIN_OTP_EXPIRE_MINUTES ?? 10} minutes.</p>
          <p style="color: #666; font-size: 13px; margin-top: 16px;">
            Retournez simplement sur la page de connexion et saisissez ce code.
          </p>
          <p style="color: #666; font-size: 12px; margin-top: 16px;">
            Si vous n'êtes pas à l'origine de cette demande, ignorez cet email ou contactez votre administrateur.
          </p>
        </div>
      `,
    };

    try {
      await this.getTransporter().sendMail(mailOptions);
      console.log(`Code OTP de connexion envoye a ${email}`);
    } catch (error) {
      console.error("Erreur lors de l'envoi du code OTP de connexion:", error);
      throw new Error("Erreur lors de l'envoi du code OTP de connexion");
    }
  }

  /**
   * Envoie une alerte email lors d'un changement d'etat du monitor
   */
  async sendMonitorAlert(
    email: string,
    monitorName: string,
    url: string,
    status: "up" | "down",
    previousStatus: "up" | "down",
    errorMessage?: string,
    responseTime?: number,
  ): Promise<void> {
    this.ensureSmtpConfigured();

    const fromAddress = this.getMailFrom();
    const smtpUser = this.getSmtpUser();
    const recipientEmail = email.trim().toLowerCase();
    const isDown = status === "down";
    const statusLabel = isDown ? "DOWN" : "UP";
    const previousLabel = previousStatus === "down" ? "DOWN" : "UP";
    const accentColor = isDown ? "#f44336" : "#2e7d32";
    const mailOptions = {
      from: fromAddress,
      replyTo: smtpUser,
      envelope: {
        from: smtpUser,
        to: recipientEmail,
      },
      to: recipientEmail,
      subject: `Alerte: ${monitorName} est ${statusLabel}`,
      text: this.buildMonitorAlertText(
        monitorName,
        url,
        status,
        previousStatus,
        errorMessage,
        responseTime,
      ),
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: ${accentColor};">Monitor ${statusLabel}</h2>
          <p>Le monitor <strong>${monitorName}</strong> est passe de <strong>${previousLabel}</strong> a <strong>${statusLabel}</strong>.</p>
          <div style="background-color: ${isDown ? "#fff3cd" : "#e8f5e9"}; padding: 15px; border-left: 4px solid ${accentColor}; margin: 20px 0;">
            <p style="margin: 0;"><strong>URL:</strong> ${url}</p>
            ${
              typeof responseTime === "number"
                ? `<p style="margin: 10px 0 0 0;"><strong>Temps de reponse:</strong> ${responseTime} ms</p>`
                : ""
            }
            ${errorMessage ? `<p style="margin: 10px 0 0 0;"><strong>Erreur:</strong> ${errorMessage}</p>` : ""}
          </div>
          <p style="color: #666; font-size: 12px;">
            Cet email a ete envoye automatiquement par Uptime Monitor.
          </p>
        </div>
      `,
    };

    try {
      await this.getTransporter().sendMail(mailOptions);
      console.log(
        `Alerte ${statusLabel} envoyee a ${email} pour ${monitorName}`,
      );
    } catch (error) {
      console.error("Erreur lors de l'envoi de l'alerte:", error);
      throw error;
    }
  }

  /**
   * Envoie une notification au super admin pour une demande de creation de compte
   */
  async sendAccountRequestEmail({
    to,
    requesterEmail,
    requesterName,
    requesterMessage,
  }: {
    to: string;
    requesterEmail: string;
    requesterName: string;
    requesterMessage?: string;
  }): Promise<void> {
    this.ensureSmtpConfigured();

    const fromAddress = this.getMailFrom();

    const subject = "Nouvelle demande de creation de compte - Monitoring";

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1c57bb; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">
          Nouvelle demande de creation de compte
        </h2>

        <p style="color: #334865; font-size: 15px; line-height: 1.6;">
          Un utilisateur a soumis une demande pour creer un compte sur la plateforme Monitoring.
        </p>

        <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <h3 style="color: #1e293b; margin-top: 0;">Informations du demandeur :</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #64748b; width: 100px;"><strong>Nom :</strong></td>
              <td style="padding: 8px 0; color: #1e293b;">${requesterName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b;"><strong>Email :</strong></td>
              <td style="padding: 8px 0; color: #1e293b;">${requesterEmail}</td>
            </tr>
          </table>

          ${
            requesterMessage
              ? `
          <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e2e8f0;">
            <strong style="color: #64748b;">Message du demandeur :</strong>
            <p style="color: #475569; font-style: italic; margin-top: 8px;">
              "${requesterMessage}"
            </p>
          </div>
          `
              : ""
          }
        </div>

        <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <p style="color: #92400e; margin: 0; font-size: 14px;">
            <strong>Action requise :</strong> Connectez-vous a l'application pour accepter ou refuser cette demande.
          </p>
        </div>

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">

        <p style="color: #94a3b8; font-size: 12px; text-align: center;">
          Cet email a ete genere automatiquement par la plateforme Monitoring.
        </p>
      </div>
    `;

    const textContent = `
Nouvelle demande de creation de compte - Monitoring

Un utilisateur a soumis une demande pour creer un compte sur la plateforme.

Informations du demandeur :
- Nom : ${requesterName}
- Email : ${requesterEmail}
${requesterMessage ? `- Message : "${requesterMessage}"\n` : ""}

Action requise : Connectez-vous a l'application pour accepter ou refuser cette demande.
    `;

    const mailOptions: nodemailer.SendMailOptions = {
      from: fromAddress,
      to,
      subject,
      text: textContent,
      html: htmlContent,
    };

    try {
      await this.getTransporter().sendMail(mailOptions);
      console.log(`Notification de demande de compte envoyee a ${to}`);
    } catch (error) {
      console.error(
        "Erreur lors de l'envoi de la notification de demande:",
        error,
      );
      throw error;
    }
  }

  async sendAccountApprovedEmail({
    to,
    name,
    email,
    tempPassword,
  }: {
    to: string;
    name: string;
    email: string;
    tempPassword: string;
  }): Promise<void> {
    this.ensureSmtpConfigured();

    const fromAddress = this.buildFromAddress();
    const subject = "Votre demande de compte a été approuvée - Uptime Monitor";

    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px 20px; color: #334155;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h2 style="color: #1e3a8a; margin: 0;">Uptime Monitor</h2>
        </div>

        <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <h3 style="color: #15803d; margin: 0 0 10px 0;">Bonne nouvelle ! 🎉</h3>
          <p style="margin: 0; color: #166534;">Votre demande de création de compte a été approuvée.</p>
        </div>

        <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
          Bonjour ${name},
        </p>

        <p style="font-size: 15px; line-height: 1.6; margin-bottom: 20px;">
          Votre compte a été créé avec succès. Voici vos informations de connexion :
        </p>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #64748b; width: 120px;"><strong>Email :</strong></td>
              <td style="padding: 8px 0; color: #1e293b;">${email}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b;"><strong>Mot de passe :</strong></td>
              <td style="padding: 8px 0; color: #1e293b; font-family: monospace; background: #fef3c7; padding: 4px 8px; border-radius: 4px;">${tempPassword}</td>
            </tr>
          </table>
        </div>

        <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <p style="color: #92400e; margin: 0; font-size: 14px;">
            <strong>Important :</strong> Pour des raisons de sécurité, veuillez changer votre mot de passe dès votre première connexion.
          </p>
        </div>

        <p style="font-size: 15px; line-height: 1.6; margin-top: 20px;">
          <a href="${process.env.FRONTEND_URL || "http://localhost:5173"}/login" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">Se connecter</a>
        </p>

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">

        <p style="color: #94a3b8; font-size: 12px; text-align: center;">
          Cet email a été généré automatiquement par la plateforme Uptime Monitor.<br>
          Si vous n'avez pas fait cette demande, veuillez ignorer cet email.
        </p>
      </div>
    `;

    const textContent = `
Votre demande de compte a été approuvée - Uptime Monitor

Bonjour ${name},

Votre demande de création de compte a été approuvée.

Voici vos informations de connexion :
- Email : ${email}
- Mot de passe temporaire : ${tempPassword}

IMPORTANT : Pour des raisons de sécurité, veuillez changer votre mot de passe dès votre première connexion.

Connectez-vous ici : ${process.env.FRONTEND_URL || "http://localhost:5173"}/login

---
Cet email a été généré automatiquement par la plateforme Uptime Monitor.
Si vous n'avez pas fait cette demande, veuillez ignorer cet email.
    `;

    const mailOptions: nodemailer.SendMailOptions = {
      from: fromAddress,
      to,
      subject,
      text: textContent,
      html: htmlContent,
    };

    try {
      await this.getTransporter().sendMail(mailOptions);
      console.log(`Email d'approbation de compte envoyé à ${to}`);
    } catch (error) {
      console.error("Erreur lors de l'envoi de l'email d'approbation:", error);
      throw error;
    }
  }

  async sendAccountRejectedEmail({
    to,
    name,
  }: {
    to: string;
    name: string;
  }): Promise<void> {
    this.ensureSmtpConfigured();

    const fromAddress = this.buildFromAddress();
    const subject = "Votre demande de compte a ete refusee - Uptime Monitor";
    const loginUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/login`;

    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px 20px; color: #334155;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h2 style="color: #1e3a8a; margin: 0;">Uptime Monitor</h2>
        </div>

        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <h3 style="color: #b91c1c; margin: 0 0 10px 0;">Demande refusee</h3>
          <p style="margin: 0; color: #991b1b;">Votre demande de creation de compte n'a pas ete acceptee.</p>
        </div>

        <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
          Bonjour ${name},
        </p>

        <p style="font-size: 15px; line-height: 1.6; margin-bottom: 20px;">
          Nous vous informons que votre demande de creation de compte sur Uptime Monitor a ete refusee par l'administrateur.
        </p>

        <p style="font-size: 15px; line-height: 1.6; margin-bottom: 20px;">
          Si vous pensez qu'il s'agit d'une erreur, vous pouvez contacter l'administrateur de la plateforme ou soumettre une nouvelle demande depuis la page de connexion.
        </p>

        <p style="font-size: 15px; line-height: 1.6; margin-top: 20px;">
          <a href="${loginUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">Retour a la page de connexion</a>
        </p>

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">

        <p style="color: #94a3b8; font-size: 12px; text-align: center;">
          Cet email a ete genere automatiquement par la plateforme Uptime Monitor.<br>
          Si vous n'avez pas fait cette demande, veuillez ignorer cet email.
        </p>
      </div>
    `;

    const textContent = `
Votre demande de compte a ete refusee - Uptime Monitor

Bonjour ${name},

Nous vous informons que votre demande de creation de compte sur Uptime Monitor a ete refusee par l'administrateur.

Si vous pensez qu'il s'agit d'une erreur, vous pouvez contacter l'administrateur de la plateforme ou soumettre une nouvelle demande depuis la page de connexion.

Retour a la page de connexion : ${loginUrl}

---
Cet email a ete genere automatiquement par la plateforme Uptime Monitor.
Si vous n'avez pas fait cette demande, veuillez ignorer cet email.
    `;

    const mailOptions: nodemailer.SendMailOptions = {
      from: fromAddress,
      to,
      subject,
      text: textContent,
      html: htmlContent,
    };

    try {
      await this.getTransporter().sendMail(mailOptions);
      console.log(`Email de refus de compte envoye a ${to}`);
    } catch (error) {
      console.error("Erreur lors de l'envoi de l'email de refus:", error);
      throw error;
    }
  }
}

export default new EmailService();
