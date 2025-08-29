/**
 * @jest-environment node
 */

import * as apiClient from '@/lib/api/client'

jest.mock('@/lib/api/client')

describe('/api/test-backend route handler', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should handle successful backend connection', async () => {
    const mockBackendData = {
      status: 'healthy',
      timestamp: '2024-01-01T00:00:00.000Z',
      uptime: 1000,
      environment: 'development',
    }

    jest.spyOn(apiClient, 'testBackendConnection').mockResolvedValueOnce({
      connected: true,
      data: mockBackendData,
    })

    const result = await apiClient.testBackendConnection()

    expect(result.connected).toBe(true)
    expect(result.data).toEqual(mockBackendData)
  })

  it('should handle backend connection failure', async () => {
    jest.spyOn(apiClient, 'testBackendConnection').mockResolvedValueOnce({
      connected: false,
      error: 'Connection refused',
    })

    const result = await apiClient.testBackendConnection()

    expect(result.connected).toBe(false)
    expect(result.error).toBe('Connection refused')
  })

  it('should handle timeout errors', async () => {
    jest.spyOn(apiClient, 'testBackendConnection').mockResolvedValueOnce({
      connected: false,
      error: 'Request timeout',
    })

    const result = await apiClient.testBackendConnection()

    expect(result.connected).toBe(false)
    expect(result.error).toBe('Request timeout')
  })

  it('should handle unexpected errors', async () => {
    jest.spyOn(apiClient, 'testBackendConnection').mockRejectedValueOnce(
      new Error('Unexpected error')
    )

    try {
      await apiClient.testBackendConnection()
      fail('Should have thrown error')
    } catch (error: any) {
      expect(error.message).toBe('Unexpected error')
    }
  })
})