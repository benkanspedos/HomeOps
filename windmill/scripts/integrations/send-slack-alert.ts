/**
 * Send Slack Alert
 *
 * Sends alerts to Slack using a webhook URL.
 * Supports different alert severities and custom formatting.
 *
 * @param message - The alert message
 * @param severity - Alert severity (info, warning, critical)
 * @param channel - Optional: Override default channel
 * @param details - Optional: Additional details object
 */

import * as wmill from 'windmill-client';

interface SlackAlert {
  message: string;
  severity: 'info' | 'warning' | 'critical';
  channel?: string;
  details?: Record<string, any>;
}

interface SlackMessage {
  text: string;
  blocks: any[];
}

export async function main(args: SlackAlert): Promise<{
  success: boolean;
  timestamp: string;
  channel: string;
}> {
  const { message, severity, channel, details } = args;

  console.log(`Sending ${severity} alert to Slack...`);

  try {
    // Get Slack webhook from Windmill resources
    const slackWebhook = await wmill.getResource('platform/slack_webhook');
    const webhookUrl = slackWebhook.url;

    // Determine emoji and color based on severity
    const severityConfig = {
      info: { emoji: 'ℹ️', color: '#2196F3' },
      warning: { emoji: '⚠️', color: '#FF9800' },
      critical: { emoji: '🚨', color: '#F44336' }
    };

    const config = severityConfig[severity];

    // Build Slack message with blocks for rich formatting
    const slackMessage: SlackMessage = {
      text: `${config.emoji} ${severity.toUpperCase()}: ${message}`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `${config.emoji} ${severity.toUpperCase()} Alert`,
            emoji: true
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Message:* ${message}`
          }
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `*Source:* HomeOps Platform | *Time:* ${new Date().toLocaleString()}`
            }
          ]
        }
      ]
    };

    // Add details section if provided
    if (details && Object.keys(details).length > 0) {
      slackMessage.blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Details:*\n\`\`\`${JSON.stringify(details, null, 2)}\`\`\``
        }
      });
    }

    // Add divider
    slackMessage.blocks.push({ type: 'divider' });

    // Send to Slack
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(slackMessage)
    });

    if (!response.ok) {
      throw new Error(`Slack API error: ${response.statusText}`);
    }

    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      channel: channel || process.env.SLACK_DEFAULT_CHANNEL || '#homeops-alerts'
    };

    console.log(`✅ Alert sent successfully to ${result.channel}`);

    return result;
  } catch (error) {
    console.error('Error sending Slack alert:', error);

    // Don't throw - we don't want alert failures to break workflows
    // Just log and return failure status
    return {
      success: false,
      timestamp: new Date().toISOString(),
      channel: channel || 'unknown'
    };
  }
}

// Example usage for testing
if (require.main === module) {
  main({
    message: 'Test alert from Windmill platform',
    severity: 'info',
    details: {
      test: true,
      timestamp: new Date().toISOString()
    }
  })
    .then(result => {
      console.log('Result:', result);
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}
