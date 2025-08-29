-- HomeOps DNS Tables Creation Script
-- Run this in Supabase SQL Editor or via API

-- Create domains table
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

-- Create DNS queries table  
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

-- Create DNS metrics table
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

-- Insert sample blocked domains
INSERT INTO domains (domain, blocked, comment) VALUES
    ('ads.google.com', true, 'Google Ads - Sample Data'),
    ('facebook.com', true, 'Social Media Block - Sample Data'),
    ('doubleclick.net', true, 'Ad Network - Sample Data'),
    ('googlesyndication.com', true, 'Ad Syndication - Sample Data'),
    ('googletagmanager.com', true, 'Tracking - Sample Data'),
    ('google-analytics.com', true, 'Analytics Tracking - Sample Data'),
    ('scorecardresearch.com', true, 'Research Tracking - Sample Data'),
    ('amazon-adsystem.com', true, 'Amazon Ads - Sample Data')
ON CONFLICT (domain) DO NOTHING;

-- Insert sample allowed domains
INSERT INTO domains (domain, blocked, comment) VALUES
    ('google.com', false, 'Search Engine - Sample Data'),
    ('github.com', false, 'Development Platform - Sample Data'),
    ('stackoverflow.com', false, 'Developer Community - Sample Data'),
    ('youtube.com', false, 'Video Platform - Sample Data'),
    ('wikipedia.org', false, 'Knowledge Base - Sample Data')
ON CONFLICT (domain) DO NOTHING;

-- Insert sample DNS queries (last 24 hours)
INSERT INTO dns_queries (domain, client_ip, query_type, timestamp, blocked, response_time) 
SELECT 
    CASE (random() * 10)::int
        WHEN 0 THEN 'google.com'
        WHEN 1 THEN 'facebook.com'
        WHEN 2 THEN 'youtube.com'
        WHEN 3 THEN 'ads.google.com'
        WHEN 4 THEN 'doubleclick.net'
        WHEN 5 THEN 'github.com'
        WHEN 6 THEN 'stackoverflow.com'
        WHEN 7 THEN 'amazon.com'
        WHEN 8 THEN 'netflix.com'
        ELSE 'twitter.com'
    END,
    CASE (random() * 4)::int
        WHEN 0 THEN '192.168.1.100'
        WHEN 1 THEN '192.168.1.101'
        WHEN 2 THEN '192.168.1.102'
        ELSE '192.168.1.103'
    END,
    'A',
    extract(epoch from (NOW() - (random() * interval '24 hours'))) * 1000,
    random() < 0.3, -- 30% blocked
    (random() * 100 + 10)::int
FROM generate_series(1, 100);

-- Insert sample DNS metrics (last 24 hours)
INSERT INTO dns_metrics (queries_today, blocked_today, avg_response_time, cache_hit_rate, unique_clients, timestamp)
SELECT 
    (random() * 500 + 500)::int,
    (random() * 150 + 50)::int,
    random() * 40 + 10,
    random() * 20 + 75,
    (random() * 8 + 4)::int,
    NOW() - (interval '1 hour' * generate_series)
FROM generate_series(0, 23);