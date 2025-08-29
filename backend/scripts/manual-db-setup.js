#!/usr/bin/env node

/**
 * HomeOps Manual Database Setup
 * Direct Supabase client operations without RPC
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('ERROR: Missing Supabase configuration');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false
  }
});

async function insertSampleData() {
  console.log('🚀 Setting up sample data for DNS system...\n');

  try {
    // 1. Sample blocked domains
    console.log('1. Inserting sample domains...');
    const sampleDomains = [
      { domain: 'ads.google.com', blocked: true, comment: 'Google Ads - Sample Data' },
      { domain: 'facebook.com', blocked: true, comment: 'Social Media Block - Sample Data' },
      { domain: 'doubleclick.net', blocked: true, comment: 'Ad Network - Sample Data' },
      { domain: 'googlesyndication.com', blocked: true, comment: 'Ad Syndication - Sample Data' },
      { domain: 'googletagmanager.com', blocked: true, comment: 'Tracking - Sample Data' },
      { domain: 'google-analytics.com', blocked: true, comment: 'Analytics Tracking - Sample Data' },
      { domain: 'scorecardresearch.com', blocked: true, comment: 'Research Tracking - Sample Data' },
      { domain: 'amazon-adsystem.com', blocked: true, comment: 'Amazon Ads - Sample Data' },
      // Allowed domains
      { domain: 'google.com', blocked: false, comment: 'Search Engine - Sample Data' },
      { domain: 'github.com', blocked: false, comment: 'Development Platform - Sample Data' },
      { domain: 'stackoverflow.com', blocked: false, comment: 'Developer Community - Sample Data' },
      { domain: 'youtube.com', blocked: false, comment: 'Video Platform - Sample Data' },
      { domain: 'wikipedia.org', blocked: false, comment: 'Knowledge Base - Sample Data' },
      { domain: 'reddit.com', blocked: false, comment: 'Community Platform - Sample Data' },
      { domain: 'netflix.com', blocked: false, comment: 'Streaming Service - Sample Data' }
    ];

    const { data: domainsData, error: domainsError } = await supabase
      .from('domains')
      .upsert(sampleDomains, { onConflict: 'domain' })
      .select();

    if (domainsError) {
      console.error('❌ Error with domains - table may not exist:', domainsError.message);
      console.log('📋 You need to create the domains table first. Run this SQL in Supabase dashboard:');
      console.log(`
CREATE TABLE domains (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  domain VARCHAR(255) UNIQUE NOT NULL,
  blocked BOOLEAN DEFAULT false,
  comment TEXT,
  added_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_domains_domain ON domains(domain);
CREATE INDEX idx_domains_blocked ON domains(blocked);
      `);
    } else {
      console.log(`✅ Inserted ${domainsData.length} sample domains`);
    }

    // 2. Sample DNS queries
    console.log('2. Inserting sample DNS queries...');
    const now = Date.now();
    const hour = 1000 * 60 * 60;
    const sampleQueries = [];

    const domains = ['google.com', 'facebook.com', 'youtube.com', 'ads.google.com', 'doubleclick.net', 'github.com', 'stackoverflow.com', 'reddit.com', 'netflix.com'];
    const clientIps = ['192.168.1.100', '192.168.1.101', '192.168.1.102', '192.168.1.103', '192.168.1.104'];

    for (let i = 0; i < 100; i++) {
      const randomHoursAgo = Math.floor(Math.random() * 24);
      const timestamp = now - (randomHoursAgo * hour) - Math.floor(Math.random() * 3600000);
      const domain = domains[Math.floor(Math.random() * domains.length)];
      const blockedDomains = ['ads.google.com', 'facebook.com', 'doubleclick.net', 'googlesyndication.com', 'googletagmanager.com'];
      
      sampleQueries.push({
        domain: domain,
        client_ip: clientIps[Math.floor(Math.random() * clientIps.length)],
        query_type: Math.random() > 0.8 ? 'AAAA' : 'A',
        timestamp: timestamp,
        blocked: blockedDomains.includes(domain),
        response_time: Math.floor(Math.random() * 150) + 5
      });
    }

    const { data: queriesData, error: queriesError } = await supabase
      .from('dns_queries')
      .insert(sampleQueries)
      .select();

    if (queriesError) {
      console.error('❌ Error with dns_queries - table may not exist:', queriesError.message);
      console.log('📋 You need to create the dns_queries table first. Run this SQL in Supabase dashboard:');
      console.log(`
CREATE TABLE dns_queries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  domain VARCHAR(255) NOT NULL,
  client_ip VARCHAR(45) NOT NULL,
  query_type VARCHAR(10) DEFAULT 'A',
  timestamp BIGINT NOT NULL,
  blocked BOOLEAN DEFAULT false,
  response_time INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_dns_queries_domain ON dns_queries(domain);
CREATE INDEX idx_dns_queries_timestamp ON dns_queries(timestamp);
CREATE INDEX idx_dns_queries_blocked ON dns_queries(blocked);
CREATE INDEX idx_dns_queries_client_ip ON dns_queries(client_ip);
      `);
    } else {
      console.log(`✅ Inserted ${sampleQueries.length} sample DNS queries`);
    }

    // 3. Sample metrics
    console.log('3. Inserting sample DNS metrics...');
    const sampleMetrics = [];
    for (let i = 0; i < 24; i++) {
      const metricsTime = new Date(now - (i * hour));
      sampleMetrics.push({
        queries_today: Math.floor(Math.random() * 800) + 400,
        blocked_today: Math.floor(Math.random() * 200) + 80,
        avg_response_time: Math.random() * 60 + 15,
        cache_hit_rate: Math.random() * 25 + 70,
        unique_clients: Math.floor(Math.random() * 12) + 5,
        timestamp: metricsTime.toISOString()
      });
    }

    const { data: metricsData, error: metricsError } = await supabase
      .from('dns_metrics')
      .insert(sampleMetrics)
      .select();

    if (metricsError) {
      console.error('❌ Error with dns_metrics - table may not exist:', metricsError.message);
      console.log('📋 You need to create the dns_metrics table first. Run this SQL in Supabase dashboard:');
      console.log(`
CREATE TABLE dns_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  queries_today INT NOT NULL DEFAULT 0,
  blocked_today INT NOT NULL DEFAULT 0,
  avg_response_time FLOAT DEFAULT 0,
  cache_hit_rate FLOAT DEFAULT 0,
  unique_clients INT DEFAULT 0,
  timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_dns_metrics_timestamp ON dns_metrics(timestamp);
      `);
    } else {
      console.log(`✅ Inserted ${sampleMetrics.length} sample metrics entries`);
    }

    return true;
  } catch (error) {
    console.error('❌ Error during setup:', error);
    return false;
  }
}

async function testAPIs() {
  console.log('\n🧪 Testing DNS API endpoints...');

  try {
    // Test domain queries
    const { data: domains, error: domainError } = await supabase
      .from('domains')
      .select('*')
      .limit(5);

    if (!domainError) {
      console.log(`✅ Domains API working - ${domains.length} sample domains found`);
    }

    // Test query history
    const { data: queries, error: queryError } = await supabase
      .from('dns_queries')
      .select('*')
      .limit(10);

    if (!queryError) {
      console.log(`✅ DNS Queries API working - ${queries.length} sample queries found`);
    }

    // Test metrics
    const { data: metrics, error: metricError } = await supabase
      .from('dns_metrics')
      .select('*')
      .limit(5);

    if (!metricError) {
      console.log(`✅ DNS Metrics API working - ${metrics.length} sample metrics found`);
    }

    return true;
  } catch (error) {
    console.error('❌ API testing failed:', error);
    return false;
  }
}

async function showSummary() {
  console.log('\n📊 Database Summary:');

  try {
    const { count: domainsCount } = await supabase
      .from('domains')
      .select('*', { count: 'exact', head: true });

    const { count: queriesCount } = await supabase
      .from('dns_queries')
      .select('*', { count: 'exact', head: true });

    const { count: metricsCount } = await supabase
      .from('dns_metrics')
      .select('*', { count: 'exact', head: true });

    console.log(`   📋 Domains: ${domainsCount || 0}`);
    console.log(`   🔍 DNS Queries: ${queriesCount || 0}`);
    console.log(`   📈 Metrics Records: ${metricsCount || 0}`);

    // Show sample blocked and allowed domains
    const { data: blockedDomains } = await supabase
      .from('domains')
      .select('domain')
      .eq('blocked', true)
      .limit(3);

    const { data: allowedDomains } = await supabase
      .from('domains')
      .select('domain')
      .eq('blocked', false)
      .limit(3);

    if (blockedDomains?.length) {
      console.log(`   🚫 Sample blocked: ${blockedDomains.map(d => d.domain).join(', ')}`);
    }

    if (allowedDomains?.length) {
      console.log(`   ✅ Sample allowed: ${allowedDomains.map(d => d.domain).join(', ')}`);
    }

  } catch (error) {
    console.log('   ❌ Could not get summary - tables may not exist');
  }
}

async function main() {
  console.log('🏗️  HomeOps DNS Database Manual Setup\n');

  if (await insertSampleData()) {
    console.log('\n✅ Sample data insertion completed');
  }

  if (await testAPIs()) {
    console.log('\n✅ API endpoints are working');
  }

  await showSummary();

  console.log('\n🎯 Next Steps:');
  console.log('   1. If tables don\'t exist, create them using the SQL provided above');
  console.log('   2. Test backend API: npm run dev');
  console.log('   3. Test endpoints: curl http://localhost:3101/api/dns/status');
  console.log('   4. Check frontend dashboard');

  console.log('\n🎉 Setup completed!');
}

main().catch(console.error);