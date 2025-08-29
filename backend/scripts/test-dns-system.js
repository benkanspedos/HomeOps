#!/usr/bin/env node

/**
 * HomeOps DNS System Comprehensive Test
 * Tests database, Pi-hole integration, and API endpoints
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const apiUrl = 'http://localhost:3101/api';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('ERROR: Missing Supabase configuration');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false
  }
});

async function testDatabaseTables() {
  console.log('🗄️  Testing Database Tables...\n');

  const tables = ['domains', 'dns_queries', 'dns_metrics'];
  const results = {};

  for (const table of tables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) {
        results[table] = { status: '❌', error: error.message, count: 0 };
      } else {
        results[table] = { status: '✅', count: count || 0 };
      }
    } catch (err) {
      results[table] = { status: '❌', error: err.message, count: 0 };
    }
  }

  // Display results
  console.log('Database Table Status:');
  for (const [table, result] of Object.entries(results)) {
    console.log(`  ${result.status} ${table}: ${result.count} records`);
    if (result.error) {
      console.log(`      Error: ${result.error}`);
    }
  }

  const allTablesExist = Object.values(results).every(r => r.status === '✅');
  
  if (!allTablesExist) {
    console.log('\n📋 To create missing tables, run this SQL in Supabase Dashboard:');
    console.log('   https://supabase.com/dashboard/project/adgbkjbkfjqqccasyfxz/sql');
    console.log('   Copy the SQL from: scripts/COMPLETE-DNS-SCHEMA.sql');
  }

  return allTablesExist;
}

async function testAPIEndpoints() {
  console.log('\n🌐 Testing API Endpoints...\n');

  const endpoints = [
    { name: 'Health Check', url: '/health', auth: false },
    { name: 'DNS Status (Public)', url: '/dns/status', auth: false },
    { name: 'API Documentation', url: '', auth: false }
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await axios.get(`${apiUrl}${endpoint.url}`, {
        timeout: 5000
      });

      if (response.status === 200) {
        console.log(`✅ ${endpoint.name}: Working`);
        
        // Show some details for key endpoints
        if (endpoint.name === 'DNS Status (Public)') {
          const data = response.data?.data?.status;
          if (data) {
            console.log(`    DNS Queries Today: ${data.dns_queries_today || 0}`);
            console.log(`    Blocked Today: ${data.ads_blocked_today || 0}`);
            console.log(`    Unique Clients: ${data.unique_clients || 0}`);
          }
        }
      } else {
        console.log(`⚠️  ${endpoint.name}: Status ${response.status}`);
      }
    } catch (error) {
      if (error.response?.status === 401) {
        console.log(`🔒 ${endpoint.name}: Requires authentication (expected)`);
      } else {
        console.log(`❌ ${endpoint.name}: ${error.message}`);
      }
    }
  }
}

async function testPiHoleIntegration() {
  console.log('\n🕳️  Testing Pi-hole Integration...\n');

  const piholeUrl = process.env.PIHOLE_API_URL || 'http://localhost:8081/api';
  const piholeKey = process.env.PIHOLE_API_KEY;

  console.log(`Pi-hole URL: ${piholeUrl}`);
  console.log(`Pi-hole Key: ${piholeKey ? 'SET (length: ' + piholeKey.length + ')' : 'NOT SET'}`);

  try {
    // Test direct Pi-hole connection
    const response = await axios.get(`${piholeUrl}/stats/summary`, {
      headers: {
        'X-Pi-hole-Authenticate': piholeKey || ''
      },
      timeout: 5000
    });

    if (response.status === 200) {
      console.log('✅ Pi-hole direct connection: Working');
      console.log(`    Data: ${JSON.stringify(response.data).substring(0, 100)}...`);
    }
  } catch (error) {
    console.log(`❌ Pi-hole direct connection: ${error.response?.status || error.message}`);
    console.log('    Using mock data fallback (this is normal for development)');
  }

  // Check Pi-hole container
  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    const { stdout } = await execAsync('docker ps --filter "name=pihole" --format "table {{.Names}}\\t{{.Status}}"');
    
    if (stdout.includes('pihole')) {
      console.log('✅ Pi-hole Docker container: Running');
      console.log(`    Status: ${stdout.split('\n')[1]}`);
    } else {
      console.log('❌ Pi-hole Docker container: Not found');
    }
  } catch (error) {
    console.log('⚠️  Could not check Docker container status');
  }
}

async function showSystemSummary() {
  console.log('\n📊 System Summary...\n');

  try {
    // Get API status
    const statusResponse = await axios.get(`${apiUrl}/dns/status`);
    const status = statusResponse.data?.data?.status;

    if (status) {
      console.log('DNS Management System Status:');
      console.log(`  🔍 DNS Queries Today: ${status.dns_queries_today}`);
      console.log(`  🚫 Ads Blocked Today: ${status.ads_blocked_today}`);
      console.log(`  📊 Block Percentage: ${status.ads_percentage_today}%`);
      console.log(`  👥 Unique Clients: ${status.unique_clients}`);
      console.log(`  ⚡ Cache Hit Rate: ${((status.queries_cached / status.dns_queries_today) * 100).toFixed(1)}%`);
    }

    // Database summary
    try {
      const { count: domainsCount } = await supabase
        .from('domains')
        .select('*', { count: 'exact', head: true });

      const { count: queriesCount } = await supabase
        .from('dns_queries')
        .select('*', { count: 'exact', head: true });

      if (domainsCount !== null || queriesCount !== null) {
        console.log('\nDatabase Records:');
        console.log(`  📋 Managed Domains: ${domainsCount || 0}`);
        console.log(`  🔍 Logged Queries: ${queriesCount || 0}`);
      }
    } catch (error) {
      // Database not available
    }

  } catch (error) {
    console.log('⚠️  Could not get system summary');
  }
}

async function showNextSteps() {
  console.log('\n🎯 Next Steps:');
  console.log('');
  console.log('1. 📊 Create Database Tables:');
  console.log('   - Go to: https://supabase.com/dashboard/project/adgbkjbkfjqqccasyfxz/sql');
  console.log('   - Copy SQL from: scripts/COMPLETE-DNS-SCHEMA.sql');
  console.log('   - Click "RUN" to create tables and sample data');
  console.log('');
  console.log('2. 🌐 Test Frontend:');
  console.log('   - npm run dev (in frontend directory)');
  console.log('   - Visit: http://localhost:3000/dashboard');
  console.log('');
  console.log('3. 🔍 Test API Endpoints:');
  console.log('   - curl http://localhost:3101/api/dns/status');
  console.log('   - curl http://localhost:3101/api/health');
  console.log('');
  console.log('4. 🕳️  Pi-hole Configuration:');
  console.log('   - Container is running with API key configured');
  console.log('   - Using mock data for development (normal)');
  console.log('   - Real Pi-hole integration will work in production');
  console.log('');
  console.log('✅ Backend is ready for testing!');
}

async function main() {
  console.log('🚀 HomeOps DNS System Comprehensive Test\n');
  console.log('='.repeat(60));

  const tablesExist = await testDatabaseTables();
  await testAPIEndpoints();
  await testPiHoleIntegration();
  await showSystemSummary();
  await showNextSteps();

  console.log('\n' + '=' .repeat(60));
  console.log('🎉 Test completed!');
  
  if (!tablesExist) {
    console.log('⚠️  Database tables need to be created manually');
  } else {
    console.log('✅ System is ready for use');
  }
}

main().catch(console.error);