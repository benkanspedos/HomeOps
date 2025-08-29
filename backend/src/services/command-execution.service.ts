import { logger } from '../utils/logger';
import { healthMonitor } from './health-monitor.service';
import { alertService } from './alert.service';
import Docker from 'dockerode';
import { CommandIntent } from './openai.service';

export interface ExecutionResult {
  success: boolean;
  data?: any;
  message: string;
  timestamp: string;
  executionTime: number;
  requiresConfirmation?: boolean;
}

export interface SecurityContext {
  userId: string;
  sessionId: string;
  ipAddress: string;
  userAgent?: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  sessionId: string;
  command: CommandIntent;
  result: ExecutionResult;
  securityContext: SecurityContext;
  timestamp: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export class CommandExecutionEngine {
  private docker: Docker;
  private auditLogs: Map<string, AuditLog> = new Map();
  private executionCounts: Map<string, number> = new Map();
  private lastResetTime: number = Date.now();

  // Security configuration
  private readonly RATE_LIMIT_PER_USER = 50; // commands per hour
  private readonly RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour
  private readonly HIGH_RISK_ACTIONS = ['remove', 'delete', 'stop', 'kill', 'rm'];
  private readonly CRITICAL_ACTIONS = ['remove', 'delete', 'prune'];

  constructor() {
    this.docker = new Docker();
    logger.info('Command execution engine initialized');
    
    // Reset rate limiting counters every hour
    setInterval(() => {
      this.resetRateLimits();
    }, this.RATE_LIMIT_WINDOW);
  }

  /**
   * Validate command before execution
   */
  async validateCommand(intent: CommandIntent, context: SecurityContext): Promise<{ valid: boolean; reason?: string }> {
    try {
      // Rate limiting check
      const rateLimitResult = this.checkRateLimit(context.userId);
      if (!rateLimitResult.allowed) {
        return {
          valid: false,
          reason: `Rate limit exceeded. ${rateLimitResult.remaining} commands remaining. Reset in ${Math.ceil(rateLimitResult.resetTime / 60000)} minutes.`
        };
      }

      // Command structure validation
      if (!intent.action || !intent.target) {
        return { valid: false, reason: 'Invalid command structure: missing action or target' };
      }

      // Security validation based on action type
      const securityResult = await this.validateSecurity(intent, context);
      if (!securityResult.valid) {
        return securityResult;
      }

      // Target validation (ensure targets exist)
      const targetResult = await this.validateTarget(intent);
      if (!targetResult.valid) {
        return targetResult;
      }

      logger.info(`Command validation passed`, {
        userId: context.userId,
        action: intent.action,
        target: intent.target,
        confidence: intent.confidence
      });

      return { valid: true };
    } catch (error: any) {
      logger.error('Command validation failed:', error);
      return { valid: false, reason: `Validation error: ${error.message}` };
    }
  }

  /**
   * Execute validated command
   */
  async executeCommand(intent: CommandIntent, context: SecurityContext): Promise<ExecutionResult> {
    const startTime = Date.now();
    const auditId = `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Validate command first
      const validation = await this.validateCommand(intent, context);
      if (!validation.valid) {
        const result: ExecutionResult = {
          success: false,
          message: validation.reason || 'Command validation failed',
          timestamp: new Date().toISOString(),
          executionTime: Date.now() - startTime
        };
        
        await this.auditCommand(auditId, intent, result, context, 'low');
        return result;
      }

      // Increment usage counter
      this.incrementUsageCounter(context.userId);

      // Execute based on action category
      let result: ExecutionResult;
      
      switch (intent.action.toLowerCase()) {
        case 'start':
        case 'stop':
        case 'restart':
        case 'remove':
          result = await this.executeContainerCommand(intent);
          break;
          
        case 'health':
        case 'status':
        case 'metrics':
          result = await this.executeHealthCommand(intent);
          break;
          
        case 'logs':
          result = await this.executeLogsCommand(intent);
          break;
          
        case 'add':
        case 'remove':
        case 'lookup':
          result = await this.executeDNSCommand(intent);
          break;
          
        default:
          result = {
            success: false,
            message: `Unsupported action: ${intent.action}`,
            timestamp: new Date().toISOString(),
            executionTime: Date.now() - startTime
          };
      }

      // Determine risk level
      const riskLevel = this.determineRiskLevel(intent);
      
      // Audit the execution
      await this.auditCommand(auditId, intent, result, context, riskLevel);

      return result;
    } catch (error: any) {
      logger.error('Command execution failed:', error);
      
      const result: ExecutionResult = {
        success: false,
        message: `Execution failed: ${error.message}`,
        timestamp: new Date().toISOString(),
        executionTime: Date.now() - startTime
      };
      
      await this.auditCommand(auditId, intent, result, context, 'high');
      return result;
    }
  }

  /**
   * Execute container management commands
   */
  private async executeContainerCommand(intent: CommandIntent): Promise<ExecutionResult> {
    const startTime = Date.now();
    const containerName = intent.target;

    try {
      // Get container by name
      const containers = await this.docker.listContainers({ all: true });
      const container = containers.find(c => 
        c.Names.some(name => name.includes(containerName))
      );

      if (!container) {
        return {
          success: false,
          message: `Container '${containerName}' not found`,
          timestamp: new Date().toISOString(),
          executionTime: Date.now() - startTime
        };
      }

      const dockerContainer = this.docker.getContainer(container.Id);

      switch (intent.action.toLowerCase()) {
        case 'start':
          await dockerContainer.start();
          return {
            success: true,
            message: `Container '${containerName}' started successfully`,
            timestamp: new Date().toISOString(),
            executionTime: Date.now() - startTime,
            data: { containerId: container.Id, status: 'started' }
          };

        case 'stop':
          await dockerContainer.stop();
          return {
            success: true,
            message: `Container '${containerName}' stopped successfully`,
            timestamp: new Date().toISOString(),
            executionTime: Date.now() - startTime,
            data: { containerId: container.Id, status: 'stopped' }
          };

        case 'restart':
          await dockerContainer.restart();
          return {
            success: true,
            message: `Container '${containerName}' restarted successfully`,
            timestamp: new Date().toISOString(),
            executionTime: Date.now() - startTime,
            data: { containerId: container.Id, status: 'restarted' }
          };

        case 'remove':
          // This is a destructive action - require confirmation
          if (!intent.parameters?.confirmed) {
            return {
              success: false,
              message: `Container removal requires confirmation. This action cannot be undone.`,
              timestamp: new Date().toISOString(),
              executionTime: Date.now() - startTime,
              requiresConfirmation: true,
              data: { 
                confirmationCommand: { ...intent, parameters: { ...intent.parameters, confirmed: true } }
              }
            };
          }
          
          await dockerContainer.remove({ force: true });
          return {
            success: true,
            message: `Container '${containerName}' removed successfully`,
            timestamp: new Date().toISOString(),
            executionTime: Date.now() - startTime,
            data: { containerId: container.Id, status: 'removed' }
          };

        default:
          return {
            success: false,
            message: `Unsupported container action: ${intent.action}`,
            timestamp: new Date().toISOString(),
            executionTime: Date.now() - startTime
          };
      }
    } catch (error: any) {
      return {
        success: false,
        message: `Container command failed: ${error.message}`,
        timestamp: new Date().toISOString(),
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Execute health monitoring commands
   */
  private async executeHealthCommand(intent: CommandIntent): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      switch (intent.action.toLowerCase()) {
        case 'health':
        case 'status':
          const healthData = await healthMonitor.checkContainerHealth();
          const systemMetrics = await healthMonitor.getResourceUsage();
          
          return {
            success: true,
            message: 'System health retrieved successfully',
            timestamp: new Date().toISOString(),
            executionTime: Date.now() - startTime,
            data: {
              containers: healthData,
              system: systemMetrics,
              summary: {
                totalContainers: healthData.length,
                runningContainers: healthData.filter(c => c.status === 'running').length,
                healthyContainers: healthData.filter(c => c.health === 'healthy').length
              }
            }
          };

        case 'metrics':
          const metrics = await healthMonitor.collectMetrics();
          return {
            success: true,
            message: 'System metrics retrieved successfully',
            timestamp: new Date().toISOString(),
            executionTime: Date.now() - startTime,
            data: metrics
          };

        default:
          return {
            success: false,
            message: `Unsupported health action: ${intent.action}`,
            timestamp: new Date().toISOString(),
            executionTime: Date.now() - startTime
          };
      }
    } catch (error: any) {
      return {
        success: false,
        message: `Health command failed: ${error.message}`,
        timestamp: new Date().toISOString(),
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Execute log retrieval commands
   */
  private async executeLogsCommand(intent: CommandIntent): Promise<ExecutionResult> {
    const startTime = Date.now();
    const lines = intent.parameters?.lines || 100;

    try {
      if (intent.target === 'system') {
        // System logs (placeholder - would integrate with system logging)
        return {
          success: true,
          message: `System logs retrieved (last ${lines} lines)`,
          timestamp: new Date().toISOString(),
          executionTime: Date.now() - startTime,
          data: {
            logs: ['System log implementation pending'],
            lines: lines
          }
        };
      } else {
        // Container logs
        const logs = await healthMonitor.getContainerLogs(intent.target, lines);
        return {
          success: true,
          message: `Container logs retrieved for ${intent.target} (last ${lines} lines)`,
          timestamp: new Date().toISOString(),
          executionTime: Date.now() - startTime,
          data: {
            logs: logs,
            container: intent.target,
            lines: lines
          }
        };
      }
    } catch (error: any) {
      return {
        success: false,
        message: `Logs command failed: ${error.message}`,
        timestamp: new Date().toISOString(),
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Execute DNS management commands (placeholder)
   */
  private async executeDNSCommand(intent: CommandIntent): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      // DNS management would integrate with Pi-hole API or DNS service
      return {
        success: false,
        message: 'DNS management features are not yet implemented',
        timestamp: new Date().toISOString(),
        executionTime: Date.now() - startTime,
        data: {
          action: intent.action,
          target: intent.target,
          note: 'This feature will be implemented in the next phase'
        }
      };
    } catch (error: any) {
      return {
        success: false,
        message: `DNS command failed: ${error.message}`,
        timestamp: new Date().toISOString(),
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Security validation
   */
  private async validateSecurity(intent: CommandIntent, context: SecurityContext): Promise<{ valid: boolean; reason?: string }> {
    // Check for high-risk actions
    if (this.HIGH_RISK_ACTIONS.includes(intent.action.toLowerCase())) {
      if (intent.confidence < 0.8) {
        return {
          valid: false,
          reason: `High-risk action '${intent.action}' requires high confidence (>0.8), got ${intent.confidence}`
        };
      }
    }

    // Critical actions require explicit confirmation
    if (this.CRITICAL_ACTIONS.includes(intent.action.toLowerCase())) {
      if (!intent.parameters?.confirmed) {
        return {
          valid: false,
          reason: `Critical action '${intent.action}' requires explicit user confirmation`
        };
      }
    }

    return { valid: true };
  }

  /**
   * Target validation
   */
  private async validateTarget(intent: CommandIntent): Promise<{ valid: boolean; reason?: string }> {
    try {
      // For container actions, verify container exists
      if (['start', 'stop', 'restart', 'remove', 'logs'].includes(intent.action.toLowerCase())) {
        const containers = await this.docker.listContainers({ all: true });
        const containerExists = containers.some(c =>
          c.Names.some(name => name.includes(intent.target))
        );

        if (!containerExists) {
          return {
            valid: false,
            reason: `Container '${intent.target}' does not exist`
          };
        }
      }

      return { valid: true };
    } catch (error: any) {
      return {
        valid: false,
        reason: `Target validation failed: ${error.message}`
      };
    }
  }

  /**
   * Rate limiting check
   */
  private checkRateLimit(userId: string): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    
    // Reset counters if window expired
    if (now - this.lastResetTime > this.RATE_LIMIT_WINDOW) {
      this.resetRateLimits();
    }

    const currentCount = this.executionCounts.get(userId) || 0;
    const remaining = Math.max(0, this.RATE_LIMIT_PER_USER - currentCount);
    const resetTime = this.lastResetTime + this.RATE_LIMIT_WINDOW - now;

    return {
      allowed: currentCount < this.RATE_LIMIT_PER_USER,
      remaining,
      resetTime
    };
  }

  /**
   * Increment usage counter
   */
  private incrementUsageCounter(userId: string): void {
    const current = this.executionCounts.get(userId) || 0;
    this.executionCounts.set(userId, current + 1);
  }

  /**
   * Reset rate limiting counters
   */
  private resetRateLimits(): void {
    this.executionCounts.clear();
    this.lastResetTime = Date.now();
    logger.info('Rate limiting counters reset');
  }

  /**
   * Determine risk level of command
   */
  private determineRiskLevel(intent: CommandIntent): 'low' | 'medium' | 'high' | 'critical' {
    if (this.CRITICAL_ACTIONS.includes(intent.action.toLowerCase())) {
      return 'critical';
    }
    
    if (this.HIGH_RISK_ACTIONS.includes(intent.action.toLowerCase())) {
      return 'high';
    }
    
    if (['restart', 'stop'].includes(intent.action.toLowerCase())) {
      return 'medium';
    }
    
    return 'low';
  }

  /**
   * Audit command execution
   */
  private async auditCommand(
    id: string,
    command: CommandIntent,
    result: ExecutionResult,
    context: SecurityContext,
    riskLevel: 'low' | 'medium' | 'high' | 'critical'
  ): Promise<void> {
    const auditLog: AuditLog = {
      id,
      userId: context.userId,
      sessionId: context.sessionId,
      command,
      result,
      securityContext: context,
      timestamp: new Date().toISOString(),
      riskLevel
    };

    this.auditLogs.set(id, auditLog);

    // Log to Winston
    logger.info('Command execution audit', {
      auditId: id,
      userId: context.userId,
      action: command.action,
      target: command.target,
      success: result.success,
      riskLevel,
      executionTime: result.executionTime
    });

    // For high-risk actions, also create an alert
    if (riskLevel === 'high' || riskLevel === 'critical') {
      await alertService.createAlert({
        type: 'security',
        severity: riskLevel === 'critical' ? 'critical' : 'warning',
        message: `${riskLevel.toUpperCase()} risk command executed: ${command.action} ${command.target}`,
        details: {
          userId: context.userId,
          command,
          result
        }
      });
    }

    // Keep audit logs in memory for recent access (last 1000 entries)
    if (this.auditLogs.size > 1000) {
      const oldest = Array.from(this.auditLogs.keys())[0];
      this.auditLogs.delete(oldest);
    }
  }

  /**
   * Get audit history for a user
   */
  getAuditHistory(userId: string, limit: number = 50): AuditLog[] {
    return Array.from(this.auditLogs.values())
      .filter(log => log.userId === userId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  /**
   * Get system-wide audit statistics
   */
  getAuditStats(): {
    totalCommands: number;
    successRate: number;
    riskDistribution: Record<string, number>;
    topUsers: Array<{ userId: string; count: number }>;
  } {
    const logs = Array.from(this.auditLogs.values());
    const totalCommands = logs.length;
    const successfulCommands = logs.filter(log => log.result.success).length;
    const successRate = totalCommands > 0 ? successfulCommands / totalCommands : 0;

    const riskDistribution: Record<string, number> = {};
    const userCounts: Record<string, number> = {};

    logs.forEach(log => {
      riskDistribution[log.riskLevel] = (riskDistribution[log.riskLevel] || 0) + 1;
      userCounts[log.userId] = (userCounts[log.userId] || 0) + 1;
    });

    const topUsers = Object.entries(userCounts)
      .map(([userId, count]) => ({ userId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalCommands,
      successRate,
      riskDistribution,
      topUsers
    };
  }
}

// Export singleton instance
export const commandExecutionEngine = new CommandExecutionEngine();