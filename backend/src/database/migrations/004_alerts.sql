-- Migration: Create alerts and alert history tables
-- Version: 004
-- Date: 2025-08-28

-- Create alerts configuration table
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  container_id VARCHAR(64),
  container_name VARCHAR(255),
  metric_type VARCHAR(50) NOT NULL, -- cpu, memory, disk, network, container_status, health_check, restart_count
  threshold_value NUMERIC(10,2) NOT NULL,
  comparison_operator VARCHAR(10) NOT NULL, -- >, <, =, !=, >=, <=
  channel_config JSONB NOT NULL, -- Array of channel configurations
  enabled BOOLEAN DEFAULT true,
  priority VARCHAR(20) DEFAULT 'medium', -- low, medium, high, critical
  cooldown_minutes INTEGER DEFAULT 15,
  description TEXT,
  created_by VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_metric_type CHECK (metric_type IN ('cpu', 'memory', 'disk', 'network', 'container_status', 'health_check', 'restart_count')),
  CONSTRAINT chk_comparison_operator CHECK (comparison_operator IN ('>', '<', '=', '!=', '>=', '<=')),
  CONSTRAINT chk_priority CHECK (priority IN ('low', 'medium', 'high', 'critical'))
);

-- Create indexes for alerts
CREATE INDEX IF NOT EXISTS idx_alerts_enabled 
  ON alerts (enabled) WHERE enabled = true;

CREATE INDEX IF NOT EXISTS idx_alerts_container 
  ON alerts (container_id) WHERE container_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_alerts_metric 
  ON alerts (metric_type, enabled);

-- Create alert_history table for tracking triggered alerts
CREATE TABLE IF NOT EXISTS alert_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID REFERENCES alerts(id) ON DELETE CASCADE,
  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  metric_value NUMERIC(10,2),
  threshold_value NUMERIC(10,2),
  message TEXT,
  sent_to TEXT, -- JSON array of channels where alert was sent
  status VARCHAR(20) NOT NULL, -- sent, failed, suppressed
  error TEXT,
  container_id VARCHAR(64),
  container_name VARCHAR(255),
  CONSTRAINT chk_status CHECK (status IN ('sent', 'failed', 'suppressed'))
);

-- Create indexes for alert history
CREATE INDEX IF NOT EXISTS idx_alert_history_alert_id 
  ON alert_history (alert_id, triggered_at DESC);

CREATE INDEX IF NOT EXISTS idx_alert_history_time 
  ON alert_history (triggered_at DESC);

CREATE INDEX IF NOT EXISTS idx_alert_history_status 
  ON alert_history (status, triggered_at DESC);

-- Create alert_channels table for managing notification channels
CREATE TABLE IF NOT EXISTS alert_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  type VARCHAR(50) NOT NULL, -- email, slack, webhook, discord
  config JSONB NOT NULL, -- Channel-specific configuration
  enabled BOOLEAN DEFAULT true,
  test_status VARCHAR(20), -- success, failed, never_tested
  last_tested_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_channel_type CHECK (type IN ('email', 'slack', 'webhook', 'discord'))
);

-- Create index for alert channels
CREATE INDEX IF NOT EXISTS idx_alert_channels_type 
  ON alert_channels (type, enabled);

-- Create alert_templates table for predefined alert configurations
CREATE TABLE IF NOT EXISTS alert_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  category VARCHAR(50), -- performance, availability, security, resource
  metric_type VARCHAR(50) NOT NULL,
  threshold_value NUMERIC(10,2) NOT NULL,
  comparison_operator VARCHAR(10) NOT NULL,
  priority VARCHAR(20) DEFAULT 'medium',
  description TEXT,
  recommended_channels JSONB, -- Suggested channel types for this alert
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default alert templates
INSERT INTO alert_templates (name, category, metric_type, threshold_value, comparison_operator, priority, description, recommended_channels, is_default) 
VALUES 
  ('High CPU Usage', 'performance', 'cpu', 80, '>', 'high', 'Alert when CPU usage exceeds 80%', '["email", "slack"]', true),
  ('Critical CPU Usage', 'performance', 'cpu', 95, '>', 'critical', 'Alert when CPU usage exceeds 95%', '["email", "slack", "webhook"]', true),
  ('High Memory Usage', 'performance', 'memory', 85, '>', 'high', 'Alert when memory usage exceeds 85%', '["email", "slack"]', true),
  ('Critical Memory Usage', 'performance', 'memory', 95, '>', 'critical', 'Alert when memory usage exceeds 95%', '["email", "slack", "webhook"]', true),
  ('Container Down', 'availability', 'container_status', 0, '=', 'critical', 'Alert when container is not running', '["email", "slack", "webhook"]', true),
  ('Container Unhealthy', 'availability', 'health_check', 0, '=', 'high', 'Alert when container health check fails', '["email", "slack"]', true),
  ('Excessive Restarts', 'availability', 'restart_count', 5, '>', 'high', 'Alert when container restarts more than 5 times', '["email", "slack"]', true),
  ('High Disk Usage', 'resource', 'disk', 85, '>', 'medium', 'Alert when disk usage exceeds 85%', '["email"]', true),
  ('Critical Disk Usage', 'resource', 'disk', 95, '>', 'critical', 'Alert when disk usage exceeds 95%', '["email", "slack", "webhook"]', true),
  ('High Network Traffic', 'performance', 'network', 1000, '>', 'medium', 'Alert when network traffic exceeds 1GB', '["email"]', true)
ON CONFLICT (name) DO NOTHING;

-- Create alert_subscriptions table for user-specific alert preferences
CREATE TABLE IF NOT EXISTS alert_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  alert_id UUID REFERENCES alerts(id) ON DELETE CASCADE,
  channel_preferences JSONB, -- User-specific channel overrides
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, alert_id)
);

-- Create index for subscriptions
CREATE INDEX IF NOT EXISTS idx_alert_subscriptions_user 
  ON alert_subscriptions (user_id, enabled);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_alerts_updated_at BEFORE UPDATE ON alerts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_alert_channels_updated_at BEFORE UPDATE ON alert_channels
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_alert_subscriptions_updated_at BEFORE UPDATE ON alert_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create view for active alerts with channel information
CREATE OR REPLACE VIEW active_alerts_view AS
SELECT 
  a.id,
  a.name,
  a.container_id,
  a.container_name,
  a.metric_type,
  a.threshold_value,
  a.comparison_operator,
  a.priority,
  a.description,
  a.channel_config,
  a.cooldown_minutes,
  COUNT(DISTINCT ah.id) FILTER (WHERE ah.triggered_at > NOW() - INTERVAL '24 hours') as alerts_last_24h,
  MAX(ah.triggered_at) as last_triggered
FROM alerts a
LEFT JOIN alert_history ah ON a.id = ah.alert_id
WHERE a.enabled = true
GROUP BY a.id;

-- Create view for alert statistics
CREATE OR REPLACE VIEW alert_statistics AS
SELECT 
  DATE_TRUNC('hour', ah.triggered_at) as hour,
  a.name as alert_name,
  a.metric_type,
  a.priority,
  COUNT(*) as trigger_count,
  AVG(ah.metric_value) as avg_metric_value,
  MAX(ah.metric_value) as max_metric_value,
  COUNT(*) FILTER (WHERE ah.status = 'sent') as sent_count,
  COUNT(*) FILTER (WHERE ah.status = 'failed') as failed_count,
  COUNT(*) FILTER (WHERE ah.status = 'suppressed') as suppressed_count
FROM alert_history ah
JOIN alerts a ON ah.alert_id = a.id
WHERE ah.triggered_at > NOW() - INTERVAL '7 days'
GROUP BY DATE_TRUNC('hour', ah.triggered_at), a.name, a.metric_type, a.priority
ORDER BY hour DESC;

-- Grant permissions (adjust user as needed)
GRANT SELECT, INSERT, UPDATE, DELETE ON alerts TO homeops;
GRANT SELECT, INSERT, UPDATE, DELETE ON alert_history TO homeops;
GRANT SELECT, INSERT, UPDATE, DELETE ON alert_channels TO homeops;
GRANT SELECT, INSERT, UPDATE, DELETE ON alert_templates TO homeops;
GRANT SELECT, INSERT, UPDATE, DELETE ON alert_subscriptions TO homeops;
GRANT SELECT ON active_alerts_view TO homeops;
GRANT SELECT ON alert_statistics TO homeops;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO homeops;