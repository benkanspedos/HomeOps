# HomeOps Database Migration Strategy
**Version 1.0** | **Date: August 24, 2025**

---

## Overview

The HomeOps migration strategy provides a comprehensive approach to database schema deployment, version control, and evolution. This strategy ensures zero-downtime deployments, data integrity, and the ability to safely rollback changes when needed.

### Key Principles

1. **Zero-Downtime Migrations**: All production deployments maintain service availability
2. **Version Control**: Every schema change is tracked and documented
3. **Rollback Safety**: All migrations include safe rollback procedures
4. **Data Integrity**: Comprehensive validation before and after migrations
5. **Environment Parity**: Consistent deployment across development, staging, and production

---

## Migration Framework Architecture

### Migration File Structure

```
migrations/
├── schema/
│   ├── 001_initial_schema.sql
│   ├── 002_add_financial_tables.sql
│   ├── 003_add_media_tables.sql
│   └── ...
├── data/
│   ├── 001_seed_system_config.sql
│   ├── 002_default_rooms.sql
│   └── ...
├── indexes/
│   ├── 001_core_indexes.sql
│   ├── 002_financial_indexes.sql
│   └── ...
├── procedures/
│   ├── 001_migration_helpers.sql
│   ├── 002_data_validation.sql
│   └── ...
└── rollbacks/
    ├── 001_rollback_initial.sql
    ├── 002_rollback_financial.sql
    └── ...
```

### Migration Metadata Schema

```sql
-- Migration tracking schema
CREATE SCHEMA IF NOT EXISTS migrations;

-- Migration history table
CREATE TABLE migrations.schema_versions (
    id SERIAL PRIMARY KEY,
    version VARCHAR(50) NOT NULL UNIQUE,
    description TEXT NOT NULL,
    migration_file VARCHAR(255) NOT NULL,
    rollback_file VARCHAR(255),
    applied_at TIMESTAMPTZ DEFAULT NOW(),
    applied_by VARCHAR(255) DEFAULT current_user,
    execution_time_ms INTEGER,
    checksum VARCHAR(64),
    status VARCHAR(20) DEFAULT 'applied' CHECK (status IN ('applied', 'rolled_back', 'failed'))
);

-- Migration locks to prevent concurrent migrations
CREATE TABLE migrations.migration_locks (
    id INTEGER PRIMARY KEY DEFAULT 1,
    locked_by VARCHAR(255),
    locked_at TIMESTAMPTZ,
    lock_reason TEXT,
    CONSTRAINT only_one_lock CHECK (id = 1)
);
```

---

## Initial Schema Deployment

### Phase 1: Infrastructure Setup

#### 1.1 Supabase Project Initialization
```bash
# Create new Supabase project
supabase projects create homeops-production

# Initialize local development
supabase init
supabase start

# Link to remote project
supabase link --project-ref [project-id]
```

#### 1.2 Extension Installation
```sql
-- Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "timescaledb";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
```

#### 1.3 Schema Creation
```bash
# Apply initial schema
supabase db reset
supabase db push

# Or manually apply
psql -f migrations/schema/001_initial_schema.sql
```

### Phase 2: Data Seeding

#### 2.1 System Configuration Seeding
```sql
-- migrations/data/001_seed_system_config.sql
INSERT INTO core.system_config (key, value, category, description) VALUES
('system.version', '"1.0.0"', 'core', 'HomeOps system version'),
('ai.default_model', '"gpt-4"', 'ai', 'Default AI model'),
-- ... additional config values
ON CONFLICT (key) DO NOTHING;
```

#### 2.2 Reference Data Population
```sql
-- migrations/data/002_reference_data.sql
INSERT INTO smart_home.rooms (name, type, floor) VALUES
('Living Room', 'living_room', 1),
('Kitchen', 'kitchen', 1),
-- ... additional rooms
ON CONFLICT (name) DO NOTHING;
```

### Phase 3: Index Creation

#### 3.1 Performance Indexes
```bash
# Apply indexing strategy
psql -f migrations/indexes/001_performance_indexes.sql
```

#### 3.2 Index Validation
```sql
-- Verify index creation
SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes 
WHERE schemaname NOT IN ('information_schema', 'pg_catalog')
ORDER BY schemaname, tablename;
```

---

## Schema Version Control

### Version Numbering Convention

#### Semantic Versioning for Schemas
- **MAJOR.MINOR.PATCH** (e.g., 1.2.3)
- **MAJOR**: Breaking changes requiring application updates
- **MINOR**: New features, tables, or columns (backward compatible)
- **PATCH**: Bug fixes, index changes, data corrections

#### Migration File Naming
```
[sequence]_[version]_[description].sql

Examples:
001_v1.0.0_initial_schema.sql
002_v1.1.0_add_trading_alerts.sql  
003_v1.1.1_fix_user_preferences.sql
```

### Git Integration

#### Migration Workflow
```bash
# Create new migration branch
git checkout -b migration/add-trading-alerts

# Create migration files
touch migrations/schema/002_v1.1.0_add_trading_alerts.sql
touch migrations/rollbacks/002_v1.1.0_rollback_trading_alerts.sql

# Test migration locally
supabase db reset
supabase db push

# Commit changes
git add migrations/
git commit -m "Add trading alerts schema migration v1.1.0"

# Create pull request
git push origin migration/add-trading-alerts
```

#### Pre-commit Hooks
```yaml
# .pre-commit-config.yaml
repos:
  - repo: local
    hooks:
      - id: validate-sql-syntax
        name: Validate SQL syntax
        entry: pg_prove --ext .sql
        language: system
        files: ^migrations/.*\.sql$
      
      - id: check-migration-rollback
        name: Check rollback exists
        entry: scripts/check-rollback-exists.sh
        language: script
        files: ^migrations/schema/.*\.sql$
```

### Migration Validation

#### Pre-Migration Checks
```sql
-- Check for schema conflicts
SELECT table_name, column_name 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND column_name IN ('new_column_name');

-- Validate data integrity before migration
SELECT 
    COUNT(*) as total_records,
    COUNT(DISTINCT user_id) as unique_users,
    MAX(created_at) as latest_record
FROM core.users;
```

#### Post-Migration Validation
```sql
-- Verify migration success
SELECT version, applied_at, status 
FROM migrations.schema_versions 
ORDER BY applied_at DESC 
LIMIT 5;

-- Check data consistency
SELECT table_name, 
       pg_size_pretty(pg_total_relation_size(table_name::regclass)) as size
FROM information_schema.tables 
WHERE table_schema NOT IN ('information_schema', 'pg_catalog');
```

---

## Zero-Downtime Migration Techniques

### Additive Changes (Safe)

#### Adding New Tables
```sql
-- Safe - new tables don't affect existing queries
CREATE TABLE financial.new_feature (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES core.users(id),
    data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Adding New Columns
```sql
-- Safe - add with default value
ALTER TABLE core.users 
ADD COLUMN new_preference JSONB DEFAULT '{}';

-- Safe - nullable column
ALTER TABLE financial.accounts 
ADD COLUMN external_metadata TEXT;
```

#### Adding Indexes
```sql
-- Safe - create concurrently
CREATE INDEX CONCURRENTLY idx_new_feature 
ON financial.accounts (user_id, account_type);
```

### Complex Changes (Require Careful Planning)

#### Column Type Changes
```sql
-- Step 1: Add new column
ALTER TABLE financial.transactions 
ADD COLUMN amount_decimal DECIMAL(15,2);

-- Step 2: Migrate data in batches
DO $$
DECLARE
    batch_size INTEGER := 10000;
    offset_val INTEGER := 0;
    rows_affected INTEGER;
BEGIN
    LOOP
        UPDATE financial.transactions 
        SET amount_decimal = amount::DECIMAL(15,2)
        WHERE id IN (
            SELECT id FROM financial.transactions 
            WHERE amount_decimal IS NULL
            LIMIT batch_size
        );
        
        GET DIAGNOSTICS rows_affected = ROW_COUNT;
        EXIT WHEN rows_affected = 0;
        
        offset_val := offset_val + batch_size;
        RAISE NOTICE 'Processed % rows', offset_val;
        
        -- Commit batch and allow other operations
        COMMIT;
        PERFORM pg_sleep(0.1); -- Brief pause
    END LOOP;
END $$;

-- Step 3: Add constraints
ALTER TABLE financial.transactions 
ADD CONSTRAINT check_amount_decimal_not_null 
CHECK (amount_decimal IS NOT NULL) NOT VALID;

-- Step 4: Validate constraint
ALTER TABLE financial.transactions 
VALIDATE CONSTRAINT check_amount_decimal_not_null;

-- Step 5: Drop old column (after application update)
-- ALTER TABLE financial.transactions DROP COLUMN amount;
-- ALTER TABLE financial.transactions RENAME COLUMN amount_decimal TO amount;
```

#### Table Restructuring
```sql
-- Create new table structure
CREATE TABLE financial.transactions_new (
    LIKE financial.transactions INCLUDING ALL
);

-- Add improvements to new table
ALTER TABLE financial.transactions_new 
ADD COLUMN merchant_category VARCHAR(100);

-- Migrate data in batches
INSERT INTO financial.transactions_new 
SELECT *, NULL as merchant_category 
FROM financial.transactions 
WHERE id BETWEEN $1 AND $2;

-- Switch tables atomically (when ready)
BEGIN;
    ALTER TABLE financial.transactions RENAME TO transactions_old;
    ALTER TABLE financial.transactions_new RENAME TO transactions;
    -- Update foreign key references if needed
COMMIT;
```

---

## Rollback Procedures

### Automatic Rollback Detection

#### Rollback Triggers
```sql
-- Create rollback trigger function
CREATE OR REPLACE FUNCTION migrations.check_migration_health()
RETURNS TRIGGER AS $$
BEGIN
    -- Check for critical errors
    IF EXISTS (
        SELECT 1 FROM pg_stat_database 
        WHERE datname = current_database() 
        AND xact_rollback > (xact_commit * 0.1) -- >10% rollback rate
    ) THEN
        RAISE EXCEPTION 'High rollback rate detected, migration may be problematic';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Rollback Strategy Framework

#### 1. Rollback Decision Matrix
```
Change Type          | Rollback Complexity | Auto-Rollback Safe?
---------------------|--------------------|--------------------|
Add Table            | Low                | Yes                |
Add Column           | Low                | Yes (if nullable)  |
Add Index            | Low                | Yes                |
Modify Column        | High               | No                 |
Drop Column          | Very High          | No                 |
Drop Table           | Very High          | No                 |
Data Migration       | High               | Depends on change  |
```

#### 2. Rollback Procedures by Type

##### Safe Rollbacks (Automated)
```sql
-- migrations/rollbacks/002_rollback_add_preferences.sql
-- Rollback: Add user preferences column
ALTER TABLE core.users DROP COLUMN IF EXISTS preferences;
DROP INDEX IF EXISTS idx_users_preferences_gin;

-- Update migration status
UPDATE migrations.schema_versions 
SET status = 'rolled_back' 
WHERE version = 'v1.1.0';
```

##### Complex Rollbacks (Manual)
```sql
-- migrations/rollbacks/005_rollback_transaction_restructure.sql
-- Rollback: Transaction table restructuring

-- Step 1: Verify old table exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables 
                   WHERE table_name = 'transactions_old') THEN
        RAISE EXCEPTION 'Cannot rollback: backup table not found';
    END IF;
END $$;

-- Step 2: Restore from backup
BEGIN;
    DROP TABLE IF EXISTS financial.transactions CASCADE;
    ALTER TABLE financial.transactions_old RENAME TO transactions;
    
    -- Recreate foreign key constraints
    ALTER TABLE financial.transactions 
    ADD CONSTRAINT fk_transactions_account 
    FOREIGN KEY (account_id) REFERENCES financial.accounts(id);
    
    -- Recreate indexes
    CREATE INDEX idx_transactions_account_date 
    ON financial.transactions (account_id, transaction_date DESC);
COMMIT;
```

### Emergency Rollback Procedures

#### Database Backup Restoration
```bash
# Create point-in-time backup before migration
pg_dump homeops_production > backup_pre_migration_$(date +%Y%m%d_%H%M%S).sql

# Emergency restoration (if needed)
dropdb homeops_production_temp
createdb homeops_production_temp
psql homeops_production_temp < backup_pre_migration_20250824_143000.sql

# Verify backup integrity
psql homeops_production_temp -c "SELECT COUNT(*) FROM core.users;"
```

#### Supabase Point-in-Time Recovery
```bash
# Request point-in-time recovery via Supabase CLI
supabase recovery create \
  --project-ref [project-id] \
  --recovery-time "2025-08-24 14:30:00+00"
```

---

## Data Seeding Strategy

### Environment-Specific Seeding

#### Development Environment
```sql
-- migrations/data/dev_seed.sql
-- Development test data
INSERT INTO core.users (email, password_hash, full_name, role) VALUES
('admin@homeops.local', crypt('admin123', gen_salt('bf')), 'Admin User', 'admin'),
('user@homeops.local', crypt('user123', gen_salt('bf')), 'Test User', 'user');

-- Test financial accounts
INSERT INTO financial.institutions (name, type) VALUES
('Test Bank', 'bank'),
('Test Broker', 'broker');
```

#### Production Environment
```sql
-- migrations/data/prod_seed.sql
-- Production-safe reference data only
INSERT INTO smart_home.rooms (name, type, floor) VALUES
('Living Room', 'living_room', 1),
('Kitchen', 'kitchen', 1);

-- System configuration
INSERT INTO core.system_config (key, value, category) VALUES
('system.environment', '"production"', 'core'),
('security.encryption_enabled', 'true', 'security');
```

### Seeding Execution Strategy

#### Conditional Seeding
```sql
-- Only seed if data doesn't exist
INSERT INTO financial.institutions (name, type, api_config)
SELECT 'Plaid', 'aggregator', '{"environment": "production"}'::jsonb
WHERE NOT EXISTS (
    SELECT 1 FROM financial.institutions 
    WHERE name = 'Plaid' AND type = 'aggregator'
);
```

#### Batch Processing for Large Datasets
```sql
-- Process in smaller batches to avoid locks
DO $$
DECLARE
    batch_size INTEGER := 1000;
    total_processed INTEGER := 0;
BEGIN
    LOOP
        WITH batch AS (
            INSERT INTO media.items (title, type, library_id)
            SELECT title, type, library_id
            FROM temp_media_import
            LIMIT batch_size
            RETURNING id
        )
        SELECT COUNT(*) FROM batch INTO total_processed;
        
        EXIT WHEN total_processed = 0;
        
        RAISE NOTICE 'Processed batch of % records', total_processed;
        COMMIT;
    END LOOP;
END $$;
```

---

## Environment Management

### Development Environment

#### Local Setup
```bash
# Start local Supabase stack
supabase start

# Apply migrations
supabase db reset
supabase db push

# Seed with development data
psql postgresql://postgres:postgres@localhost:54322/postgres \
  -f migrations/data/dev_seed.sql
```

#### Docker Development
```yaml
# docker-compose.dev.yml
version: '3.8'
services:
  postgres:
    image: supabase/postgres:15.1.0.68
    environment:
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: homeops_dev
    volumes:
      - ./migrations:/docker-entrypoint-initdb.d/
      - postgres_dev_data:/var/lib/postgresql/data
    ports:
      - "54322:5432"
```

### Staging Environment

#### Staging Deployment Pipeline
```yaml
# .github/workflows/deploy-staging.yml
name: Deploy to Staging
on:
  push:
    branches: [develop]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Supabase CLI
        run: npm install -g supabase
        
      - name: Link to staging project
        run: supabase link --project-ref ${{ secrets.STAGING_PROJECT_REF }}
        
      - name: Run migrations
        run: supabase db push --include-seed
        
      - name: Validate deployment
        run: |
          psql ${{ secrets.STAGING_DB_URL }} \
            -c "SELECT version FROM migrations.schema_versions ORDER BY applied_at DESC LIMIT 1;"
```

### Production Environment

#### Production Deployment Checklist
```markdown
## Pre-Deployment Checklist
- [ ] Migration tested in staging environment
- [ ] Database backup created
- [ ] Rollback procedure documented
- [ ] Performance impact assessed
- [ ] Team notified of maintenance window
- [ ] Monitoring alerts configured

## Deployment Steps
1. Create pre-migration backup
2. Apply migration with validation
3. Verify data integrity
4. Update application configuration
5. Monitor system health
6. Confirm successful deployment

## Post-Deployment Verification
- [ ] Application functionality verified
- [ ] Database performance within normal range
- [ ] No error rate increase
- [ ] All services responding normally
```

#### Production Migration Execution
```bash
#!/bin/bash
# scripts/production-migrate.sh

set -e

echo "Starting production migration..."

# Create backup
echo "Creating backup..."
pg_dump $PROD_DATABASE_URL > "backup_$(date +%Y%m%d_%H%M%S).sql"

# Acquire migration lock
psql $PROD_DATABASE_URL -c "
    INSERT INTO migrations.migration_locks (locked_by, locked_at, lock_reason) 
    VALUES ('$(whoami)', NOW(), 'Production migration v$MIGRATION_VERSION');"

# Apply migration
echo "Applying migration..."
psql $PROD_DATABASE_URL -f "migrations/schema/$MIGRATION_FILE"

# Validate migration
echo "Validating migration..."
psql $PROD_DATABASE_URL -f "scripts/validate-migration.sql"

# Release lock
psql $PROD_DATABASE_URL -c "DELETE FROM migrations.migration_locks;"

echo "Migration completed successfully!"
```

---

## Schema Evolution Plan

### Version 1.x Roadmap

#### v1.1.0 - Enhanced Financial Features
- Add trading alerts table
- Implement portfolio performance tracking
- Add cryptocurrency position support

#### v1.2.0 - Advanced Media Features
- Add recommendation engine tables
- Implement viewing history analytics
- Add music mood and genre analysis

#### v1.3.0 - Smart Home Expansion
- Add energy monitoring tables
- Implement automation learning tables
- Add device maintenance tracking

### Long-term Evolution Strategy

#### v2.0.0 - Community Platform
- Add marketplace tables
- Implement revenue sharing system
- Add user-generated content support

#### v3.0.0 - AI Enhancement
- Add vector similarity tables
- Implement conversation embeddings
- Add predictive analytics tables

---

## Monitoring and Maintenance

### Migration Monitoring

#### Key Metrics to Track
```sql
-- Migration execution time tracking
SELECT 
    version,
    execution_time_ms,
    applied_at
FROM migrations.schema_versions 
ORDER BY applied_at DESC;

-- Database size growth
SELECT 
    schemaname,
    pg_size_pretty(SUM(pg_total_relation_size(schemaname||'.'||tablename))) as size
FROM pg_tables 
WHERE schemaname NOT IN ('information_schema', 'pg_catalog')
GROUP BY schemaname;
```

#### Automated Health Checks
```sql
-- Check for failed migrations
SELECT * FROM migrations.schema_versions 
WHERE status = 'failed';

-- Monitor constraint violations
SELECT conname, conrelid::regclass 
FROM pg_constraint 
WHERE NOT convalidated;

-- Check for missing foreign key indexes
SELECT 
    t.table_name,
    kcu.column_name
FROM information_schema.table_constraints t
JOIN information_schema.key_column_usage kcu
ON t.constraint_name = kcu.constraint_name
WHERE t.constraint_type = 'FOREIGN KEY'
AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = t.table_name
    AND indexdef LIKE '%' || kcu.column_name || '%'
);
```

### Maintenance Procedures

#### Weekly Maintenance
```bash
# Update table statistics
psql $DATABASE_URL -c "ANALYZE;"

# Check for index bloat
psql $DATABASE_URL -f scripts/check-index-bloat.sql

# Validate backup integrity
pg_dump $DATABASE_URL | psql $TEST_DATABASE_URL
```

#### Monthly Maintenance
```bash
# Full database maintenance
psql $DATABASE_URL -c "VACUUM ANALYZE;"

# Update extensions
psql $DATABASE_URL -c "ALTER EXTENSION timescaledb UPDATE;"

# Review migration performance
psql $DATABASE_URL -f scripts/migration-performance-report.sql
```

---

## Troubleshooting Guide

### Common Migration Issues

#### 1. Lock Timeout During Migration
```sql
-- Check for long-running transactions
SELECT 
    pid,
    now() - pg_stat_activity.query_start AS duration,
    query 
FROM pg_stat_activity 
WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes';

-- Terminate blocking queries (if safe)
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE pid = 12345;
```

#### 2. Constraint Violation During Data Migration
```sql
-- Identify problematic records
SELECT * FROM financial.transactions 
WHERE account_id NOT IN (SELECT id FROM financial.accounts);

-- Fix data before applying constraint
DELETE FROM financial.transactions 
WHERE account_id NOT IN (SELECT id FROM financial.accounts);
```

#### 3. Out of Disk Space During Migration
```bash
# Check disk usage
df -h

# Vacuum old data
psql $DATABASE_URL -c "VACUUM FULL pg_stat_statements;"

# Clean up old WAL files
pg_archivecleanup /var/lib/postgresql/data/pg_wal 000000010000000000000020
```

### Recovery Procedures

#### Partial Migration Failure
```sql
-- Check migration status
SELECT * FROM migrations.schema_versions 
WHERE version = 'v1.2.0';

-- Manual cleanup if needed
DROP TABLE IF EXISTS temp_migration_table;
DELETE FROM migrations.schema_versions 
WHERE version = 'v1.2.0' AND status = 'failed';

-- Retry migration
\i migrations/schema/005_v1.2.0_retry.sql
```

#### Complete Rollback Required
```bash
# Restore from backup
dropdb homeops_production
createdb homeops_production
psql homeops_production < backup_20250824_143000.sql

# Verify restoration
psql homeops_production -c "SELECT COUNT(*) FROM core.users;"

# Update migration status
psql homeops_production -c "
    DELETE FROM migrations.schema_versions 
    WHERE applied_at > '2025-08-24 14:30:00';"
```

---

## Conclusion

This migration strategy provides a robust framework for managing HomeOps database evolution throughout its lifecycle. Key benefits include:

1. **Reliability**: Comprehensive testing and validation procedures
2. **Safety**: Always-available rollback procedures
3. **Scalability**: Zero-downtime migration techniques
4. **Maintainability**: Clear documentation and monitoring
5. **Flexibility**: Support for various migration types and scenarios

The strategy balances safety with agility, enabling rapid development while maintaining production stability. Regular review and updates of these procedures ensure they remain effective as the system evolves.

---

**Document Control**
- **Author**: Database Architect Agent  
- **Version**: 1.0
- **Last Updated**: August 24, 2025
- **Next Review**: Post-implementation validation