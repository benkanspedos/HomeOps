export interface User {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  preferences?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: 'bank' | 'investment' | 'crypto' | 'other';
  institution?: string;
  account_number?: string;
  balance: number;
  currency: string;
  api_config?: Record<string, any>;
  is_active: boolean;
  last_synced?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface Transaction {
  id: string;
  account_id: string;
  type: 'deposit' | 'withdrawal' | 'transfer' | 'trade' | 'fee' | 'dividend' | 'interest';
  amount: number;
  currency: string;
  description?: string;
  category?: string;
  metadata?: Record<string, any>;
  external_id?: string;
  transaction_date: Date;
  created_at: Date;
}

export interface Alert {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  condition_type: string;
  condition_config: Record<string, any>;
  notification_channels: string[];
  is_active: boolean;
  last_triggered?: Date;
  trigger_count: number;
  created_at: Date;
  updated_at: Date;
}

export interface Service {
  id: string;
  user_id: string;
  name: string;
  container_name: string;
  image: string;
  status: 'running' | 'stopped' | 'error' | 'unknown';
  health_check_url?: string;
  ports?: Array<{ host: number; container: number }>;
  environment?: Record<string, string>;
  labels?: Record<string, string>;
  last_health_check?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface Automation {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  trigger_type: 'schedule' | 'event' | 'condition';
  trigger_config: Record<string, any>;
  actions: Array<{
    type: string;
    config: Record<string, any>;
  }>;
  status: 'active' | 'paused' | 'disabled';
  last_run?: Date;
  next_run?: Date;
  run_count: number;
  created_at: Date;
  updated_at: Date;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}

export interface JWTPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}