import axios from 'axios'

// Create mock axios instance
export const createMockAxiosInstance = () => {
  const mockInstance = {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    patch: jest.fn(),
    request: jest.fn(),
    interceptors: {
      request: {
        use: jest.fn((success, error) => {
          return 0 // Return an ID for the interceptor
        }),
        eject: jest.fn(),
      },
      response: {
        use: jest.fn((success, error) => {
          return 0 // Return an ID for the interceptor
        }),
        eject: jest.fn(),
      },
    },
    defaults: {
      headers: {
        common: {},
        get: {},
        post: {},
        put: {},
        delete: {},
        patch: {},
      },
    },
  }
  
  return mockInstance
}

// Mock axios.create to return our mock instance
export const setupAxiosMock = () => {
  const mockInstance = createMockAxiosInstance()
  
  ;(axios.create as jest.Mock) = jest.fn(() => mockInstance)
  ;(axios.get as jest.Mock) = jest.fn()
  ;(axios.post as jest.Mock) = jest.fn()
  ;(axios.put as jest.Mock) = jest.fn()
  ;(axios.delete as jest.Mock) = jest.fn()
  
  return mockInstance
}

// Helper to reset all mocks
export const resetAxiosMocks = () => {
  jest.clearAllMocks()
}

// Common response mocks
export const mockSuccessResponse = (data: any) => 
  Promise.resolve({ data, status: 200, statusText: 'OK' })

export const mockErrorResponse = (status: number, message: string) =>
  Promise.reject({
    response: {
      status,
      data: { error: message },
    },
  })

export const mockNetworkError = () =>
  Promise.reject(new Error('Network Error'))