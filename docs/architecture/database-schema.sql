-- HomeOps Database Schema
-- PostgreSQL 15.x via Supabase
-- Version: 1.0
-- Date: August 24, 2025

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "timescaledb";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Create database schemas for organization
CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS financial;
CREATE SCHEMA IF NOT EXISTS media;
CREATE SCHEMA IF NOT EXISTS smart_home;
CREATE SCHEMA IF NOT EXISTS network;
CREATE SCHEMA IF NOT EXISTS system_optimization;
CREATE SCHEMA IF NOT EXISTS community;
CREATE SCHEMA IF NOT EXISTS analytics;

-- ============================================================================
-- CORE SCHEMA - Central system management
-- ============================================================================

-- Users table for authentication and authorization
CREATE TABLE core.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user', 'guest')),
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true
);

-- Agent configurations and states
CREATE TABLE core.agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    type VARCHAR(50) NOT NULL, -- 'central', 'financial', 'media', 'smart_home', etc.
    config JSONB NOT NULL DEFAULT '{}',
    state JSONB NOT NULL DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error', 'maintenance')),
    version VARCHAR(20) NOT NULL,
    last_heartbeat TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Conversation sessions with the central agent
CREATE TABLE core.conversation_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    title VARCHAR(255),
    context JSONB DEFAULT '{}',
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true
);

-- Individual messages within conversations
CREATE TABLE core.conversation_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES core.conversation_sessions(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- System-wide notifications and alerts
CREATE TABLE core.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES core.users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- 'info', 'warning', 'error', 'success'
    category VARCHAR(50) NOT NULL, -- 'system', 'financial', 'media', etc.
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

-- System-wide configuration settings
CREATE TABLE core.system_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(255) UNIQUE NOT NULL,
    value JSONB NOT NULL,
    category VARCHAR(100) NOT NULL,
    description TEXT,
    is_encrypted BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Task queue for background jobs
CREATE TABLE core.tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
    scheduled_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- FINANCIAL SCHEMA - Financial management and trading
-- ============================================================================

-- Financial institutions and account providers
CREATE TABLE financial.institutions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'bank', 'broker', 'crypto_exchange', 'other'
    api_config JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User financial accounts
CREATE TABLE financial.accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    institution_id UUID REFERENCES financial.institutions(id),
    account_name VARCHAR(255) NOT NULL,
    account_type VARCHAR(50) NOT NULL CHECK (account_type IN ('checking', 'savings', 'credit', 'investment', 'crypto')),
    account_number_hash VARCHAR(255), -- Hashed for security
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    balance DECIMAL(15,2) DEFAULT 0.00,
    available_balance DECIMAL(15,2),
    credit_limit DECIMAL(15,2),
    is_active BOOLEAN DEFAULT true,
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Financial transactions
CREATE TABLE financial.transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES financial.accounts(id) ON DELETE CASCADE,
    external_id VARCHAR(255), -- ID from external system
    transaction_date DATE NOT NULL,
    posted_date DATE,
    amount DECIMAL(15,2) NOT NULL,
    description TEXT NOT NULL,
    merchant_name VARCHAR(255),
    category VARCHAR(100),
    subcategory VARCHAR(100),
    tags TEXT[],
    is_recurring BOOLEAN DEFAULT false,
    pending BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(account_id, external_id)
);

-- Budget categories and limits
CREATE TABLE financial.budgets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    monthly_limit DECIMAL(10,2) NOT NULL,
    yearly_limit DECIMAL(12,2),
    alert_threshold DECIMAL(5,2) DEFAULT 0.8, -- Alert at 80% of limit
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Investment portfolios and positions
CREATE TABLE financial.portfolios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'stocks', 'crypto', 'mixed', etc.
    total_value DECIMAL(15,2) DEFAULT 0.00,
    total_cost_basis DECIMAL(15,2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Individual investment positions
CREATE TABLE financial.positions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    portfolio_id UUID NOT NULL REFERENCES financial.portfolios(id) ON DELETE CASCADE,
    symbol VARCHAR(20) NOT NULL,
    asset_type VARCHAR(50) NOT NULL, -- 'stock', 'crypto', 'etf', 'bond', etc.
    quantity DECIMAL(18,8) NOT NULL,
    average_cost DECIMAL(15,4) NOT NULL,
    current_price DECIMAL(15,4),
    market_value DECIMAL(15,2),
    unrealized_pnl DECIMAL(15,2),
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trading alerts and conditions
CREATE TABLE financial.trading_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    symbol VARCHAR(20) NOT NULL,
    alert_type VARCHAR(50) NOT NULL, -- 'price_above', 'price_below', 'volume_spike', etc.
    condition_value DECIMAL(15,4) NOT NULL,
    current_value DECIMAL(15,4),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'triggered', 'cancelled', 'expired')),
    priority INTEGER DEFAULT 5,
    message TEXT,
    triggered_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- MEDIA SCHEMA - Media library and content management
-- ============================================================================

-- Media libraries (movies, TV shows, music, etc.)
CREATE TABLE media.libraries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('movie', 'tv', 'music', 'audiobook', 'podcast')),
    path VARCHAR(500) NOT NULL,
    server_type VARCHAR(50), -- 'plex', 'jellyfin', 'emby'
    server_config JSONB DEFAULT '{}',
    scan_interval INTEGER DEFAULT 3600, -- seconds
    last_scan TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Individual media items
CREATE TABLE media.items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    library_id UUID NOT NULL REFERENCES media.libraries(id) ON DELETE CASCADE,
    external_id VARCHAR(255), -- TMDB ID, TVDB ID, etc.
    title VARCHAR(500) NOT NULL,
    original_title VARCHAR(500),
    type VARCHAR(50) NOT NULL,
    year INTEGER,
    runtime INTEGER, -- minutes
    genres TEXT[],
    rating DECIMAL(3,1),
    summary TEXT,
    poster_url TEXT,
    backdrop_url TEXT,
    file_path VARCHAR(1000),
    file_size BIGINT,
    quality VARCHAR(50),
    codec VARCHAR(50),
    resolution VARCHAR(20),
    status VARCHAR(50) DEFAULT 'available' CHECK (status IN ('available', 'downloading', 'processing', 'missing', 'corrupt')),
    date_added TIMESTAMPTZ DEFAULT NOW(),
    last_watched TIMESTAMPTZ,
    watch_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- TV show seasons and episodes
CREATE TABLE media.episodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    series_id UUID NOT NULL REFERENCES media.items(id) ON DELETE CASCADE,
    season_number INTEGER NOT NULL,
    episode_number INTEGER NOT NULL,
    title VARCHAR(500) NOT NULL,
    summary TEXT,
    runtime INTEGER,
    air_date DATE,
    rating DECIMAL(3,1),
    file_path VARCHAR(1000),
    file_size BIGINT,
    status VARCHAR(50) DEFAULT 'available',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(series_id, season_number, episode_number)
);

-- Music-specific metadata
CREATE TABLE media.music_metadata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID NOT NULL REFERENCES media.items(id) ON DELETE CASCADE,
    artist VARCHAR(500),
    album VARCHAR(500),
    track_number INTEGER,
    disc_number INTEGER DEFAULT 1,
    bpm INTEGER,
    key VARCHAR(10),
    lyrics TEXT,
    musicbrainz_id UUID,
    spotify_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Download requests and queue
CREATE TABLE media.download_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    request_type VARCHAR(50) NOT NULL,
    title VARCHAR(500) NOT NULL,
    external_id VARCHAR(255),
    quality_preference VARCHAR(50),
    priority INTEGER DEFAULT 5,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'searching', 'downloading', 'completed', 'failed', 'cancelled')),
    progress INTEGER DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
    error_message TEXT,
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

-- User viewing history and preferences
CREATE TABLE media.user_activity (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    item_id UUID REFERENCES media.items(id) ON DELETE CASCADE,
    episode_id UUID REFERENCES media.episodes(id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL, -- 'watch', 'rate', 'favorite', 'playlist_add'
    progress_seconds INTEGER,
    rating INTEGER CHECK (rating BETWEEN 1 AND 10),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- SMART_HOME SCHEMA - Smart home devices and automation
-- ============================================================================

-- Physical rooms in the house
CREATE TABLE smart_home.rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    type VARCHAR(50), -- 'bedroom', 'living_room', 'kitchen', etc.
    floor INTEGER,
    area_sqft INTEGER,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Smart devices and their capabilities
CREATE TABLE smart_home.devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID REFERENCES smart_home.rooms(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    device_type VARCHAR(50) NOT NULL, -- 'light', 'thermostat', 'lock', 'camera', 'speaker', 'sensor'
    brand VARCHAR(100),
    model VARCHAR(100),
    mac_address VARCHAR(17),
    ip_address INET,
    protocol VARCHAR(50), -- 'zigbee', 'zwave', 'wifi', 'bluetooth'
    capabilities TEXT[], -- ['brightness', 'color', 'temperature', etc.]
    current_state JSONB DEFAULT '{}',
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    is_online BOOLEAN DEFAULT true,
    is_controllable BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Device control history
CREATE TABLE smart_home.device_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID NOT NULL REFERENCES smart_home.devices(id) ON DELETE CASCADE,
    user_id UUID REFERENCES core.users(id) ON DELETE SET NULL,
    command VARCHAR(100) NOT NULL,
    parameters JSONB DEFAULT '{}',
    previous_state JSONB,
    new_state JSONB,
    success BOOLEAN NOT NULL,
    error_message TEXT,
    triggered_by VARCHAR(50), -- 'manual', 'automation', 'voice', 'schedule'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Automation scenes and routines
CREATE TABLE smart_home.scenes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES core.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Actions within scenes
CREATE TABLE smart_home.scene_actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scene_id UUID NOT NULL REFERENCES smart_home.scenes(id) ON DELETE CASCADE,
    device_id UUID NOT NULL REFERENCES smart_home.devices(id) ON DELETE CASCADE,
    command VARCHAR(100) NOT NULL,
    parameters JSONB DEFAULT '{}',
    delay_seconds INTEGER DEFAULT 0,
    execution_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Automation rules and triggers
CREATE TABLE smart_home.automations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES core.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    trigger_type VARCHAR(50) NOT NULL, -- 'time', 'device_state', 'location', 'weather'
    trigger_config JSONB NOT NULL,
    conditions JSONB DEFAULT '[]', -- Additional conditions to check
    actions JSONB NOT NULL, -- Actions to perform
    is_active BOOLEAN DEFAULT true,
    last_triggered TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Voice command history
CREATE TABLE smart_home.voice_commands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES core.users(id) ON DELETE SET NULL,
    device_name VARCHAR(100), -- Which Google Home device
    command_text TEXT NOT NULL,
    intent VARCHAR(100),
    confidence DECIMAL(4,3),
    response_text TEXT,
    success BOOLEAN NOT NULL,
    processing_time INTEGER, -- milliseconds
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- NETWORK SCHEMA - Network infrastructure and monitoring
-- ============================================================================

-- Network nodes (PCs, NAS, routers, etc.)
CREATE TABLE network.nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hostname VARCHAR(255) NOT NULL UNIQUE,
    ip_address INET NOT NULL,
    mac_address VARCHAR(17),
    node_type VARCHAR(50) NOT NULL, -- 'pc', 'nas', 'router', 'pi', 'device'
    role VARCHAR(50), -- 'primary', 'backup', 'client'
    os VARCHAR(100),
    cpu_info TEXT,
    memory_gb INTEGER,
    storage_gb INTEGER,
    is_monitored BOOLEAN DEFAULT true,
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Services running on network nodes
CREATE TABLE network.services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    node_id UUID NOT NULL REFERENCES network.nodes(id) ON DELETE CASCADE,
    service_name VARCHAR(100) NOT NULL,
    service_type VARCHAR(50) NOT NULL, -- 'dns', 'web', 'database', 'media', etc.
    port INTEGER,
    protocol VARCHAR(10) DEFAULT 'TCP',
    status VARCHAR(20) DEFAULT 'running' CHECK (status IN ('running', 'stopped', 'error', 'maintenance')),
    health_check_url TEXT,
    last_health_check TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(node_id, service_name, port)
);

-- DNS records and management
CREATE TABLE network.dns_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    zone VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(10) NOT NULL, -- 'A', 'AAAA', 'CNAME', 'MX', etc.
    value TEXT NOT NULL,
    ttl INTEGER DEFAULT 3600,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(zone, name, type)
);

-- Failover configuration and status
CREATE TABLE network.failover_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_type VARCHAR(50) NOT NULL,
    primary_node_id UUID NOT NULL REFERENCES network.nodes(id),
    backup_node_id UUID NOT NULL REFERENCES network.nodes(id),
    check_interval INTEGER DEFAULT 30, -- seconds
    failure_threshold INTEGER DEFAULT 3,
    current_active_node_id UUID NOT NULL REFERENCES network.nodes(id),
    last_failover TIMESTAMPTZ,
    is_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Network performance metrics (TimescaleDB hypertable)
CREATE TABLE network.performance_metrics (
    time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    node_id UUID NOT NULL REFERENCES network.nodes(id) ON DELETE CASCADE,
    metric_type VARCHAR(50) NOT NULL, -- 'ping', 'bandwidth', 'packet_loss'
    value DECIMAL(10,4) NOT NULL,
    unit VARCHAR(20) NOT NULL, -- 'ms', 'mbps', 'percent'
    metadata JSONB DEFAULT '{}'
);

-- Convert to hypertable for time-series optimization
SELECT create_hypertable('network.performance_metrics', 'time');

-- ============================================================================
-- SYSTEM_OPTIMIZATION SCHEMA - PC optimization and maintenance
-- ============================================================================

-- Gaming profiles and optimization settings
CREATE TABLE system_optimization.gaming_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    game_executable VARCHAR(500),
    optimization_settings JSONB NOT NULL DEFAULT '{}',
    performance_targets JSONB DEFAULT '{}', -- FPS, temperature targets
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- System maintenance tasks
CREATE TABLE system_optimization.maintenance_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_name VARCHAR(255) NOT NULL,
    task_type VARCHAR(50) NOT NULL, -- 'cleanup', 'defrag', 'update', 'backup'
    frequency VARCHAR(50) NOT NULL, -- 'daily', 'weekly', 'monthly'
    schedule_cron VARCHAR(100),
    is_enabled BOOLEAN DEFAULT true,
    last_run TIMESTAMPTZ,
    next_run TIMESTAMPTZ,
    run_count INTEGER DEFAULT 0,
    average_duration INTEGER, -- seconds
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- System performance metrics (TimescaleDB hypertable)
CREATE TABLE system_optimization.performance_metrics (
    time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    node_id UUID NOT NULL REFERENCES network.nodes(id) ON DELETE CASCADE,
    cpu_usage DECIMAL(5,2),
    memory_usage DECIMAL(5,2),
    disk_usage DECIMAL(5,2),
    gpu_usage DECIMAL(5,2),
    gpu_memory_usage DECIMAL(5,2),
    cpu_temperature DECIMAL(5,2),
    gpu_temperature DECIMAL(5,2),
    network_rx_mbps DECIMAL(10,2),
    network_tx_mbps DECIMAL(10,2),
    power_consumption DECIMAL(8,2) -- watts
);

-- Convert to hypertable
SELECT create_hypertable('system_optimization.performance_metrics', 'time');

-- Gaming session tracking
CREATE TABLE system_optimization.gaming_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES system_optimization.gaming_profiles(id),
    game_name VARCHAR(255) NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    duration_minutes INTEGER,
    avg_fps DECIMAL(6,2),
    min_fps DECIMAL(6,2),
    max_fps DECIMAL(6,2),
    avg_cpu_temp DECIMAL(5,2),
    max_cpu_temp DECIMAL(5,2),
    avg_gpu_temp DECIMAL(5,2),
    max_gpu_temp DECIMAL(5,2),
    optimizations_applied JSONB DEFAULT '{}',
    performance_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- COMMUNITY SCHEMA - Community sharing and marketplace
-- ============================================================================

-- Community users (different from core.users for public features)
CREATE TABLE community.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    username VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    bio TEXT,
    avatar_url TEXT,
    reputation_score INTEGER DEFAULT 0,
    total_downloads INTEGER DEFAULT 0,
    total_revenue DECIMAL(10,2) DEFAULT 0.00,
    is_verified BOOLEAN DEFAULT false,
    is_public BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shared configurations and templates
CREATE TABLE community.configurations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES community.profiles(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(100) NOT NULL, -- 'financial', 'media', 'smart_home', 'complete_setup'
    config_data JSONB NOT NULL,
    version VARCHAR(20) NOT NULL DEFAULT '1.0.0',
    price DECIMAL(8,2) DEFAULT 0.00,
    downloads INTEGER DEFAULT 0,
    rating DECIMAL(3,2) DEFAULT 0.00,
    rating_count INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    featured BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Configuration ratings and reviews
CREATE TABLE community.reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    configuration_id UUID NOT NULL REFERENCES community.configurations(id) ON DELETE CASCADE,
    reviewer_id UUID NOT NULL REFERENCES community.profiles(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    title VARCHAR(255),
    comment TEXT,
    is_verified_purchase BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(configuration_id, reviewer_id)
);

-- Configuration downloads and purchases
CREATE TABLE community.downloads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    configuration_id UUID NOT NULL REFERENCES community.configurations(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES community.profiles(id) ON DELETE CASCADE,
    price_paid DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    payment_status VARCHAR(20) DEFAULT 'completed',
    download_count INTEGER DEFAULT 0,
    last_downloaded TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trading signals and strategies marketplace
CREATE TABLE community.trading_signals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES community.profiles(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    strategy_type VARCHAR(100) NOT NULL,
    subscription_price DECIMAL(8,2) NOT NULL,
    performance_metrics JSONB DEFAULT '{}',
    subscriber_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- ANALYTICS SCHEMA - System analytics and reporting
-- ============================================================================

-- Event tracking for system usage
CREATE TABLE analytics.events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES core.users(id) ON DELETE SET NULL,
    session_id VARCHAR(255),
    event_type VARCHAR(100) NOT NULL,
    event_category VARCHAR(100) NOT NULL,
    event_data JSONB DEFAULT '{}',
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,
    referrer TEXT
);

-- Convert to hypertable for time-series optimization
SELECT create_hypertable('analytics.events', 'timestamp');

-- System health snapshots
CREATE TABLE analytics.system_health (
    time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    overall_health_score INTEGER CHECK (overall_health_score BETWEEN 0 AND 100),
    active_services INTEGER,
    failed_services INTEGER,
    avg_response_time DECIMAL(8,2),
    error_rate DECIMAL(5,4),
    memory_usage_percent DECIMAL(5,2),
    disk_usage_percent DECIMAL(5,2),
    network_latency DECIMAL(8,2),
    backup_status VARCHAR(20),
    security_alerts INTEGER DEFAULT 0
);

-- Convert to hypertable
SELECT create_hypertable('analytics.system_health', 'time');

-- ============================================================================
-- INDEXES FOR PERFORMANCE OPTIMIZATION
-- ============================================================================

-- Core schema indexes
CREATE INDEX idx_users_email ON core.users(email);
CREATE INDEX idx_users_active ON core.users(is_active);
CREATE INDEX idx_agents_type_status ON core.agents(type, status);
CREATE INDEX idx_conversation_messages_session ON core.conversation_messages(session_id);
CREATE INDEX idx_notifications_user_unread ON core.notifications(user_id, is_read);
CREATE INDEX idx_tasks_status_priority ON core.tasks(status, priority);

-- Financial schema indexes
CREATE INDEX idx_accounts_user_active ON financial.accounts(user_id, is_active);
CREATE INDEX idx_transactions_account_date ON financial.transactions(account_id, transaction_date);
CREATE INDEX idx_transactions_category ON financial.transactions(category);
CREATE INDEX idx_positions_portfolio ON financial.positions(portfolio_id);
CREATE INDEX idx_trading_alerts_user_status ON financial.trading_alerts(user_id, status);

-- Media schema indexes
CREATE INDEX idx_media_items_library_type ON media.items(library_id, type);
CREATE INDEX idx_media_items_status ON media.items(status);
CREATE INDEX idx_episodes_series ON media.episodes(series_id, season_number, episode_number);
CREATE INDEX idx_download_requests_status ON media.download_requests(status);

-- Smart home schema indexes
CREATE INDEX idx_devices_room ON smart_home.devices(room_id);
CREATE INDEX idx_devices_type_online ON smart_home.devices(device_type, is_online);
CREATE INDEX idx_device_history_device_time ON smart_home.device_history(device_id, created_at);
CREATE INDEX idx_scene_actions_scene ON smart_home.scene_actions(scene_id);

-- Network schema indexes
CREATE INDEX idx_nodes_type ON network.nodes(node_type);
CREATE INDEX idx_services_node_status ON network.services(node_id, status);
CREATE INDEX idx_dns_records_zone_active ON network.dns_records(zone, is_active);

-- Community schema indexes
CREATE INDEX idx_configurations_category_status ON community.configurations(category, status);
CREATE INDEX idx_configurations_featured ON community.configurations(featured);
CREATE INDEX idx_reviews_configuration ON community.reviews(configuration_id);

-- ============================================================================
-- SECURITY CONFIGURATIONS
-- ============================================================================

-- Row Level Security (RLS) policies would be defined here
-- Note: Specific RLS policies should be implemented based on Supabase best practices

-- Enable RLS on sensitive tables
ALTER TABLE core.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE smart_home.devices ENABLE ROW LEVEL SECURITY;

-- Create roles for different access levels
-- These would be implemented in the application layer with Supabase auth

-- ============================================================================
-- INITIAL DATA AND CONFIGURATIONS
-- ============================================================================

-- Insert default system configuration
INSERT INTO core.system_config (key, value, category, description) VALUES
('system.version', '"1.0.0"', 'core', 'HomeOps system version'),
('ai.default_model', '"gpt-4"', 'ai', 'Default AI model for central agent'),
('ai.fallback_models', '["claude-3-sonnet", "gemini-pro"]', 'ai', 'Fallback AI models'),
('network.dns_failover_enabled', 'true', 'network', 'Enable automatic DNS failover'),
('media.auto_download', 'true', 'media', 'Enable automatic media downloads'),
('smart_home.voice_enabled', 'true', 'smart_home', 'Enable voice commands'),
('optimization.gaming_mode', 'true', 'optimization', 'Enable gaming optimization'),
('notifications.email_enabled', 'true', 'notifications', 'Enable email notifications'),
('security.encryption_enabled', 'true', 'security', 'Enable data encryption'),
('backup.enabled', 'true', 'backup', 'Enable automatic backups');

-- Insert default maintenance tasks
INSERT INTO system_optimization.maintenance_tasks (task_name, task_type, frequency, schedule_cron) VALUES
('System Cleanup', 'cleanup', 'daily', '0 2 * * *'),
('Disk Defragmentation', 'defrag', 'weekly', '0 3 * * 0'),
('Software Updates', 'update', 'weekly', '0 4 * * 1'),
('Full System Backup', 'backup', 'daily', '0 1 * * *'),
('Database Maintenance', 'cleanup', 'weekly', '0 5 * * 2');

-- Insert default rooms for smart home
INSERT INTO smart_home.rooms (name, type, floor) VALUES
('Living Room', 'living_room', 1),
('Kitchen', 'kitchen', 1),
('Master Bedroom', 'bedroom', 2),
('Office', 'office', 1),
('Garage', 'garage', 1);

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- System health overview
CREATE VIEW analytics.system_health_current AS
SELECT 
    sh.*,
    (SELECT COUNT(*) FROM network.services WHERE status = 'running') as running_services,
    (SELECT COUNT(*) FROM network.services WHERE status = 'error') as error_services
FROM analytics.system_health sh
WHERE sh.time >= NOW() - INTERVAL '5 minutes'
ORDER BY sh.time DESC
LIMIT 1;

-- User portfolio summary
CREATE VIEW financial.portfolio_summary AS
SELECT 
    p.id,
    p.user_id,
    p.name,
    p.total_value,
    p.total_cost_basis,
    (p.total_value - p.total_cost_basis) as unrealized_pnl,
    CASE 
        WHEN p.total_cost_basis > 0 THEN 
            ((p.total_value - p.total_cost_basis) / p.total_cost_basis) * 100 
        ELSE 0 
    END as return_percentage,
    COUNT(pos.id) as position_count
FROM financial.portfolios p
LEFT JOIN financial.positions pos ON p.id = pos.portfolio_id
GROUP BY p.id, p.user_id, p.name, p.total_value, p.total_cost_basis;

-- Active smart home devices by room
CREATE VIEW smart_home.devices_by_room AS
SELECT 
    r.name as room_name,
    r.type as room_type,
    COUNT(d.id) as total_devices,
    COUNT(CASE WHEN d.is_online THEN 1 END) as online_devices,
    COUNT(CASE WHEN NOT d.is_online THEN 1 END) as offline_devices
FROM smart_home.rooms r
LEFT JOIN smart_home.devices d ON r.id = d.room_id
GROUP BY r.id, r.name, r.type;

-- Recent media activity
CREATE VIEW media.recent_activity AS
SELECT 
    i.title,
    i.type,
    ua.activity_type,
    ua.created_at,
    u.full_name as user_name
FROM media.user_activity ua
JOIN core.users u ON ua.user_id = u.id
LEFT JOIN media.items i ON ua.item_id = i.id
ORDER BY ua.created_at DESC
LIMIT 50;

COMMENT ON SCHEMA core IS 'Core system functionality including users, agents, and system configuration';
COMMENT ON SCHEMA financial IS 'Financial management, accounts, transactions, and trading';
COMMENT ON SCHEMA media IS 'Media library management, downloads, and user activity';
COMMENT ON SCHEMA smart_home IS 'Smart home devices, automation, and voice commands';
COMMENT ON SCHEMA network IS 'Network infrastructure, monitoring, and failover management';
COMMENT ON SCHEMA system_optimization IS 'PC optimization, gaming profiles, and maintenance';
COMMENT ON SCHEMA community IS 'Community features, configuration sharing, and marketplace';
COMMENT ON SCHEMA analytics IS 'System analytics, event tracking, and performance metrics';