import { AlertService } from '../../services/alert.service';
import { Pool } from 'pg';
import { CacheService } from '../../services/cache.service';
import nodemailer from 'nodemailer';
import axios from 'axios';

jest.mock('pg');
jest.mock('../../services/cache.service');
jest.mock('nodemailer');
jest.mock('axios');

describe('Alert Channel Integration Tests', () => {
  let alertService: AlertService;
  let mockPool: jest.Mocked<Pool>;
  let mockCacheService: jest.Mocked<CacheService>;
  let mockTransporter: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockPool = new Pool() as jest.Mocked<Pool>;
    mockCacheService = new CacheService() as jest.Mocked<CacheService>;
    
    mockTransporter = {
      sendMail: jest.fn(),
      verify: jest.fn()
    };
    
    (nodemailer.createTransporter as jest.Mock).mockReturnValue(mockTransporter);
    
    alertService = new AlertService(mockPool, mockCacheService);
    
    // Setup environment variables for testing
    process.env.SMTP_HOST = 'smtp.test.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'test@example.com';
    process.env.SMTP_PASS = 'testpass';
    process.env.ALERT_EMAIL_TO = 'admin@example.com';
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';
    process.env.ALERT_WEBHOOK_URL = 'https://api.example.com/alerts';
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.ALERT_EMAIL_TO;
    delete process.env.SLACK_WEBHOOK_URL;
    delete process.env.ALERT_WEBHOOK_URL;
  });

  describe('Email Alert Channel', () => {
    describe('Configuration Validation', () => {
      it('validates SMTP configuration on startup', async () => {
        mockTransporter.verify.mockResolvedValue(true);
        
        const isValid = await alertService.validateEmailConfig();
        
        expect(isValid).toBe(true);
        expect(nodemailer.createTransporter).toHaveBeenCalledWith({
          host: 'smtp.test.com',
          port: 587,
          secure: false,
          auth: {
            user: 'test@example.com',
            pass: 'testpass'
          }
        });
        expect(mockTransporter.verify).toHaveBeenCalled();
      });

      it('handles invalid SMTP configuration', async () => {
        mockTransporter.verify.mockRejectedValue(new Error('SMTP Auth failed'));
        
        const isValid = await alertService.validateEmailConfig();
        
        expect(isValid).toBe(false);
      });

      it('requires all SMTP environment variables', async () => {
        delete process.env.SMTP_HOST;
        
        const isValid = await alertService.validateEmailConfig();
        
        expect(isValid).toBe(false);
      });
    });

    describe('Email Sending', () => {
      it('sends critical alerts with high priority', async () => {
        mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-123' });
        
        await alertService.sendEmailAlert(
          'critical',
          'Database Connection Lost',
          'PostgreSQL container is not responding'
        );
        
        expect(mockTransporter.sendMail).toHaveBeenCalledWith({
          from: 'test@example.com',
          to: 'admin@example.com',
          subject: '[CRITICAL] Database Connection Lost',
          priority: 'high',
          text: expect.stringContaining('PostgreSQL container is not responding'),
          html: expect.stringContaining('PostgreSQL container is not responding')
        });
      });

      it('sends warning alerts with normal priority', async () => {
        mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-456' });
        
        await alertService.sendEmailAlert(
          'warning',
          'High CPU Usage',
          'nginx container CPU at 85%'
        );
        
        expect(mockTransporter.sendMail).toHaveBeenCalledWith(
          expect.objectContaining({
            subject: '[WARNING] High CPU Usage',
            priority: 'normal'
          })
        );
      });

      it('includes system information in email body', async () => {
        mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-789' });
        
        await alertService.sendEmailAlert(
          'warning',
          'Test Alert',
          'Test message',
          { containerId: 'nginx-123', containerName: 'nginx-web' }
        );
        
        const emailCall = mockTransporter.sendMail.mock.calls[0][0];
        expect(emailCall.html).toContain('nginx-123');
        expect(emailCall.html).toContain('nginx-web');
        expect(emailCall.html).toContain(new Date().getFullYear().toString());
      });

      it('handles email delivery failures with retries', async () => {
        mockTransporter.sendMail
          .mockRejectedValueOnce(new Error('Temporary SMTP error'))
          .mockRejectedValueOnce(new Error('Still failing'))
          .mockResolvedValueOnce({ messageId: 'success-123' });
        
        const result = await alertService.sendEmailAlert(
          'critical',
          'Retry Test',
          'Testing retry mechanism'
        );
        
        expect(mockTransporter.sendMail).toHaveBeenCalledTimes(3);
        expect(result.success).toBe(true);
        expect(result.messageId).toBe('success-123');
      });

      it('gives up after maximum retry attempts', async () => {
        mockTransporter.sendMail.mockRejectedValue(new Error('Persistent failure'));
        
        const result = await alertService.sendEmailAlert(
          'warning',
          'Failed Test',
          'This should fail'
        );
        
        expect(mockTransporter.sendMail).toHaveBeenCalledTimes(3); // Initial + 2 retries
        expect(result.success).toBe(false);
        expect(result.error).toContain('Persistent failure');
      });

      it('formats HTML emails with proper styling', async () => {
        mockTransporter.sendMail.mockResolvedValue({ messageId: 'html-test' });
        
        await alertService.sendEmailAlert('critical', 'HTML Test', 'Test message');
        
        const emailCall = mockTransporter.sendMail.mock.calls[0][0];
        expect(emailCall.html).toContain('<!DOCTYPE html>');
        expect(emailCall.html).toContain('background-color: #dc3545'); // Critical red
        expect(emailCall.html).toContain('HomeOps Monitoring Alert');
      });

      it('supports multiple recipient addresses', async () => {
        process.env.ALERT_EMAIL_TO = 'admin@example.com,ops@example.com,alerts@example.com';
        mockTransporter.sendMail.mockResolvedValue({ messageId: 'multi-test' });
        
        await alertService.sendEmailAlert('warning', 'Multi Recipient', 'Test');
        
        const emailCall = mockTransporter.sendMail.mock.calls[0][0];
        expect(emailCall.to).toContain('admin@example.com');
        expect(emailCall.to).toContain('ops@example.com');
        expect(emailCall.to).toContain('alerts@example.com');
      });
    });
  });

  describe('Slack Alert Channel', () => {
    describe('Webhook Integration', () => {
      it('sends alerts to Slack webhook successfully', async () => {
        (axios.post as jest.Mock).mockResolvedValue({ 
          status: 200, 
          data: { ok: true } 
        });
        
        await alertService.sendSlackAlert(
          'warning',
          'High Memory Usage',
          'Redis container memory at 90%'
        );
        
        expect(axios.post).toHaveBeenCalledWith(
          'https://hooks.slack.com/test',
          {
            text: 'HomeOps Alert',
            attachments: [
              {
                color: 'warning',
                title: '[WARNING] High Memory Usage',
                text: 'Redis container memory at 90%',
                timestamp: expect.any(Number),
                footer: 'HomeOps Monitoring',
                fields: [
                  {
                    title: 'Severity',
                    value: 'warning',
                    short: true
                  },
                  {
                    title: 'Time',
                    value: expect.any(String),
                    short: true
                  }
                ]
              }
            ]
          },
          expect.objectContaining({
            headers: {
              'Content-Type': 'application/json'
            }
          })
        );
      });

      it('uses different colors for different severity levels', async () => {
        (axios.post as jest.Mock).mockResolvedValue({ status: 200 });
        
        const testCases = [
          { severity: 'critical', expectedColor: 'danger' },
          { severity: 'warning', expectedColor: 'warning' },
          { severity: 'info', expectedColor: 'good' }
        ];
        
        for (const { severity, expectedColor } of testCases) {
          await alertService.sendSlackAlert(severity, 'Test', 'Message');
          
          const lastCall = (axios.post as jest.Mock).mock.calls.pop();
          expect(lastCall[1].attachments[0].color).toBe(expectedColor);
        }
      });

      it('includes additional context in Slack message', async () => {
        (axios.post as jest.Mock).mockResolvedValue({ status: 200 });
        
        await alertService.sendSlackAlert(
          'critical',
          'Container Down',
          'nginx container has stopped',
          {
            containerId: 'nginx-web-123',
            containerName: 'nginx-web',
            uptime: '2 days',
            lastSeen: '2024-01-20T10:30:00Z'
          }
        );
        
        const slackPayload = (axios.post as jest.Mock).mock.calls[0][1];
        const attachment = slackPayload.attachments[0];
        
        expect(attachment.fields).toContainEqual({
          title: 'Container',
          value: 'nginx-web (nginx-web-123)',
          short: false
        });
        expect(attachment.fields).toContainEqual({
          title: 'Last Seen',
          value: expect.any(String),
          short: true
        });
      });

      it('handles Slack webhook failures gracefully', async () => {
        (axios.post as jest.Mock).mockRejectedValue({
          response: {
            status: 400,
            data: { error: 'invalid_payload' }
          }
        });
        
        const result = await alertService.sendSlackAlert(
          'warning',
          'Webhook Test',
          'This should fail'
        );
        
        expect(result.success).toBe(false);
        expect(result.error).toContain('invalid_payload');
      });

      it('retries on network errors', async () => {
        (axios.post as jest.Mock)
          .mockRejectedValueOnce(new Error('Network timeout'))
          .mockResolvedValueOnce({ status: 200 });
        
        const result = await alertService.sendSlackAlert(
          'info',
          'Retry Test',
          'Testing retry'
        );
        
        expect(axios.post).toHaveBeenCalledTimes(2);
        expect(result.success).toBe(true);
      });

      it('validates webhook URL format', async () => {
        process.env.SLACK_WEBHOOK_URL = 'invalid-url';
        
        const result = await alertService.sendSlackAlert(
          'info',
          'URL Test',
          'Invalid URL test'
        );
        
        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid webhook URL');
      });
    });

    describe('Message Formatting', () => {
      it('truncates long messages appropriately', async () => {
        (axios.post as jest.Mock).mockResolvedValue({ status: 200 });
        
        const longMessage = 'A'.repeat(8000); // Very long message
        
        await alertService.sendSlackAlert('info', 'Long Message Test', longMessage);
        
        const slackPayload = (axios.post as jest.Mock).mock.calls[0][1];
        const messageText = slackPayload.attachments[0].text;
        
        expect(messageText.length).toBeLessThan(7500);
        expect(messageText).toContain('...[truncated]');
      });

      it('escapes special Slack characters', async () => {
        (axios.post as jest.Mock).mockResolvedValue({ status: 200 });
        
        const messageWithSpecialChars = 'Container <nginx> failed with error: "Connection refused" & timeout';
        
        await alertService.sendSlackAlert('error', 'Special Chars', messageWithSpecialChars);
        
        const slackPayload = (axios.post as jest.Mock).mock.calls[0][1];
        const messageText = slackPayload.attachments[0].text;
        
        expect(messageText).toContain('&lt;nginx&gt;');
        expect(messageText).toContain('&quot;Connection refused&quot;');
        expect(messageText).toContain('&amp;');
      });

      it('formats metrics data in readable format', async () => {
        (axios.post as jest.Mock).mockResolvedValue({ status: 200 });
        
        const metricsData = {
          cpu: 85.5,
          memory: 78.2,
          diskUsage: 92.1,
          networkRx: 1048576,
          networkTx: 524288
        };
        
        await alertService.sendSlackAlert(
          'warning',
          'High Resource Usage',
          'Multiple metrics exceeded thresholds',
          metricsData
        );
        
        const slackPayload = (axios.post as jest.Mock).mock.calls[0][1];
        const attachment = slackPayload.attachments[0];
        
        expect(attachment.fields).toContainEqual({
          title: 'CPU Usage',
          value: '85.5%',
          short: true
        });
        expect(attachment.fields).toContainEqual({
          title: 'Network RX',
          value: '1.0 MB',
          short: true
        });
      });
    });
  });

  describe('Webhook Alert Channel', () => {
    describe('Generic Webhook Support', () => {
      it('sends POST requests to configured webhook URLs', async () => {
        (axios.post as jest.Mock).mockResolvedValue({
          status: 200,
          data: { received: true }
        });
        
        await alertService.sendWebhookAlert(
          'https://api.example.com/alerts',
          'critical',
          'Database Offline',
          'PostgreSQL container is not responding'
        );
        
        expect(axios.post).toHaveBeenCalledWith(
          'https://api.example.com/alerts',
          {
            severity: 'critical',
            title: 'Database Offline',
            message: 'PostgreSQL container is not responding',
            timestamp: expect.any(String),
            source: 'HomeOps',
            hostname: expect.any(String),
            tags: ['monitoring', 'container', 'critical']
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'HomeOps-Monitor/1.0'
            },
            timeout: 10000
          }
        );
      });

      it('includes custom headers when configured', async () => {
        (axios.post as jest.Mock).mockResolvedValue({ status: 200 });
        
        const webhookConfig = {
          url: 'https://api.example.com/alerts',
          headers: {
            'Authorization': 'Bearer test-token',
            'X-API-Key': 'secret-key'
          }
        };
        
        await alertService.sendWebhookAlert(
          webhookConfig.url,
          'warning',
          'Custom Headers Test',
          'Testing custom headers',
          {},
          webhookConfig.headers
        );
        
        expect(axios.post).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(Object),
          expect.objectContaining({
            headers: expect.objectContaining({
              'Authorization': 'Bearer test-token',
              'X-API-Key': 'secret-key'
            })
          })
        );
      });

      it('handles webhook authentication failures', async () => {
        (axios.post as jest.Mock).mockRejectedValue({
          response: {
            status: 401,
            data: { error: 'Unauthorized' }
          }
        });
        
        const result = await alertService.sendWebhookAlert(
          'https://api.example.com/alerts',
          'info',
          'Auth Test',
          'Testing authentication'
        );
        
        expect(result.success).toBe(false);
        expect(result.error).toContain('Unauthorized');
        expect(result.statusCode).toBe(401);
      });

      it('respects webhook timeout configuration', async () => {
        (axios.post as jest.Mock).mockImplementation(() => 
          new Promise(resolve => setTimeout(resolve, 15000))
        );
        
        const startTime = Date.now();
        
        const result = await alertService.sendWebhookAlert(
          'https://slow-api.example.com/alerts',
          'info',
          'Timeout Test',
          'Testing timeout'
        );
        
        const duration = Date.now() - startTime;
        
        expect(duration).toBeLessThan(11000); // Should timeout at 10s
        expect(result.success).toBe(false);
        expect(result.error).toContain('timeout');
      });

      it('supports different payload formats', async () => {
        (axios.post as jest.Mock).mockResolvedValue({ status: 200 });
        
        const customFormat = {
          alert: {
            level: 'HIGH',
            description: 'Custom format test',
            metadata: {
              service: 'nginx',
              timestamp: new Date().toISOString()
            }
          }
        };
        
        await alertService.sendWebhookAlert(
          'https://api.example.com/custom',
          'warning',
          'Custom Format',
          'Testing custom payload',
          {},
          {},
          customFormat
        );
        
        expect(axios.post).toHaveBeenCalledWith(
          'https://api.example.com/custom',
          customFormat,
          expect.any(Object)
        );
      });
    });
  });

  describe('Multi-Channel Alert Distribution', () => {
    it('sends alerts to multiple channels simultaneously', async () => {
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'email-123' });
      (axios.post as jest.Mock).mockResolvedValue({ status: 200 });
      
      const channels = ['email', 'slack', 'webhook'];
      
      await alertService.sendMultiChannelAlert(
        'critical',
        'Multi-Channel Test',
        'Testing multiple channels',
        channels
      );
      
      expect(mockTransporter.sendMail).toHaveBeenCalled();
      expect(axios.post).toHaveBeenCalledTimes(2); // Slack + webhook
    });

    it('continues with successful channels if some fail', async () => {
      mockTransporter.sendMail.mockRejectedValue(new Error('Email failed'));
      (axios.post as jest.Mock)
        .mockResolvedValueOnce({ status: 200 }) // Slack succeeds
        .mockRejectedValueOnce(new Error('Webhook failed'));
      
      const result = await alertService.sendMultiChannelAlert(
        'warning',
        'Partial Failure Test',
        'Testing partial failures',
        ['email', 'slack', 'webhook']
      );
      
      expect(result.successful).toContain('slack');
      expect(result.failed).toContain('email');
      expect(result.failed).toContain('webhook');
      expect(result.partialSuccess).toBe(true);
    });
  });

  describe('Channel Health Monitoring', () => {
    it('monitors channel health and disables failing channels temporarily', async () => {
      // Simulate repeated failures
      mockTransporter.sendMail.mockRejectedValue(new Error('SMTP down'));
      
      for (let i = 0; i < 5; i++) {
        await alertService.sendEmailAlert('test', 'Health Test', 'Testing');
      }
      
      const channelHealth = await alertService.getChannelHealth();
      
      expect(channelHealth.email.status).toBe('unhealthy');
      expect(channelHealth.email.consecutiveFailures).toBe(5);
      expect(channelHealth.email.temporarilyDisabled).toBe(true);
    });

    it('re-enables channels after successful delivery', async () => {
      // First, make channel unhealthy
      mockTransporter.sendMail.mockRejectedValue(new Error('Temporary failure'));
      
      for (let i = 0; i < 3; i++) {
        await alertService.sendEmailAlert('test', 'Failure Test', 'Testing');
      }
      
      // Then make it healthy again
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'recovery-123' });
      
      await alertService.sendEmailAlert('info', 'Recovery Test', 'Testing recovery');
      
      const channelHealth = await alertService.getChannelHealth();
      
      expect(channelHealth.email.status).toBe('healthy');
      expect(channelHealth.email.consecutiveFailures).toBe(0);
      expect(channelHealth.email.temporarilyDisabled).toBe(false);
    });
  });
});