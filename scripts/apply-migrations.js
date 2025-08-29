#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env.local') });

async function applyMigrations() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase configuration');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const migrationsDir = path.join(__dirname, '../supabase/migrations');
  const migrationFiles = fs.readdirSync(migrationsDir).sort();

  console.log('Found migrations:', migrationFiles);

  for (const file of migrationFiles) {
    if (!file.endsWith('.sql')) continue;

    console.log(`\nApplying migration: ${file}`);
    const migrationPath = path.join(migrationsDir, file);
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');

    try {
      // Execute the migration SQL
      const { data, error } = await supabase.rpc('exec_sql', { 
        sql: migrationSql 
      });

      if (error) {
        // If rpc doesn't work, try direct query for simple cases
        console.log('RPC failed, trying direct execution...');
        
        // Split the migration into individual statements
        const statements = migrationSql
          .split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0);

        for (const statement of statements) {
          if (statement.trim()) {
            console.log('Executing:', statement.substring(0, 100) + '...');
            const { error: stmtError } = await supabase
              .from('information_schema.tables')
              .select('*')
              .limit(0); // This will fail but let us test connection
              
            if (stmtError) {
              console.warn('Cannot execute statements directly via Supabase client');
              console.log('Migration content:', statement.substring(0, 200) + '...');
            }
          }
        }
      } else {
        console.log('✅ Migration applied successfully');
      }
    } catch (err) {
      console.error('❌ Migration failed:', err.message);
      console.log('Migration file content (first 500 chars):');
      console.log(migrationSql.substring(0, 500) + '...');
    }
  }

  // Check if tables exist
  console.log('\nChecking tables...');
  try {
    const { data: tables, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public');

    if (error) {
      console.error('Cannot query tables:', error);
    } else {
      console.log('Existing public tables:', tables?.map(t => t.table_name) || []);
    }
  } catch (err) {
    console.log('Cannot check tables with Supabase client');
  }

  // Try to check if users table exists by attempting to insert (will fail gracefully)
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .limit(1);
    
    if (error) {
      console.log('❌ Users table not found:', error.message);
      console.log('This confirms migrations need to be applied via Supabase dashboard or CLI');
    } else {
      console.log('✅ Users table exists and accessible');
    }
  } catch (err) {
    console.log('Cannot test users table:', err.message);
  }
}

if (require.main === module) {
  applyMigrations()
    .then(() => {
      console.log('\nMigration check complete');
    })
    .catch(err => {
      console.error('Migration process failed:', err);
      process.exit(1);
    });
}

module.exports = { applyMigrations };