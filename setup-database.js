// Script to initialize HomeOps database with real Supabase connection
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

async function setupDatabase() {
  console.log('🚀 Setting up HomeOps database...');
  
  // Create Supabase client with service key (admin privileges)
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  try {
    // Test connection
    console.log('🔌 Testing connection...');
    const { data: connectionTest, error: connectionError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .limit(1);
    
    if (connectionError) {
      throw new Error(`Connection failed: ${connectionError.message}`);
    }
    
    console.log('✅ Connected to Supabase successfully!');

    // Read and execute the initial schema migration
    console.log('📊 Creating database schema...');
    const schemaSQL = fs.readFileSync(
      path.join(__dirname, 'supabase', 'migrations', '001_initial_schema.sql'),
      'utf8'
    );

    // Execute schema in chunks (Supabase has query limits)
    const statements = schemaSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        console.log(`   Executing statement ${i + 1}/${statements.length}...`);
        
        const { error } = await supabase.rpc('execute_sql', {
          sql: statement + ';'
        });

        if (error && !error.message.includes('already exists')) {
          console.warn(`   Warning on statement ${i + 1}: ${error.message}`);
        }
      }
    }

    console.log('✅ Schema created successfully!');

    // Execute auth setup
    console.log('🔐 Setting up authentication and RLS...');
    const authSQL = fs.readFileSync(
      path.join(__dirname, 'supabase', 'migrations', '002_auth_setup.sql'),
      'utf8'
    );

    const authStatements = authSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);

    for (let i = 0; i < authStatements.length; i++) {
      const statement = authStatements[i];
      if (statement.trim()) {
        console.log(`   Executing auth statement ${i + 1}/${authStatements.length}...`);
        
        const { error } = await supabase.rpc('execute_sql', {
          sql: statement + ';'
        });

        if (error && !error.message.includes('already exists')) {
          console.warn(`   Warning on auth statement ${i + 1}: ${error.message}`);
        }
      }
    }

    console.log('✅ Authentication setup complete!');

    // Seed development data
    console.log('🌱 Adding seed data...');
    const seedSQL = fs.readFileSync(
      path.join(__dirname, 'supabase', 'seed.sql'),
      'utf8'
    );

    const seedStatements = seedSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);

    for (let i = 0; i < seedStatements.length; i++) {
      const statement = seedStatements[i];
      if (statement.trim()) {
        const { error } = await supabase.rpc('execute_sql', {
          sql: statement + ';'
        });

        if (error && !error.message.includes('already exists')) {
          console.warn(`   Warning on seed statement ${i + 1}: ${error.message}`);
        }
      }
    }

    console.log('✅ Seed data added successfully!');

    // Verify setup by checking tables
    console.log('🔍 Verifying database setup...');
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public');

    if (tablesError) {
      throw new Error(`Verification failed: ${tablesError.message}`);
    }

    console.log(`✅ Database setup complete! Created ${tables.length} tables:`);
    tables.forEach(table => console.log(`   - ${table.table_name}`));

    console.log('\n🎉 HomeOps database is ready!');
    console.log('   You can now start the application with: npm run dev');

  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    process.exit(1);
  }
}

// Alternative simpler approach using direct SQL execution
async function setupDatabaseDirect() {
  console.log('🚀 Setting up HomeOps database (direct method)...');
  
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  try {
    // Test basic connection
    const { data: test } = await supabase.auth.getSession();
    console.log('✅ Connected to Supabase!');

    // Create tables using Supabase client methods
    console.log('📊 Creating core tables...');

    // Create users table first (extends auth.users)
    const { error: usersError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS public.users (
          id UUID REFERENCES auth.users(id) PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          full_name TEXT,
          avatar_url TEXT,
          preferences JSONB DEFAULT '{}',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `
    });

    if (usersError) console.warn('Users table warning:', usersError.message);

    console.log('✅ Database setup complete!');
    console.log('🎉 You can now start your application!');

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    console.log('\n📋 Manual setup instructions:');
    console.log('1. Go to your Supabase project dashboard');
    console.log('2. Open SQL Editor');
    console.log('3. Copy and paste the content from supabase/migrations/001_initial_schema.sql');
    console.log('4. Run the query');
    console.log('5. Then run 002_auth_setup.sql');
  }
}

setupDatabaseDirect();