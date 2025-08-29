import React, { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'

// Simple wrapper without complex providers
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>
}

// Custom render function
const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => {
  return render(ui, { wrapper: AllTheProviders, ...options })
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

// Wait utilities
export const waitForAsync = () => new Promise(resolve => setImmediate(resolve))

export const waitFor = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))