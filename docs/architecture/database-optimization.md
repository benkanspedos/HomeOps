# HomeOps Database Optimization Guide
**Version 1.0** | **Date: August 24, 2025**

---

## Overview

This document provides comprehensive database optimization strategies for HomeOps, covering query performance, caching strategies, connection management, monitoring, and scaling considerations. The optimization approach balances performance, resource utilization, and maintainability for a single-household deployment with potential community scaling.

### Optimization Principles

1. **Performance First**: Optimize for sub-second response times
2. **Resource Efficiency**: Maximize hardware utilization without waste
3. **Scalability Ready**: Design for future growth and community features
4. **Maintainability**: Keep optimization strategies simple and monitorable
5. **Cost Effectiveness**: Leverage free and open-source solutions where possible

---

## Query Optimization Guidelines

### Query Performance Standards

#### Response Time Targets
```
Query Type                | Target Response Time | Maximum Acceptable
-------------------------|---------------------|-------------------
Authentication/Session   | <50ms               | 100ms
Dashboard Loading        | <200ms              | 500ms
Real-time Data          | <100ms              | 250ms
Background Processing   | <1s                 | 5s
Analytics/Reports       | <2s                 | 10s
Bulk Operations         | <10s                | 30s
```

### Index Strategy Implementation

#### Core Performance Indexes
```sql
-- High-frequency authentication queries
CREATE INDEX CONCURRENTLY idx_users_auth_lookup 
ON core.users (email, is_active) 
WHERE is_active = true;

-- Session management optimization
CREATE INDEX CONCURRENTLY idx_sessions_user_active 
ON core.conversation_sessions (user_id, is_active) 
INCLUDE (id, started_at)
WHERE is_active = true;

-- Real-time notifications
CREATE INDEX CONCURRENTLY idx_notifications_realtime 
ON core.notifications (user_id, created_at DESC) 
INCLUDE (id, type, title, is_read)
WHERE is_read = false;
```

#### Time-Series Query Optimization
```sql
-- Partition-aware indexes for TimescaleDB
CREATE INDEX CONCURRENTLY idx_perf_metrics_node_hour 
ON network.performance_metrics (node_id, time_bucket('1 hour', time));

CREATE INDEX CONCURRENTLY idx_sys_metrics_recent 
ON system_optimization.performance_metrics (time DESC, node_id) 
WHERE time > NOW() - INTERVAL '24 hours';

-- Composite indexes for common dashboard queries
CREATE INDEX CONCURRENTLY idx_system_health_dashboard 
ON analytics.system_health (time DESC) 
INCLUDE (overall_health_score, active_services, error_rate);
```

### Query Pattern Optimization

#### Dashboard Loading Queries
```sql
-- Optimized system overview query
WITH RECURSIVE system_status AS (
    -- Get latest system health
    SELECT overall_health_score, active_services, failed_services
    FROM analytics.system_health 
    ORDER BY time DESC 
    LIMIT 1
),
recent_alerts AS (
    -- Get unread notifications efficiently
    SELECT COUNT(*) as unread_count
    FROM core.notifications 
    WHERE user_id = $1 AND is_read = false
),
service_summary AS (
    -- Service status summary
    SELECT 
        status,
        COUNT(*) as count
    FROM network.services 
    GROUP BY status
)
SELECT * FROM system_status, recent_alerts, service_summary;
```

#### Financial Dashboard Optimization
```sql
-- Portfolio performance with single query
SELECT 
    p.id,
    p.name,
    p.total_value,
    p.total_cost_basis,
    (p.total_value - p.total_cost_basis) as unrealized_pnl,
    CASE 
        WHEN p.total_cost_basis > 0 THEN 
            ((p.total_value - p.total_cost_basis) / p.total_cost_basis) * 100 
        ELSE 0 
    END as return_percentage,
    pos_summary.position_count,
    pos_summary.avg_performance
FROM financial.portfolios p
LEFT JOIN (
    SELECT 
        portfolio_id,
        COUNT(*) as position_count,
        AVG(
            CASE 
                WHEN average_cost > 0 THEN 
                    ((current_price - average_cost) / average_cost) * 100 
                ELSE 0 
            END
        ) as avg_performance
    FROM financial.positions 
    WHERE quantity > 0
    GROUP BY portfolio_id
) pos_summary ON p.id = pos_summary.portfolio_id
WHERE p.user_id = $1;
```

#### Smart Home Device Status
```sql
-- Efficient device status with room grouping
SELECT 
    r.name as room_name,
    r.type as room_type,
    json_agg(
        json_build_object(
            'id', d.id,
            'name', d.name,
            'type', d.device_type,
            'online', d.is_online,
            'state', d.current_state
        ) ORDER BY d.name
    ) as devices
FROM smart_home.rooms r
LEFT JOIN smart_home.devices d ON r.id = d.room_id
WHERE d.is_controllable = true
GROUP BY r.id, r.name, r.type
ORDER BY r.name;
```

### Query Analysis and Optimization

#### EXPLAIN ANALYZE Usage
```sql
-- Enable detailed query analysis
SET track_io_timing = ON;
SET log_min_duration_statement = 100;

-- Analyze slow queries
EXPLAIN (ANALYZE, BUFFERS, TIMING, FORMAT JSON) 
SELECT * FROM financial.transactions 
WHERE account_id = $1 
AND transaction_date >= $2 
ORDER BY transaction_date DESC 
LIMIT 50;
```

#### Common Query Anti-Patterns to Avoid
```sql
-- AVOID: N+1 queries
-- Bad: Multiple separate queries
SELECT * FROM media.items WHERE library_id = 1;
-- Then for each item:
SELECT * FROM media.user_activity WHERE item_id = ?;

-- GOOD: Single query with JOIN
SELECT 
    i.*,
    COALESCE(
        json_agg(
            json_build_object('activity_type', ua.activity_type, 'created_at', ua.created_at)
        ) FILTER (WHERE ua.id IS NOT NULL), 
        '[]'
    ) as activities
FROM media.items i
LEFT JOIN media.user_activity ua ON i.id = ua.item_id
WHERE i.library_id = 1
GROUP BY i.id;

-- AVOID: SELECT * in production queries
-- Bad:
SELECT * FROM financial.transactions;

-- Good:
SELECT id, transaction_date, amount, description 
FROM financial.transactions;

-- AVOID: Functions in WHERE clauses
-- Bad:
SELECT * FROM core.users WHERE UPPER(email) = UPPER($1);

-- Good:
CREATE INDEX idx_users_email_lower ON core.users (LOWER(email));
SELECT * FROM core.users WHERE LOWER(email) = LOWER($1);
```

---

## Caching Layer Design

### Redis Caching Architecture

#### Cache Hierarchy Strategy
```
Level 1: Application Memory Cache (Node.js)
├── Session data (15 minutes TTL)
├── User preferences (1 hour TTL)
└── Frequently accessed configs (24 hours TTL)

Level 2: Redis Cache (Centralized)
├── Database query results (5-60 minutes TTL)
├── API responses (1-15 minutes TTL)
├── Real-time metrics (30 seconds TTL)
└── Computed aggregations (1-6 hours TTL)

Level 3: Database (Source of Truth)
├── Materialized views for complex aggregations
├── Partial indexes for frequent filters
└── Connection pooling for efficiency
```

#### Redis Configuration
```redis
# redis.conf optimization for HomeOps
maxmemory 2gb
maxmemory-policy allkeys-lru
timeout 300
tcp-keepalive 60

# Persistence for important session data
appendonly yes
appendfsync everysec
auto-aof-rewrite-percentage 100
auto-aof-rewrite-min-size 64mb

# Memory optimization
hash-max-ziplist-entries 512
hash-max-ziplist-value 64
list-max-ziplist-size -2
set-max-intset-entries 512
```

### Application-Level Caching

#### Session and User Data Caching
```typescript
// Session cache with automatic invalidation
interface SessionCache {
  userId: string;
  preferences: UserPreferences;
  permissions: string[];
  lastActivity: Date;
  ttl: number;
}

class SessionManager {
  private cache = new Map<string, SessionCache>();
  private readonly TTL = 15 * 60 * 1000; // 15 minutes

  async getSession(sessionId: string): Promise<SessionCache | null> {
    let session = this.cache.get(sessionId);
    
    if (!session || Date.now() > session.ttl) {
      session = await this.loadFromDatabase(sessionId);
      if (session) {
        session.ttl = Date.now() + this.TTL;
        this.cache.set(sessionId, session);
      }
    }
    
    return session;
  }

  invalidateUser(userId: string): void {
    for (const [sessionId, session] of this.cache.entries()) {
      if (session.userId === userId) {
        this.cache.delete(sessionId);
      }
    }
  }
}
```

#### Query Result Caching
```typescript
// Database query cache with dependency tracking
interface CacheEntry<T> {
  data: T;
  dependencies: string[];
  expiry: Date;
  hitCount: number;
}

class QueryCache {
  private redis: Redis;
  private dependencies = new Map<string, Set<string>>();

  async get<T>(key: string, dependencies: string[]): Promise<T | null> {
    const cached = await this.redis.hgetall(`cache:${key}`);
    
    if (cached.data && new Date(cached.expiry) > new Date()) {
      await this.redis.hincrby(`cache:${key}`, 'hitCount', 1);
      return JSON.parse(cached.data);
    }
    
    return null;
  }

  async set<T>(key: string, data: T, ttlSeconds: number, dependencies: string[]): Promise<void> {
    const entry: CacheEntry<T> = {
      data,
      dependencies,
      expiry: new Date(Date.now() + ttlSeconds * 1000),
      hitCount: 0
    };

    await this.redis.hset(`cache:${key}`, {
      data: JSON.stringify(data),
      dependencies: JSON.stringify(dependencies),
      expiry: entry.expiry.toISOString(),
      hitCount: 0
    });

    // Track dependencies for invalidation
    dependencies.forEach(dep => {
      if (!this.dependencies.has(dep)) {
        this.dependencies.set(dep, new Set());
      }
      this.dependencies.get(dep)!.add(key);
    });
  }

  async invalidate(dependency: string): Promise<void> {
    const keys = this.dependencies.get(dependency);
    if (keys) {
      const pipeline = this.redis.pipeline();
      keys.forEach(key => pipeline.del(`cache:${key}`));
      await pipeline.exec();
      this.dependencies.delete(dependency);
    }
  }
}
```

### Database-Level Caching

#### Materialized Views for Complex Aggregations
```sql
-- Portfolio performance summary (refreshed hourly)
CREATE MATERIALIZED VIEW financial.portfolio_performance_summary AS
SELECT 
    p.user_id,
    p.id as portfolio_id,
    p.name,
    p.total_value,
    p.total_cost_basis,
    (p.total_value - p.total_cost_basis) as unrealized_pnl,
    COUNT(pos.id) as position_count,
    AVG(pos.unrealized_pnl) as avg_position_pnl,
    STDDEV(pos.unrealized_pnl) as portfolio_volatility,
    MAX(pos.last_updated) as last_position_update
FROM financial.portfolios p
LEFT JOIN financial.positions pos ON p.id = pos.portfolio_id
GROUP BY p.id, p.user_id, p.name, p.total_value, p.total_cost_basis;

-- Create index on materialized view
CREATE UNIQUE INDEX idx_portfolio_perf_summary_id 
ON financial.portfolio_performance_summary (portfolio_id);

CREATE INDEX idx_portfolio_perf_summary_user 
ON financial.portfolio_performance_summary (user_id);

-- Refresh strategy
CREATE OR REPLACE FUNCTION refresh_portfolio_performance() 
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY financial.portfolio_performance_summary;
END;
$$ LANGUAGE plpgsql;

-- Schedule refresh via cron or application
SELECT cron.schedule('refresh-portfolio-performance', '0 * * * *', 'SELECT refresh_portfolio_performance();');
```

#### Partial Indexes for Hot Data
```sql
-- Index only recent, active data
CREATE INDEX idx_transactions_recent_hot 
ON financial.transactions (account_id, transaction_date DESC, amount) 
WHERE transaction_date >= CURRENT_DATE - INTERVAL '90 days';

CREATE INDEX idx_notifications_active_users 
ON core.notifications (user_id, created_at DESC) 
WHERE is_read = false 
AND user_id IN (
    SELECT id FROM core.users 
    WHERE last_login_at >= CURRENT_DATE - INTERVAL '30 days'
);

CREATE INDEX idx_devices_responsive 
ON smart_home.devices (room_id, device_type, is_online) 
WHERE is_online = true 
AND last_seen >= NOW() - INTERVAL '5 minutes';
```

---

## Connection Management

### Connection Pool Configuration

#### Node.js with Prisma
```typescript
// Database connection pool configuration
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  },
  log: ['query', 'info', 'warn', 'error'],
});

// Connection pool settings via environment
DATABASE_URL="postgresql://user:pass@localhost:5432/homeops?connection_limit=20&pool_timeout=20&connect_timeout=10"
```

#### Advanced Connection Pooling with PgBouncer
```ini
# pgbouncer.ini
[databases]
homeops = host=localhost port=5432 dbname=homeops

[pgbouncer]
listen_port = 6432
listen_addr = *
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt

# Pool configuration
pool_mode = transaction
max_client_conn = 100
default_pool_size = 20
min_pool_size = 5
reserve_pool_size = 5
reserve_pool_timeout = 10

# Connection limits
max_db_connections = 50
max_user_connections = 30

# Performance tuning
server_round_robin = 1
ignore_startup_parameters = extra_float_digits

# Monitoring
stats_period = 60
log_connections = 1
log_disconnections = 1
```

### Connection Pool Monitoring

#### Connection Health Checks
```typescript
// Connection pool health monitoring
class DatabaseHealthCheck {
  private prisma: PrismaClient;
  private healthMetrics = {
    activeConnections: 0,
    totalQueries: 0,
    avgResponseTime: 0,
    errorRate: 0
  };

  async checkHealth(): Promise<HealthStatus> {
    try {
      const start = Date.now();
      
      // Simple query to test connectivity
      await this.prisma.$queryRaw`SELECT 1`;
      
      const responseTime = Date.now() - start;
      
      // Get connection pool stats
      const poolStats = await this.getPoolStats();
      
      return {
        status: 'healthy',
        responseTime,
        connections: poolStats,
        timestamp: new Date()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date()
      };
    }
  }

  private async getPoolStats() {
    // Query pg_stat_activity for connection info
    const stats = await this.prisma.$queryRaw`
      SELECT 
        COUNT(*) as total_connections,
        COUNT(*) FILTER (WHERE state = 'active') as active_connections,
        COUNT(*) FILTER (WHERE state = 'idle') as idle_connections
      FROM pg_stat_activity 
      WHERE datname = current_database()
    `;
    
    return stats[0];
  }
}
```

#### Automatic Connection Recovery
```typescript
// Connection recovery and retry logic
class ResilientDatabaseClient {
  private prisma: PrismaClient;
  private maxRetries = 3;
  private baseDelay = 1000;

  async query<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (this.isRetryableError(error) && attempt < this.maxRetries) {
          const delay = this.baseDelay * Math.pow(2, attempt - 1);
          await this.delay(delay);
          
          // Optionally reconnect
          if (this.isConnectionError(error)) {
            await this.reconnect();
          }
        } else {
          throw error;
        }
      }
    }
    
    throw lastError!;
  }

  private isRetryableError(error: any): boolean {
    const retryableCodes = [
      'ECONNRESET',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'P2028' // Prisma connection timeout
    ];
    
    return retryableCodes.some(code => 
      error.code === code || error.message.includes(code)
    );
  }

  private async reconnect(): Promise<void> {
    try {
      await this.prisma.$disconnect();
      await this.prisma.$connect();
    } catch (error) {
      console.error('Reconnection failed:', error);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

---

## Partitioning Strategy

### Time-Series Data Partitioning

#### TimescaleDB Hypertable Configuration
```sql
-- Create hypertables for time-series data
SELECT create_hypertable('network.performance_metrics', 'time', chunk_time_interval => INTERVAL '1 day');
SELECT create_hypertable('system_optimization.performance_metrics', 'time', chunk_time_interval => INTERVAL '1 day');
SELECT create_hypertable('analytics.events', 'timestamp', chunk_time_interval => INTERVAL '1 week');
SELECT create_hypertable('analytics.system_health', 'time', chunk_time_interval => INTERVAL '1 day');

-- Add space partitioning for high-volume tables
SELECT add_dimension('analytics.events', 'user_id', number_partitions => 4);
SELECT add_dimension('network.performance_metrics', 'node_id', number_partitions => 2);
```

#### Compression and Retention Policies
```sql
-- Enable compression on older data
SELECT add_compression_policy('network.performance_metrics', INTERVAL '7 days');
SELECT add_compression_policy('analytics.events', INTERVAL '30 days');
SELECT add_compression_policy('analytics.system_health', INTERVAL '7 days');

-- Set up data retention policies
SELECT add_retention_policy('network.performance_metrics', INTERVAL '1 year');
SELECT add_retention_policy('analytics.events', INTERVAL '2 years');
SELECT add_retention_policy('analytics.system_health', INTERVAL '6 months');

-- Continuous aggregates for common queries
CREATE MATERIALIZED VIEW network.performance_hourly
WITH (timescaledb.continuous) AS
SELECT 
    time_bucket('1 hour', time) AS hour,
    node_id,
    metric_type,
    AVG(value) as avg_value,
    MIN(value) as min_value,
    MAX(value) as max_value,
    COUNT(*) as sample_count
FROM network.performance_metrics
GROUP BY hour, node_id, metric_type;

-- Refresh policy for continuous aggregates
SELECT add_continuous_aggregate_policy('network.performance_hourly',
    start_offset => INTERVAL '1 day',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour');
```

### Application-Level Partitioning

#### Horizontal Partitioning for Large Tables
```sql
-- Partition financial transactions by year
CREATE TABLE financial.transactions (
    id UUID NOT NULL,
    account_id UUID NOT NULL,
    transaction_date DATE NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    description TEXT NOT NULL,
    -- other columns...
    CONSTRAINT pk_transactions PRIMARY KEY (id, transaction_date)
) PARTITION BY RANGE (transaction_date);

-- Create partitions for each year
CREATE TABLE financial.transactions_2024 PARTITION OF financial.transactions
FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

CREATE TABLE financial.transactions_2025 PARTITION OF financial.transactions
FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');

-- Create indexes on each partition
CREATE INDEX idx_transactions_2024_account_date 
ON financial.transactions_2024 (account_id, transaction_date DESC);

CREATE INDEX idx_transactions_2025_account_date 
ON financial.transactions_2025 (account_id, transaction_date DESC);

-- Automatic partition creation function
CREATE OR REPLACE FUNCTION create_yearly_partition(table_name TEXT, year INTEGER)
RETURNS void AS $$
DECLARE
    partition_name TEXT;
    start_date DATE;
    end_date DATE;
BEGIN
    partition_name := table_name || '_' || year;
    start_date := DATE(year || '-01-01');
    end_date := DATE((year + 1) || '-01-01');
    
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF %I
                    FOR VALUES FROM (%L) TO (%L)',
                   partition_name, table_name, start_date, end_date);
                   
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_account_date 
                    ON %I (account_id, transaction_date DESC)',
                   partition_name, partition_name);
END;
$$ LANGUAGE plpgsql;

-- Schedule automatic partition creation
SELECT cron.schedule('create-yearly-partitions', '0 0 1 1 *', 
    'SELECT create_yearly_partition(''financial.transactions'', EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER + 1)');
```

---

## Monitoring and Alerting

### Performance Monitoring Setup

#### Key Metrics Collection
```sql
-- Create monitoring views for key metrics
CREATE OR REPLACE VIEW monitoring.database_performance AS
SELECT 
    'query_performance' as metric_type,
    schemaname,
    tablename,
    seq_scan,
    seq_tup_read,
    idx_scan,
    idx_tup_fetch,
    n_tup_ins,
    n_tup_upd,
    n_tup_del,
    n_live_tup,
    n_dead_tup
FROM pg_stat_user_tables;

CREATE OR REPLACE VIEW monitoring.index_usage AS
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

CREATE OR REPLACE VIEW monitoring.slow_queries AS
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    min_time,
    max_time,
    stddev_time
FROM pg_stat_statements
WHERE mean_time > 100 -- queries taking more than 100ms on average
ORDER BY total_time DESC;
```

#### Automated Performance Alerts
```typescript
// Performance monitoring service
class DatabaseMonitor {
  private alertThresholds = {
    slowQueryTime: 1000, // 1 second
    highConnectionCount: 80, // 80% of max connections
    indexScanRatio: 0.8, // 80% index vs sequential scans
    deadTupleRatio: 0.1, // 10% dead tuples
    cacheHitRatio: 0.95 // 95% cache hit rate
  };

  async checkPerformance(): Promise<AlertLevel> {
    const metrics = await this.collectMetrics();
    const alerts: Alert[] = [];

    // Check slow queries
    if (metrics.slowQueries.length > 0) {
      alerts.push({
        level: 'warning',
        message: `${metrics.slowQueries.length} slow queries detected`,
        details: metrics.slowQueries.slice(0, 5)
      });
    }

    // Check connection usage
    if (metrics.connectionUsage > this.alertThresholds.highConnectionCount) {
      alerts.push({
        level: 'critical',
        message: `High connection usage: ${metrics.connectionUsage}%`,
        recommendation: 'Consider scaling connection pool or investigating connection leaks'
      });
    }

    // Check index usage
    const tablesWithLowIndexUsage = metrics.tables.filter(
      table => table.indexScanRatio < this.alertThresholds.indexScanRatio
    );
    
    if (tablesWithLowIndexUsage.length > 0) {
      alerts.push({
        level: 'warning',
        message: `${tablesWithLowIndexUsage.length} tables with low index usage`,
        details: tablesWithLowIndexUsage.map(t => t.name)
      });
    }

    return this.determineAlertLevel(alerts);
  }

  private async collectMetrics() {
    return {
      slowQueries: await this.getSlowQueries(),
      connectionUsage: await this.getConnectionUsage(),
      tables: await this.getTableStats(),
      cacheHitRatio: await this.getCacheHitRatio(),
      replicationLag: await this.getReplicationLag()
    };
  }

  private async getSlowQueries() {
    const result = await prisma.$queryRaw`
      SELECT query, calls, mean_time, total_time
      FROM pg_stat_statements
      WHERE mean_time > ${this.alertThresholds.slowQueryTime}
      ORDER BY total_time DESC
      LIMIT 10
    `;
    return result;
  }
}
```

### Health Check Endpoints

#### Application Health Checks
```typescript
// Comprehensive health check endpoint
app.get('/health', async (req, res) => {
  const healthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: 'unknown',
      redis: 'unknown',
      external_apis: 'unknown'
    },
    metrics: {}
  };

  try {
    // Database health
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    healthCheck.services.database = 'healthy';
    healthCheck.metrics.database_response_time = Date.now() - dbStart;

    // Redis health
    const redisStart = Date.now();
    await redis.ping();
    healthCheck.services.redis = 'healthy';
    healthCheck.metrics.redis_response_time = Date.now() - redisStart;

    // Critical service checks
    const criticalServices = await Promise.allSettled([
      checkFinancialService(),
      checkMediaService(),
      checkSmartHomeService()
    ]);

    healthCheck.services.external_apis = criticalServices.every(
      result => result.status === 'fulfilled'
    ) ? 'healthy' : 'degraded';

    // Overall status
    const hasUnhealthyService = Object.values(healthCheck.services)
      .some(status => status === 'unhealthy');
    
    if (hasUnhealthyService) {
      healthCheck.status = 'unhealthy';
      res.status(503);
    } else if (healthCheck.services.external_apis === 'degraded') {
      healthCheck.status = 'degraded';
      res.status(200);
    }

    res.json(healthCheck);
  } catch (error) {
    healthCheck.status = 'unhealthy';
    healthCheck.error = error.message;
    res.status(503).json(healthCheck);
  }
});
```

### Monitoring Dashboard

#### Grafana Dashboard Configuration
```json
{
  "dashboard": {
    "title": "HomeOps Database Performance",
    "panels": [
      {
        "title": "Query Performance",
        "type": "graph",
        "targets": [
          {
            "expr": "avg(database_query_duration_seconds)",
            "legendFormat": "Average Query Time"
          }
        ]
      },
      {
        "title": "Connection Pool Usage",
        "type": "singlestat",
        "targets": [
          {
            "expr": "database_connections_active / database_connections_max * 100",
            "legendFormat": "Connection Usage %"
          }
        ]
      },
      {
        "title": "Cache Hit Ratio",
        "type": "singlestat",
        "targets": [
          {
            "expr": "database_cache_hit_ratio * 100",
            "legendFormat": "Cache Hit %"
          }
        ]
      },
      {
        "title": "Index Usage",
        "type": "table",
        "targets": [
          {
            "rawSql": "SELECT schemaname, tablename, idx_scan, seq_scan FROM pg_stat_user_tables ORDER BY seq_scan DESC LIMIT 10"
          }
        ]
      }
    ]
  }
}
```

---

## Read Replica Configuration

### Primary-Replica Setup

#### Streaming Replication Configuration
```postgresql
# postgresql.conf (Primary)
wal_level = replica
max_wal_senders = 3
max_replication_slots = 3
archive_mode = on
archive_command = 'cp %p /var/lib/postgresql/archive/%f'

# Enable hot standby
hot_standby = on
max_standby_streaming_delay = 30s
```

#### Application-Level Read/Write Splitting
```typescript
// Database connection manager with read/write splitting
class DatabaseManager {
  private primaryDb: PrismaClient;
  private replicaDb: PrismaClient;
  private replicationLag = 0;
  private readonly maxLagMs = 5000; // 5 seconds

  constructor() {
    this.primaryDb = new PrismaClient({
      datasources: { db: { url: process.env.PRIMARY_DATABASE_URL } }
    });
    
    this.replicaDb = new PrismaClient({
      datasources: { db: { url: process.env.REPLICA_DATABASE_URL } }
    });
    
    this.monitorReplicationLag();
  }

  async read<T>(operation: (db: PrismaClient) => Promise<T>, options: ReadOptions = {}): Promise<T> {
    const { forceConsistency = false, maxStaleness = 30000 } = options;
    
    // Force primary for consistency-critical reads
    if (forceConsistency || this.replicationLag > maxStaleness) {
      return await operation(this.primaryDb);
    }
    
    // Use replica for regular reads
    try {
      return await operation(this.replicaDb);
    } catch (error) {
      // Fallback to primary if replica fails
      console.warn('Replica read failed, falling back to primary:', error);
      return await operation(this.primaryDb);
    }
  }

  async write<T>(operation: (db: PrismaClient) => Promise<T>): Promise<T> {
    return await operation(this.primaryDb);
  }

  private async monitorReplicationLag(): Promise<void> {
    setInterval(async () => {
      try {
        const [primaryTime] = await this.primaryDb.$queryRaw<[{now: Date}]>`SELECT NOW() as now`;
        const [replicaTime] = await this.replicaDb.$queryRaw<[{now: Date}]>`SELECT NOW() as now`;
        
        this.replicationLag = primaryTime.now.getTime() - replicaTime.now.getTime();
      } catch (error) {
        console.error('Failed to check replication lag:', error);
        this.replicationLag = Number.MAX_SAFE_INTEGER; // Force primary usage
      }
    }, 10000); // Check every 10 seconds
  }
}

// Usage examples
const dbManager = new DatabaseManager();

// Read operations (can use replica)
const users = await dbManager.read(db => 
  db.user.findMany({ where: { isActive: true } })
);

// Consistency-critical reads (use primary)
const userBalance = await dbManager.read(
  db => db.financialAccount.findFirst({ where: { userId } }),
  { forceConsistency: true }
);

// Write operations (always primary)
const newUser = await dbManager.write(db =>
  db.user.create({ data: userData })
);
```

### Load Balancing Strategy

#### Application-Level Load Balancing
```typescript
// Read replica load balancer
class ReadReplicaLoadBalancer {
  private replicas: Array<{ url: string; client: PrismaClient; health: boolean; latency: number }>;
  private healthCheckInterval: NodeJS.Timeout;

  constructor(replicaUrls: string[]) {
    this.replicas = replicaUrls.map(url => ({
      url,
      client: new PrismaClient({ datasources: { db: { url } } }),
      health: true,
      latency: 0
    }));

    this.startHealthChecks();
  }

  async executeRead<T>(operation: (client: PrismaClient) => Promise<T>): Promise<T> {
    const healthyReplicas = this.replicas.filter(r => r.health);
    
    if (healthyReplicas.length === 0) {
      throw new Error('No healthy replicas available');
    }

    // Select replica based on latency (weighted random)
    const selectedReplica = this.selectOptimalReplica(healthyReplicas);
    
    try {
      const start = Date.now();
      const result = await operation(selectedReplica.client);
      selectedReplica.latency = Date.now() - start;
      return result;
    } catch (error) {
      selectedReplica.health = false;
      // Retry with another replica
      return this.executeRead(operation);
    }
  }

  private selectOptimalReplica(replicas: typeof this.replicas) {
    // Weighted selection based on inverse latency
    const weights = replicas.map(r => 1 / (r.latency + 1));
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    
    let random = Math.random() * totalWeight;
    for (let i = 0; i < replicas.length; i++) {
      random -= weights[i];
      if (random <= 0) return replicas[i];
    }
    
    return replicas[0]; // Fallback
  }

  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      await Promise.all(this.replicas.map(async replica => {
        try {
          const start = Date.now();
          await replica.client.$queryRaw`SELECT 1`;
          replica.latency = Date.now() - start;
          replica.health = true;
        } catch (error) {
          replica.health = false;
        }
      }));
    }, 30000); // Check every 30 seconds
  }
}
```

---

## Performance Benchmarking

### Baseline Performance Metrics

#### Database Performance Targets
```typescript
// Performance benchmarking suite
class PerformanceBenchmark {
  private scenarios: BenchmarkScenario[] = [
    {
      name: 'User Authentication',
      query: 'SELECT id, email, role FROM core.users WHERE email = $1 AND is_active = true',
      targetTime: 50,
      params: ['user@example.com']
    },
    {
      name: 'Dashboard Data Loading',
      query: `
        SELECT 
          (SELECT COUNT(*) FROM core.notifications WHERE user_id = $1 AND is_read = false) as unread_notifications,
          (SELECT COUNT(*) FROM smart_home.devices WHERE is_online = true) as online_devices,
          (SELECT SUM(balance) FROM financial.accounts WHERE user_id = $1) as total_balance
      `,
      targetTime: 200,
      params: ['user-uuid']
    },
    {
      name: 'Transaction History',
      query: `
        SELECT t.*, a.account_name 
        FROM financial.transactions t
        JOIN financial.accounts a ON t.account_id = a.id
        WHERE a.user_id = $1 
        ORDER BY t.transaction_date DESC 
        LIMIT 50
      `,
      targetTime: 100,
      params: ['user-uuid']
    },
    {
      name: 'Media Library Browse',
      query: `
        SELECT i.*, COUNT(ua.id) as activity_count
        FROM media.items i
        LEFT JOIN media.user_activity ua ON i.id = ua.item_id
        WHERE i.library_id = $1
        GROUP BY i.id
        ORDER BY i.date_added DESC
        LIMIT 100
      `,
      targetTime: 300,
      params: ['library-uuid']
    }
  ];

  async runBenchmarks(): Promise<BenchmarkResults> {
    const results: BenchmarkResult[] = [];
    
    for (const scenario of this.scenarios) {
      const result = await this.benchmarkScenario(scenario);
      results.push(result);
      
      if (result.averageTime > scenario.targetTime) {
        console.warn(`⚠️  ${scenario.name} exceeded target time: ${result.averageTime}ms > ${scenario.targetTime}ms`);
      }
    }
    
    return {
      timestamp: new Date(),
      results,
      summary: this.generateSummary(results)
    };
  }

  private async benchmarkScenario(scenario: BenchmarkScenario): Promise<BenchmarkResult> {
    const iterations = 100;
    const times: number[] = [];
    
    // Warm up
    for (let i = 0; i < 10; i++) {
      await this.executeQuery(scenario.query, scenario.params);
    }
    
    // Actual benchmark
    for (let i = 0; i < iterations; i++) {
      const start = process.hrtime.bigint();
      await this.executeQuery(scenario.query, scenario.params);
      const end = process.hrtime.bigint();
      
      times.push(Number(end - start) / 1_000_000); // Convert to milliseconds
    }
    
    times.sort((a, b) => a - b);
    
    return {
      name: scenario.name,
      iterations,
      averageTime: times.reduce((sum, time) => sum + time, 0) / times.length,
      medianTime: times[Math.floor(times.length / 2)],
      minTime: times[0],
      maxTime: times[times.length - 1],
      p95Time: times[Math.floor(times.length * 0.95)],
      p99Time: times[Math.floor(times.length * 0.99)],
      targetTime: scenario.targetTime,
      passed: times[Math.floor(times.length * 0.95)] <= scenario.targetTime
    };
  }
}
```

### Continuous Performance Testing

#### Performance Regression Detection
```typescript
// Automated performance monitoring
class PerformanceMonitor {
  private baselineResults: Map<string, BenchmarkResult> = new Map();
  private regressionThreshold = 1.5; // 50% performance regression threshold

  async checkForRegressions(): Promise<RegressionReport> {
    const currentResults = await this.runCurrentBenchmarks();
    const regressions: Regression[] = [];

    for (const [testName, currentResult] of currentResults) {
      const baseline = this.baselineResults.get(testName);
      
      if (baseline) {
        const performanceRatio = currentResult.p95Time / baseline.p95Time;
        
        if (performanceRatio > this.regressionThreshold) {
          regressions.push({
            testName,
            baselineTime: baseline.p95Time,
            currentTime: currentResult.p95Time,
            regressionFactor: performanceRatio,
            severity: this.calculateSeverity(performanceRatio)
          });
        }
      }
    }

    return {
      timestamp: new Date(),
      regressions,
      overallHealth: regressions.length === 0 ? 'healthy' : 'degraded'
    };
  }

  private calculateSeverity(ratio: number): 'minor' | 'major' | 'critical' {
    if (ratio > 3) return 'critical';
    if (ratio > 2) return 'major';
    return 'minor';
  }
}
```

---

## Optimization Maintenance

### Regular Maintenance Tasks

#### Automated Database Maintenance
```sql
-- Create maintenance procedures
CREATE OR REPLACE FUNCTION perform_database_maintenance()
RETURNS void AS $$
BEGIN
    -- Update statistics
    ANALYZE;
    
    -- Vacuum dead tuples
    VACUUM (ANALYZE);
    
    -- Reindex fragmented indexes
    REINDEX INDEX CONCURRENTLY idx_transactions_account_date;
    
    -- Update continuous aggregates
    CALL refresh_continuous_aggregate('network.performance_hourly', 
                                     NOW() - INTERVAL '1 day', 
                                     NOW());
    
    -- Clean up old partitions
    CALL drop_old_partitions('financial.transactions', INTERVAL '7 years');
    
    -- Update materialized views
    REFRESH MATERIALIZED VIEW CONCURRENTLY financial.portfolio_performance_summary;
    
    RAISE NOTICE 'Database maintenance completed at %', NOW();
END;
$$ LANGUAGE plpgsql;

-- Schedule maintenance (requires pg_cron extension)
SELECT cron.schedule('database-maintenance', '0 2 * * 0', 'SELECT perform_database_maintenance()');
```

#### Performance Optimization Scripts
```bash
#!/bin/bash
# scripts/optimize-database.sh

set -e

echo "Starting database optimization..."

# Check for unused indexes
echo "Checking for unused indexes..."
psql $DATABASE_URL -c "
SELECT schemaname, tablename, indexname
FROM pg_stat_user_indexes
WHERE idx_scan = 0 AND idx_tup_read = 0
AND indexrelname NOT LIKE '%_pkey'
ORDER BY schemaname, tablename;
" > unused_indexes.log

# Check for missing indexes
echo "Analyzing query patterns for missing indexes..."
psql $DATABASE_URL -c "
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
WHERE calls > 100 AND mean_time > 10
ORDER BY total_time DESC
LIMIT 20;
" > slow_queries.log

# Update table statistics
echo "Updating table statistics..."
psql $DATABASE_URL -c "ANALYZE;"

# Check table bloat
echo "Checking table bloat..."
psql $DATABASE_URL -c "
SELECT 
  schemaname,
  tablename,
  n_dead_tup,
  n_live_tup,
  ROUND(n_dead_tup * 100.0 / (n_live_tup + n_dead_tup), 2) as dead_tuple_percent
FROM pg_stat_user_tables
WHERE n_live_tup > 0
AND n_dead_tup * 100.0 / (n_live_tup + n_dead_tup) > 10
ORDER BY dead_tuple_percent DESC;
" > table_bloat.log

echo "Optimization analysis complete. Check *.log files for results."
```

### Performance Monitoring Automation

#### Continuous Performance Tracking
```typescript
// Performance tracking service
class PerformanceTracker {
  private metrics: PerformanceMetric[] = [];
  private alertThresholds = {
    responseTime: 500,
    throughput: 100,
    errorRate: 0.01
  };

  async recordMetric(operation: string, executionTime: number, success: boolean): Promise<void> {
    const metric: PerformanceMetric = {
      timestamp: new Date(),
      operation,
      executionTime,
      success,
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage()
    };

    this.metrics.push(metric);

    // Keep only last 10000 metrics in memory
    if (this.metrics.length > 10000) {
      this.metrics = this.metrics.slice(-10000);
    }

    // Store in database for long-term analysis
    await this.persistMetric(metric);

    // Check for performance degradation
    await this.checkPerformanceAlerts(operation);
  }

  private async checkPerformanceAlerts(operation: string): Promise<void> {
    const recentMetrics = this.metrics
      .filter(m => m.operation === operation && 
                  m.timestamp > new Date(Date.now() - 5 * 60 * 1000)) // Last 5 minutes
      .slice(-10); // Last 10 operations

    if (recentMetrics.length >= 10) {
      const avgResponseTime = recentMetrics.reduce((sum, m) => sum + m.executionTime, 0) / recentMetrics.length;
      const errorRate = recentMetrics.filter(m => !m.success).length / recentMetrics.length;

      if (avgResponseTime > this.alertThresholds.responseTime) {
        await this.sendAlert('high_response_time', {
          operation,
          avgResponseTime,
          threshold: this.alertThresholds.responseTime
        });
      }

      if (errorRate > this.alertThresholds.errorRate) {
        await this.sendAlert('high_error_rate', {
          operation,
          errorRate,
          threshold: this.alertThresholds.errorRate
        });
      }
    }
  }

  async generatePerformanceReport(): Promise<PerformanceReport> {
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentMetrics = this.metrics.filter(m => m.timestamp > last24Hours);

    const operationStats = this.groupBy(recentMetrics, 'operation');
    const report: PerformanceReport = {
      timeRange: { start: last24Hours, end: new Date() },
      totalRequests: recentMetrics.length,
      operations: {}
    };

    for (const [operation, metrics] of Object.entries(operationStats)) {
      const executionTimes = metrics.map(m => m.executionTime);
      const successRate = metrics.filter(m => m.success).length / metrics.length;

      report.operations[operation] = {
        totalRequests: metrics.length,
        averageResponseTime: this.average(executionTimes),
        medianResponseTime: this.median(executionTimes),
        p95ResponseTime: this.percentile(executionTimes, 95),
        p99ResponseTime: this.percentile(executionTimes, 99),
        successRate,
        requestsPerSecond: metrics.length / (24 * 60 * 60)
      };
    }

    return report;
  }

  private groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
    return array.reduce((groups, item) => {
      const group = item[key] as string;
      groups[group] = groups[group] || [];
      groups[group].push(item);
      return groups;
    }, {} as Record<string, T[]>);
  }

  private average(numbers: number[]): number {
    return numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
  }

  private median(numbers: number[]): number {
    const sorted = numbers.sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 
      ? (sorted[middle - 1] + sorted[middle]) / 2 
      : sorted[middle];
  }

  private percentile(numbers: number[], percentile: number): number {
    const sorted = numbers.sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index];
  }
}
```

---

## Conclusion

This comprehensive database optimization guide provides HomeOps with the foundation for high-performance, scalable data management. Key implementation priorities:

### Immediate Implementation (Phase 1)
1. **Index Strategy**: Implement core performance indexes
2. **Connection Pooling**: Configure PgBouncer and application pools
3. **Basic Caching**: Redis setup with application-level caching
4. **Monitoring**: Basic performance monitoring and health checks

### Medium-term Optimization (Phase 2)
1. **Time-Series Optimization**: Full TimescaleDB configuration
2. **Query Optimization**: Materialized views and query tuning
3. **Advanced Caching**: Multi-level caching with dependency tracking
4. **Performance Testing**: Automated benchmarking and regression detection

### Long-term Scaling (Phase 3)
1. **Read Replicas**: Primary-replica setup with load balancing
2. **Partitioning**: Advanced partitioning for large datasets
3. **Community Scaling**: Optimization for multi-tenant features
4. **AI Integration**: Vector database optimization for embeddings

This optimization strategy ensures HomeOps maintains excellent performance from initial deployment through community scaling, while providing the monitoring and maintenance procedures necessary for long-term stability.

---

**Document Control**
- **Author**: Database Architect Agent
- **Version**: 1.0  
- **Last Updated**: August 24, 2025
- **Next Review**: Post-implementation validation