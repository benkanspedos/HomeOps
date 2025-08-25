-- HomeOps Indexing Strategy
-- PostgreSQL 15.x via Supabase
-- Version: 1.0
-- Date: August 24, 2025

-- ============================================================================
-- CORE SCHEMA INDEXES
-- ============================================================================

-- Users table - Authentication and user lookups
CREATE UNIQUE INDEX idx_users_email_lower ON core.users (LOWER(email));
CREATE INDEX idx_users_active_role ON core.users (is_active, role) WHERE is_active = true;
CREATE INDEX idx_users_last_login ON core.users (last_login_at DESC);
CREATE INDEX idx_users_created_at ON core.users (created_at DESC);
CREATE INDEX idx_users_preferences_gin ON core.users USING gin (preferences);

-- Agents table - Agent management and monitoring
CREATE INDEX idx_agents_type_status ON core.agents (type, status);
CREATE INDEX idx_agents_status_heartbeat ON core.agents (status, last_heartbeat DESC);
CREATE INDEX idx_agents_name_version ON core.agents (name, version);
CREATE INDEX idx_agents_config_gin ON core.agents USING gin (config);
CREATE INDEX idx_agents_state_gin ON core.agents USING gin (state);

-- Conversation sessions - Session management
CREATE INDEX idx_conv_sessions_user_active ON core.conversation_sessions (user_id, is_active);
CREATE INDEX idx_conv_sessions_started_at ON core.conversation_sessions (started_at DESC);
CREATE INDEX idx_conv_sessions_title_search ON core.conversation_sessions USING gin (to_tsvector('english', title));

-- Conversation messages - Message retrieval and search
CREATE INDEX idx_conv_messages_session_created ON core.conversation_messages (session_id, created_at DESC);
CREATE INDEX idx_conv_messages_role_session ON core.conversation_messages (role, session_id);
CREATE INDEX idx_conv_messages_content_search ON core.conversation_messages USING gin (to_tsvector('english', content));
CREATE INDEX idx_conv_messages_metadata_gin ON core.conversation_messages USING gin (metadata);

-- Notifications - User notifications and alerts
CREATE INDEX idx_notifications_user_unread ON core.notifications (user_id, is_read, created_at DESC) WHERE is_read = false;
CREATE INDEX idx_notifications_category_type ON core.notifications (category, type);
CREATE INDEX idx_notifications_priority_created ON core.notifications (priority DESC, created_at DESC);
CREATE INDEX idx_notifications_expires_at ON core.notifications (expires_at) WHERE expires_at IS NOT NULL;

-- System configuration - Configuration lookups
CREATE UNIQUE INDEX idx_system_config_key_lower ON core.system_config (LOWER(key));
CREATE INDEX idx_system_config_category ON core.system_config (category);
CREATE INDEX idx_system_config_encrypted ON core.system_config (is_encrypted);

-- Tasks - Background job processing
CREATE INDEX idx_tasks_status_priority ON core.tasks (status, priority DESC, scheduled_at);
CREATE INDEX idx_tasks_type_status ON core.tasks (type, status);
CREATE INDEX idx_tasks_scheduled_at ON core.tasks (scheduled_at) WHERE status = 'pending';
CREATE INDEX idx_tasks_retry_count ON core.tasks (retry_count) WHERE status = 'failed';

-- ============================================================================
-- FINANCIAL SCHEMA INDEXES
-- ============================================================================

-- Institutions - Financial institution lookups
CREATE INDEX idx_institutions_type_active ON financial.institutions (type, is_active);
CREATE INDEX idx_institutions_name_search ON financial.institutions USING gin (to_tsvector('english', name));

-- Accounts - Financial account management
CREATE INDEX idx_accounts_user_active ON financial.accounts (user_id, is_active);
CREATE INDEX idx_accounts_institution_type ON financial.accounts (institution_id, account_type);
CREATE INDEX idx_accounts_currency ON financial.accounts (currency);
CREATE INDEX idx_accounts_balance ON financial.accounts (balance DESC) WHERE is_active = true;
CREATE INDEX idx_accounts_last_synced ON financial.accounts (last_synced_at);

-- Transactions - Transaction queries and analysis
CREATE INDEX idx_transactions_account_date ON financial.transactions (account_id, transaction_date DESC);
CREATE INDEX idx_transactions_date_amount ON financial.transactions (transaction_date DESC, amount DESC);
CREATE INDEX idx_transactions_category_date ON financial.transactions (category, transaction_date DESC);
CREATE INDEX idx_transactions_merchant ON financial.transactions (merchant_name);
CREATE INDEX idx_transactions_description_search ON financial.transactions USING gin (to_tsvector('english', description));
CREATE INDEX idx_transactions_tags_gin ON financial.transactions USING gin (tags);
CREATE INDEX idx_transactions_external_id ON financial.transactions (account_id, external_id);
CREATE INDEX idx_transactions_pending ON financial.transactions (pending) WHERE pending = true;
CREATE INDEX idx_transactions_recurring ON financial.transactions (is_recurring) WHERE is_recurring = true;

-- Budgets - Budget monitoring
CREATE INDEX idx_budgets_user_active ON financial.budgets (user_id, is_active);
CREATE INDEX idx_budgets_category ON financial.budgets (category);
CREATE INDEX idx_budgets_alert_threshold ON financial.budgets (alert_threshold) WHERE is_active = true;

-- Portfolios - Portfolio management
CREATE INDEX idx_portfolios_user_type ON financial.portfolios (user_id, type);
CREATE INDEX idx_portfolios_total_value ON financial.portfolios (total_value DESC);

-- Positions - Investment position tracking
CREATE INDEX idx_positions_portfolio_symbol ON financial.positions (portfolio_id, symbol);
CREATE INDEX idx_positions_asset_type ON financial.positions (asset_type);
CREATE INDEX idx_positions_market_value ON financial.positions (market_value DESC);
CREATE INDEX idx_positions_unrealized_pnl ON financial.positions (unrealized_pnl DESC);
CREATE INDEX idx_positions_last_updated ON financial.positions (last_updated DESC);

-- Trading alerts - Trading alert management
CREATE INDEX idx_trading_alerts_user_status ON financial.trading_alerts (user_id, status);
CREATE INDEX idx_trading_alerts_symbol_status ON financial.trading_alerts (symbol, status);
CREATE INDEX idx_trading_alerts_priority_created ON financial.trading_alerts (priority DESC, created_at DESC);
CREATE INDEX idx_trading_alerts_expires_at ON financial.trading_alerts (expires_at) WHERE expires_at IS NOT NULL;

-- ============================================================================
-- MEDIA SCHEMA INDEXES
-- ============================================================================

-- Libraries - Media library management
CREATE INDEX idx_libraries_type_active ON media.libraries (type, is_active);
CREATE INDEX idx_libraries_server_type ON media.libraries (server_type);
CREATE INDEX idx_libraries_last_scan ON media.libraries (last_scan);

-- Items - Media item queries
CREATE INDEX idx_media_items_library_type ON media.items (library_id, type);
CREATE INDEX idx_media_items_status ON media.items (status);
CREATE INDEX idx_media_items_title_search ON media.items USING gin (to_tsvector('english', title));
CREATE INDEX idx_media_items_year_rating ON media.items (year DESC, rating DESC);
CREATE INDEX idx_media_items_genres_gin ON media.items USING gin (genres);
CREATE INDEX idx_media_items_date_added ON media.items (date_added DESC);
CREATE INDEX idx_media_items_last_watched ON media.items (last_watched DESC NULLS LAST);
CREATE INDEX idx_media_items_watch_count ON media.items (watch_count DESC);
CREATE INDEX idx_media_items_external_id ON media.items (external_id);

-- Episodes - TV episode management
CREATE INDEX idx_episodes_series_season_ep ON media.episodes (series_id, season_number, episode_number);
CREATE INDEX idx_episodes_air_date ON media.episodes (air_date DESC);
CREATE INDEX idx_episodes_status ON media.episodes (status);
CREATE INDEX idx_episodes_title_search ON media.episodes USING gin (to_tsvector('english', title));

-- Music metadata - Music-specific queries
CREATE INDEX idx_music_artist ON media.music_metadata (artist);
CREATE INDEX idx_music_album ON media.music_metadata (album);
CREATE INDEX idx_music_artist_album ON media.music_metadata (artist, album);
CREATE INDEX idx_music_spotify_id ON media.music_metadata (spotify_id);
CREATE INDEX idx_music_musicbrainz_id ON media.music_metadata (musicbrainz_id);

-- Download requests - Download queue management
CREATE INDEX idx_download_requests_status_priority ON media.download_requests (status, priority DESC);
CREATE INDEX idx_download_requests_user_status ON media.download_requests (user_id, status);
CREATE INDEX idx_download_requests_requested_at ON media.download_requests (requested_at DESC);
CREATE INDEX idx_download_requests_type ON media.download_requests (request_type);

-- User activity - Media consumption tracking
CREATE INDEX idx_user_activity_user_created ON media.user_activity (user_id, created_at DESC);
CREATE INDEX idx_user_activity_item_type ON media.user_activity (item_id, activity_type);
CREATE INDEX idx_user_activity_episode_type ON media.user_activity (episode_id, activity_type);
CREATE INDEX idx_user_activity_rating ON media.user_activity (rating) WHERE rating IS NOT NULL;

-- ============================================================================
-- SMART_HOME SCHEMA INDEXES
-- ============================================================================

-- Rooms - Room management
CREATE INDEX idx_rooms_type ON smart_home.rooms (type);
CREATE INDEX idx_rooms_floor ON smart_home.rooms (floor);
CREATE INDEX idx_rooms_name_search ON smart_home.rooms USING gin (to_tsvector('english', name));

-- Devices - Device management and control
CREATE INDEX idx_devices_room_type ON smart_home.devices (room_id, device_type);
CREATE INDEX idx_devices_type_online ON smart_home.devices (device_type, is_online);
CREATE INDEX idx_devices_brand_model ON smart_home.devices (brand, model);
CREATE INDEX idx_devices_protocol ON smart_home.devices (protocol);
CREATE INDEX idx_devices_capabilities_gin ON smart_home.devices USING gin (capabilities);
CREATE INDEX idx_devices_last_seen ON smart_home.devices (last_seen DESC);
CREATE INDEX idx_devices_controllable_online ON smart_home.devices (is_controllable, is_online);
CREATE INDEX idx_devices_mac_address ON smart_home.devices (mac_address);
CREATE INDEX idx_devices_ip_address ON smart_home.devices (ip_address);

-- Device history - Device control tracking
CREATE INDEX idx_device_history_device_created ON smart_home.device_history (device_id, created_at DESC);
CREATE INDEX idx_device_history_user_created ON smart_home.device_history (user_id, created_at DESC);
CREATE INDEX idx_device_history_command ON smart_home.device_history (command);
CREATE INDEX idx_device_history_triggered_by ON smart_home.device_history (triggered_by);
CREATE INDEX idx_device_history_success ON smart_home.device_history (success);

-- Scenes - Scene management
CREATE INDEX idx_scenes_user_active ON smart_home.scenes (user_id, is_active);
CREATE INDEX idx_scenes_name_search ON smart_home.scenes USING gin (to_tsvector('english', name));

-- Scene actions - Scene execution
CREATE INDEX idx_scene_actions_scene_order ON smart_home.scene_actions (scene_id, execution_order);
CREATE INDEX idx_scene_actions_device ON smart_home.scene_actions (device_id);

-- Automations - Automation rules
CREATE INDEX idx_automations_user_active ON smart_home.automations (user_id, is_active);
CREATE INDEX idx_automations_trigger_type ON smart_home.automations (trigger_type);
CREATE INDEX idx_automations_last_triggered ON smart_home.automations (last_triggered DESC);

-- Voice commands - Voice interaction tracking
CREATE INDEX idx_voice_commands_user_created ON smart_home.voice_commands (user_id, created_at DESC);
CREATE INDEX idx_voice_commands_device_name ON smart_home.voice_commands (device_name);
CREATE INDEX idx_voice_commands_intent ON smart_home.voice_commands (intent);
CREATE INDEX idx_voice_commands_success ON smart_home.voice_commands (success);
CREATE INDEX idx_voice_commands_confidence ON smart_home.voice_commands (confidence DESC);

-- ============================================================================
-- NETWORK SCHEMA INDEXES
-- ============================================================================

-- Nodes - Network node management
CREATE INDEX idx_nodes_type_hostname ON network.nodes (node_type, hostname);
CREATE INDEX idx_nodes_role ON network.nodes (role);
CREATE INDEX idx_nodes_last_seen ON network.nodes (last_seen DESC);
CREATE INDEX idx_nodes_monitored ON network.nodes (is_monitored) WHERE is_monitored = true;
CREATE INDEX idx_nodes_ip_address ON network.nodes (ip_address);
CREATE INDEX idx_nodes_mac_address ON network.nodes (mac_address);

-- Services - Service monitoring
CREATE INDEX idx_services_node_status ON network.services (node_id, status);
CREATE INDEX idx_services_type_status ON network.services (service_type, status);
CREATE INDEX idx_services_port ON network.services (port);
CREATE INDEX idx_services_last_health_check ON network.services (last_health_check DESC);

-- DNS records - DNS management
CREATE INDEX idx_dns_records_zone_active ON network.dns_records (zone, is_active);
CREATE INDEX idx_dns_records_name_type ON network.dns_records (name, type);
CREATE INDEX idx_dns_records_value ON network.dns_records (value);

-- Failover configuration - Failover management
CREATE INDEX idx_failover_service_type ON network.failover_config (service_type);
CREATE INDEX idx_failover_primary_node ON network.failover_config (primary_node_id);
CREATE INDEX idx_failover_backup_node ON network.failover_config (backup_node_id);
CREATE INDEX idx_failover_enabled ON network.failover_config (is_enabled) WHERE is_enabled = true;

-- Performance metrics (TimescaleDB hypertable)
CREATE INDEX idx_perf_metrics_node_time ON network.performance_metrics (node_id, time DESC);
CREATE INDEX idx_perf_metrics_type_time ON network.performance_metrics (metric_type, time DESC);

-- ============================================================================
-- SYSTEM_OPTIMIZATION SCHEMA INDEXES
-- ============================================================================

-- Gaming profiles - Gaming optimization
CREATE INDEX idx_gaming_profiles_user_active ON system_optimization.gaming_profiles (user_id, is_active);
CREATE INDEX idx_gaming_profiles_game_exec ON system_optimization.gaming_profiles (game_executable);

-- Maintenance tasks - Maintenance scheduling
CREATE INDEX idx_maintenance_tasks_enabled ON system_optimization.maintenance_tasks (is_enabled) WHERE is_enabled = true;
CREATE INDEX idx_maintenance_tasks_next_run ON system_optimization.maintenance_tasks (next_run);
CREATE INDEX idx_maintenance_tasks_type ON system_optimization.maintenance_tasks (task_type);
CREATE INDEX idx_maintenance_tasks_frequency ON system_optimization.maintenance_tasks (frequency);

-- Performance metrics (TimescaleDB hypertable)
CREATE INDEX idx_sys_perf_node_time ON system_optimization.performance_metrics (node_id, time DESC);

-- Gaming sessions - Gaming session tracking
CREATE INDEX idx_gaming_sessions_user_started ON system_optimization.gaming_sessions (user_id, started_at DESC);
CREATE INDEX idx_gaming_sessions_profile ON system_optimization.gaming_sessions (profile_id);
CREATE INDEX idx_gaming_sessions_game_name ON system_optimization.gaming_sessions (game_name);
CREATE INDEX idx_gaming_sessions_duration ON system_optimization.gaming_sessions (duration_minutes DESC);

-- ============================================================================
-- COMMUNITY SCHEMA INDEXES
-- ============================================================================

-- Profiles - Community user profiles
CREATE UNIQUE INDEX idx_community_profiles_username_lower ON community.profiles (LOWER(username));
CREATE INDEX idx_community_profiles_reputation ON community.profiles (reputation_score DESC);
CREATE INDEX idx_community_profiles_verified_public ON community.profiles (is_verified, is_public);
CREATE INDEX idx_community_profiles_downloads ON community.profiles (total_downloads DESC);
CREATE INDEX idx_community_profiles_revenue ON community.profiles (total_revenue DESC);

-- Configurations - Shared configurations
CREATE INDEX idx_configurations_category_status ON community.configurations (category, status);
CREATE INDEX idx_configurations_profile_status ON community.configurations (profile_id, status);
CREATE INDEX idx_configurations_featured ON community.configurations (featured) WHERE featured = true;
CREATE INDEX idx_configurations_rating ON community.configurations (rating DESC, rating_count DESC);
CREATE INDEX idx_configurations_downloads ON community.configurations (downloads DESC);
CREATE INDEX idx_configurations_price ON community.configurations (price);
CREATE INDEX idx_configurations_title_search ON community.configurations USING gin (to_tsvector('english', title));

-- Reviews - Configuration reviews
CREATE INDEX idx_reviews_configuration_rating ON community.reviews (configuration_id, rating DESC);
CREATE INDEX idx_reviews_reviewer_created ON community.reviews (reviewer_id, created_at DESC);
CREATE INDEX idx_reviews_verified_purchase ON community.reviews (is_verified_purchase) WHERE is_verified_purchase = true;

-- Downloads - Purchase tracking
CREATE INDEX idx_downloads_profile_created ON community.downloads (profile_id, created_at DESC);
CREATE INDEX idx_downloads_configuration ON community.downloads (configuration_id);
CREATE INDEX idx_downloads_payment_status ON community.downloads (payment_status);

-- Trading signals - Trading signal marketplace
CREATE INDEX idx_trading_signals_profile_active ON community.trading_signals (profile_id, is_active);
CREATE INDEX idx_trading_signals_strategy_type ON community.trading_signals (strategy_type);
CREATE INDEX idx_trading_signals_subscribers ON community.trading_signals (subscriber_count DESC);
CREATE INDEX idx_trading_signals_price ON community.trading_signals (subscription_price);

-- ============================================================================
-- ANALYTICS SCHEMA INDEXES
-- ============================================================================

-- Events (TimescaleDB hypertable) - Event tracking
CREATE INDEX idx_events_user_timestamp ON analytics.events (user_id, timestamp DESC);
CREATE INDEX idx_events_type_timestamp ON analytics.events (event_type, timestamp DESC);
CREATE INDEX idx_events_category_timestamp ON analytics.events (event_category, timestamp DESC);
CREATE INDEX idx_events_session ON analytics.events (session_id);

-- System health (TimescaleDB hypertable) - System monitoring
CREATE INDEX idx_system_health_time ON analytics.system_health (time DESC);
CREATE INDEX idx_system_health_score ON analytics.system_health (overall_health_score);

-- ============================================================================
-- FULL-TEXT SEARCH INDEXES
-- ============================================================================

-- Comprehensive full-text search across various content
CREATE INDEX idx_fts_conversation_messages ON core.conversation_messages USING gin (to_tsvector('english', content));
CREATE INDEX idx_fts_media_titles ON media.items USING gin (to_tsvector('english', title || ' ' || COALESCE(original_title, '') || ' ' || COALESCE(summary, '')));
CREATE INDEX idx_fts_configuration_content ON community.configurations USING gin (to_tsvector('english', title || ' ' || description));

-- ============================================================================
-- COMPOSITE INDEXES FOR COMPLEX QUERIES
-- ============================================================================

-- Multi-column indexes for common query patterns
CREATE INDEX idx_transactions_user_date_category ON financial.transactions (account_id, transaction_date DESC, category);
CREATE INDEX idx_media_items_library_status_added ON media.items (library_id, status, date_added DESC);
CREATE INDEX idx_device_history_device_success_created ON smart_home.device_history (device_id, success, created_at DESC);
CREATE INDEX idx_notifications_user_category_unread ON core.notifications (user_id, category, is_read) WHERE is_read = false;

-- ============================================================================
-- PARTIAL INDEXES FOR FILTERED QUERIES
-- ============================================================================

-- Indexes on commonly filtered subsets
CREATE INDEX idx_active_agents ON core.agents (type, last_heartbeat) WHERE status = 'active';
CREATE INDEX idx_active_accounts ON financial.accounts (user_id, account_type) WHERE is_active = true;
CREATE INDEX idx_available_media ON media.items (library_id, date_added DESC) WHERE status = 'available';
CREATE INDEX idx_online_devices ON smart_home.devices (room_id, device_type) WHERE is_online = true;
CREATE INDEX idx_enabled_automations ON smart_home.automations (user_id, trigger_type) WHERE is_active = true;
CREATE INDEX idx_running_services ON network.services (node_id, service_type) WHERE status = 'running';

-- ============================================================================
-- EXPRESSION INDEXES FOR COMPUTED QUERIES
-- ============================================================================

-- Indexes on calculated values
CREATE INDEX idx_portfolio_return_pct ON financial.portfolios (
    CASE 
        WHEN total_cost_basis > 0 THEN 
            ((total_value - total_cost_basis) / total_cost_basis) * 100 
        ELSE 0 
    END DESC
) WHERE total_cost_basis > 0;

CREATE INDEX idx_transaction_amount_abs ON financial.transactions (ABS(amount) DESC);
CREATE INDEX idx_gaming_session_efficiency ON system_optimization.gaming_sessions (
    CASE 
        WHEN duration_minutes > 0 AND avg_fps > 0 THEN 
            (avg_fps / duration_minutes) 
        ELSE 0 
    END DESC
);

-- ============================================================================
-- COVERING INDEXES FOR QUERY OPTIMIZATION
-- ============================================================================

-- Include frequently selected columns in indexes to avoid table lookups
CREATE INDEX idx_users_email_covering ON core.users (email) INCLUDE (full_name, role, is_active);
CREATE INDEX idx_accounts_user_covering ON financial.accounts (user_id) INCLUDE (account_name, account_type, balance, currency);
CREATE INDEX idx_devices_room_covering ON smart_home.devices (room_id) INCLUDE (name, device_type, is_online, current_state);
CREATE INDEX idx_media_items_library_covering ON media.items (library_id) INCLUDE (title, type, year, rating, status);

-- ============================================================================
-- UNIQUE CONSTRAINTS AND INDEXES
-- ============================================================================

-- Additional unique constraints for data integrity
CREATE UNIQUE INDEX idx_agents_name_unique ON core.agents (name);
CREATE UNIQUE INDEX idx_rooms_name_unique ON smart_home.rooms (name);
CREATE UNIQUE INDEX idx_dns_records_unique ON network.dns_records (zone, name, type);
CREATE UNIQUE INDEX idx_community_username_unique ON community.profiles (LOWER(username));

-- ============================================================================
-- MAINTENANCE COMMANDS
-- ============================================================================

-- Commands for index maintenance (to be run periodically)

-- Analyze all tables for query planner statistics
-- ANALYZE;

-- Reindex commands for maintenance (uncomment when needed)
-- REINDEX INDEX CONCURRENTLY idx_transactions_account_date;
-- REINDEX INDEX CONCURRENTLY idx_media_items_title_search;
-- REINDEX INDEX CONCURRENTLY idx_device_history_device_created;

-- Check for unused indexes (query to run periodically)
/*
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
WHERE idx_tup_read = 0 AND idx_tup_fetch = 0
ORDER BY schemaname, tablename, indexname;
*/

-- Check for index bloat (query to run periodically)
/*
SELECT 
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_total_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
JOIN pg_class ON pg_class.oid = indexrelid
ORDER BY pg_total_relation_size(indexrelid) DESC;
*/

-- ============================================================================
-- PERFORMANCE NOTES
-- ============================================================================

/*
INDEX STRATEGY SUMMARY:

1. Primary Key Indexes: Automatically created by PostgreSQL
2. Foreign Key Indexes: Created for all FK relationships
3. Query-Specific Indexes: Based on expected query patterns
4. Composite Indexes: For multi-column WHERE clauses
5. Partial Indexes: For commonly filtered subsets
6. Full-Text Indexes: For content search capabilities
7. Time-Series Indexes: Optimized for TimescaleDB hypertables

MONITORING RECOMMENDATIONS:

1. Use pg_stat_user_indexes to monitor index usage
2. Monitor query performance with pg_stat_statements
3. Regular ANALYZE to update statistics
4. Consider index maintenance during low-traffic periods
5. Monitor index bloat and rebuild when necessary

QUERY OPTIMIZATION TIPS:

1. Use EXPLAIN ANALYZE to understand query execution
2. Ensure WHERE clause columns are indexed
3. Consider covering indexes for frequently accessed columns
4. Use partial indexes for filtered queries
5. Monitor slow query logs for optimization opportunities
*/