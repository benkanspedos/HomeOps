import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import toast from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3101/api';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true,
    });

    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        const token = this.getToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Handle unauthorized access
          this.clearToken();
          window.location.href = '/login';
        } else if (error.response?.status === 500) {
          toast.error('Server error. Please try again later.');
        }
        return Promise.reject(error);
      }
    );
  }

  private getToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('auth_token');
    }
    return null;
  }

  private setToken(token: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_token', token);
    }
  }

  private clearToken(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
    }
  }

  // Generic request method
  async request<T = any>(config: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.request(config);
    return response.data;
  }

  // Convenience methods
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: 'GET', url });
  }

  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: 'POST', url, data });
  }

  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: 'PUT', url, data });
  }

  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: 'DELETE', url });
  }

  // Authentication methods
  async login(email: string, password: string): Promise<{ token: string; user: any }> {
    const response = await this.post<{ token: string; user: any }>('/auth/login', {
      email,
      password,
    });
    this.setToken(response.token);
    return response;
  }

  async logout(): Promise<void> {
    await this.post('/auth/logout');
    this.clearToken();
  }

  // Resource-specific methods
  async getAccounts() {
    return this.get('/accounts');
  }

  async getAccount(id: string) {
    return this.get(`/accounts/${id}`);
  }

  async createAccount(data: any) {
    return this.post('/accounts', data);
  }

  async updateAccount(id: string, data: any) {
    return this.put(`/accounts/${id}`, data);
  }

  async deleteAccount(id: string) {
    return this.delete(`/accounts/${id}`);
  }

  async getServices() {
    return this.get('/services');
  }

  async getService(id: string) {
    return this.get(`/services/${id}`);
  }

  async restartService(id: string) {
    return this.post(`/services/${id}/restart`);
  }

  async stopService(id: string) {
    return this.post(`/services/${id}/stop`);
  }

  async getAlerts() {
    return this.get('/alerts');
  }

  async createAlert(data: any) {
    return this.post('/alerts', data);
  }

  async updateAlert(id: string, data: any) {
    return this.put(`/alerts/${id}`, data);
  }

  async deleteAlert(id: string) {
    return this.delete(`/alerts/${id}`);
  }

  async getHealth() {
    return this.get('/health');
  }
}

export const apiClient = new ApiClient();

// Test backend connection function
export const testBackendConnection = async () => {
  try {
    // Note: Backend health endpoint is at root, not under /api
    const response = await axios.get('http://localhost:3101/health');
    return {
      connected: true,
      data: response.data,
    };
  } catch (error: any) {
    console.error('Backend connection failed:', error);
    return {
      connected: false,
      error: error.message || 'Connection failed',
    };
  }
};