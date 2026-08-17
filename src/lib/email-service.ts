/**
 * GESTION E-IMMO - Service d'e-mail
 * Service d'e-mail complet pour les invitations de locataires, les notifications et la réinitialisation de mot de passe
 */

import nodemailer from "nodemailer";
import { IUser } from "@/types";
import { formatCurrency } from "@/lib/utils/formatting";
import { getEmailConfig } from "@/lib/services/email-config.service";

// Interface du modèle d'e-mail
interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

// Classe de service d'e-mail
export class EmailService {
  private appName: string;
  private appUrl: string;

  constructor() {
    // Image de marque au niveau de l'application utilisée dans les modèles d'e-mail.
    this.appName = process.env.APP_NAME || "GESTION E-IMMO";
    this.appUrl = process.env.APP_URL || "http://localhost:3000";
  }

  // Construire un transporteur à partir de la configuration active (priorité à la base de données, repli sur l'environnement).
  private async getTransport() {
    const config = await getEmailConfig();
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth,
    });
    return { transporter, config };
  }

  // Vérifier la connexion au service d'e-mail
  async verifyConnection(): Promise<boolean> {
    try {
      const { transporter } = await this.getTransport();
      await transporter.verify();
      return true;
    } catch (error) {
      console.error("Échec de la connexion au service d'e-mail :", error);
      return false;
    }
  }

  // Envoyer un e-mail avec un modèle
  private async sendEmail(
    to: string,
    template: EmailTemplate,
    attachments?: Array<{
      filename: string;
      content: Buffer | string;
      contentType?: string;
    }>
  ): Promise<boolean> {
    try {
      const { transporter, config } = await this.getTransport();

      if (!config.configured) {
        throw new Error(
          "Le service e-mail n’est pas configuré. Renseignez le serveur SMTP dans Administration > Paramètres > E-mail."
        );
      }

      const mailOptions = {
        from: `${config.fromName || this.appName} <${config.fromEmail}>`,
        to,
        subject: template.subject,
        html: template.html,
        text: template.text,
        attachments,
        ...(config.replyTo ? { replyTo: config.replyTo } : {}),
      };

      const result = await transporter.sendMail(mailOptions);

      return true;
    } catch (error: any) {
      console.error("Échec de l'envoi de l'e-mail :", error);

      // Fournir des conseils spécifiques pour les erreurs d'authentification Gmail
      if (error.code === "EAUTH" && error.responseCode === 535) {
        console.error(`
🚨 Erreur d'authentification Gmail - Veuillez vérifier :
1. Activez l'authentification à deux facteurs sur votre compte Gmail
2. Générez un mot de passe d'application (pas votre mot de passe Gmail habituel)
3. Utilisez le mot de passe d'application dans EMAIL_SERVER_PASSWORD
4. Assurez-vous que EMAIL_SERVER_USER est votre adresse Gmail complète

Configuration actuelle :
- Utilisateur : ${process.env.EMAIL_SERVER_USER}
- Hôte : ${process.env.EMAIL_SERVER_HOST}
- Port : ${process.env.EMAIL_SERVER_PORT}

📖 Guide : https://support.google.com/accounts/answer/185833
        `);
      }

      throw error; // Relancer pour permettre à l'API de gérer la réponse d'erreur
    }
  }

  // Générer le modèle d'e-mail de base
  private generateBaseTemplate(
    title: string,
    content: string,
    actionButton?: {
      text: string;
      url: string;
    }
  ): EmailTemplate {
    const html = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8f9fa;
          }
          .container {
            background-color: #ffffff;
            border-radius: 8px;
            padding: 40px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .logo {
            font-size: 24px;
            font-weight: bold;
            color: #2563eb;
            margin-bottom: 10px;
          }
          .title {
            font-size: 20px;
            font-weight: 600;
            color: #1f2937;
            margin-bottom: 20px;
          }
          .content {
            margin-bottom: 30px;
            color: #4b5563;
          }
          .button {
            display: inline-block;
            background-color: #2563eb;
            color: #ffffff;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 500;
            margin: 20px 0;
          }
          .button:hover {
            background-color: #1d4ed8;
          }
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            text-align: center;
            color: #6b7280;
            font-size: 14px;
          }
          .security-notice {
            background-color: #fef3c7;
            border: 1px solid #f59e0b;
            border-radius: 6px;
            padding: 16px;
            margin: 20px 0;
            color: #92400e;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">${this.appName}</div>
            <h1 class="title">${title}</h1>
          </div>
          
          <div class="content">
            ${content}
          </div>
          
          ${
            actionButton
              ? `
            <div style="text-align: center; margin: 20px 0;">
  <a
    href="${actionButton.url}"
    style="display:inline-block;background-color:#e00000;color:#ffffff !important;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:600;"
  >
    ${actionButton.text}
  </a>
</div>
          `
              : ""
          }
          
          <div class="footer">
            <p>Cet e-mail a été envoyé depuis le système de gestion immobilière ${
              this.appName
            }.</p>
            <p>Si vous avez des questions, veuillez contacter notre équipe de support.</p>
            <p>&copy; ${new Date().getFullYear()} ${
      this.appName
    }. Tous droits réservés.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Générer la version en texte brut
    const text = `
${this.appName}

${title}

${content
  .replace(/<[^>]*>/g, "")
  .replace(/\s+/g, " ")
  .trim()}

${actionButton ? `${actionButton.text} : ${actionButton.url}` : ""}

---
Cet e-mail a été envoyé depuis le système de gestion immobilière ${this.appName}.
Si vous avez des questions, veuillez contacter notre équipe de support.
© ${new Date().getFullYear()} ${this.appName}. Tous droits réservés.
    `.trim();

    return {
      subject: title,
      html,
      text,
    };
  }

  // Envoyer un e-mail d'invitation de locataire
  async sendTenantInvitation(
    tenantEmail: string,
    tenantName: string,
    invitationToken: string,
    invitedBy: string
  ): Promise<boolean> {
    const invitationUrl = `${this.appUrl}/auth/setup-password?token=${invitationToken}`;

    const content = `
      <p>Bonjour <strong>${tenantName}</strong>,</p>

      <p>Vous avez été invité(e) à rejoindre ${this.appName} en tant que locataire par <strong>${invitedBy}</strong>.</p>

      <p>Pour finaliser la configuration de votre compte et accéder à votre portail locataire, veuillez cliquer sur le bouton ci-dessous pour configurer votre mot de passe :</p>

      <div class="security-notice">
        <strong>Avis de sécurité :</strong> Ce lien d'invitation expirera dans 24 heures pour votre sécurité.
        Si vous ne terminez pas la configuration dans ce délai, veuillez contacter votre gestionnaire immobilier pour obtenir une nouvelle invitation.
      </div>

      <p>Une fois votre mot de passe configuré, vous pourrez :</p>
      <ul>
        <li>Accéder à votre tableau de bord locataire</li>
        <li>Consulter les informations et documents de votre bail</li>
        <li>Soumettre des demandes de maintenance</li>
        <li>Effectuer des paiements de loyer en ligne</li>
        <li>Communiquer avec votre gestionnaire immobilier</li>
      </ul>

      <p>Si vous avez des questions ou besoin d'assistance, n'hésitez pas à contacter notre équipe de support.</p>

      <p>Bienvenue sur ${this.appName} !</p>
    `;

    const template = this.generateBaseTemplate(
      "Bienvenue sur GESTION E-IMMO - Finalisez la configuration de votre compte",
      content,
      {
        text: "Configurer mon mot de passe",
        url: invitationUrl,
      }
    );

    return this.sendEmail(tenantEmail, template);
  }

  // Envoyer un e-mail de réinitialisation de mot de passe
  async sendPasswordReset(
    userEmail: string,
    userName: string,
    resetToken: string
  ): Promise<boolean> {
    const resetUrl = `${this.appUrl}/auth/reset-password?token=${resetToken}`;

    const content = `
      <p>Bonjour <strong>${userName}</strong>,</p>

      <p>Nous avons reçu une demande de réinitialisation de mot de passe pour votre compte ${this.appName}.</p>

      <p>Si vous avez initié cette réinitialisation de mot de passe, veuillez cliquer sur le bouton ci-dessous pour créer un nouveau mot de passe :</p>

      <div class="security-notice">
        <strong>Avis de sécurité :</strong> Ce lien de réinitialisation de mot de passe expirera dans 1 heure pour votre sécurité.
        Si vous ne réinitialisez pas votre mot de passe dans ce délai, vous devrez demander un nouveau lien.
      </div>

      <p><strong>Si vous n'avez pas demandé cette réinitialisation de mot de passe :</strong></p>
      <ul>
        <li>Vous pouvez ignorer cet e-mail en toute sécurité</li>
        <li>Votre mot de passe restera inchangé</li>
        <li>Envisagez de modifier votre mot de passe si vous suspectez un accès non autorisé</li>
      </ul>

      <p>Pour des raisons de sécurité, nous vous recommandons d'utiliser un mot de passe fort comprenant :</p>
      <ul>
        <li>Au moins 8 caractères</li>
        <li>Un mélange de lettres majuscules et minuscules</li>
        <li>Des chiffres et des caractères spéciaux</li>
      </ul>
    `;

    const template = this.generateBaseTemplate(
      "Réinitialisez votre mot de passe GESTION E-IMMO",
      content,
      {
        text: "Réinitialiser mon mot de passe",
        url: resetUrl,
      }
    );

    return this.sendEmail(userEmail, template);
  }

  // Envoyer la vérification de changement d'e-mail à la nouvelle adresse
  async sendEmailChangeVerification(
    newEmail: string,
    userName: string,
    token: string
  ): Promise<boolean> {
    const confirmUrl = `${this.appUrl}/auth/confirm-email-change?token=${token}`;

    const content = `
      <p>Bonjour <strong>${userName}</strong>,</p>

      <p>Nous avons reçu une demande de modification de l'adresse e-mail de votre compte ${this.appName} vers <strong>${newEmail}</strong>.</p>

      <p>Pour confirmer ce changement, veuillez cliquer sur le bouton ci-dessous :</p>

      <div class="security-notice">
        <strong>Avis de sécurité :</strong> Ce lien de confirmation expirera dans 1 heure.
        L'e-mail de votre compte ne sera pas modifié tant que vous ne l'aurez pas confirmé ici.
      </div>

      <p><strong>Si vous n'avez pas demandé ce changement :</strong></p>
      <ul>
        <li>Vous pouvez ignorer cet e-mail en toute sécurité</li>
        <li>L'e-mail de votre compte restera inchangé</li>
        <li>Envisagez de modifier votre mot de passe si vous suspectez un accès non autorisé</li>
      </ul>
    `;

    const template = this.generateBaseTemplate(
      "Confirmez votre nouvelle adresse e-mail",
      content,
      {
        text: "Confirmer le changement d'e-mail",
        url: confirmUrl,
      }
    );

    return this.sendEmail(newEmail, template);
  }

    // Envoyer un lien de confirmation du compte à l'adresse e-mail de l'utilisateur
  async sendEmailVerification(
    userEmail: string,
    userName: string,
    token: string
  ): Promise<boolean> {
    const verifyUrl = `${this.appUrl}/auth/verify-email?token=${token}`;

    const content = `
      <p>Bonjour <strong>${userName}</strong>,</p>

      <p>Confirmez votre compte ${this.appName} et votre adresse <strong>${userEmail}</strong>.</p>

      <p>Cliquez sur le bouton ci-dessous pour continuer :</p>

      <div class="security-notice">
        <strong>Sécurité :</strong> Ce lien expire dans 24 heures.
      </div>

      <p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.</p>
    `;

    const template = this.generateBaseTemplate(
      "Confirmez votre compte",
      content,
      {
        text: "Confirmer mon compte",
        url: verifyUrl,
      }
    );

    return this.sendEmail(userEmail, template);
  }

  // Envoyer la confirmation d'activation du compte
  async sendAccountActivated(
    userEmail: string,
    userName: string
  ): Promise<boolean> {
    const loginUrl = `${this.appUrl}/auth/signin`;

    const content = `
      <p>Bonjour <strong>${userName}</strong>,</p>

      <p>Excellente nouvelle ! Votre compte ${this.appName} a été activé avec succès.</p>

      <p>Vous pouvez dès à présent vous connecter à votre portail locataire et accéder à toutes les fonctionnalités disponibles :</p>

      <ul>
        <li><strong>Tableau de bord :</strong> Consultez la vue d'ensemble de votre compte et les notifications importantes</li>
        <li><strong>Gestion des baux :</strong> Accédez aux documents et informations de votre bail</li>
        <li><strong>Demandes de maintenance :</strong> Soumettez et suivez vos demandes de maintenance</li>
        <li><strong>Portail de paiement :</strong> Effectuez des paiements de loyer et consultez l'historique des paiements</li>
        <li><strong>Communication :</strong> Envoyez un message direct à votre gestionnaire immobilier</li>
        <li><strong>Paramètres du profil :</strong> Mettez à jour vos coordonnées et préférences</li>
      </ul>

      <p>Si vous avez des questions sur l'utilisation de la plateforme ou si vous avez besoin d'aide, notre équipe de support est là pour vous aider.</p>

      <p>Bienvenue sur ${this.appName} !</p>
    `;

    const template = this.generateBaseTemplate(
      "Votre compte GESTION E-IMMO est prêt !",
      content,
      {
        text: "Accéder à mon portail",
        url: loginUrl,
      }
    );

    return this.sendEmail(userEmail, template);
  }

  // Envoyer un e-mail de notification générale
  async sendNotification(
    userEmail: string,
    userName: string,
    subject: string,
    message: string,
    actionButton?: {
      text: string;
      url: string;
    }
  ): Promise<boolean> {
    const content = `
      <p>Bonjour <strong>${userName}</strong>,</p>

      <div style="margin: 20px 0;">
        ${message.replace(/\n/g, "<br>")}
      </div>
    `;

    const template = this.generateBaseTemplate(subject, content, actionButton);
    return this.sendEmail(userEmail, template);
  }

  // Envoyer un e-mail avec un modèle personnalisé et des pièces jointes (méthode publique)
  async sendEmailWithAttachments(
    to: string,
    template: EmailTemplate,
    attachments?: Array<{
      filename: string;
      content: Buffer | string;
      contentType?: string;
    }>
  ): Promise<boolean> {
    return this.sendEmail(to, template, attachments);
  }

  // ============================================================================
  // MÉTHODES D'E-MAIL POUR LES ÉVÉNEMENTS DU CALENDRIER
  // ============================================================================

  // Envoyer un e-mail d'invitation à un événement
  async sendEventInvitation(
    attendeeEmail: string,
    attendeeName: string,
    event: {
      title: string;
      description?: string;
      startDate: Date;
      endDate?: Date;
      location?: string;
      organizer: string;
      type: string;
      allDay?: boolean;
    },
    invitationToken?: string
  ): Promise<boolean> {
    const eventDate = event.startDate.toLocaleDateString("fr-FR", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const eventTime = event.allDay
      ? "Toute la journée"
      : `${event.startDate.toLocaleTimeString("fr-FR", {
          hour: "numeric",
          minute: "2-digit",
          hour12: false,
        })}${
          event.endDate
            ? ` - ${event.endDate.toLocaleTimeString("fr-FR", {
                hour: "numeric",
                minute: "2-digit",
                hour12: false,
              })}`
            : ""
        }`;

    const rsvpUrl = invitationToken
      ? `${this.appUrl}/calendar/rsvp?token=${invitationToken}`
      : null;

    const content = `
      <p>Bonjour <strong>${attendeeName}</strong>,</p>

      <p>Vous avez été invité(e) à l'événement suivant :</p>

      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <h3 style="margin: 0 0 15px 0; color: #1e293b; font-size: 18px;">${
          event.title
        }</h3>

        <div style="margin-bottom: 10px;">
          <strong>📅 Date :</strong> ${eventDate}
        </div>

        <div style="margin-bottom: 10px;">
          <strong>🕐 Heure :</strong> ${eventTime}
        </div>

        ${
          event.location
            ? `
        <div style="margin-bottom: 10px;">
          <strong>📍 Lieu :</strong> ${event.location}
        </div>
        `
            : ""
        }

        <div style="margin-bottom: 10px;">
          <strong>👤 Organisateur :</strong> ${event.organizer}
        </div>

        <div style="margin-bottom: 10px;">
          <strong>📋 Type :</strong> ${event.type.replace(/_/g, " ")}
        </div>

        ${
          event.description
            ? `
        <div style="margin-top: 15px;">
          <strong>Description :</strong>
          <p style="margin: 5px 0 0 0; color: #64748b;">${event.description}</p>
        </div>
        `
            : ""
        }
      </div>

      ${
        rsvpUrl
          ? `
      <p>Veuillez répondre à cette invitation :</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${rsvpUrl}&response=accepted" style="display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 0 5px;">Accepter</a>
        <a href="${rsvpUrl}&response=declined" style="display: inline-block; background: #ef4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 0 5px;">Refuser</a>
        <a href="${rsvpUrl}&response=tentative" style="display: inline-block; background: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 0 5px;">Peut-être</a>
      </div>
      `
          : ""
      }

      <p>Si vous avez des questions concernant cet événement, veuillez contacter l'organisateur.</p>
    `;

    const template = this.generateBaseTemplate(
      `Invitation à un événement : ${event.title}`,
      content,
      rsvpUrl
        ? {
            text: "Afficher les détails de l'événement",
            url: rsvpUrl,
          }
        : undefined
    );

    return this.sendEmail(attendeeEmail, template);
  }

  // Envoyer un e-mail de rappel d'événement
  async sendEventReminder(
    attendeeEmail: string,
    attendeeName: string,
    event: {
      title: string;
      description?: string;
      startDate: Date;
      endDate?: Date;
      location?: string;
      type: string;
      allDay?: boolean;
    },
    reminderType: "1_hour" | "1_day" | "1_week" = "1_hour"
  ): Promise<boolean> {
    const eventDate = event.startDate.toLocaleDateString("fr-FR", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const eventTime = event.allDay
      ? "Toute la journée"
      : event.startDate.toLocaleTimeString("fr-FR", {
          hour: "numeric",
          minute: "2-digit",
          hour12: false,
        });

    const reminderText = {
      "1_hour": "dans 1 heure",
      "1_day": "demain",
      "1_week": "dans 1 semaine",
    }[reminderType];

    const content = `
      <p>Bonjour <strong>${attendeeName}</strong>,</p>

      <p>Ceci est un rappel que vous avez un événement à venir <strong>${reminderText}</strong> :</p>

      <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <h3 style="margin: 0 0 15px 0; color: #92400e; font-size: 18px;">⏰ ${
          event.title
        }</h3>

        <div style="margin-bottom: 10px;">
          <strong>📅 Date :</strong> ${eventDate}
        </div>

        <div style="margin-bottom: 10px;">
          <strong>🕐 Heure :</strong> ${eventTime}
        </div>

        ${
          event.location
            ? `
        <div style="margin-bottom: 10px;">
          <strong>📍 Lieu :</strong> ${event.location}
        </div>
        `
            : ""
        }

        ${
          event.description
            ? `
        <div style="margin-top: 15px;">
          <strong>Description :</strong>
          <p style="margin: 5px 0 0 0; color: #92400e;">${event.description}</p>
        </div>
        `
            : ""
        }
      </div>

      <p>Veuillez vous assurer d'être préparé(e) pour cet événement. Si vous devez apporter des modifications, veuillez contacter l'organisateur dès que possible.</p>
    `;

    const template = this.generateBaseTemplate(
      `Rappel : ${event.title} (${reminderText})`,
      content
    );

    return this.sendEmail(attendeeEmail, template);
  }

  // Envoyer un e-mail d'annulation d'événement
  async sendEventCancellation(
    attendeeEmail: string,
    attendeeName: string,
    event: {
      title: string;
      startDate: Date;
      location?: string;
      organizer: string;
      reason?: string;
    }
  ): Promise<boolean> {
    const eventDate = event.startDate.toLocaleDateString("fr-FR", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const content = `
      <p>Bonjour <strong>${attendeeName}</strong>,</p>

      <p>Nous avons le regret de vous informer que l'événement suivant a été <strong>annulé</strong> :</p>

      <div style="background: #fef2f2; border: 1px solid #ef4444; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <h3 style="margin: 0 0 15px 0; color: #dc2626; font-size: 18px;">❌ ${
          event.title
        }</h3>

        <div style="margin-bottom: 10px;">
          <strong>📅 Date initiale :</strong> ${eventDate}
        </div>

        ${
          event.location
            ? `
        <div style="margin-bottom: 10px;">
          <strong>📍 Lieu :</strong> ${event.location}
        </div>
        `
            : ""
        }

        <div style="margin-bottom: 10px;">
          <strong>👤 Organisateur :</strong> ${event.organizer}
        </div>

        ${
          event.reason
            ? `
        <div style="margin-top: 15px;">
          <strong>Motif de l'annulation :</strong>
          <p style="margin: 5px 0 0 0; color: #dc2626;">${event.reason}</p>
        </div>
        `
            : ""
        }
      </div>

      <p>Nous vous prions de nous excuser pour tout désagrément que cela pourrait causer. Si vous avez des questions, veuillez contacter l'organisateur.</p>
    `;

    const template = this.generateBaseTemplate(
      `Événement annulé : ${event.title}`,
      content
    );

    return this.sendEmail(attendeeEmail, template);
  }

  // Envoyer un e-mail de mise à jour d'événement
  async sendEventUpdate(
    attendeeEmail: string,
    attendeeName: string,
    event: {
      title: string;
      startDate: Date;
      endDate?: Date;
      location?: string;
      organizer: string;
      allDay?: boolean;
    },
    changes: string[]
  ): Promise<boolean> {
    const eventDate = event.startDate.toLocaleDateString("fr-FR", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const eventTime = event.allDay
      ? "Toute la journée"
      : event.startDate.toLocaleTimeString("fr-FR", {
          hour: "numeric",
          minute: "2-digit",
          hour12: false,
        });

    const content = `
      <p>Bonjour <strong>${attendeeName}</strong>,</p>

      <p>L'événement suivant a été <strong>mis à jour</strong> :</p>

      <div style="background: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <h3 style="margin: 0 0 15px 0; color: #0369a1; font-size: 18px;">📝 ${
          event.title
        }</h3>

        <div style="margin-bottom: 10px;">
          <strong>📅 Date :</strong> ${eventDate}
        </div>

        <div style="margin-bottom: 10px;">
          <strong>🕐 Heure :</strong> ${eventTime}
        </div>

        ${
          event.location
            ? `
        <div style="margin-bottom: 10px;">
          <strong>📍 Lieu :</strong> ${event.location}
        </div>
        `
            : ""
        }

        <div style="margin-top: 15px;">
          <strong>Modifications apportées :</strong>
          <ul style="margin: 5px 0 0 20px; color: #0369a1;">
            ${changes.map((change) => `<li>${change}</li>`).join("")}
          </ul>
        </div>
      </div>

      <p>Veuillez mettre à jour votre calendrier en conséquence. Si vous avez des questions concernant ces modifications, veuillez contacter l'organisateur.</p>
    `;

    const template = this.generateBaseTemplate(
      `Événement mis à jour : ${event.title}`,
      content
    );

    return this.sendEmail(attendeeEmail, template);
  }

  // Envoyer un e-mail de confirmation de RSVP
  async sendRSVPConfirmation(
    attendeeEmail: string,
    attendeeName: string,
    event: {
      title: string;
      startDate: Date;
      location?: string;
    },
    response: "accepted" | "declined" | "tentative"
  ): Promise<boolean> {
    const responseText = {
      accepted: "accepté",
      declined: "refusé",
      tentative: "accepté provisoirement",
    }[response];

    const responseColor = {
      accepted: "#10b981",
      declined: "#ef4444",
      tentative: "#f59e0b",
    }[response];

    const content = `
      <p>Bonjour <strong>${attendeeName}</strong>,</p>

      <p>Merci pour votre réponse. Vous avez <strong style="color: ${responseColor};">${responseText}</strong> l'invitation à :</p>

      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <h3 style="margin: 0 0 15px 0; color: #1e293b; font-size: 18px;">${
          event.title
        }</h3>

        <div style="margin-bottom: 10px;">
          <strong>📅 Date :</strong> ${event.startDate.toLocaleDateString(
            "fr-FR",
            {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            }
          )}
        </div>

        ${
          event.location
            ? `
        <div style="margin-bottom: 10px;">
          <strong>📍 Lieu :</strong> ${event.location}
        </div>
        `
            : ""
        }
      </div>

      ${
        response === "accepted"
          ? `
      <p>Nous avons hâte de vous voir à l'événement !</p>
      `
          : response === "declined"
          ? `
      <p>Nous sommes désolés que vous ne puissiez pas y assister. Si vos plans changent, veuillez en informer l'organisateur.</p>
      `
          : `
      <p>Veuillez confirmer votre présence dès que possible.</p>
      `
      }
    `;

    const template = this.generateBaseTemplate(
      `Confirmation de RSVP : ${event.title}`,
      content
    );

    return this.sendEmail(attendeeEmail, template);
  }

  // Envoyer un e-mail de rappel de paiement
  async sendPaymentReminder(
    tenantEmail: string,
    tenantName: string,
    propertyName: string,
    rentAmount: number,
    dueDate: Date,
    daysOverdue: number = 0
  ): Promise<boolean> {
    const paymentUrl = `${this.appUrl}/dashboard/payments/pay-rent`;
    const isOverdue = daysOverdue > 0;

    const content = `
      <p>Bonjour <strong>${tenantName}</strong>,</p>

      ${
        isOverdue
          ? `<div style="background-color: #fef2f2; border: 1px solid #fca5a5; border-radius: 6px; padding: 16px; margin: 20px 0; color: #dc2626;">
             <strong>⚠️ Avis de paiement en retard</strong><br>
             Votre paiement de loyer est en retard de ${daysOverdue} jour${
              daysOverdue > 1 ? "s" : ""
            }.
           </div>`
          : `<p>Ceci est un rappel amical indiquant que votre paiement de loyer arrive bientôt à échéance.</p>`
      }

      <div style="background-color: #f3f4f6; border-radius: 6px; padding: 20px; margin: 20px 0;">
        <h3 style="margin: 0 0 10px 0; color: #1f2937;">Détails du paiement</h3>
        <p style="margin: 5px 0;"><strong>Propriété :</strong> ${propertyName}</p>
        <p style="margin: 5px 0;"><strong>Montant dû :</strong> ${formatCurrency(
          rentAmount
        )}</p>
        <p style="margin: 5px 0;"><strong>Date d'échéance :</strong> ${dueDate.toLocaleDateString()}</p>
        ${
          isOverdue
            ? `<p style="margin: 5px 0; color: #dc2626;"><strong>Jours de retard :</strong> ${daysOverdue}</p>`
            : ""
        }
      </div>

      <p>Vous pouvez effectuer votre paiement en toute sécurité via votre portail locataire en utilisant le bouton ci-dessous.</p>

      ${
        isOverdue
          ? `<p style="color: #dc2626;"><strong>Important :</strong> Veuillez effectuer votre paiement dès que possible pour éviter des frais de retard ou toute autre action.</p>`
          : `<p>Merci d'être un locataire précieux !</p>`
      }
    `;

    const template = this.generateBaseTemplate(
      isOverdue
        ? "Paiement de loyer en retard - Action requise"
        : "Rappel de paiement de loyer",
      content,
      {
        text: "Payer le loyer maintenant",
        url: paymentUrl,
      }
    );

    return this.sendEmail(tenantEmail, template);
  }

  // Envoyer un rappel d'expiration de bail
  async sendLeaseExpiryReminder(
    tenantEmail: string,
    tenantName: string,
    propertyName: string,
    expiryDate: Date,
    daysUntilExpiry: number
  ): Promise<boolean> {
    const renewalUrl = `${this.appUrl}/dashboard/leases/my-lease`;

    const content = `
      <p>Bonjour <strong>${tenantName}</strong>,</p>

      <p>Nous souhaitions vous rappeler que votre bail pour <strong>${propertyName}</strong> approche de sa date d'expiration.</p>

      <div style="background-color: ${
        daysUntilExpiry <= 30 ? "#fef3c7" : "#f0f9ff"
      }; border: 1px solid ${
      daysUntilExpiry <= 30 ? "#f59e0b" : "#0ea5e9"
    }; border-radius: 6px; padding: 20px; margin: 20px 0;">
        <h3 style="margin: 0 0 10px 0; color: #1f2937;">Informations sur le bail</h3>
        <p style="margin: 5px 0;"><strong>Propriété :</strong> ${propertyName}</p>
        <p style="margin: 5px 0;"><strong>Expiration du bail :</strong> ${expiryDate.toLocaleDateString()}</p>
        <p style="margin: 5px 0;"><strong>Jours restants :</strong> ${daysUntilExpiry}</p>
      </div>

      ${
        daysUntilExpiry <= 30
          ? `<p style="color: #92400e;"><strong>Action requise :</strong> Votre bail expire dans ${daysUntilExpiry} jours. Veuillez contacter votre gestionnaire immobilier pour discuter des options de renouvellement.</p>`
          : `<p>Veuillez commencer à réfléchir à vos options de renouvellement et contacter votre gestionnaire immobilier si vous avez des questions.</p>`
      }

      <p>Pour consulter les détails de votre bail actuel ou contacter votre gestionnaire immobilier, veuillez visiter votre portail locataire.</p>
    `;

    const template = this.generateBaseTemplate(
      `Rappel d'expiration de bail - ${daysUntilExpiry} jours restants`,
      content,
      {
        text: "Afficher les détails du bail",
        url: renewalUrl,
      }
    );

    return this.sendEmail(tenantEmail, template);
  }

  // Envoyer un rappel d'expiration de bail au propriétaire/gestionnaire
  async sendLeaseExpiryReminderToLandlord(
    landlordEmail: string,
    landlordName: string,
    propertyName: string,
    tenantName: string,
    expiryDate: Date,
    daysUntilExpiry: number,
    leaseId?: string
  ): Promise<boolean> {
    const leaseUrl = leaseId
      ? `${this.appUrl}/dashboard/leases/${leaseId}`
      : `${this.appUrl}/dashboard/leases`;

    const content = `
      <p>Bonjour <strong>${landlordName}</strong>,</p>

      <p>Ceci est un rappel automatisé indiquant qu'un contrat de bail pour l'une de vos propriétés approche de sa date d'expiration.</p>

      <div style="background-color: ${
        daysUntilExpiry <= 30 ? "#fef3c7" : "#f0f9ff"
      }; border: 1px solid ${
      daysUntilExpiry <= 30 ? "#f59e0b" : "#0ea5e9"
    }; border-radius: 6px; padding: 20px; margin: 20px 0;">
        <h3 style="margin: 0 0 10px 0; color: #1f2937;">Détails de l'expiration du bail</h3>
        <p style="margin: 5px 0;"><strong>Propriété :</strong> ${propertyName}</p>
        <p style="margin: 5px 0;"><strong>Locataire :</strong> ${tenantName}</p>
        <p style="margin: 5px 0;"><strong>Expiration du bail :</strong> ${expiryDate.toLocaleDateString()}</p>
        <p style="margin: 5px 0;"><strong>Jours restants :</strong> ${daysUntilExpiry}</p>
      </div>

      ${
        daysUntilExpiry <= 30
          ? `<div style="background-color: #fef2f2; border: 1px solid #fca5a5; border-radius: 6px; padding: 16px; margin: 20px 0; color: #dc2626;">
               <strong>⚠️ Action requise</strong><br>
               Ce bail expire dans ${daysUntilExpiry} jours. Veuillez prendre les mesures suivantes :
               <ul style="margin: 10px 0; padding-left: 20px;">
                 <li>Contacter le locataire pour discuter des options de renouvellement</li>
                 <li>Préparer un nouveau contrat de bail si un renouvellement est souhaité</li>
                 <li>Prévoir la rotation de la propriété si le locataire déménage</li>
                 <li>Planifier une inspection de la propriété si nécessaire</li>
               </ul>
             </div>`
          : `<p>Vous disposez de suffisamment de temps pour planifier à l'avance. Pensez à contacter le locataire pour discuter de ses intentions de renouvellement.</p>`
      }

      <p><strong>Actions recommandées :</strong></p>
      <ul style="line-height: 1.8;">
        <li>Examiner les conditions actuelles du bail et l'historique des paiements du locataire</li>
        <li>Déterminer si vous souhaitez proposer un renouvellement de bail</li>
        <li>Envisager d'éventuels ajustements de loyer pour la nouvelle période</li>
        <li>Communiquer avec le locataire concernant ses projets</li>
        ${
          daysUntilExpiry <= 30
            ? "<li><strong>Agir rapidement pour éviter les périodes de vacance</strong></li>"
            : ""
        }
      </ul>

      <p>Cliquez sur le bouton ci-dessous pour afficher l'ensemble des détails du bail et agir.</p>
    `;

    const template = this.generateBaseTemplate(
      `Bail expirant bientôt - ${propertyName} (${daysUntilExpiry} jours)`,
      content,
      {
        text: "Afficher les détails du bail",
        url: leaseUrl,
      }
    );

    return this.sendEmail(landlordEmail, template);
  }

  // Envoyer une notification de mise à jour de maintenance
  async sendMaintenanceUpdate(
    userEmail: string,
    userName: string,
    requestId: string,
    propertyName: string,
    status: string,
    description: string,
    notes?: string
  ): Promise<boolean> {
    const maintenanceUrl = `${this.appUrl}/dashboard/maintenance/${requestId}`;

    const statusColors = {
      submitted: "#3b82f6",
      in_progress: "#f59e0b",
      completed: "#10b981",
      cancelled: "#ef4444",
    };

    const statusColor =
      statusColors[status as keyof typeof statusColors] || "#6b7280";

    const content = `
      <p>Bonjour <strong>${userName}</strong>,</p>

      <p>Votre demande de maintenance a été mise à jour.</p>

      <div style="background-color: #f9fafb; border-radius: 6px; padding: 20px; margin: 20px 0;">
        <h3 style="margin: 0 0 15px 0; color: #1f2937;">Détails de la demande</h3>
        <p style="margin: 5px 0;"><strong>ID de la demande :</strong> #${requestId}</p>
        <p style="margin: 5px 0;"><strong>Propriété :</strong> ${propertyName}</p>
        <p style="margin: 5px 0;"><strong>Description :</strong> ${description}</p>
        <p style="margin: 5px 0;">
          <strong>Statut :</strong>
          <span style="background-color: ${statusColor}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; text-transform: uppercase;">
            ${status.replace("_", " ")}
          </span>
        </p>
        ${
          notes
            ? `<p style="margin: 15px 0 5px 0;"><strong>Remarques :</strong> ${notes}</p>`
            : ""
        }
      </div>

      <p>Vous pouvez consulter l'ensemble des détails et suivre la progression de votre demande en utilisant le bouton ci-dessous.</p>
    `;

    const template = this.generateBaseTemplate(
      `Mise à jour de la demande de maintenance - #${requestId}`,
      content,
      {
        text: "Afficher les détails de la demande",
        url: maintenanceUrl,
      }
    );

    return this.sendEmail(userEmail, template);
  }

  // Envoyer un e-mail de test pour vérifier la configuration
  async sendTestEmail(recipientEmail: string): Promise<boolean> {
    const template: EmailTemplate = {
      subject: `${this.appName} - Test du service d'e-mail`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333; text-align: center;">Test du service d'e-mail</h2>
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; color: #666;">
              Ceci est un e-mail de test pour vérifier que votre service d'e-mail ${
                this.appName
              } fonctionne correctement.
            </p>
          </div>
          <div style="text-align: center; margin-top: 30px;">
            <p style="color: #28a745; font-weight: bold;">✅ Le service d'e-mail fonctionne !</p>
          </div>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px; text-align: center;">
            Cet e-mail a été envoyé depuis ${
              this.appName
            } le ${new Date().toLocaleString()}
          </p>
        </div>
      `,
      text: `
        ${this.appName} - Test du service d'e-mail

        Ceci est un e-mail de test pour vérifier que votre service d'e-mail ${
          this.appName
        } fonctionne correctement.

        ✅ Le service d'e-mail fonctionne !

        Cet e-mail a été envoyé depuis ${
          this.appName
        } le ${new Date().toLocaleString()}
      `,
    };

    return this.sendEmail(recipientEmail, template);
  }
}

// Créer une instance singleton
export const emailService = new EmailService();
