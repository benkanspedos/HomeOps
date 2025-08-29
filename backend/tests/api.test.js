const axios = require('axios');

const API_BASE = 'http://localhost:3101';

describe('API Health Tests', () => {
  test('Health endpoint responds', async () => {
    const response = await axios.get(`${API_BASE}/health`);
    expect(response.status).toBe(200);
    expect(response.data.status).toBe('healthy');
    expect(response.data).toHaveProperty('timestamp');
    expect(response.data).toHaveProperty('uptime');
    expect(response.data).toHaveProperty('environment');
  });

  test('Services endpoint requires authentication', async () => {
    try {
      await axios.get(`${API_BASE}/api/services`);
      fail('Should have thrown authentication error');
    } catch (error) {
      expect(error.response.status).toBe(401);
      expect(error.response.data.success).toBe(false);
      expect(error.response.data.error).toBe('No authentication token provided');
    }
  });

  test('Accounts endpoint requires authentication', async () => {
    try {
      await axios.get(`${API_BASE}/api/accounts`);
      fail('Should have thrown authentication error');
    } catch (error) {
      expect(error.response.status).toBe(401);
      expect(error.response.data.success).toBe(false);
      expect(error.response.data.error).toBe('No authentication token provided');
    }
  });

  test('Invalid endpoint returns 404', async () => {
    try {
      await axios.get(`${API_BASE}/api/invalid-endpoint`);
      fail('Should have thrown 404 error');
    } catch (error) {
      expect(error.response.status).toBe(404);
    }
  });
});

describe('Infrastructure Health Tests', () => {
  test('Backend server is running', async () => {
    const response = await axios.get(`${API_BASE}/health`);
    expect(response.status).toBe(200);
  });

  test('Response times are acceptable', async () => {
    const start = Date.now();
    await axios.get(`${API_BASE}/health`);
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(1000); // Should respond within 1 second
  });

  test('Error handling returns proper format', async () => {
    try {
      await axios.get(`${API_BASE}/api/services`);
    } catch (error) {
      expect(error.response.data).toHaveProperty('success');
      expect(error.response.data).toHaveProperty('error');
      expect(error.response.data.success).toBe(false);
    }
  });
});

// Performance Benchmarks
describe('API Performance Tests', () => {
  test('Health endpoint responds quickly', async () => {
    const times = [];
    for (let i = 0; i < 10; i++) {
      const start = Date.now();
      await axios.get(`${API_BASE}/health`);
      times.push(Date.now() - start);
    }
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    expect(avgTime).toBeLessThan(100); // Average response under 100ms
  });

  test('Can handle multiple concurrent requests', async () => {
    const requests = Array(20).fill(null).map(() => 
      axios.get(`${API_BASE}/health`)
    );
    
    const results = await Promise.allSettled(requests);
    const successful = results.filter(r => r.status === 'fulfilled');
    expect(successful.length).toBe(20); // All requests should succeed
  });
});

// Docker Infrastructure Tests (via backend health check)
describe('Infrastructure Services', () => {
  test('Backend can report its status', async () => {
    const response = await axios.get(`${API_BASE}/health`);
    expect(response.data.environment).toBe('development');
  });

  test('Uptime is tracked correctly', async () => {
    const response1 = await axios.get(`${API_BASE}/health`);
    await new Promise(resolve => setTimeout(resolve, 1000));
    const response2 = await axios.get(`${API_BASE}/health`);
    
    expect(response2.data.uptime).toBeGreaterThan(response1.data.uptime);
  });
});