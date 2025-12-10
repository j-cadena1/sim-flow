import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock nodemailer before importing emailService
vi.mock('nodemailer', () => {
  const mockSendMail = vi.fn().mockResolvedValue({ messageId: 'test-message-id' });
  const mockVerify = vi.fn().mockResolvedValue(true);
  const mockClose = vi.fn();

  return {
    default: {
      createTransport: vi.fn(() => ({
        sendMail: mockSendMail,
        verify: mockVerify,
        close: mockClose,
      })),
    },
  };
});

// Mock logger
vi.mock('../../middleware/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('emailService', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    // Clear environment variables
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_SECURE;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASSWORD;
    delete process.env.SMTP_FROM_EMAIL;
    delete process.env.SMTP_FROM_NAME;
    delete process.env.CORS_ORIGIN;
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('isEmailConfigured', () => {
    it('returns false when SMTP_HOST is not set', async () => {
      const { isEmailConfigured, initializeEmailService } = await import('../emailService');
      initializeEmailService();
      expect(isEmailConfigured()).toBe(false);
    });

    it('returns true when SMTP is configured and initialized', async () => {
      process.env.SMTP_HOST = 'smtp.example.com';
      const { isEmailConfigured, initializeEmailService } = await import('../emailService');
      initializeEmailService();
      expect(isEmailConfigured()).toBe(true);
    });
  });

  describe('initializeEmailService', () => {
    it('does not create transporter when SMTP_HOST is not set', async () => {
      const nodemailer = await import('nodemailer');
      const { initializeEmailService } = await import('../emailService');

      initializeEmailService();

      expect(nodemailer.default.createTransport).not.toHaveBeenCalled();
    });

    it('creates transporter with correct config when SMTP is configured', async () => {
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_PORT = '587';
      process.env.SMTP_SECURE = 'false';

      const nodemailer = await import('nodemailer');
      const { initializeEmailService } = await import('../emailService');

      initializeEmailService();

      expect(nodemailer.default.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'smtp.example.com',
          port: 587,
          secure: false,
          pool: true,
        })
      );
    });

    it('includes auth when SMTP_USER is set', async () => {
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_USER = 'user@example.com';
      process.env.SMTP_PASSWORD = 'password123';

      const nodemailer = await import('nodemailer');
      const { initializeEmailService } = await import('../emailService');

      initializeEmailService();

      expect(nodemailer.default.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          auth: {
            user: 'user@example.com',
            pass: 'password123',
          },
        })
      );
    });
  });

  describe('sendEmail', () => {
    it('returns false when email is not configured', async () => {
      const { sendEmail, initializeEmailService } = await import('../emailService');
      initializeEmailService();

      const result = await sendEmail({
        to: 'test@example.com',
        subject: 'Test',
        text: 'Test message',
      });

      expect(result).toBe(false);
    });

    it('sends email successfully when configured', async () => {
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_FROM_EMAIL = 'noreply@test.com';
      process.env.SMTP_FROM_NAME = 'Test App';

      const { sendEmail, initializeEmailService } = await import('../emailService');
      initializeEmailService();

      const result = await sendEmail({
        to: 'test@example.com',
        subject: 'Test Subject',
        text: 'Test message',
        html: '<p>Test message</p>',
      });

      expect(result).toBe(true);
    });
  });

  describe('sendInstantNotificationEmail', () => {
    it('sends email with correct template content', async () => {
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.CORS_ORIGIN = 'https://app.example.com';

      const { sendInstantNotificationEmail, initializeEmailService } = await import(
        '../emailService'
      );
      initializeEmailService();

      const notification = {
        id: 'notif-123',
        userId: 'user-123',
        type: 'REQUEST_ASSIGNED' as const,
        title: 'New Assignment',
        message: 'You have been assigned to Request #123',
        link: '/requests/123',
        read: false,
        createdAt: new Date(),
      };

      const result = await sendInstantNotificationEmail('user@example.com', notification);

      expect(result).toBe(true);
    });
  });

  describe('sendDigestEmail', () => {
    it('returns true for empty notifications array', async () => {
      process.env.SMTP_HOST = 'smtp.example.com';

      const { sendDigestEmail, initializeEmailService } = await import('../emailService');
      initializeEmailService();

      const result = await sendDigestEmail('user@example.com', [], 'daily');

      expect(result).toBe(true);
    });

    it('sends digest email with grouped notifications', async () => {
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.CORS_ORIGIN = 'https://app.example.com';

      const { sendDigestEmail, initializeEmailService } = await import('../emailService');
      initializeEmailService();

      const notifications = [
        {
          id: 'notif-1',
          userId: 'user-123',
          type: 'REQUEST_ASSIGNED' as const,
          title: 'New Assignment',
          message: 'Assigned to Request #1',
          read: false,
          createdAt: new Date(),
        },
        {
          id: 'notif-2',
          userId: 'user-123',
          type: 'REQUEST_COMMENT_ADDED' as const,
          title: 'New Comment',
          message: 'Comment on Request #2',
          read: false,
          createdAt: new Date(),
        },
      ];

      const result = await sendDigestEmail('user@example.com', notifications, 'daily');

      expect(result).toBe(true);
    });
  });

  describe('verifyEmailConnection', () => {
    it('returns false when email is not configured', async () => {
      const { verifyEmailConnection, initializeEmailService } = await import('../emailService');
      initializeEmailService();

      const result = await verifyEmailConnection();

      expect(result).toBe(false);
    });

    it('returns true when SMTP connection is verified', async () => {
      process.env.SMTP_HOST = 'smtp.example.com';

      const { verifyEmailConnection, initializeEmailService } = await import('../emailService');
      initializeEmailService();

      const result = await verifyEmailConnection();

      expect(result).toBe(true);
    });
  });
});
