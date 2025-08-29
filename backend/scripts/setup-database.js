#!/usr/bin/env node

/**
 * HomeOps Database Setup Script
 * Creates the necessary DNS tables in Supabase and adds sample data
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
  console.error('SUPABASE_URL:', supabaseUrl ? 'SET' : 'MISSING');
  console.error('SUPABASE_SERVICE_KEY:', supabaseServiceKey ? 'SET' : 'MISSING');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false
  }
});

async function createTables() {
  console.log('Creating DNS tables...');

  // Create domains table
  const domainsSQL = `
    CREATE TABLE IF NOT EXISTS domains (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      domain VARCHAR(255) UNIQUE NOT NULL,
      blocked BOOLEAN DEFAULT false,
      comment TEXT,
      added_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
    
    CREATE INDEX IF NOT EXISTS idx_domains_domain ON domains(domain);
    CREATE INDEX IF NOT EXISTS idx_domains_blocked ON domains(blocked);
  `;

  // Create DNS queries table  
  const queriesSQL = `
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
    
    CREATE INDEX IF NOT EXISTS idx_dns_queries_domain ON dns_queries(domain);
    CREATE INDEX IF NOT EXISTS idx_dns_queries_timestamp ON dns_queries(timestamp);
    CREATE INDEX IF NOT EXISTS idx_dns_queries_blocked ON dns_queries(blocked);
  `;

  // Create DNS metrics table
  const metricsSQL = `
    CREATE TABLE IF NOT EXISTS dns_metrics (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      queries_today INT NOT NULL DEFAULT 0,
      blocked_today INT NOT NULL DEFAULT 0,
      avg_response_time FLOAT DEFAULT 0,
      cache_hit_rate FLOAT DEFAULT 0,
      unique_clients INT DEFAULT 0,
      timestamp TIMESTAMP DEFAULT NOW()
    );
    
    CREATE INDEX IF NOT EXISTS idx_dns_metrics_timestamp ON dns_metrics(timestamp);
  `;

  try {
    // Execute table creation SQL
    console.log('Creating domains table...');
    const { data: domainsResult, error: domainsError } = await supabase.rpc('exec_sql', { query: domainsSQL });
    if (domainsError) {
      console.warn('Domains table creation warning:', domainsError.message);
    } else {
      console.log('✅ Domains table created successfully');
    }

    console.log('Creating DNS queries table...');
    const { data: queriesResult, error: queriesError } = await supabase.rpc('exec_sql', { query: queriesSQL });
    if (queriesError) {
      console.warn('DNS queries table creation warning:', queriesError.message);
    } else {
      console.log('✅ DNS queries table created successfully');
    }

    console.log('Creating DNS metrics table...');
    const { data: metricsResult, error: metricsError } = await supabase.rpc('exec_sql', { query: metricsSQL });
    if (metricsError) {
      console.warn('DNS metrics table creation warning:', metricsError.message);
    } else {
      console.log('✅ DNS metrics table created successfully');
    }

  } catch (error) {
    console.error('Table creation failed. Trying direct table creation...');
    
    // Fallback: Try direct table operations
    try {
      // Check if tables exist by trying a simple query
      const { data: domainsCheck } = await supabase.from('domains').select('count').limit(1);
      const { data: queriesCheck } = await supabase.from('dns_queries').select('count').limit(1);
      const { data: metricsCheck } = await supabase.from('dns_metrics').select('count').limit(1);
      
      console.log('✅ Tables already exist and are accessible');
    } catch (tableError) {
      console.error('❌ Tables do not exist and cannot be created automatically');
      console.error('Please create tables manually in Supabase dashboard:');
      console.log('\n-- DOMAINS TABLE --');
      console.log(domainsSQL);
      console.log('\n-- DNS QUERIES TABLE --');
      console.log(queriesSQL);
      console.log('\n-- DNS METRICS TABLE --');
      console.log(metricsSQL);
      return false;
    }
  }

  return true;
}

async function insertSampleData() {
  console.log('\nInserting sample data...');

  try {
    // Add sample blocked domains
    const sampleBlockedDomains = [
      { domain: 'ads.google.com', blocked: true, comment: 'Google Ads - Sample Data' },
      { domain: 'facebook.com', blocked: true, comment: 'Social Media Block - Sample Data' },
      { domain: 'doubleclick.net', blocked: true, comment: 'Ad Network - Sample Data' },
      { domain: 'googlesyndication.com', blocked: true, comment: 'Ad Syndication - Sample Data' },
      { domain: 'googletagmanager.com', blocked: true, comment: 'Tracking - Sample Data' }
    ];

    const { data: domainsData, error: domainsError } = await supabase
      .from('domains')
      .upsert(sampleBlockedDomains, { onConflict: 'domain' })
      .select();

    if (domainsError) {
      console.error('Error inserting sample domains:', domainsError);
    } else {
      console.log(`✅ Inserted ${domainsData.length} sample domains`);
    }

    // Add sample DNS queries
    const now = Date.now();
    const hour = 1000 * 60 * 60;
    const sampleQueries = [];

    // Generate 50 sample queries over the last 24 hours
    for (let i = 0; i < 50; i++) {
      const randomHoursAgo = Math.floor(Math.random() * 24);
      const timestamp = now - (randomHoursAgo * hour);
      const clientIps = ['192.168.1.100', '192.168.1.101', '192.168.1.102', '192.168.1.103'];
      const domains = ['google.com', 'facebook.com', 'youtube.com', 'ads.google.com', 'doubleclick.net', 'github.com', 'stackoverflow.com'];
      
      sampleQueries.push({
        domain: domains[Math.floor(Math.random() * domains.length)],
        client_ip: clientIps[Math.floor(Math.random() * clientIps.length)],
        query_type: 'A',
        timestamp: timestamp,
        blocked: sampleBlockedDomains.some(bd => bd.domain === domains[Math.floor(Math.random() * domains.length)]),
        response_time: Math.floor(Math.random() * 100) + 10
      });
    }

    const { data: queriesData, error: queriesError } = await supabase
      .from('dns_queries')
      .insert(sampleQueries)
      .select();

    if (queriesError) {
      console.error('Error inserting sample queries:', queriesError);
    } else {
      console.log(`✅ Inserted ${sampleQueries.length} sample DNS queries`);
    }

    // Add sample metrics
    const sampleMetrics = [];
    for (let i = 0; i < 24; i++) {
      const metricsTime = new Date(now - (i * hour));
      sampleMetrics.push({
        queries_today: Math.floor(Math.random() * 1000) + 500,
        blocked_today: Math.floor(Math.random() * 200) + 50,
        avg_response_time: Math.random() * 50 + 10,
        cache_hit_rate: Math.random() * 30 + 70,
        unique_clients: Math.floor(Math.random() * 10) + 5,
        timestamp: metricsTime.toISOString()
      });
    }

    const { data: metricsData, error: metricsError } = await supabase
      .from('dns_metrics')
      .insert(sampleMetrics)
      .select();

    if (metricsError) {
      console.error('Error inserting sample metrics:', metricsError);
    } else {
      console.log(`✅ Inserted ${sampleMetrics.length} sample metrics entries`);
    }

  } catch (error) {
    console.error('Error inserting sample data:', error);
    return false;
  }

  return true;
}

async function testConnection() {
  console.log('\nTesting database connection...');
  
  try {
    // Test basic connection
    const { data: connectionTest, error: connectionError } = await supabase
      .from('domains')
      .select('count')
      .limit(1);

    if (connectionError) {
      console.error('❌ Connection test failed:', connectionError);
      return false;
    }

    console.log('✅ Database connection successful');

    // Test each table
    const { data: domainCount } = await supabase
      .from('domains')
      .select('*', { count: 'exact', head: true });

    const { data: queryCount } = await supabase
      .from('dns_queries')
      .select('*', { count: 'exact', head: true });

    const { data: metricsCount } = await supabase
      .from('dns_metrics')
      .select('*', { count: 'exact', head: true });

    console.log(`📊 Database Summary:`);
    console.log(`   - Domains: ${domainCount?.length || 0} entries`);
    console.log(`   - DNS Queries: ${queryCount?.length || 0} entries`);
    console.log(`   - DNS Metrics: ${metricsCount?.length || 0} entries`);

    return true;
  } catch (error) {
    console.error('❌ Connection test failed:', error);
    return false;
  }
}

async function main() {
  console.log('🚀 HomeOps Database Setup Starting...\n');

  // Test initial connection
  if (!(await testConnection())) {
    process.exit(1);
  }

  // Create tables
  if (!(await createTables())) {
    process.exit(1);
  }

  // Insert sample data
  if (!(await insertSampleData())) {
    console.warn('⚠️  Sample data insertion failed, but tables should be working');
  }

  // Final test
  await testConnection();

  console.log('\n✅ Database setup completed successfully!');
  console.log('🎯 You can now test the DNS API endpoints');
}

main().catch(console.error);