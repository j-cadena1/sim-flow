/**
 * Email Service
 * Handles SMTP configuration and email sending for notifications
 */

import nodemailer, { Transporter } from 'nodemailer';
import { logger } from '../middleware/logger';
import { Notification } from '../types/notifications';

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  auth?: {
    user: string;
    pass: string;
  };
}

interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

let transporter: Transporter | null = null;

/**
 * Get SMTP configuration from environment variables
 */
function getSmtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST;
  if (!host) {
    return null;
  }

  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE === 'true';

  const config: SmtpConfig = {
    host,
    port,
    secure,
  };

  // Add auth if credentials provided
  if (process.env.SMTP_USER) {
    config.auth = {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD || '',
    };
  }

  return config;
}

/**
 * Get sender email and name from environment
 */
function getSenderInfo(): { email: string; name: string } {
  return {
    email: process.env.SMTP_FROM_EMAIL || 'noreply@sim-rq.local',
    name: process.env.SMTP_FROM_NAME || 'SimRQ Notifications',
  };
}

/**
 * Get the application URL for building links
 */
function getAppUrl(): string {
  return process.env.CORS_ORIGIN || 'http://localhost:5173';
}

/**
 * Initialize the email service
 * Call this on server startup
 */
export function initializeEmailService(): void {
  const config = getSmtpConfig();

  if (!config) {
    logger.info('Email service not configured (SMTP_HOST not set)');
    return;
  }

  try {
    transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth,
      // Connection pooling for efficiency
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
    });

    logger.info(`Email service initialized (SMTP: ${config.host}:${config.port})`);
  } catch (error) {
    logger.error('Failed to initialize email service:', error);
    transporter = null;
  }
}

/**
 * Check if email is configured and available
 */
export function isEmailConfigured(): boolean {
  return transporter !== null;
}

/**
 * Verify SMTP connection is working
 */
export async function verifyEmailConnection(): Promise<boolean> {
  if (!transporter) {
    return false;
  }

  try {
    await transporter.verify();
    logger.info('SMTP connection verified');
    return true;
  } catch (error) {
    logger.error('SMTP connection verification failed:', error);
    return false;
  }
}

/**
 * Send an email
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  if (!transporter) {
    logger.warn('Email not configured, skipping send');
    return false;
  }

  const sender = getSenderInfo();

  try {
    const info = await transporter.sendMail({
      from: `"${sender.name}" <${sender.email}>`,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });

    logger.info(`Email sent: ${info.messageId} to ${options.to}`);
    return true;
  } catch (error) {
    logger.error(`Failed to send email to ${options.to}:`, error);
    return false;
  }
}

/**
 * Send an instant notification email
 */
export async function sendInstantNotificationEmail(
  userEmail: string,
  notification: Notification
): Promise<boolean> {
  const appUrl = getAppUrl();
  const link = notification.link ? `${appUrl}${notification.link}` : appUrl;

  const subject = notification.title;

  const text = `${notification.message}

View in SimRQ: ${link}

---
You received this email because you have instant email notifications enabled.
To change your notification preferences, visit: ${appUrl}/settings`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #f8f9fa; border-radius: 8px; padding: 24px; margin-bottom: 20px;">
    <h2 style="margin: 0 0 12px 0; color: #1a1a1a;">${escapeHtml(notification.title)}</h2>
    <p style="margin: 0; color: #4a4a4a;">${escapeHtml(notification.message)}</p>
  </div>

  <div style="text-align: center; margin: 24px 0;">
    <a href="${link}" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500;">View in SimRQ</a>
  </div>

  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">

  <p style="font-size: 12px; color: #6b7280; text-align: center;">
    You received this email because you have instant email notifications enabled.<br>
    <a href="${appUrl}/settings" style="color: #2563eb;">Manage notification preferences</a>
  </p>
</body>
</html>`;

  return sendEmail({
    to: userEmail,
    subject,
    text,
    html,
  });
}

/**
 * Send a digest email with multiple notifications
 */
export async function sendDigestEmail(
  userEmail: string,
  notifications: Notification[],
  frequency: string
): Promise<boolean> {
  if (notifications.length === 0) {
    return true; // Nothing to send
  }

  const appUrl = getAppUrl();
  const frequencyLabel = frequency.charAt(0).toUpperCase() + frequency.slice(1);

  const subject = `SimRQ ${frequencyLabel} Digest: ${notifications.length} notification${notifications.length === 1 ? '' : 's'}`;

  // Group notifications by type for summary
  const grouped = groupNotificationsByType(notifications);

  // Build plain text version
  const textItems = notifications
    .slice(0, 50)
    .map((n) => `- ${n.title}: ${n.message}`)
    .join('\n');

  const text = `SimRQ ${frequencyLabel} Notification Digest

You have ${notifications.length} new notification${notifications.length === 1 ? '' : 's'}:

${textItems}
${notifications.length > 50 ? `\n...and ${notifications.length - 50} more\n` : ''}
View all notifications: ${appUrl}/notifications

---
You received this ${frequency} digest because of your notification preferences.
To change your notification preferences, visit: ${appUrl}/settings`;

  // Build HTML version
  const htmlItems = notifications
    .slice(0, 50)
    .map(
      (n) => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
          <strong style="color: #1a1a1a;">${escapeHtml(n.title)}</strong><br>
          <span style="color: #4a4a4a; font-size: 14px;">${escapeHtml(n.message)}</span>
        </td>
      </tr>`
    )
    .join('');

  const summaryItems = Object.entries(grouped)
    .map(([type, count]) => `<li>${formatNotificationType(type)}: ${count}</li>`)
    .join('');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #2563eb; color: #ffffff; border-radius: 8px 8px 0 0; padding: 20px; text-align: center;">
    <h1 style="margin: 0; font-size: 24px;">SimRQ ${frequencyLabel} Digest</h1>
    <p style="margin: 8px 0 0 0; opacity: 0.9;">${notifications.length} new notification${notifications.length === 1 ? '' : 's'}</p>
  </div>

  <div style="background: #f8f9fa; padding: 16px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb;">
    <strong>Summary:</strong>
    <ul style="margin: 8px 0; padding-left: 20px;">
      ${summaryItems}
    </ul>
  </div>

  <table style="width: 100%; border-collapse: collapse; background: #ffffff; border: 1px solid #e5e7eb; border-top: none;">
    ${htmlItems}
  </table>

  ${
    notifications.length > 50
      ? `<p style="text-align: center; color: #6b7280; font-style: italic;">...and ${notifications.length - 50} more notifications</p>`
      : ''
  }

  <div style="text-align: center; margin: 24px 0;">
    <a href="${appUrl}/notifications" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500;">View All Notifications</a>
  </div>

  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">

  <p style="font-size: 12px; color: #6b7280; text-align: center;">
    You received this ${frequency} digest because of your notification preferences.<br>
    <a href="${appUrl}/settings" style="color: #2563eb;">Manage notification preferences</a>
  </p>
</body>
</html>`;

  return sendEmail({
    to: userEmail,
    subject,
    text,
    html,
  });
}

/**
 * Shutdown email service (for graceful shutdown)
 */
export function shutdownEmailService(): void {
  if (transporter) {
    transporter.close();
    transporter = null;
    logger.info('Email service shut down');
  }
}

// Helper functions

function escapeHtml(text: string): string {
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return text.replace(/[&<>"']/g, (char) => htmlEntities[char]);
}

function groupNotificationsByType(notifications: Notification[]): Record<string, number> {
  return notifications.reduce(
    (acc, n) => {
      acc[n.type] = (acc[n.type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
}

function formatNotificationType(type: string): string {
  const typeLabels: Record<string, string> = {
    REQUEST_ASSIGNED: 'Request assignments',
    REQUEST_STATUS_CHANGED: 'Status changes',
    REQUEST_COMMENT_ADDED: 'New comments',
    REQUEST_PENDING_REVIEW: 'Pending reviews',
    PROJECT_PENDING_APPROVAL: 'Project approvals',
    APPROVAL_NEEDED: 'Approvals needed',
    APPROVAL_REVIEWED: 'Approvals reviewed',
    TIME_LOGGED: 'Time logged',
    PROJECT_UPDATED: 'Project updates',
    ADMIN_ACTION: 'Admin actions',
    TITLE_CHANGE_REQUESTED: 'Title change requests',
    TITLE_CHANGE_REVIEWED: 'Title changes reviewed',
    DISCUSSION_REQUESTED: 'Discussion requests',
    DISCUSSION_REVIEWED: 'Discussions reviewed',
  };
  return typeLabels[type] || type;
}
