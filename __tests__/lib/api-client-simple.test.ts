import { testBackendConnection } from '@/lib/api/client'

// Mock axios at the module level
jest.mock('axios', () => ({
  default: {
    create: jest.fn(() => ({
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
    })),
    get: jest.fn(),
    post: jest.fn(),
  },
  create: jest.fn(() => ({
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  })),
  get: jest.fn(),
  post: jest.fn(),
}))

describe('API Client - Simple Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('testBackendConnection', () => {
    it('should be a function', () => {
      expect(typeof testBackendConnection).toBe('function')
    })

    it('should handle successful connection', async () => {
      const axios = require('axios')
      axios.get.mockResolvedValueOnce({
        data: {
          status: 'healthy',
          timestamp: '2024-01-01T00:00:00.000Z',
          uptime: 1000,
        },
        status: 200,
      })

      const result = await testBackendConnection()

      expect(result.connected).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data.status).toBe('healthy')
    })

    it('should handle connection failure', async () => {
      const axios = require('axios')
      axios.get.mockRejectedValueOnce(new Error('Network Error'))

      const result = await testBackendConnection()

      expect(result.connected).toBe(false)
      expect(result.error).toBe('Network Error')
    })

    it('should handle timeout', async () => {
      const axios = require('axios')
      axios.get.mockRejectedValueOnce(new Error('timeout of 10000ms exceeded'))

      const result = await testBackendConnection()

      expect(result.connected).toBe(false)
      expect(result.error).toContain('timeout')
    })
  })

  describe('Authentication Flow', () => {
    it('should handle token storage', () => {
      const token = 'test-jwt-token'
      localStorage.setItem('auth_token', token)
      
      expect(localStorage.getItem('auth_token')).toBe(token)
    })

    it('should handle token removal', () => {
      localStorage.setItem('auth_token', 'test-token')
      localStorage.removeItem('auth_token')
      
      expect(localStorage.getItem('auth_token')).toBeNull()
    })
  })
})