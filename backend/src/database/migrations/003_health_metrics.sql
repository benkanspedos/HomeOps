-- Migration: Create health metrics tables for container and system monitoring
-- Version: 003
-- Date: 2025-08-28

-- Create health_metrics table for container metrics (TimescaleDB hypertable)
CREATE TABLE IF NOT EXISTS health_metrics (
  time TIMESTAMPTZ NOT NULL,
  container_id VARCHAR(64) NOT NULL,
  container_name VARCHAR(255),
  cpu_percent NUMERIC(5,2),
  memory_usage_mb NUMERIC(10,2),
  memory_percent NUMERIC(5,2),
  network_rx_bytes BIGINT,
  network_tx_bytes BIGINT,
  disk_read_bytes BIGINT,
  disk_write_bytes BIGINT,
  disk_usage_mb NUMERIC(10,2),
  status VARCHAR(50),
  health_status VARCHAR(50),
  restart_count INTEGER DEFAULT 0,
  uptime_seconds BIGINT
);

-- Convert to TimescaleDB hypertable for time-series optimization
SELECT create_hypertable('health_metrics', 'time', if_not_exists => TRUE);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_health_metrics_container_time 
  ON health_metrics (container_id, time DESC);

CREATE INDEX IF NOT EXISTS idx_health_metrics_container_name_time 
  ON health_metrics (container_name, time DESC);

CREATE INDEX IF NOT EXISTS idx_health_metrics_status 
  ON health_metrics (status, time DESC) 
  WHERE status != 'running';

-- Create compression policy (keep recent data uncompressed for 7 days)
SELECT add_compression_policy('health_metrics', INTERVAL '7 days', if_not_exists => TRUE);

-- Create retention policy (automatically delete data older than 30 days)
SELECT add_retention_policy('health_metrics', INTERVAL '30 days', if_not_exists => TRUE);

-- Create system_metrics table for overall system health
CREATE TABLE IF NOT EXISTS system_metrics (
  time TIMESTAMPTZ NOT NULL,
  total_cpu_percent NUMERIC(5,2),
  total_memory_mb NUMERIC(10,2),
  used_memory_mb NUMERIC(10,2),
  memory_percent NUMERIC(5,2),
  disk_usage_mb NUMERIC(10,2),
  disk_percent NUMERIC(5,2),
  container_count INTEGER,
  running_containers INTEGER,
  stopped_containers INTEGER,
  unhealthy_containers INTEGER,
  network_rx_total_bytes BIGINT,
  network_tx_total_bytes BIGINT
);

-- Convert to TimescaleDB hypertable
SELECT create_hypertable('system_metrics', 'time', if_not_exists => TRUE);

-- Create index for system metrics
CREATE INDEX IF NOT EXISTS idx_system_metrics_time 
  ON system_metrics (time DESC);

-- Compression and retention for system metrics
SELECT add_compression_policy('system_metrics', INTERVAL '7 days', if_not_exists => TRUE);
SELECT add_retention_policy('system_metrics', INTERVAL '30 days', if_not_exists => TRUE);

-- Create container_events table for tracking state changes
CREATE TABLE IF NOT EXISTS container_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  container_id VARCHAR(64) NOT NULL,
  container_name VARCHAR(255),
  event_type VARCHAR(50) NOT NULL, -- started, stopped, restarted, created, destroyed, health_changed
  event_data JSONB,
  occurred_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for container events
CREATE INDEX IF NOT EXISTS idx_container_events_container 
  ON container_events (container_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_container_events_type 
  ON container_events (event_type, occurred_at DESC);

-- Create continuous aggregates for 5-minute averages
CREATE MATERIALIZED VIEW IF NOT EXISTS health_metrics_5min
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('5 minutes', time) AS bucket,
  container_id,
  container_name,
  AVG(cpu_percent) AS avg_cpu_percent,
  MAX(cpu_percent) AS max_cpu_percent,
  AVG(memory_percent) AS avg_memory_percent,
  MAX(memory_percent) AS max_memory_percent,
  AVG(memory_usage_mb) AS avg_memory_mb,
  SUM(network_rx_bytes) AS total_rx_bytes,
  SUM(network_tx_bytes) AS total_tx_bytes,
  COUNT(*) AS sample_count
FROM health_metrics
GROUP BY bucket, container_id, container_name
WITH NO DATA;

-- Create refresh policy for continuous aggregate
SELECT add_continuous_aggregate_policy('health_metrics_5min',
  start_offset => INTERVAL '10 minutes',
  end_offset => INTERVAL '1 minute',
  schedule_interval => INTERVAL '5 minutes',
  if_not_exists => TRUE);

-- Create hourly aggregates
CREATE MATERIALIZED VIEW IF NOT EXISTS health_metrics_hourly
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 hour', time) AS bucket,
  container_id,
  container_name,
  AVG(cpu_percent) AS avg_cpu_percent,
  MAX(cpu_percent) AS max_cpu_percent,
  MIN(cpu_percent) AS min_cpu_percent,
  AVG(memory_percent) AS avg_memory_percent,
  MAX(memory_percent) AS max_memory_percent,
  MIN(memory_percent) AS min_memory_percent,
  AVG(memory_usage_mb) AS avg_memory_mb,
  SUM(network_rx_bytes) AS total_rx_bytes,
  SUM(network_tx_bytes) AS total_tx_bytes,
  COUNT(*) AS sample_count
FROM health_metrics
GROUP BY bucket, container_id, container_name
WITH NO DATA;

-- Create refresh policy for hourly aggregate
SELECT add_continuous_aggregate_policy('health_metrics_hourly',
  start_offset => INTERVAL '2 hours',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour',
  if_not_exists => TRUE);

-- Grant permissions (adjust user as needed)
GRANT SELECT, INSERT, UPDATE ON health_metrics TO homeops;
GRANT SELECT, INSERT, UPDATE ON system_metrics TO homeops;
GRANT SELECT, INSERT, UPDATE ON container_events TO homeops;
GRANT SELECT ON health_metrics_5min TO homeops;
GRANT SELECT ON health_metrics_hourly TO homeops;