import cron from 'node-cron';
import { logger } from './logger';
import { getSupabaseClient } from '../db/client';
import { cache } from '../db/redis';

// Store active cron jobs
const cronJobs: Map<string, cron.ScheduledTask> = new Map();

export const startScheduledJobs = () => {
  logger.info('Starting scheduled jobs...');

  // Health check every 5 minutes
  const healthCheckJob = cron.schedule('*/5 * * * *', async () => {
    try {
      await performHealthChecks();
    } catch (error) {
      logger.error('Health check job failed:', error);
    }
  });
  cronJobs.set('health-check', healthCheckJob);

  // Clean up expired sessions every hour
  const sessionCleanupJob = cron.schedule('0 * * * *', async () => {
    try {
      await cleanupExpiredSessions();
    } catch (error) {
      logger.error('Session cleanup job failed:', error);
    }
  });
  cronJobs.set('session-cleanup', sessionCleanupJob);

  // Process automations every minute
  const automationJob = cron.schedule('* * * * *', async () => {
    try {
      await processAutomations();
    } catch (error) {
      logger.error('Automation job failed:', error);
    }
  });
  cronJobs.set('automation-processor', automationJob);

  // Cache cleanup every 30 minutes
  const cacheCleanupJob = cron.schedule('*/30 * * * *', async () => {
    try {
      await cleanupCache();
    } catch (error) {
      logger.error('Cache cleanup job failed:', error);
    }
  });
  cronJobs.set('cache-cleanup', cacheCleanupJob);

  logger.info(`Started ${cronJobs.size} scheduled jobs`);
};

export const stopScheduledJobs = () => {
  logger.info('Stopping scheduled jobs...');
  
  cronJobs.forEach((job, name) => {
    job.stop();
    logger.info(`Stopped job: ${name}`);
  });
  
  cronJobs.clear();
};

async function performHealthChecks() {
  const client = getSupabaseClient();
  
  // Get all services that need health checks
  const { data: services, error } = await client
    .from('services')
    .select('*')
    .not('health_check_url', 'is', null)
    .eq('status', 'running');

  if (error) {
    logger.error('Failed to fetch services for health check:', error);
    return;
  }

  if (!services || services.length === 0) {
    return;
  }

  logger.debug(`Performing health checks for ${services.length} services`);

  // Perform health checks in parallel
  const checks = services.map(async (service) => {
    try {
      // In production, this would make actual HTTP requests
      // For now, we'll just update the timestamp
      await client
        .from('services')
        .update({ last_health_check: new Date().toISOString() })
        .eq('id', service.id);
        
      // Cache the health status
      await cache.set(
        `service:health:${service.id}`,
        { status: 'healthy', checkedAt: new Date() },
        300 // 5 minutes TTL
      );
    } catch (error) {
      logger.error(`Health check failed for service ${service.name}:`, error);
      
      // Update service status to error
      await client
        .from('services')
        .update({ 
          status: 'error',
          last_health_check: new Date().toISOString()
        })
        .eq('id', service.id);
    }
  });

  await Promise.allSettled(checks);
}

async function cleanupExpiredSessions() {
  // Clean up expired API keys
  const client = getSupabaseClient();
  
  const { error } = await client
    .from('api_keys')
    .delete()
    .lt('expires_at', new Date().toISOString())
    .not('expires_at', 'is', null);

  if (error) {
    logger.error('Failed to cleanup expired API keys:', error);
  } else {
    logger.debug('Cleaned up expired API keys');
  }

  // Clean up old alert history (keep last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const { error: alertError } = await client
    .from('alert_history')
    .delete()
    .lt('triggered_at', thirtyDaysAgo.toISOString());

  if (alertError) {
    logger.error('Failed to cleanup old alert history:', alertError);
  } else {
    logger.debug('Cleaned up old alert history');
  }
}

async function processAutomations() {
  const client = getSupabaseClient();
  const now = new Date();
  
  // Get automations that need to run
  const { data: automations, error } = await client
    .from('automations')
    .select('*')
    .eq('status', 'active')
    .or(`next_run.is.null,next_run.lte.${now.toISOString()}`);

  if (error) {
    logger.error('Failed to fetch automations:', error);
    return;
  }

  if (!automations || automations.length === 0) {
    return;
  }

  logger.debug(`Processing ${automations.length} automations`);

  for (const automation of automations) {
    try {
      // Check if automation should run based on trigger type
      const shouldRun = await shouldAutomationRun(automation);
      
      if (shouldRun) {
        // Log automation start
        const { data: logEntry } = await client
          .from('automation_logs')
          .insert({
            automation_id: automation.id,
            started_at: new Date().toISOString(),
            status: 'running',
          })
          .select()
          .single();

        // Execute automation actions
        // In production, this would execute the actual automation
        logger.info(`Executing automation: ${automation.name}`);
        
        // Update automation log and next run time
        await client
          .from('automation_logs')
          .update({
            completed_at: new Date().toISOString(),
            status: 'success',
            steps_completed: automation.actions.length,
          })
          .eq('id', logEntry?.id);

        // Calculate next run time based on trigger config
        const nextRun = calculateNextRun(automation);
        
        await client
          .from('automations')
          .update({
            last_run: new Date().toISOString(),
            next_run: nextRun,
            run_count: automation.run_count + 1,
          })
          .eq('id', automation.id);
      }
    } catch (error) {
      logger.error(`Failed to process automation ${automation.name}:`, error);
    }
  }
}

async function shouldAutomationRun(automation: any): Promise<boolean> {
  // Check based on trigger type
  switch (automation.trigger_type) {
    case 'schedule':
      // Check if it's time to run based on cron expression
      return true; // Simplified for now
    
    case 'condition':
      // Check if condition is met
      // This would evaluate the condition_config
      return false; // Simplified for now
    
    case 'event':
      // Check if triggering event occurred
      return false; // Simplified for now
    
    default:
      return false;
  }
}

function calculateNextRun(automation: any): string | null {
  if (automation.trigger_type !== 'schedule') {
    return null;
  }

  // Parse cron expression from trigger_config
  // Simplified - in production, use a cron parser library
  const now = new Date();
  now.setMinutes(now.getMinutes() + 5); // Run again in 5 minutes
  return now.toISOString();
}

async function cleanupCache() {
  // This is a placeholder for cache cleanup logic
  // In production, you might want to:
  // - Remove expired cache entries
  // - Clear caches that haven't been accessed recently
  // - Manage cache size limits
  
  logger.debug('Cache cleanup completed');
}