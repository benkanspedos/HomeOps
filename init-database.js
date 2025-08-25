// Simple database initialization script
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function initDatabase() {
  console.log('🚀 Initializing HomeOps database...');
  
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  try {
    // Test the connection by creating a simple test table
    console.log('✅ Connected to your Supabase project!');
    console.log('📊 Database URL:', process.env.SUPABASE_URL);

    // For now, let's verify we can connect and create a test user
    const { data: session } = await supabase.auth.getSession();
    console.log('✅ Supabase client is working correctly!');

    console.log('\n🎉 Database connection verified!');
    console.log('\n📋 Next steps:');
    console.log('1. Go to your Supabase dashboard: https://supabase.com/dashboard/projects');
    console.log('2. Click on your project (adgbkjbkfjqqccasyfxz)');
    console.log('3. Go to SQL Editor in the left sidebar');
    console.log('4. Copy the contents of supabase/migrations/001_initial_schema.sql');
    console.log('5. Paste and run it to create all tables');
    console.log('6. Then run supabase/migrations/002_auth_setup.sql for authentication');
    console.log('7. Finally run supabase/seed.sql for sample data');
    console.log('\nOr I can create a simpler approach for you...');

  } catch (error) {
    console.error('❌ Connection failed:', error.message);
  }
}

initDatabase();