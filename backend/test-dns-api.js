const axios = require('axios');

const API_BASE_URL = 'http://localhost:3101/api';

// Test user credentials (you may need to adjust these)
const TEST_USER = {
  email: 'test@homeops.local',
  password: 'testpassword123'
};

let authToken = null;

async function register() {
  try {
    console.log('Registering test user...');
    const response = await axios.post(`${API_BASE_URL}/auth/register`, {
      email: TEST_USER.email,
      password: TEST_USER.password,
      name: 'Test User'
    });
    console.log('Registration successful');
    console.log('Response data:', JSON.stringify(response.data, null, 2));
    return response.data.token || response.data.access_token || response.data.accessToken || response.data;
  } catch (error) {
    if (error.response?.data?.error?.includes('already exists') || error.response?.status === 409) {
      console.log('User already exists, attempting login...');
      return null; // Will try login next
    }
    console.error('Registration failed:', error.response?.data || error.message);
    return null;
  }
}

async function login() {
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: TEST_USER.email,
      password: TEST_USER.password
    });
    console.log('Login successful');
    console.log('Response data:', JSON.stringify(response.data, null, 2));
    return response.data.token || response.data.access_token || response.data.accessToken || response.data;
  } catch (error) {
    console.error('Login failed:', error.response?.data || error.message);
    return null;
  }
}

async function testDNSEndpoints(token) {
  const config = {
    headers: { Authorization: `Bearer ${token}` }
  };

  console.log('\n=== Testing DNS Endpoints ===\n');

  // Test 1: Get DNS Status
  try {
    console.log('1. Testing GET /api/dns/status');
    const response = await axios.get(`${API_BASE_URL}/dns/status`, config);
    console.log('   Status:', response.data.success ? 'SUCCESS' : 'FAILED');
    console.log('   Pi-hole Connected:', response.data.data?.connected);
    if (response.data.data?.status) {
      console.log('   Queries Today:', response.data.data.status.dns_queries_today);
      console.log('   Ads Blocked Today:', response.data.data.status.ads_blocked_today);
    }
  } catch (error) {
    console.log('   ERROR:', error.response?.data?.error || error.message);
  }

  // Test 2: Get Performance Metrics
  try {
    console.log('\n2. Testing GET /api/dns/performance');
    const response = await axios.get(`${API_BASE_URL}/dns/performance`, config);
    console.log('   Status:', response.data.success ? 'SUCCESS' : 'FAILED');
    if (response.data.data?.metrics) {
      console.log('   Queries Today:', response.data.data.metrics.queries_today);
      console.log('   Blocked Today:', response.data.data.metrics.blocked_today);
      console.log('   Cache Hit Rate:', response.data.data.metrics.cache_hit_rate?.toFixed(2) + '%');
    }
  } catch (error) {
    console.log('   ERROR:', error.response?.data?.error || error.message);
  }

  // Test 3: Get Domains
  try {
    console.log('\n3. Testing GET /api/dns/domains');
    const response = await axios.get(`${API_BASE_URL}/dns/domains?listType=black`, config);
    console.log('   Status:', response.data.success ? 'SUCCESS' : 'FAILED');
    console.log('   Total Domains:', response.data.data?.total || 0);
  } catch (error) {
    console.log('   ERROR:', error.response?.data?.error || error.message);
  }

  // Test 4: Get Query History
  try {
    console.log('\n4. Testing GET /api/dns/queries?limit=10');
    const response = await axios.get(`${API_BASE_URL}/dns/queries?limit=10`, config);
    console.log('   Status:', response.data.success ? 'SUCCESS' : 'FAILED');
    console.log('   Queries Retrieved:', response.data.data?.queries?.length || 0);
  } catch (error) {
    console.log('   ERROR:', error.response?.data?.error || error.message);
  }

  // Test 5: Get Top Queries
  try {
    console.log('\n5. Testing GET /api/dns/top-queries');
    const response = await axios.get(`${API_BASE_URL}/dns/top-queries`, config);
    console.log('   Status:', response.data.success ? 'SUCCESS' : 'FAILED');
    console.log('   Top Domains:', response.data.data?.topQueries?.length || 0);
  } catch (error) {
    console.log('   ERROR:', error.response?.data?.error || error.message);
  }

  // Test 6: Get Top Blocked
  try {
    console.log('\n6. Testing GET /api/dns/top-blocked');
    const response = await axios.get(`${API_BASE_URL}/dns/top-blocked`, config);
    console.log('   Status:', response.data.success ? 'SUCCESS' : 'FAILED');
    console.log('   Top Blocked:', response.data.data?.topBlocked?.length || 0);
  } catch (error) {
    console.log('   ERROR:', error.response?.data?.error || error.message);
  }

  // Test 7: Add a test domain to blacklist
  try {
    console.log('\n7. Testing POST /api/dns/domains (Add domain)');
    const response = await axios.post(`${API_BASE_URL}/dns/domains`, {
      domain: 'test-block.example.com',
      listType: 'black',
      comment: 'Test domain from HomeOps API'
    }, config);
    console.log('   Status:', response.data.success ? 'SUCCESS' : 'FAILED');
    console.log('   Message:', response.data.data?.message);
  } catch (error) {
    console.log('   ERROR:', error.response?.data?.error || error.message);
  }

  // Test 8: Remove the test domain
  try {
    console.log('\n8. Testing DELETE /api/dns/domains/:domain');
    const response = await axios.delete(
      `${API_BASE_URL}/dns/domains/test-block.example.com?listType=black`, 
      config
    );
    console.log('   Status:', response.data.success ? 'SUCCESS' : 'FAILED');
    console.log('   Message:', response.data.data?.message);
  } catch (error) {
    console.log('   ERROR:', error.response?.data?.error || error.message);
  }

  console.log('\n=== DNS API Tests Complete ===\n');
}

async function main() {
  // First get authentication token
  authToken = await register();
  
  if (!authToken) {
    authToken = await login();
  }
  
  if (!authToken) {
    console.error('Failed to authenticate. Cannot test DNS endpoints.');
    process.exit(1);
  }

  // Test DNS endpoints
  await testDNSEndpoints(authToken);
}

main().catch(console.error);