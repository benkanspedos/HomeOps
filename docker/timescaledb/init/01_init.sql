-- TimescaleDB initialization script for HomeOps
-- This script creates the necessary extensions and tables for time-series metrics

-- Create TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- Create schemas
CREATE SCHEMA IF NOT EXISTS metrics;
CREATE SCHEMA IF NOT EXISTS events;

-- Service metrics table (continuous time-series data)
CREATE TABLE IF NOT EXISTS metrics.service_metrics (
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    service_name TEXT NOT NULL,
    container_id TEXT,
    cpu_usage_percent REAL,
    memory_usage_bytes BIGINT,
    memory_limit_bytes BIGINT,
    network_rx_bytes BIGINT,
    network_tx_bytes BIGINT,
    disk_read_bytes BIGINT,
    disk_write_bytes BIGINT,
    restart_count INTEGER DEFAULT 0,
    health_status TEXT CHECK (health_status IN ('healthy', 'unhealthy', 'starting', 'none')),
    labels JSONB DEFAULT '{}'
);

-- Convert to hypertable (time-series optimization)
SELECT create_hypertable('metrics.service_metrics', 'timestamp', 
    chunk_time_interval => INTERVAL '1 hour',
    if_not_exists => TRUE
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_service_metrics_service_time 
    ON metrics.service_metrics (service_name, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_service_metrics_container_time 
    ON metrics.service_metrics (container_id, timestamp DESC);

-- System events table
CREATE TABLE IF NOT EXISTS events.system_events (
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    event_type TEXT NOT NULL,
    service_name TEXT,
    container_id TEXT,
    severity TEXT CHECK (severity IN ('info', 'warning', 'error', 'critical')),
    message TEXT NOT NULL,
    details JSONB DEFAULT '{}',
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMPTZ
);

-- Convert events to hypertable
SELECT create_hypertable('events.system_events', 'timestamp', 
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

-- Create indexes for events
CREATE INDEX IF NOT EXISTS idx_system_events_type_time 
    ON events.system_events (event_type, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_system_events_service_time 
    ON events.system_events (service_name, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_system_events_severity_time 
    ON events.system_events (severity, timestamp DESC);

-- Network metrics table (for VPN and traffic analysis)
CREATE TABLE IF NOT EXISTS metrics.network_metrics (
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    interface_name TEXT NOT NULL,
    bytes_received BIGINT,
    bytes_sent BIGINT,
    packets_received BIGINT,
    packets_sent BIGINT,
    errors_received INTEGER DEFAULT 0,
    errors_sent INTEGER DEFAULT 0,
    drops_received INTEGER DEFAULT 0,
    drops_sent INTEGER DEFAULT 0
);

-- Convert network metrics to hypertable
SELECT create_hypertable('metrics.network_metrics', 'timestamp',
    chunk_time_interval => INTERVAL '1 hour',
    if_not_exists => TRUE
);

-- DNS metrics table (for Pi-hole statistics)
CREATE TABLE IF NOT EXISTS metrics.dns_metrics (
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    queries_total INTEGER DEFAULT 0,
    queries_blocked INTEGER DEFAULT 0,
    queries_cached INTEGER DEFAULT 0,
    clients_active INTEGER DEFAULT 0,
    domains_blocked INTEGER DEFAULT 0,
    top_domains JSONB DEFAULT '[]',
    top_blocked JSONB DEFAULT '[]',
    query_types JSONB DEFAULT '{}'
);

-- Convert DNS metrics to hypertable
SELECT create_hypertable('metrics.dns_metrics', 'timestamp',
    chunk_time_interval => INTERVAL '15 minutes',
    if_not_exists => TRUE
);

-- Create continuous aggregates for common queries
-- 5-minute service metrics aggregate
CREATE MATERIALIZED VIEW IF NOT EXISTS metrics.service_metrics_5m
WITH (timescaledb.continuous) AS
SELECT 
    time_bucket('5 minutes', timestamp) AS bucket,
    service_name,
    AVG(cpu_usage_percent) as avg_cpu,
    MAX(cpu_usage_percent) as max_cpu,
    AVG(memory_usage_bytes) as avg_memory,
    MAX(memory_usage_bytes) as max_memory,
    SUM(network_rx_bytes) as total_network_rx,
    SUM(network_tx_bytes) as total_network_tx,
    COUNT(*) as sample_count
FROM metrics.service_metrics
GROUP BY bucket, service_name;

-- 1-hour service metrics aggregate
CREATE MATERIALIZED VIEW IF NOT EXISTS metrics.service_metrics_1h
WITH (timescaledb.continuous) AS
SELECT 
    time_bucket('1 hour', timestamp) AS bucket,
    service_name,
    AVG(cpu_usage_percent) as avg_cpu,
    MAX(cpu_usage_percent) as max_cpu,
    AVG(memory_usage_bytes) as avg_memory,
    MAX(memory_usage_bytes) as max_memory,
    SUM(network_rx_bytes) as total_network_rx,
    SUM(network_tx_bytes) as total_network_tx,
    COUNT(*) as sample_count
FROM metrics.service_metrics
GROUP BY bucket, service_name;

-- Enable continuous aggregate refresh policies
SELECT add_continuous_aggregate_policy('metrics.service_metrics_5m',
    start_offset => INTERVAL '10 minutes',
    end_offset => INTERVAL '1 minute',
    schedule_interval => INTERVAL '1 minute',
    if_not_exists => TRUE
);

SELECT add_continuous_aggregate_policy('metrics.service_metrics_1h',
    start_offset => INTERVAL '2 hours',
    end_offset => INTERVAL '5 minutes',
    schedule_interval => INTERVAL '5 minutes',
    if_not_exists => TRUE
);

-- Data retention policies (keep raw data for 7 days, aggregates longer)
SELECT add_retention_policy('metrics.service_metrics', INTERVAL '7 days', if_not_exists => TRUE);
SELECT add_retention_policy('events.system_events', INTERVAL '30 days', if_not_exists => TRUE);
SELECT add_retention_policy('metrics.network_metrics', INTERVAL '7 days', if_not_exists => TRUE);
SELECT add_retention_policy('metrics.dns_metrics', INTERVAL '7 days', if_not_exists => TRUE);

-- Create functions for common operations
CREATE OR REPLACE FUNCTION metrics.insert_service_metric(
    p_service_name TEXT,
    p_container_id TEXT,
    p_cpu_usage REAL,
    p_memory_usage BIGINT,
    p_memory_limit BIGINT,
    p_network_rx BIGINT,
    p_network_tx BIGINT,
    p_health_status TEXT
) RETURNS VOID AS $$
BEGIN
    INSERT INTO metrics.service_metrics (
        service_name, container_id, cpu_usage_percent, memory_usage_bytes,
        memory_limit_bytes, network_rx_bytes, network_tx_bytes, health_status
    ) VALUES (
        p_service_name, p_container_id, p_cpu_usage, p_memory_usage,
        p_memory_limit, p_network_rx, p_network_tx, p_health_status
    );
END;
$$ LANGUAGE plpgsql;

-- Function to log system events
CREATE OR REPLACE FUNCTION events.log_event(
    p_event_type TEXT,
    p_service_name TEXT,
    p_severity TEXT,
    p_message TEXT,
    p_details JSONB DEFAULT '{}'
) RETURNS VOID AS $$
BEGIN
    INSERT INTO events.system_events (
        event_type, service_name, severity, message, details
    ) VALUES (
        p_event_type, p_service_name, p_severity, p_message, p_details
    );
END;
$$ LANGUAGE plpgsql;

-- Create views for easier querying
CREATE OR REPLACE VIEW metrics.latest_service_status AS
SELECT DISTINCT ON (service_name)
    service_name,
    timestamp,
    cpu_usage_percent,
    memory_usage_bytes,
    health_status,
    container_id
FROM metrics.service_metrics
ORDER BY service_name, timestamp DESC;

-- Grant permissions
GRANT USAGE ON SCHEMA metrics TO homeops;
GRANT USAGE ON SCHEMA events TO homeops;
GRANT ALL ON ALL TABLES IN SCHEMA metrics TO homeops;
GRANT ALL ON ALL TABLES IN SCHEMA events TO homeops;
GRANT ALL ON ALL SEQUENCES IN SCHEMA metrics TO homeops;
GRANT ALL ON ALL SEQUENCES IN SCHEMA events TO homeops;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA metrics TO homeops;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA events TO homeops;

-- Insert initial test data
SELECT events.log_event('system', 'timescaledb', 'info', 'TimescaleDB initialized successfully', '{"version": "latest-pg15"}');

COMMIT;