import React, { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { Providers } from '@/components/providers/Providers'

// Custom render function that includes providers
const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => {
  return render(ui, { wrapper: Providers, ...options })
}

// Re-export everything
export * from '@testing-library/react'
export { customRender as render }

// Mock data generators
export const mockUser = (overrides = {}) => ({
  id: '1',
  email: 'test@example.com',
  name: 'Test User',
  role: 'user',
  createdAt: new Date().toISOString(),
  ...overrides,
})

export const mockService = (overrides = {}) => ({
  id: '1',
  name: 'Test Service',
  status: 'running',
  container: 'test-container',
  cpu: 10,
  memory: 256,
  uptime: 1000,
  ...overrides,
})

export const mockAccount = (overrides = {}) => ({
  id: '1',
  name: 'Test Account',
  type: 'checking',
  balance: 1000,
  currency: 'USD',
  ...overrides,
})

export const mockAlert = (overrides = {}) => ({
  id: '1',
  title: 'Test Alert',
  message: 'This is a test alert',
  type: 'info',
  createdAt: new Date().toISOString(),
  ...overrides,
})

// API response mocks
export const mockApiResponse = (data: any, status = 200) => ({
  data,
  status,
  statusText: 'OK',
  headers: {},
  config: {},
})

export const mockApiError = (message = 'API Error', status = 500) => ({
  response: {
    data: { error: message },
    status,
    statusText: 'Internal Server Error',
    headers: {},
    config: {},
  },
  message,
})

// Wait utilities
export const waitForAsync = () => new Promise(resolve => setImmediate(resolve))

export const waitFor = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))