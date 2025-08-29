import { AlertService } from '../alert.service';
import { Pool } from 'pg';
import { CacheService } from '../cache.service';
import nodemailer from 'nodemailer';
import axios from 'axios';

jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: jest.fn(),
    connect: jest.fn(),
    end: jest.fn()
  }))
}));
jest.mock('../cache.service');
jest.mock('nodemailer');
jest.mock('axios');

describe('AlertService', () => {
  let service: AlertService;
  let mockPool: jest.Mocked<Pool>;
  let mockCacheService: jest.Mocked<CacheService>;
  let mockTransporter: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockPool = new Pool() as jest.Mocked<Pool>;
    mockCacheService = new CacheService() as jest.Mocked<CacheService>;
    
    mockTransporter = {
      sendMail: jest.fn().mockResolvedValue({ messageId: 'test-id' })
    };
    
    (nodemailer.createTransport as jest.Mock).mockReturnValue(mockTransporter);
    
    service = new AlertService(mockPool, mockCacheService);
  });

  describe('threshold checking', () => {
    it('should check thresholds and trigger alerts', async () => {
      const alertRules = [
        {
          id: 'rule1',
          name: 'High CPU Alert',
          metric: 'cpu',
          threshold: 80,
          operator: '>',
          severity: 'warning',
          channels: ['email', 'slack'],
          enabled: true
        }
      ];

      const metrics = {
        container_id: 'nginx-1',
        container_name: 'nginx',
        cpu: 85,
        memory: 45,
        timestamp: new Date()
      };

      mockPool.query = jest.fn().mockResolvedValue({ rows: alertRules });
      const sendSpy = jest.spyOn(service, 'sendAlert').mockResolvedValue(undefined);

      await service.checkThresholds(metrics);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM alert_rules WHERE enabled = true')
      );
      expect(sendSpy).toHaveBeenCalledWith(
        'warning',
        'High CPU Alert',
        expect.stringContaining('nginx'),
        ['email', 'slack']
      );
    });

    it('should handle multiple threshold operators', async () => {
      const testCases = [
        { operator: '>', threshold: 80, value: 85, shouldTrigger: true },
        { operator: '>=', threshold: 80, value: 80, shouldTrigger: true },
        { operator: '<', threshold: 20, value: 15, shouldTrigger: true },
        { operator: '<=', threshold: 20, value: 20, shouldTrigger: true },
        { operator: '==', threshold: 50, value: 50, shouldTrigger: true },
        { operator: '!=', threshold: 50, value: 60, shouldTrigger: true },
        { operator: '>', threshold: 80, value: 75, shouldTrigger: false },
        { operator: '<', threshold: 20, value: 25, shouldTrigger: false }
      ];

      for (const testCase of testCases) {
        const result = service['evaluateThreshold'](
          testCase.value,
          testCase.operator,
          testCase.threshold
        );
        expect(result).toBe(testCase.shouldTrigger);
      }
    });

    it('should not trigger alerts for disabled rules', async () => {
      const alertRules = [
        {
          id: 'rule1',
          name: 'Disabled Alert',
          metric: 'cpu',
          threshold: 50,
          operator: '>',
          enabled: false
        }
      ];

      const metrics = { cpu: 90 };
      mockPool.query = jest.fn().mockResolvedValue({ rows: alertRules });
      const sendSpy = jest.spyOn(service, 'sendAlert').mockResolvedValue(undefined);

      await service.checkThresholds(metrics);

      expect(sendSpy).not.toHaveBeenCalled();
    });
  });

  describe('alert deduplication', () => {
    it('should prevent duplicate alerts within cooldown period', async () => {
      const alertKey = 'high-cpu-nginx-1';
      const cooldownMinutes = 5;

      // First alert
      mockCacheService.get = jest.fn().mockResolvedValue(null);
      mockCacheService.set = jest.fn().mockResolvedValue('OK');

      const canSend1 = await service['checkAlertCooldown'](alertKey, cooldownMinutes);
      expect(canSend1).toBe(true);
      expect(mockCacheService.set).toHaveBeenCalledWith(
        `alert:cooldown:${alertKey}`,
        expect.any(String),
        300
      );

      // Second alert within cooldown
      mockCacheService.get = jest.fn().mockResolvedValue('timestamp');
      const canSend2 = await service['checkAlertCooldown'](alertKey, cooldownMinutes);
      expect(canSend2).toBe(false);
    });

    it('should allow alerts after cooldown period expires', async () => {
      const alertKey = 'high-memory-redis';
      
      mockCacheService.get = jest.fn().mockResolvedValue(null);
      
      const canSend = await service['checkAlertCooldown'](alertKey, 5);
      expect(canSend).toBe(true);
    });

    it('should track alert history for deduplication', async () => {
      const alert = {
        severity: 'warning',
        title: 'High CPU',
        message: 'CPU at 85%',
        container_id: 'nginx-1'
      };

      mockPool.query = jest.fn().mockResolvedValue({ rowCount: 1 });

      await service.recordAlert(alert);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO alert_history'),
        expect.arrayContaining([alert.severity, alert.title, alert.message])
      );
    });
  });

  describe('notification channels', () => {
    describe('email notifications', () => {
      it('should send email alerts successfully', async () => {
        process.env.SMTP_HOST = 'smtp.gmail.com';
        process.env.SMTP_USER = 'test@example.com';
        process.env.SMTP_PASS = 'password';
        process.env.ALERT_EMAIL_TO = 'admin@example.com';

        await service.sendEmailAlert('warning', 'Test Alert', 'Alert message');

        expect(nodemailer.createTransport).toHaveBeenCalledWith({
          host: 'smtp.gmail.com',
          port: 587,
          secure: false,
          auth: {
            user: 'test@example.com',
            pass: 'password'
          }
        });

        expect(mockTransporter.sendMail).toHaveBeenCalledWith({
          from: 'test@example.com',
          to: 'admin@example.com',
          subject: '[WARNING] Test Alert',
          text: expect.stringContaining('Alert message'),
          html: expect.stringContaining('Alert message')
        });
      });

      it('should handle email sending failures', async () => {
        mockTransporter.sendMail = jest.fn().mockRejectedValue(new Error('SMTP error'));

        await expect(
          service.sendEmailAlert('critical', 'Test', 'Message')
        ).rejects.toThrow('SMTP error');
      });

      it('should format email HTML content properly', () => {
        const html = service['formatEmailHTML']('critical', 'Database Down', 'Connection failed');
        
        expect(html).toContain('<!DOCTYPE html>');
        expect(html).toContain('Database Down');
        expect(html).toContain('Connection failed');
        expect(html).toContain('background-color: #dc3545'); // Critical color
      });
    });

    describe('Slack notifications', () => {
      it('should send Slack notifications successfully', async () => {
        process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';

        (axios.post as jest.Mock).mockResolvedValue({ status: 200 });

        await service.sendSlackAlert('warning', 'High Memory', 'Memory at 90%');

        expect(axios.post).toHaveBeenCalledWith(
          'https://hooks.slack.com/test',
          {
            text: 'HomeOps Alert',
            attachments: [
              {
                color: 'warning',
                title: '[WARNING] High Memory',
                text: 'Memory at 90%',
                timestamp: expect.any(Number),
                footer: 'HomeOps Monitoring'
              }
            ]
          }
        );
      });

      it('should handle Slack webhook failures', async () => {
        process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';
        
        (axios.post as jest.Mock).mockRejectedValue(new Error('Network error'));

        await expect(
          service.sendSlackAlert('info', 'Test', 'Message')
        ).rejects.toThrow('Network error');
      });

      it('should format Slack message with proper colors', async () => {
        const colorMap = {
          critical: 'danger',
          warning: 'warning',
          info: 'good'
        };

        for (const [severity, color] of Object.entries(colorMap)) {
          (axios.post as jest.Mock).mockResolvedValue({ status: 200 });
          
          await service.sendSlackAlert(severity, 'Test', 'Message');
          
          expect(axios.post).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
              attachments: expect.arrayContaining([
                expect.objectContaining({ color })
              ])
            })
          );
        }
      });
    });

    describe('webhook notifications', () => {
      it('should send webhook notifications successfully', async () => {
        const webhookUrl = 'https://api.example.com/webhook';
        
        (axios.post as jest.Mock).mockResolvedValue({ status: 200, data: { success: true } });

        await service.sendWebhookAlert(webhookUrl, 'warning', 'Test Alert', 'Alert details');

        expect(axios.post).toHaveBeenCalledWith(
          webhookUrl,
          {
            severity: 'warning',
            title: 'Test Alert',
            message: 'Alert details',
            timestamp: expect.any(String),
            source: 'HomeOps'
          },
          expect.objectContaining({
            headers: {
              'Content-Type': 'application/json'
            }
          })
        );
      });

      it('should retry webhook on failure', async () => {
        const webhookUrl = 'https://api.example.com/webhook';
        
        (axios.post as jest.Mock)
          .mockRejectedValueOnce(new Error('Network error'))
          .mockResolvedValueOnce({ status: 200 });

        await service.sendWebhookAlert(webhookUrl, 'info', 'Test', 'Message');

        expect(axios.post).toHaveBeenCalledTimes(2);
      });

      it('should respect webhook timeout', async () => {
        const webhookUrl = 'https://api.example.com/webhook';
        
        (axios.post as jest.Mock).mockImplementation(() => 
          new Promise(resolve => setTimeout(resolve, 10000))
        );

        const timeoutPromise = Promise.race([
          service.sendWebhookAlert(webhookUrl, 'info', 'Test', 'Message'),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 5000)
          )
        ]);

        await expect(timeoutPromise).rejects.toThrow('Timeout');
      });
    });
  });

  describe('rate limiting', () => {
    it('should enforce rate limiting per channel', async () => {
      const rateLimits = {
        email: { maxPerHour: 10, current: 0 },
        slack: { maxPerHour: 30, current: 0 }
      };

      for (let i = 0; i < 15; i++) {
        const canSendEmail = await service['checkRateLimit']('email', 10);
        const canSendSlack = await service['checkRateLimit']('slack', 30);
        
        if (i < 10) {
          expect(canSendEmail).toBe(true);
        } else {
          expect(canSendEmail).toBe(false);
        }
        
        expect(canSendSlack).toBe(true);
      }
    });

    it('should reset rate limits after time window', async () => {
      jest.useFakeTimers();
      
      // Fill up rate limit
      for (let i = 0; i < 10; i++) {
        await service['checkRateLimit']('email', 10);
      }
      
      // Should be rate limited
      let canSend = await service['checkRateLimit']('email', 10);
      expect(canSend).toBe(false);
      
      // Advance time by 1 hour
      jest.advanceTimersByTime(3600000);
      
      // Should be able to send again
      canSend = await service['checkRateLimit']('email', 10);
      expect(canSend).toBe(true);
      
      jest.useRealTimers();
    });

    it('should track rate limit violations', async () => {
      const logSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      // Fill up rate limit
      for (let i = 0; i < 11; i++) {
        await service['checkRateLimit']('email', 10);
      }
      
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Rate limit exceeded for email')
      );
      
      logSpy.mockRestore();
    });
  });

  describe('alert configuration', () => {
    it('should create new alert rules', async () => {
      const newRule = {
        name: 'CPU Alert',
        metric: 'cpu',
        threshold: 75,
        operator: '>',
        severity: 'warning',
        channels: ['email'],
        cooldown_minutes: 5,
        enabled: true
      };

      mockPool.query = jest.fn().mockResolvedValue({ 
        rows: [{ id: 'rule-123', ...newRule }] 
      });

      const created = await service.createAlertRule(newRule);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO alert_rules'),
        expect.arrayContaining([
          newRule.name,
          newRule.metric,
          newRule.threshold,
          newRule.operator
        ])
      );
      expect(created.id).toBe('rule-123');
    });

    it('should update existing alert rules', async () => {
      const updates = {
        threshold: 85,
        enabled: false
      };

      mockPool.query = jest.fn().mockResolvedValue({ rowCount: 1 });

      await service.updateAlertRule('rule-123', updates);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE alert_rules'),
        expect.arrayContaining([85, false, 'rule-123'])
      );
    });

    it('should delete alert rules', async () => {
      mockPool.query = jest.fn().mockResolvedValue({ rowCount: 1 });

      await service.deleteAlertRule('rule-123');

      expect(mockPool.query).toHaveBeenCalledWith(
        'DELETE FROM alert_rules WHERE id = $1',
        ['rule-123']
      );
    });

    it('should test alert channels', async () => {
      const testResults = await service.testAlertChannel('email');
      
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining('Test')
        })
      );
    });
  });

  describe('alert aggregation', () => {
    it('should aggregate multiple alerts into digest', async () => {
      const alerts = [
        { severity: 'warning', title: 'High CPU', container: 'nginx' },
        { severity: 'warning', title: 'High Memory', container: 'redis' },
        { severity: 'critical', title: 'Container Down', container: 'postgres' }
      ];

      const digest = service['createAlertDigest'](alerts);
      
      expect(digest).toContain('3 alerts');
      expect(digest).toContain('1 critical');
      expect(digest).toContain('2 warning');
      expect(digest).toContain('nginx');
      expect(digest).toContain('redis');
      expect(digest).toContain('postgres');
    });

    it('should send digest at configured intervals', async () => {
      jest.useFakeTimers();
      
      service.enableDigestMode(60); // 60 minute digest
      
      // Add alerts
      service['queueAlert']({ severity: 'warning', title: 'Alert 1' });
      service['queueAlert']({ severity: 'warning', title: 'Alert 2' });
      
      // Advance time
      jest.advanceTimersByTime(3600000); // 1 hour
      
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining('Alert Digest')
        })
      );
      
      jest.useRealTimers();
    });
  });
});