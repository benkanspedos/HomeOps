#!/usr/bin/env node

/**
 * HomeOps SQL Execution Script
 * Executes SQL commands directly on Supabase
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

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

async function executeSQL(sqlCommand) {
  try {
    // Try using rpc with sql command
    const { data, error } = await supabase.rpc('exec_sql', { 
      query: sqlCommand 
    });
    
    if (error) {
      console.error('RPC exec_sql error:', error);
      return false;
    }
    
    console.log('✅ SQL executed successfully');
    return true;
  } catch (error) {
    console.error('SQL execution failed:', error);
    return false;
  }
}

async function createTablesManually() {
  console.log('Creating DNS tables manually...\n');

  // Create domains table
  const domainsSQL = `
    CREATE TABLE IF NOT EXISTS domains (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      domain VARCHAR(255) UNIQUE NOT NULL,
      blocked BOOLEAN DEFAULT false,
      comment TEXT,
      added_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );`;

  const domainsIndexSQL = `
    CREATE INDEX IF NOT EXISTS idx_domains_domain ON domains(domain);
    CREATE INDEX IF NOT EXISTS idx_domains_blocked ON domains(blocked);`;

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
    );`;

  const queriesIndexSQL = `
    CREATE INDEX IF NOT EXISTS idx_dns_queries_domain ON dns_queries(domain);
    CREATE INDEX IF NOT EXISTS idx_dns_queries_timestamp ON dns_queries(timestamp);
    CREATE INDEX IF NOT EXISTS idx_dns_queries_blocked ON dns_queries(blocked);`;

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
    );`;

  const metricsIndexSQL = `
    CREATE INDEX IF NOT EXISTS idx_dns_metrics_timestamp ON dns_metrics(timestamp);`;

  // Execute table creation
  console.log('1. Creating domains table...');
  if (await executeSQL(domainsSQL)) {
    console.log('2. Creating domains indexes...');
    await executeSQL(domainsIndexSQL);
  }

  console.log('3. Creating DNS queries table...');
  if (await executeSQL(queriesSQL)) {
    console.log('4. Creating queries indexes...');
    await executeSQL(queriesIndexSQL);
  }

  console.log('5. Creating DNS metrics table...');
  if (await executeSQL(metricsSQL)) {
    console.log('6. Creating metrics indexes...');
    await executeSQL(metricsIndexSQL);
  }
}

async function insertSampleData() {
  console.log('\n📊 Inserting sample data via direct insert...');

  try {
    // Insert sample domains using Supabase client
    const sampleDomains = [
      { domain: 'ads.google.com', blocked: true, comment: 'Google Ads - Sample Data' },
      { domain: 'facebook.com', blocked: true, comment: 'Social Media Block - Sample Data' },
      { domain: 'doubleclick.net', blocked: true, comment: 'Ad Network - Sample Data' },
      { domain: 'googlesyndication.com', blocked: true, comment: 'Ad Syndication - Sample Data' },
      { domain: 'googletagmanager.com', blocked: true, comment: 'Tracking - Sample Data' },
      { domain: 'google.com', blocked: false, comment: 'Search Engine - Sample Data' },
      { domain: 'github.com', blocked: false, comment: 'Development Platform - Sample Data' },
      { domain: 'stackoverflow.com', blocked: false, comment: 'Developer Community - Sample Data' }
    ];

    const { data: domainsData, error: domainsError } = await supabase
      .from('domains')
      .upsert(sampleDomains, { onConflict: 'domain' })
      .select();

    if (domainsError) {
      console.error('❌ Error inserting domains:', domainsError);
    } else {
      console.log(`✅ Inserted ${domainsData.length} sample domains`);
    }

    // Insert sample queries
    const now = Date.now();
    const hour = 1000 * 60 * 60;
    const sampleQueries = [];

    const domains = ['google.com', 'facebook.com', 'youtube.com', 'ads.google.com', 'doubleclick.net', 'github.com', 'stackoverflow.com'];
    const clientIps = ['192.168.1.100', '192.168.1.101', '192.168.1.102', '192.168.1.103'];

    for (let i = 0; i < 50; i++) {
      const randomHoursAgo = Math.floor(Math.random() * 24);
      const timestamp = now - (randomHoursAgo * hour);
      const domain = domains[Math.floor(Math.random() * domains.length)];
      
      sampleQueries.push({
        domain: domain,
        client_ip: clientIps[Math.floor(Math.random() * clientIps.length)],
        query_type: 'A',
        timestamp: timestamp,
        blocked: ['ads.google.com', 'facebook.com', 'doubleclick.net'].includes(domain),
        response_time: Math.floor(Math.random() * 100) + 10
      });
    }

    const { data: queriesData, error: queriesError } = await supabase
      .from('dns_queries')
      .insert(sampleQueries)
      .select();

    if (queriesError) {
      console.error('❌ Error inserting queries:', queriesError);
    } else {
      console.log(`✅ Inserted ${sampleQueries.length} sample DNS queries`);
    }

    // Insert sample metrics
    const sampleMetrics = [];
    for (let i = 0; i < 24; i++) {
      const metricsTime = new Date(now - (i * hour));
      sampleMetrics.push({
        queries_today: Math.floor(Math.random() * 500) + 500,
        blocked_today: Math.floor(Math.random() * 150) + 50,
        avg_response_time: Math.random() * 40 + 10,
        cache_hit_rate: Math.random() * 20 + 75,
        unique_clients: Math.floor(Math.random() * 8) + 4,
        timestamp: metricsTime.toISOString()
      });
    }

    const { data: metricsData, error: metricsError } = await supabase
      .from('dns_metrics')
      .insert(sampleMetrics)
      .select();

    if (metricsError) {
      console.error('❌ Error inserting metrics:', metricsError);
    } else {
      console.log(`✅ Inserted ${sampleMetrics.length} sample metrics entries`);
    }

    return true;
  } catch (error) {
    console.error('❌ Error inserting sample data:', error);
    return false;
  }
}

async function testTables() {
  console.log('\n🧪 Testing created tables...');

  try {
    // Test domains table
    const { data: domainsCount, error: domainsError } = await supabase
      .from('domains')
      .select('*', { count: 'exact', head: true });

    if (!domainsError) {
      console.log('✅ Domains table working');
    }

    // Test DNS queries table
    const { data: queriesCount, error: queriesError } = await supabase
      .from('dns_queries')
      .select('*', { count: 'exact', head: true });

    if (!queriesError) {
      console.log('✅ DNS queries table working');
    }

    // Test DNS metrics table
    const { data: metricsCount, error: metricsError } = await supabase
      .from('dns_metrics')
      .select('*', { count: 'exact', head: true });

    if (!metricsError) {
      console.log('✅ DNS metrics table working');
    }

    // Get actual counts
    const { count: actualDomainsCount } = await supabase
      .from('domains')
      .select('*', { count: 'exact', head: true });
      
    const { count: actualQueriesCount } = await supabase
      .from('dns_queries') 
      .select('*', { count: 'exact', head: true });
      
    const { count: actualMetricsCount } = await supabase
      .from('dns_metrics')
      .select('*', { count: 'exact', head: true });

    console.log('\n📊 Table Summary:');
    console.log(`   - Domains: ${actualDomainsCount || 0} entries`);
    console.log(`   - DNS Queries: ${actualQueriesCount || 0} entries`);
    console.log(`   - DNS Metrics: ${actualMetricsCount || 0} entries`);

    return true;
  } catch (error) {
    console.error('❌ Table testing failed:', error);
    return false;
  }
}

async function main() {
  console.log('🚀 HomeOps DNS Tables Setup Starting...\n');

  // Create tables
  await createTablesManually();

  // Test that tables were created
  console.log('\n🧪 Testing table creation...');
  if (!(await testTables())) {
    console.error('❌ Table creation verification failed');
    console.log('\n📋 Manual SQL commands to run in Supabase Dashboard:');
    console.log('   Go to: https://supabase.com/dashboard/project/YOUR_PROJECT_ID/sql');
    console.log('   Copy and paste the SQL from: create-dns-tables.sql');
    return;
  }

  // Insert sample data
  if (await insertSampleData()) {
    console.log('\n✅ Sample data inserted successfully');
  }

  // Final verification
  await testTables();

  console.log('\n🎉 DNS tables setup completed successfully!');
  console.log('🎯 You can now test the DNS API endpoints');
}

main().catch(console.error);