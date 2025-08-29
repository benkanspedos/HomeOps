-- ================================================================
-- HomeOps DNS Management System - Complete Database Schema
-- ================================================================
-- Copy and paste this entire script into Supabase SQL Editor
-- Project: https://supabase.com/dashboard/project/adgbkjbkfjqqccasyfxz/sql
-- ================================================================

-- 1. Create domains table for managing blocked/allowed domains
CREATE TABLE IF NOT EXISTS domains (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    domain VARCHAR(255) UNIQUE NOT NULL,
    blocked BOOLEAN DEFAULT false,
    comment TEXT,
    added_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for domains table
CREATE INDEX IF NOT EXISTS idx_domains_domain ON domains(domain);
CREATE INDEX IF NOT EXISTS idx_domains_blocked ON domains(blocked);

-- 2. Create DNS queries table for logging all DNS requests
CREATE TABLE IF NOT EXISTS dns_queries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    domain VARCHAR(255) NOT NULL,
    client_ip VARCHAR(45) NOT NULL,
    query_type VARCHAR(10) DEFAULT 'A',
    timestamp BIGINT NOT NULL,
    blocked BOOLEAN DEFAULT false,
    response_time INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for DNS queries table
CREATE INDEX IF NOT EXISTS idx_dns_queries_domain ON dns_queries(domain);
CREATE INDEX IF NOT EXISTS idx_dns_queries_timestamp ON dns_queries(timestamp);
CREATE INDEX IF NOT EXISTS idx_dns_queries_blocked ON dns_queries(blocked);
CREATE INDEX IF NOT EXISTS idx_dns_queries_client_ip ON dns_queries(client_ip);
CREATE INDEX IF NOT EXISTS idx_dns_queries_created_at ON dns_queries(created_at);

-- 3. Create DNS metrics table for storing performance data
CREATE TABLE IF NOT EXISTS dns_metrics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    queries_today INT NOT NULL DEFAULT 0,
    blocked_today INT NOT NULL DEFAULT 0,
    avg_response_time FLOAT DEFAULT 0,
    cache_hit_rate FLOAT DEFAULT 0,
    unique_clients INT DEFAULT 0,
    timestamp TIMESTAMP DEFAULT NOW()
);

-- Create indexes for DNS metrics table
CREATE INDEX IF NOT EXISTS idx_dns_metrics_timestamp ON dns_metrics(timestamp);

-- ================================================================
-- SAMPLE DATA INSERTION
-- ================================================================

-- Insert sample blocked domains
INSERT INTO domains (domain, blocked, comment) VALUES
    ('ads.google.com', true, 'Google Ads - Sample Data'),
    ('facebook.com', true, 'Social Media Block - Sample Data'),
    ('doubleclick.net', true, 'Ad Network - Sample Data'),
    ('googlesyndication.com', true, 'Ad Syndication - Sample Data'),
    ('googletagmanager.com', true, 'Tracking - Sample Data'),
    ('google-analytics.com', true, 'Analytics Tracking - Sample Data'),
    ('scorecardresearch.com', true, 'Research Tracking - Sample Data'),
    ('amazon-adsystem.com', true, 'Amazon Ads - Sample Data'),
    ('outbrain.com', true, 'Content Discovery - Sample Data'),
    ('taboola.com', true, 'Content Recommendation - Sample Data')
ON CONFLICT (domain) DO NOTHING;

-- Insert sample allowed domains
INSERT INTO domains (domain, blocked, comment) VALUES
    ('google.com', false, 'Search Engine - Sample Data'),
    ('github.com', false, 'Development Platform - Sample Data'),
    ('stackoverflow.com', false, 'Developer Community - Sample Data'),
    ('youtube.com', false, 'Video Platform - Sample Data'),
    ('wikipedia.org', false, 'Knowledge Base - Sample Data'),
    ('reddit.com', false, 'Community Platform - Sample Data'),
    ('netflix.com', false, 'Streaming Service - Sample Data'),
    ('amazon.com', false, 'E-commerce - Sample Data'),
    ('microsoft.com', false, 'Technology Company - Sample Data'),
    ('apple.com', false, 'Technology Company - Sample Data')
ON CONFLICT (domain) DO NOTHING;

-- Insert sample DNS queries (last 24 hours with realistic data)
INSERT INTO dns_queries (domain, client_ip, query_type, timestamp, blocked, response_time) 
SELECT 
    CASE (random() * 15)::int
        WHEN 0 THEN 'google.com'
        WHEN 1 THEN 'facebook.com'
        WHEN 2 THEN 'youtube.com'
        WHEN 3 THEN 'ads.google.com'
        WHEN 4 THEN 'doubleclick.net'
        WHEN 5 THEN 'github.com'
        WHEN 6 THEN 'stackoverflow.com'
        WHEN 7 THEN 'amazon.com'
        WHEN 8 THEN 'netflix.com'
        WHEN 9 THEN 'reddit.com'
        WHEN 10 THEN 'googletagmanager.com'
        WHEN 11 THEN 'google-analytics.com'
        WHEN 12 THEN 'wikipedia.org'
        WHEN 13 THEN 'microsoft.com'
        ELSE 'apple.com'
    END as domain_name,
    CASE (random() * 6)::int
        WHEN 0 THEN '192.168.1.100'
        WHEN 1 THEN '192.168.1.101'
        WHEN 2 THEN '192.168.1.102'
        WHEN 3 THEN '192.168.1.103'
        WHEN 4 THEN '192.168.1.104'
        ELSE '192.168.1.105'
    END as client,
    CASE (random() * 4)::int
        WHEN 0 THEN 'A'
        WHEN 1 THEN 'AAAA'
        WHEN 2 THEN 'CNAME'
        ELSE 'PTR'
    END as query_type,
    extract(epoch from (NOW() - (random() * interval '24 hours'))) * 1000,
    CASE 
        WHEN domain_name IN ('ads.google.com', 'facebook.com', 'doubleclick.net', 'googletagmanager.com', 'google-analytics.com', 'amazon-adsystem.com', 'outbrain.com', 'taboola.com') 
        THEN true 
        ELSE false 
    END as blocked,
    (random() * 200 + 10)::int as response_time
FROM generate_series(1, 200) as i;

-- Insert sample DNS metrics (last 24 hours, hourly data)
INSERT INTO dns_metrics (queries_today, blocked_today, avg_response_time, cache_hit_rate, unique_clients, timestamp)
SELECT 
    (random() * 800 + 600)::int as queries,
    (random() * 200 + 100)::int as blocked,
    random() * 80 + 20 as avg_response,
    random() * 30 + 65 as cache_rate,
    (random() * 12 + 6)::int as clients,
    NOW() - (interval '1 hour' * generate_series) as time_stamp
FROM generate_series(0, 23) as generate_series;

-- ================================================================
-- VERIFICATION QUERIES
-- ================================================================

-- Check table creation and data
SELECT 'domains' as table_name, COUNT(*) as record_count FROM domains
UNION ALL
SELECT 'dns_queries' as table_name, COUNT(*) as record_count FROM dns_queries  
UNION ALL
SELECT 'dns_metrics' as table_name, COUNT(*) as record_count FROM dns_metrics;

-- Show sample data from each table
SELECT 'Sample Domains' as info, domain, blocked, comment FROM domains LIMIT 5;
SELECT 'Sample Queries' as info, domain, client_ip, blocked, timestamp FROM dns_queries ORDER BY created_at DESC LIMIT 5;
SELECT 'Sample Metrics' as info, queries_today, blocked_today, timestamp FROM dns_metrics ORDER BY timestamp DESC LIMIT 5;

-- ================================================================
-- COMPLETION MESSAGE
-- ================================================================
SELECT '✅ HomeOps DNS Database Setup Complete!' as status,
       'Tables created: domains, dns_queries, dns_metrics' as tables,
       'Sample data inserted for testing' as data,
       'Ready for API testing' as next_step;