#!/usr/bin/env node

/**
 * HomeOps Database Check Script
 * Check current database schema and available tables
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

console.log('Environment check:');
console.log('SUPABASE_URL:', supabaseUrl ? 'SET' : 'MISSING');
console.log('SUPABASE_SERVICE_KEY:', supabaseServiceKey ? 'SET (length: ' + supabaseServiceKey?.length + ')' : 'MISSING');

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('ERROR: Missing Supabase configuration');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false
  }
});

async function checkTables() {
  console.log('\n🔍 Checking existing tables...');
  
  try {
    // Try to get table information from information_schema
    const { data: tables, error } = await supabase
      .rpc('get_table_info');
      
    if (error) {
      console.log('RPC not available, trying manual query...');
      
      // Try querying information_schema directly if available
      const { data: schemaData, error: schemaError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public');
        
      if (schemaError) {
        console.log('Cannot access information_schema, checking known tables...');
        
        // Try querying known possible tables
        const tablesToCheck = ['domains', 'dns_queries', 'dns_metrics', 'automations', 'accounts', 'services'];
        
        for (const tableName of tablesToCheck) {
          try {
            const { data, error: tableError } = await supabase
              .from(tableName)
              .select('*')
              .limit(1);
              
            if (!tableError) {
              console.log(`✅ Table '${tableName}' exists and is accessible`);
            }
          } catch (err) {
            // Table doesn't exist
          }
        }
      } else {
        console.log('Available tables:', schemaData);
      }
    } else {
      console.log('Tables from RPC:', tables);
    }
    
  } catch (error) {
    console.log('Direct table check failed, trying basic connection...');
  }
}

async function testBasicConnection() {
  console.log('\n🔌 Testing basic Supabase connection...');
  
  try {
    // Try a simple RPC call or basic operation
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      console.log('Auth session check failed:', error.message);
    } else {
      console.log('✅ Basic Supabase connection working');
    }
    
    // Try using .from() with a non-existent table to see connection response
    const { data: testData, error: testError } = await supabase
      .from('_test_connection_')
      .select('*')
      .limit(1);
      
    if (testError) {
      console.log('Connection test response:', testError.message);
      if (testError.message.includes('does not exist') || testError.message.includes('table')) {
        console.log('✅ Database connection is working (table not found is expected)');
      }
    }
    
  } catch (error) {
    console.error('❌ Basic connection failed:', error);
  }
}

async function main() {
  console.log('🚀 HomeOps Database Check Starting...\n');
  
  await testBasicConnection();
  await checkTables();
  
  console.log('\n✅ Database check completed');
}

main().catch(console.error);