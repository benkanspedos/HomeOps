// Database types generated from Supabase schema
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          preferences: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          preferences?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          preferences?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      accounts: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          type: 'bank' | 'investment' | 'crypto' | 'other';
          institution: string | null;
          account_number: string | null;
          balance: number;
          currency: string;
          api_config: Json;
          is_active: boolean;
          last_synced: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          type: 'bank' | 'investment' | 'crypto' | 'other';
          institution?: string | null;
          account_number?: string | null;
          balance?: number;
          currency?: string;
          api_config?: Json;
          is_active?: boolean;
          last_synced?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          type?: 'bank' | 'investment' | 'crypto' | 'other';
          institution?: string | null;
          account_number?: string | null;
          balance?: number;
          currency?: string;
          api_config?: Json;
          is_active?: boolean;
          last_synced?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      transactions: {
        Row: {
          id: string;
          account_id: string;
          type: 'deposit' | 'withdrawal' | 'transfer' | 'trade' | 'fee' | 'dividend' | 'interest';
          amount: number;
          currency: string;
          description: string | null;
          category: string | null;
          metadata: Json;
          external_id: string | null;
          transaction_date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          type: 'deposit' | 'withdrawal' | 'transfer' | 'trade' | 'fee' | 'dividend' | 'interest';
          amount: number;
          currency?: string;
          description?: string | null;
          category?: string | null;
          metadata?: Json;
          external_id?: string | null;
          transaction_date: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          type?: 'deposit' | 'withdrawal' | 'transfer' | 'trade' | 'fee' | 'dividend' | 'interest';
          amount?: number;
          currency?: string;
          description?: string | null;
          category?: string | null;
          metadata?: Json;
          external_id?: string | null;
          transaction_date?: string;
          created_at?: string;
        };
      };
      alerts: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          severity: 'info' | 'warning' | 'error' | 'critical';
          condition_type: string;
          condition_config: Json;
          notification_channels: Json;
          is_active: boolean;
          last_triggered: string | null;
          trigger_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          description?: string | null;
          severity: 'info' | 'warning' | 'error' | 'critical';
          condition_type: string;
          condition_config: Json;
          notification_channels?: Json;
          is_active?: boolean;
          last_triggered?: string | null;
          trigger_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          description?: string | null;
          severity?: 'info' | 'warning' | 'error' | 'critical';
          condition_type?: string;
          condition_config?: Json;
          notification_channels?: Json;
          is_active?: boolean;
          last_triggered?: string | null;
          trigger_count?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      services: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          container_name: string;
          image: string;
          status: 'running' | 'stopped' | 'error' | 'unknown';
          health_check_url: string | null;
          ports: Json;
          environment: Json;
          labels: Json;
          last_health_check: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          container_name: string;
          image: string;
          status?: 'running' | 'stopped' | 'error' | 'unknown';
          health_check_url?: string | null;
          ports?: Json;
          environment?: Json;
          labels?: Json;
          last_health_check?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          container_name?: string;
          image?: string;
          status?: 'running' | 'stopped' | 'error' | 'unknown';
          health_check_url?: string | null;
          ports?: Json;
          environment?: Json;
          labels?: Json;
          last_health_check?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      account_summary: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          type: 'bank' | 'investment' | 'crypto' | 'other';
          institution: string | null;
          balance: number;
          currency: string;
          is_active: boolean;
          last_synced: string | null;
          transaction_count: number | null;
          last_transaction_date: string | null;
        };
      };
    };
    Functions: {
      validate_api_key: {
        Args: {
          key_prefix: string;
          key_hash: string;
        };
        Returns: {
          user_id: string;
          permissions: Json;
        }[];
      };
      check_service_health: {
        Args: {
          service_id: string;
        };
        Returns: void;
      };
    };
    Enums: {
      account_type: 'bank' | 'investment' | 'crypto' | 'other';
      transaction_type: 'deposit' | 'withdrawal' | 'transfer' | 'trade' | 'fee' | 'dividend' | 'interest';
      alert_severity: 'info' | 'warning' | 'error' | 'critical';
      service_status: 'running' | 'stopped' | 'error' | 'unknown';
      automation_status: 'active' | 'paused' | 'disabled';
    };
  };
}