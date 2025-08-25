import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config';
import { logger } from '../utils/logger';
import { Database } from '../types/database';

let supabaseClient: SupabaseClient<Database> | null = null;

export const initializeDatabase = async (): Promise<void> => {
  try {
    if (!config.database.supabase.url || !config.database.supabase.serviceKey) {
      throw new Error('Missing Supabase configuration');
    }

    supabaseClient = createClient<Database>(
      config.database.supabase.url,
      config.database.supabase.serviceKey,
      {
        auth: {
          autoRefreshToken: true,
          persistSession: false,
        },
        global: {
          headers: {
            'x-application': 'homeops-backend',
          },
        },
      }
    );

    // Test the connection
    const { error } = await supabaseClient.from('users').select('count').limit(1);
    
    if (error) {
      throw error;
    }

    logger.info('Supabase connection established successfully');
  } catch (error) {
    logger.error('Failed to initialize Supabase:', error);
    throw error;
  }
};

export const getSupabaseClient = (): SupabaseClient<Database> => {
  if (!supabaseClient) {
    throw new Error('Supabase client not initialized. Call initializeDatabase first.');
  }
  return supabaseClient;
};

export const closeDatabase = async (): Promise<void> => {
  if (supabaseClient) {
    // Supabase client doesn't have an explicit close method
    // but we can clear the reference
    supabaseClient = null;
    logger.info('Supabase connection closed');
  }
};

// Helper function for transactions (Supabase doesn't support traditional transactions)
export const withTransaction = async <T>(
  callback: (client: SupabaseClient<Database>) => Promise<T>
): Promise<T> => {
  const client = getSupabaseClient();
  try {
    return await callback(client);
  } catch (error) {
    logger.error('Transaction failed:', error);
    throw error;
  }
};

// Helper function for paginated queries
export const paginate = async <T>(
  table: string,
  options: {
    page?: number;
    limit?: number;
    orderBy?: string;
    ascending?: boolean;
    filters?: Record<string, any>;
  } = {}
) => {
  const {
    page = 1,
    limit = 10,
    orderBy = 'created_at',
    ascending = false,
    filters = {},
  } = options;

  const client = getSupabaseClient();
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = client.from(table).select('*', { count: 'exact' });

  // Apply filters
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      query = query.eq(key, value);
    }
  });

  // Apply ordering
  query = query.order(orderBy, { ascending });

  // Apply pagination
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) {
    throw error;
  }

  return {
    data: data || [],
    pagination: {
      page,
      limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit),
    },
  };
};