import nodemailer from 'nodemailer';
import axios from 'axios';
import { EventEmitter } from 'events';
import winston from 'winston';
import { Pool } from 'pg';
import Redis from 'ioredis';

export enum AlertChannel {
  EMAIL = 'email',
  SLACK = 'slack',
  WEBHOOK = 'webhook',
  DISCORD = 'discord'
}

export enum AlertPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum AlertMetricType {
  CPU = 'cpu',
  MEMORY = 'memory',
  DISK = 'disk',
  NETWORK = 'network',
  CONTAINER_STATUS = 'container_status',
  HEALTH_CHECK = 'health_check',
  RESTART_COUNT = 'restart_count'
}

export enum ComparisonOperator {
  GREATER_THAN = '>',
  LESS_THAN = '<',
  EQUAL = '=',
  NOT_EQUAL = '!=',
  GREATER_THAN_OR_EQUAL = '>=',
  LESS_THAN_OR_EQUAL = '<='
}

interface AlertConfig {
  id?: string;
  name: string;
  enabled: boolean;
  containerId?: string;
  containerName?: string;
  metricType: AlertMetricType;
  thresholdValue: number;
  comparisonOperator: ComparisonOperator;
  channels: AlertChannelConfig[];
  priority: AlertPriority;
  cooldownMinutes?: number;
  description?: string;
}

interface AlertChannelConfig {
  type: AlertChannel;
  config: Record<string, any>;
  enabled: boolean;
}

interface AlertHistory {
  id: string;
  alertId: string;
  alertName: string;
  triggeredAt: Date;
  metricValue: number;
  thresholdValue: number;
  message: string;
  channels: string[];
  status: 'sent' | 'failed' | 'suppressed';
  error?: string;
}

interface ThresholdCheck {
  metricType: AlertMetricType;
  currentValue: number;
  thresholdValue: number;
  operator: ComparisonOperator;
  exceeded: boolean;
}

export class AlertService extends EventEmitter {
  private pgPool: Pool;
  private redis: Redis;
  private logger: winston.Logger;
  private emailTransporter?: nodemailer.Transporter;
  private alertConfigs: Map<string, AlertConfig>;
  private lastAlertTimes: Map<string, Date>;
  private rateLimitMinutes: number;

  constructor(pgConnectionString?: string, redisUrl?: string) {
    super();
    
    // Initialize PostgreSQL
    const connectionString = pgConnectionString || process.env.TIMESCALE_URL || 
      'postgresql://homeops:homeops123@localhost:5433/metrics';
    
    this.pgPool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30000,
    });
    
    // Initialize Redis for rate limiting
    this.redis = new Redis(redisUrl || process.env.REDIS_URL || 'redis://localhost:6379');
    
    // Initialize logger
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.simple(),
        }),
        new winston.transports.File({ 
          filename: 'logs/alerts.log',
          maxsize: 5242880, // 5MB
          maxFiles: 5
        })
      ],
    });
    
    this.alertConfigs = new Map();
    this.lastAlertTimes = new Map();
    this.rateLimitMinutes = parseInt(process.env.ALERT_RATE_LIMIT || '15');
    
    // Initialize email transporter if configured
    this.initializeEmailTransporter();
  }

  private initializeEmailTransporter(): void {
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    
    if (smtpHost && smtpPort && smtpUser && smtpPass) {
      this.emailTransporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(smtpPort),
        secure: parseInt(smtpPort) === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass
        }
      });
      
      this.logger.info('Email transporter initialized');
    } else {
      this.logger.warn('Email configuration incomplete, email alerts disabled');
    }
  }

  async initialize(): Promise<void> {
    try {
      // Load alert configurations from database
      await this.loadAlertConfigs();
      
      // Test database connection
      await this.pgPool.query('SELECT NOW()');
      
      // Test Redis connection
      await this.redis.ping();
      
      this.logger.info('Alert service initialized');
      
    } catch (error) {
      this.logger.error('Failed to initialize alert service', error);
      throw error;
    }
  }

  async checkThresholds(metrics: Record<string, any>): Promise<ThresholdCheck[]> {
    const checks: ThresholdCheck[] = [];
    
    for (const [id, config] of this.alertConfigs) {
      if (!config.enabled) continue;
      
      // Check if this alert applies to this container
      if (config.containerId && metrics.containerId !== config.containerId) {
        continue;
      }
      
      if (config.containerName && metrics.containerName !== config.containerName) {
        continue;
      }
      
      // Get the metric value based on type
      let currentValue = 0;
      
      switch (config.metricType) {
        case AlertMetricType.CPU:
          currentValue = metrics.cpuPercent || 0;
          break;
        case AlertMetricType.MEMORY:
          currentValue = metrics.memoryPercent || 0;
          break;
        case AlertMetricType.DISK:
          currentValue = metrics.diskPercent || 0;
          break;
        case AlertMetricType.NETWORK:
          currentValue = (metrics.networkRxBytes + metrics.networkTxBytes) / 1024 / 1024; // MB
          break;
        case AlertMetricType.RESTART_COUNT:
          currentValue = metrics.restartCount || 0;
          break;
        default:
          continue;
      }
      
      // Check threshold
      const exceeded = this.compareValues(
        currentValue, 
        config.thresholdValue, 
        config.comparisonOperator
      );
      
      const check: ThresholdCheck = {
        metricType: config.metricType,
        currentValue,
        thresholdValue: config.thresholdValue,
        operator: config.comparisonOperator,
        exceeded
      };
      
      checks.push(check);
      
      // Trigger alert if threshold exceeded
      if (exceeded) {
        await this.triggerAlert(config, metrics, currentValue);
      }
    }
    
    return checks;
  }

  private compareValues(
    current: number, 
    threshold: number, 
    operator: ComparisonOperator
  ): boolean {
    switch (operator) {
      case ComparisonOperator.GREATER_THAN:
        return current > threshold;
      case ComparisonOperator.LESS_THAN:
        return current < threshold;
      case ComparisonOperator.EQUAL:
        return current === threshold;
      case ComparisonOperator.NOT_EQUAL:
        return current !== threshold;
      case ComparisonOperator.GREATER_THAN_OR_EQUAL:
        return current >= threshold;
      case ComparisonOperator.LESS_THAN_OR_EQUAL:
        return current <= threshold;
      default:
        return false;
    }
  }

  private async triggerAlert(
    config: AlertConfig, 
    metrics: Record<string, any>,
    currentValue: number
  ): Promise<void> {
    try {
      // Check rate limiting
      if (await this.isRateLimited(config.id || config.name)) {
        this.logger.debug(`Alert ${config.name} is rate limited`);
        await this.recordAlertHistory(config, currentValue, config.thresholdValue, 'suppressed');
        return;
      }
      
      // Build alert message
      const message = this.buildAlertMessage(config, metrics, currentValue);
      
      // Send to all enabled channels
      const sentChannels: string[] = [];
      let sendFailed = false;
      
      for (const channel of config.channels) {
        if (!channel.enabled) continue;
        
        try {
          await this.sendAlert(channel, message, config);
          sentChannels.push(channel.type);
        } catch (error) {
          this.logger.error(`Failed to send alert to ${channel.type}`, error);
          sendFailed = true;
        }
      }
      
      // Update rate limit
      await this.updateRateLimit(config.id || config.name);
      
      // Record in history
      await this.recordAlertHistory(
        config, 
        currentValue, 
        config.thresholdValue,
        sendFailed ? 'failed' : 'sent',
        message,
        sentChannels
      );
      
      // Emit event
      this.emit('alert:triggered', {
        config,
        metrics,
        currentValue,
        message,
        sentChannels
      });
      
    } catch (error) {
      this.logger.error('Failed to trigger alert', error);
    }
  }

  async sendAlert(
    channel: AlertChannelConfig, 
    message: string, 
    alertConfig: AlertConfig
  ): Promise<void> {
    switch (channel.type) {
      case AlertChannel.EMAIL:
        await this.sendEmailAlert(channel.config, message, alertConfig);
        break;
      case AlertChannel.SLACK:
        await this.sendSlackAlert(channel.config, message, alertConfig);
        break;
      case AlertChannel.WEBHOOK:
        await this.sendWebhookAlert(channel.config, message, alertConfig);
        break;
      case AlertChannel.DISCORD:
        await this.sendDiscordAlert(channel.config, message, alertConfig);
        break;
      default:
        throw new Error(`Unknown channel type: ${channel.type}`);
    }
  }

  private async sendEmailAlert(
    config: Record<string, any>, 
    message: string,
    alertConfig: AlertConfig
  ): Promise<void> {
    if (!this.emailTransporter) {
      throw new Error('Email transporter not configured');
    }
    
    const mailOptions = {
      from: config.from || process.env.SMTP_USER,
      to: config.to,
      subject: config.subject || `[HomeOps Alert] ${alertConfig.name}`,
      text: message,
      html: this.formatEmailHtml(message, alertConfig)
    };
    
    await this.emailTransporter.sendMail(mailOptions);
    this.logger.info(`Email alert sent to ${config.to}`);
  }

  private async sendSlackAlert(
    config: Record<string, any>, 
    message: string,
    alertConfig: AlertConfig
  ): Promise<void> {
    const webhookUrl = config.webhookUrl || process.env.SLACK_WEBHOOK_URL;
    
    if (!webhookUrl) {
      throw new Error('Slack webhook URL not configured');
    }
    
    const payload = {
      text: `*HomeOps Alert: ${alertConfig.name}*`,
      attachments: [{
        color: this.getPriorityColor(alertConfig.priority),
        text: message,
        footer: 'HomeOps Monitoring',
        ts: Math.floor(Date.now() / 1000)
      }]
    };
    
    await axios.post(webhookUrl, payload);
    this.logger.info('Slack alert sent');
  }

  private async sendWebhookAlert(
    config: Record<string, any>, 
    message: string,
    alertConfig: AlertConfig
  ): Promise<void> {
    const url = config.url;
    
    if (!url) {
      throw new Error('Webhook URL not configured');
    }
    
    const payload = {
      alert: alertConfig.name,
      priority: alertConfig.priority,
      message,
      timestamp: new Date().toISOString(),
      ...config.additionalData
    };
    
    const headers = config.headers || {};
    
    await axios.post(url, payload, { headers });
    this.logger.info(`Webhook alert sent to ${url}`);
  }

  private async sendDiscordAlert(
    config: Record<string, any>, 
    message: string,
    alertConfig: AlertConfig
  ): Promise<void> {
    const webhookUrl = config.webhookUrl;
    
    if (!webhookUrl) {
      throw new Error('Discord webhook URL not configured');
    }
    
    const embed = {
      title: `HomeOps Alert: ${alertConfig.name}`,
      description: message,
      color: this.getPriorityColorNumber(alertConfig.priority),
      timestamp: new Date().toISOString(),
      footer: {
        text: 'HomeOps Monitoring System'
      }
    };
    
    await axios.post(webhookUrl, { embeds: [embed] });
    this.logger.info('Discord alert sent');
  }

  async getAlertHistory(
    hours: number = 24,
    alertId?: string
  ): Promise<AlertHistory[]> {
    try {
      let query = `
        SELECT 
          ah.id,
          ah.alert_id as "alertId",
          a.name as "alertName",
          ah.triggered_at as "triggeredAt",
          ah.metric_value as "metricValue",
          ah.threshold_value as "thresholdValue",
          ah.message,
          ah.sent_to as channels,
          ah.status,
          ah.error
        FROM alert_history ah
        JOIN alerts a ON ah.alert_id = a.id
        WHERE ah.triggered_at > NOW() - INTERVAL '${hours} hours'
      `;
      
      const params: any[] = [];
      
      if (alertId) {
        query += ' AND ah.alert_id = $1';
        params.push(alertId);
      }
      
      query += ' ORDER BY ah.triggered_at DESC';
      
      const result = await this.pgPool.query(query, params);
      
      return result.rows.map(row => ({
        ...row,
        channels: JSON.parse(row.channels || '[]')
      }));
      
    } catch (error) {
      this.logger.error('Failed to get alert history', error);
      throw error;
    }
  }

  async configureAlert(config: AlertConfig): Promise<string> {
    try {
      const id = config.id || this.generateAlertId();
      
      const query = `
        INSERT INTO alerts (
          id, name, container_id, container_name, metric_type, 
          threshold_value, comparison_operator, channel_config, 
          enabled, priority, cooldown_minutes, description
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          container_id = EXCLUDED.container_id,
          container_name = EXCLUDED.container_name,
          metric_type = EXCLUDED.metric_type,
          threshold_value = EXCLUDED.threshold_value,
          comparison_operator = EXCLUDED.comparison_operator,
          channel_config = EXCLUDED.channel_config,
          enabled = EXCLUDED.enabled,
          priority = EXCLUDED.priority,
          cooldown_minutes = EXCLUDED.cooldown_minutes,
          description = EXCLUDED.description,
          updated_at = NOW()
      `;
      
      await this.pgPool.query(query, [
        id,
        config.name,
        config.containerId || null,
        config.containerName || null,
        config.metricType,
        config.thresholdValue,
        config.comparisonOperator,
        JSON.stringify(config.channels),
        config.enabled,
        config.priority,
        config.cooldownMinutes || this.rateLimitMinutes,
        config.description || null
      ]);
      
      // Update local cache
      config.id = id;
      this.alertConfigs.set(id, config);
      
      this.logger.info(`Alert configured: ${config.name} (${id})`);
      
      return id;
      
    } catch (error) {
      this.logger.error('Failed to configure alert', error);
      throw error;
    }
  }

  async deleteAlert(alertId: string): Promise<void> {
    try {
      await this.pgPool.query('DELETE FROM alerts WHERE id = $1', [alertId]);
      this.alertConfigs.delete(alertId);
      
      this.logger.info(`Alert deleted: ${alertId}`);
      
    } catch (error) {
      this.logger.error('Failed to delete alert', error);
      throw error;
    }
  }

  async testAlertChannel(
    channel: AlertChannel, 
    config: Record<string, any>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const testMessage = `This is a test alert from HomeOps Monitoring System.
Test initiated at: ${new Date().toISOString()}
Channel: ${channel}
Status: Testing connectivity and configuration`;
      
      const testAlertConfig: AlertConfig = {
        name: 'Test Alert',
        enabled: true,
        metricType: AlertMetricType.CPU,
        thresholdValue: 0,
        comparisonOperator: ComparisonOperator.GREATER_THAN,
        channels: [],
        priority: AlertPriority.LOW
      };
      
      const channelConfig: AlertChannelConfig = {
        type: channel,
        config,
        enabled: true
      };
      
      await this.sendAlert(channelConfig, testMessage, testAlertConfig);
      
      return { success: true };
      
    } catch (error: any) {
      this.logger.error(`Test alert failed for ${channel}`, error);
      return { success: false, error: error.message };
    }
  }

  private async loadAlertConfigs(): Promise<void> {
    try {
      const query = `
        SELECT 
          id, name, container_id, container_name, metric_type,
          threshold_value, comparison_operator, channel_config,
          enabled, priority, cooldown_minutes, description
        FROM alerts
        WHERE enabled = true
      `;
      
      const result = await this.pgPool.query(query);
      
      this.alertConfigs.clear();
      
      for (const row of result.rows) {
        const config: AlertConfig = {
          id: row.id,
          name: row.name,
          enabled: row.enabled,
          containerId: row.container_id,
          containerName: row.container_name,
          metricType: row.metric_type,
          thresholdValue: row.threshold_value,
          comparisonOperator: row.comparison_operator,
          channels: JSON.parse(row.channel_config || '[]'),
          priority: row.priority || AlertPriority.MEDIUM,
          cooldownMinutes: row.cooldown_minutes || this.rateLimitMinutes,
          description: row.description
        };
        
        this.alertConfigs.set(config.id!, config);
      }
      
      this.logger.info(`Loaded ${this.alertConfigs.size} alert configurations`);
      
    } catch (error) {
      this.logger.error('Failed to load alert configs', error);
    }
  }

  private async isRateLimited(alertId: string): Promise<boolean> {
    const key = `alert:ratelimit:${alertId}`;
    const exists = await this.redis.exists(key);
    return exists === 1;
  }

  private async updateRateLimit(alertId: string): Promise<void> {
    const key = `alert:ratelimit:${alertId}`;
    await this.redis.set(key, '1', 'EX', this.rateLimitMinutes * 60);
  }

  private async recordAlertHistory(
    config: AlertConfig,
    metricValue: number,
    thresholdValue: number,
    status: 'sent' | 'failed' | 'suppressed',
    message?: string,
    channels?: string[],
    error?: string
  ): Promise<void> {
    try {
      const query = `
        INSERT INTO alert_history (
          alert_id, triggered_at, metric_value, threshold_value,
          message, sent_to, status, error
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `;
      
      await this.pgPool.query(query, [
        config.id,
        new Date(),
        metricValue,
        thresholdValue,
        message || '',
        JSON.stringify(channels || []),
        status,
        error || null
      ]);
      
    } catch (err) {
      this.logger.error('Failed to record alert history', err);
    }
  }

  private buildAlertMessage(
    config: AlertConfig,
    metrics: Record<string, any>,
    currentValue: number
  ): string {
    const container = metrics.containerName || metrics.containerId || 'System';
    
    return `Alert: ${config.name}
Priority: ${config.priority.toUpperCase()}
Container: ${container}
Metric: ${config.metricType}
Current Value: ${currentValue.toFixed(2)}
Threshold: ${config.comparisonOperator} ${config.thresholdValue}
Time: ${new Date().toISOString()}
${config.description ? `\nDescription: ${config.description}` : ''}`;
  }

  private formatEmailHtml(message: string, config: AlertConfig): string {
    const lines = message.split('\n');
    const color = this.getPriorityColor(config.priority);
    
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px;">
        <div style="background-color: ${color}; color: white; padding: 10px;">
          <h2 style="margin: 0;">HomeOps Alert</h2>
        </div>
        <div style="padding: 20px; background-color: #f5f5f5;">
          ${lines.map(line => `<p style="margin: 5px 0;">${line}</p>`).join('')}
        </div>
        <div style="padding: 10px; background-color: #333; color: white; text-align: center;">
          <small>HomeOps Monitoring System</small>
        </div>
      </div>
    `;
  }

  private getPriorityColor(priority: AlertPriority): string {
    switch (priority) {
      case AlertPriority.CRITICAL:
        return '#d32f2f';
      case AlertPriority.HIGH:
        return '#ff9800';
      case AlertPriority.MEDIUM:
        return '#fbc02d';
      case AlertPriority.LOW:
        return '#4caf50';
      default:
        return '#9e9e9e';
    }
  }

  private getPriorityColorNumber(priority: AlertPriority): number {
    switch (priority) {
      case AlertPriority.CRITICAL:
        return 0xd32f2f;
      case AlertPriority.HIGH:
        return 0xff9800;
      case AlertPriority.MEDIUM:
        return 0xfbc02d;
      case AlertPriority.LOW:
        return 0x4caf50;
      default:
        return 0x9e9e9e;
    }
  }

  private generateAlertId(): string {
    return `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  async shutdown(): Promise<void> {
    await this.pgPool.end();
    await this.redis.quit();
    this.logger.info('Alert service shut down');
  }
}

// Export singleton instance
export const alertService = new AlertService();
export default alertService;