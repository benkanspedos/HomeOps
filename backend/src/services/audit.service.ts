import { logger } from '../utils/logger';
import fs from 'fs';
import path from 'path';

export interface AuditEvent {
  id: string;
  timestamp: string;
  userId: string;
  sessionId?: string;
  eventType: 'security' | 'command' | 'authentication' | 'system' | 'api' | 'error';
  action: string;
  details: Record<string, any>;
  outcome: 'success' | 'failure' | 'warning';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  metadata: {
    ipAddress?: string;
    userAgent?: string;
    endpoint?: string;
    method?: string;
    executionTime?: number;
  };
}

export interface AuditQueryOptions {
  userId?: string;
  eventType?: string;
  riskLevel?: string;
  outcome?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export class AuditService {
  private auditLog: Map<string, AuditEvent> = new Map();
  private auditFile: string;
  private maxMemoryEntries = 10000;
  private alertThresholds = {
    highRiskEvents: 5,   // per hour
    failedCommands: 10,  // per hour
    criticalEvents: 1,   // immediate alert
  };

  constructor() {
    this.auditFile = path.join(process.cwd(), 'logs', 'audit.json');
    this.ensureLogDirectory();
    this.loadAuditHistory();
    logger.info('Audit service initialized');

    // Periodic cleanup and persistence
    setInterval(() => {
      this.persistAuditLog();
      this.cleanupOldEntries();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Log an audit event
   */
  async logEvent(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<string> {
    const auditId = `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const auditEvent: AuditEvent = {
      id: auditId,
      timestamp: new Date().toISOString(),
      ...event
    };

    // Store in memory
    this.auditLog.set(auditId, auditEvent);

    // Log to Winston
    logger.info('Audit event logged', {
      auditId,
      userId: event.userId,
      eventType: event.eventType,
      action: event.action,
      outcome: event.outcome,
      riskLevel: event.riskLevel
    });

    // Check for alert conditions
    await this.checkAlertConditions(auditEvent);

    // Cleanup if too many entries
    if (this.auditLog.size > this.maxMemoryEntries) {
      this.cleanupOldEntries();
    }

    return auditId;
  }

  /**
   * Log security event
   */
  async logSecurityEvent(
    userId: string,
    action: string,
    details: Record<string, any>,
    outcome: 'success' | 'failure' | 'warning' = 'warning',
    metadata: AuditEvent['metadata'] = {}
  ): Promise<string> {
    return this.logEvent({
      userId,
      eventType: 'security',
      action,
      details,
      outcome,
      riskLevel: outcome === 'failure' ? 'high' : 'medium',
      metadata
    });
  }

  /**
   * Log command execution event
   */
  async logCommandEvent(
    userId: string,
    sessionId: string,
    action: string,
    details: Record<string, any>,
    outcome: 'success' | 'failure',
    executionTime: number,
    metadata: AuditEvent['metadata'] = {}
  ): Promise<string> {
    const riskLevel = this.determineCommandRiskLevel(action, outcome);
    
    return this.logEvent({
      userId,
      sessionId,
      eventType: 'command',
      action,
      details,
      outcome,
      riskLevel,
      metadata: {
        ...metadata,
        executionTime
      }
    });
  }

  /**
   * Log authentication event
   */
  async logAuthEvent(
    userId: string,
    action: string,
    outcome: 'success' | 'failure',
    metadata: AuditEvent['metadata'] = {}
  ): Promise<string> {
    return this.logEvent({
      userId,
      eventType: 'authentication',
      action,
      details: { loginAttempt: true },
      outcome,
      riskLevel: outcome === 'failure' ? 'medium' : 'low',
      metadata
    });
  }

  /**
   * Log API request event
   */
  async logApiEvent(
    userId: string,
    endpoint: string,
    method: string,
    outcome: 'success' | 'failure',
    executionTime: number,
    statusCode: number,
    metadata: AuditEvent['metadata'] = {}
  ): Promise<string> {
    return this.logEvent({
      userId,
      eventType: 'api',
      action: `${method} ${endpoint}`,
      details: { 
        statusCode,
        responseTime: executionTime 
      },
      outcome,
      riskLevel: statusCode >= 500 ? 'medium' : 'low',
      metadata: {
        ...metadata,
        endpoint,
        method,
        executionTime
      }
    });
  }

  /**
   * Log system event
   */
  async logSystemEvent(
    action: string,
    details: Record<string, any>,
    outcome: 'success' | 'failure' | 'warning',
    riskLevel: AuditEvent['riskLevel'] = 'low'
  ): Promise<string> {
    return this.logEvent({
      userId: 'system',
      eventType: 'system',
      action,
      details,
      outcome,
      riskLevel,
      metadata: {}
    });
  }

  /**
   * Log error event
   */
  async logErrorEvent(
    userId: string,
    error: Error,
    context: Record<string, any> = {},
    metadata: AuditEvent['metadata'] = {}
  ): Promise<string> {
    return this.logEvent({
      userId,
      eventType: 'error',
      action: 'error_occurred',
      details: {
        errorName: error.name,
        errorMessage: error.message,
        stack: error.stack,
        context
      },
      outcome: 'failure',
      riskLevel: 'medium',
      metadata
    });
  }

  /**
   * Query audit events
   */
  queryEvents(options: AuditQueryOptions = {}): AuditEvent[] {
    let events = Array.from(this.auditLog.values());

    // Apply filters
    if (options.userId) {
      events = events.filter(event => event.userId === options.userId);
    }

    if (options.eventType) {
      events = events.filter(event => event.eventType === options.eventType);
    }

    if (options.riskLevel) {
      events = events.filter(event => event.riskLevel === options.riskLevel);
    }

    if (options.outcome) {
      events = events.filter(event => event.outcome === options.outcome);
    }

    if (options.startDate) {
      events = events.filter(event => 
        new Date(event.timestamp) >= options.startDate!
      );
    }

    if (options.endDate) {
      events = events.filter(event => 
        new Date(event.timestamp) <= options.endDate!
      );
    }

    // Sort by timestamp (newest first)
    events.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Apply pagination
    const offset = options.offset || 0;
    const limit = options.limit || 100;
    
    return events.slice(offset, offset + limit);
  }

  /**
   * Get audit statistics
   */
  getStatistics(): {
    totalEvents: number;
    eventTypeDistribution: Record<string, number>;
    riskLevelDistribution: Record<string, number>;
    outcomeDistribution: Record<string, number>;
    recentActivity: {
      lastHour: number;
      lastDay: number;
      lastWeek: number;
    };
    topUsers: Array<{ userId: string; eventCount: number }>;
  } {
    const events = Array.from(this.auditLog.values());
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Event type distribution
    const eventTypeDistribution: Record<string, number> = {};
    const riskLevelDistribution: Record<string, number> = {};
    const outcomeDistribution: Record<string, number> = {};
    const userEventCounts: Record<string, number> = {};

    events.forEach(event => {
      // Event types
      eventTypeDistribution[event.eventType] = 
        (eventTypeDistribution[event.eventType] || 0) + 1;

      // Risk levels
      riskLevelDistribution[event.riskLevel] = 
        (riskLevelDistribution[event.riskLevel] || 0) + 1;

      // Outcomes
      outcomeDistribution[event.outcome] = 
        (outcomeDistribution[event.outcome] || 0) + 1;

      // User counts
      userEventCounts[event.userId] = 
        (userEventCounts[event.userId] || 0) + 1;
    });

    // Recent activity
    const recentActivity = {
      lastHour: events.filter(event => 
        new Date(event.timestamp) > oneHourAgo
      ).length,
      lastDay: events.filter(event => 
        new Date(event.timestamp) > oneDayAgo
      ).length,
      lastWeek: events.filter(event => 
        new Date(event.timestamp) > oneWeekAgo
      ).length
    };

    // Top users
    const topUsers = Object.entries(userEventCounts)
      .map(([userId, eventCount]) => ({ userId, eventCount }))
      .sort((a, b) => b.eventCount - a.eventCount)
      .slice(0, 10);

    return {
      totalEvents: events.length,
      eventTypeDistribution,
      riskLevelDistribution,
      outcomeDistribution,
      recentActivity,
      topUsers
    };
  }

  /**
   * Get events by ID
   */
  getEventById(auditId: string): AuditEvent | null {
    return this.auditLog.get(auditId) || null;
  }

  /**
   * Check for alert conditions
   */
  private async checkAlertConditions(event: AuditEvent): Promise<void> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentEvents = Array.from(this.auditLog.values())
      .filter(e => new Date(e.timestamp) > oneHourAgo);

    // Critical events - immediate alert
    if (event.riskLevel === 'critical') {
      logger.error('CRITICAL audit event detected', {
        auditId: event.id,
        userId: event.userId,
        action: event.action,
        details: event.details
      });
    }

    // High risk events threshold
    const highRiskEvents = recentEvents
      .filter(e => e.riskLevel === 'high' && e.userId === event.userId);
    
    if (highRiskEvents.length >= this.alertThresholds.highRiskEvents) {
      logger.warn('High risk event threshold exceeded', {
        userId: event.userId,
        eventCount: highRiskEvents.length,
        threshold: this.alertThresholds.highRiskEvents
      });
    }

    // Failed commands threshold
    const failedCommands = recentEvents
      .filter(e => e.eventType === 'command' && e.outcome === 'failure');
    
    if (failedCommands.length >= this.alertThresholds.failedCommands) {
      logger.warn('Failed command threshold exceeded', {
        failedCommands: failedCommands.length,
        threshold: this.alertThresholds.failedCommands
      });
    }
  }

  /**
   * Determine command risk level
   */
  private determineCommandRiskLevel(action: string, outcome: string): AuditEvent['riskLevel'] {
    const highRiskActions = ['remove', 'delete', 'stop', 'kill'];
    const criticalActions = ['remove', 'delete', 'prune'];

    if (outcome === 'failure') {
      return criticalActions.includes(action.toLowerCase()) ? 'critical' : 'high';
    }

    if (criticalActions.includes(action.toLowerCase())) {
      return 'critical';
    }

    if (highRiskActions.includes(action.toLowerCase())) {
      return 'high';
    }

    return 'medium';
  }

  /**
   * Ensure log directory exists
   */
  private ensureLogDirectory(): void {
    const logDir = path.dirname(this.auditFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  /**
   * Load audit history from file
   */
  private loadAuditHistory(): void {
    try {
      if (fs.existsSync(this.auditFile)) {
        const data = fs.readFileSync(this.auditFile, 'utf8');
        const events: AuditEvent[] = JSON.parse(data);
        
        events.forEach(event => {
          this.auditLog.set(event.id, event);
        });

        logger.info('Audit history loaded', { 
          eventCount: events.length 
        });
      }
    } catch (error: any) {
      logger.error('Failed to load audit history:', error);
    }
  }

  /**
   * Persist audit log to file
   */
  private persistAuditLog(): void {
    try {
      const events = Array.from(this.auditLog.values());
      const data = JSON.stringify(events, null, 2);
      
      fs.writeFileSync(this.auditFile, data);
      logger.debug('Audit log persisted', { 
        eventCount: events.length 
      });
    } catch (error: any) {
      logger.error('Failed to persist audit log:', error);
    }
  }

  /**
   * Clean up old entries from memory
   */
  private cleanupOldEntries(): void {
    if (this.auditLog.size <= this.maxMemoryEntries) {
      return;
    }

    const events = Array.from(this.auditLog.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Keep only the most recent entries
    const toKeep = events.slice(0, this.maxMemoryEntries);
    const toRemove = events.slice(this.maxMemoryEntries);

    // Clear and rebuild map
    this.auditLog.clear();
    toKeep.forEach(event => {
      this.auditLog.set(event.id, event);
    });

    logger.info('Audit log cleaned up', {
      kept: toKeep.length,
      removed: toRemove.length
    });
  }

  /**
   * Export audit events to file
   */
  async exportEvents(
    options: AuditQueryOptions & { format?: 'json' | 'csv' },
    outputPath: string
  ): Promise<void> {
    const events = this.queryEvents(options);
    const format = options.format || 'json';

    try {
      if (format === 'json') {
        const data = JSON.stringify(events, null, 2);
        fs.writeFileSync(outputPath, data);
      } else if (format === 'csv') {
        const headers = 'ID,Timestamp,User ID,Event Type,Action,Outcome,Risk Level,Details\n';
        const rows = events.map(event => 
          `${event.id},"${event.timestamp}","${event.userId}","${event.eventType}","${event.action}","${event.outcome}","${event.riskLevel}","${JSON.stringify(event.details).replace(/"/g, '""')}"`
        ).join('\n');
        
        fs.writeFileSync(outputPath, headers + rows);
      }

      logger.info('Audit events exported', {
        eventCount: events.length,
        format,
        outputPath
      });
    } catch (error: any) {
      logger.error('Failed to export audit events:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const auditService = new AuditService();