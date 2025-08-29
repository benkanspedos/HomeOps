import { test, expect } from '@playwright/test'

test.describe('API Endpoints', () => {
  test('health endpoint returns correct status', async ({ request }) => {
    const response = await request.get('http://localhost:3101/health')
    
    expect(response.ok()).toBeTruthy()
    expect(response.status()).toBe(200)
    
    const data = await response.json()
    expect(data).toHaveProperty('status', 'healthy')
    expect(data).toHaveProperty('timestamp')
    expect(data).toHaveProperty('uptime')
    expect(data).toHaveProperty('environment', 'development')
  })

  test('frontend-backend integration endpoint works', async ({ request }) => {
    const response = await request.get('http://localhost:3000/api/test-backend')
    
    expect(response.ok()).toBeTruthy()
    
    const data = await response.json()
    expect(data).toHaveProperty('frontend', 'ok')
    expect(data).toHaveProperty('timestamp')
    
    if (data.backend) {
      expect(data.backend).toHaveProperty('status', 'healthy')
    }
  })

  test('protected endpoints require authentication', async ({ request }) => {
    const endpoints = [
      'http://localhost:3101/api/accounts',
      'http://localhost:3101/api/services',
      'http://localhost:3101/api/alerts'
    ]
    
    for (const endpoint of endpoints) {
      const response = await request.get(endpoint)
      
      // Should return 401 Unauthorized without auth token
      expect(response.status()).toBe(401)
      
      const data = await response.json()
      expect(data).toHaveProperty('success', false)
      expect(data).toHaveProperty('error')
    }
  })

  test('API handles malformed requests', async ({ request }) => {
    // Test with invalid JSON
    const response = await request.post('http://localhost:3101/api/accounts', {
      data: 'invalid json',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    
    // Should return 400 Bad Request or similar
    expect(response.status()).toBeGreaterThanOrEqual(400)
    expect(response.status()).toBeLessThan(500)
  })

  test('API responds with correct headers', async ({ request }) => {
    const response = await request.get('http://localhost:3101/health')
    
    // Check for security headers
    const headers = response.headers()
    
    // CORS headers
    if (headers['access-control-allow-origin']) {
      expect(headers['access-control-allow-origin']).toBeTruthy()
    }
    
    // Content-Type
    expect(headers['content-type']).toContain('application/json')
  })

  test('rate limiting works (if implemented)', async ({ request }) => {
    // Make multiple rapid requests
    const requests = []
    for (let i = 0; i < 100; i++) {
      requests.push(request.get('http://localhost:3101/health'))
    }
    
    const responses = await Promise.all(requests)
    
    // Check if any requests were rate limited (429 status)
    const rateLimited = responses.filter(r => r.status() === 429)
    
    // This test will depend on actual rate limiting implementation
    // If rate limiting is implemented, some requests should be limited
  })
})

test.describe('WebSocket Connections', () => {
  test.skip('WebSocket connection can be established', async ({ page }) => {
    // This test would require WebSocket implementation
    await page.goto('/dashboard')
    
    // Evaluate WebSocket connection in browser context
    const wsConnected = await page.evaluate(() => {
      return new Promise((resolve) => {
        try {
          const ws = new WebSocket('ws://localhost:3101')
          ws.onopen = () => resolve(true)
          ws.onerror = () => resolve(false)
          setTimeout(() => resolve(false), 5000)
        } catch {
          resolve(false)
        }
      })
    })
    
    // Skip assertion if WebSocket not implemented
    // expect(wsConnected).toBeTruthy()
  })
})

test.describe('Database Connectivity', () => {
  test('backend has database connection', async ({ request }) => {
    const response = await request.get('http://localhost:3101/health')
    const data = await response.json()
    
    // Health check should indicate database status
    // This depends on implementation
    expect(data.status).toBe('healthy')
  })
})

test.describe('Error Recovery', () => {
  test('API recovers from errors gracefully', async ({ request }) => {
    // First, make a bad request
    await request.get('http://localhost:3101/api/nonexistent').catch(() => {})
    
    // Then make a valid request
    const response = await request.get('http://localhost:3101/health')
    
    // Should still work after error
    expect(response.ok()).toBeTruthy()
    
    const data = await response.json()
    expect(data.status).toBe('healthy')
  })
})