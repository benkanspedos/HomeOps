import { supabase } from '../config/database';
import { Logger } from '../utils/logger';

export interface Domain {
  id?: string;
  domain: string;
  blocked: boolean;
  comment?: string;
  added_at: Date;
  updated_at: Date;
}

export interface DNSQuery {
  id?: string;
  domain: string;
  client_ip: string;
  query_type: string;
  timestamp: number;
  blocked: boolean;
  response_time?: number;
}

export interface DNSMetrics {
  id?: string;
  queries_today: number;
  blocked_today: number;
  avg_response_time: number;
  cache_hit_rate?: number;
  unique_clients?: number;
  timestamp: Date;
}

export class DNSModel {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('DNSModel');
    this.initializeTables();
  }

  /**
   * Initialize database tables if they don't exist
   */
  private async initializeTables(): Promise<void> {
    try {
      // Create domains table
      const domainsTable = `
        CREATE TABLE IF NOT EXISTS domains (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          domain VARCHAR(255) UNIQUE NOT NULL,
          blocked BOOLEAN DEFAULT false,
          comment TEXT,
          added_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_domains_domain ON domains(domain);
        CREATE INDEX IF NOT EXISTS idx_domains_blocked ON domains(blocked);
      `;

      // Create DNS queries table
      const queriesTable = `
        CREATE TABLE IF NOT EXISTS dns_queries (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          domain VARCHAR(255) NOT NULL,
          client_ip VARCHAR(45) NOT NULL,
          query_type VARCHAR(10),
          timestamp BIGINT NOT NULL,
          blocked BOOLEAN DEFAULT false,
          response_time INT,
          created_at TIMESTAMP DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_dns_queries_domain ON dns_queries(domain);
        CREATE INDEX IF NOT EXISTS idx_dns_queries_timestamp ON dns_queries(timestamp);
        CREATE INDEX IF NOT EXISTS idx_dns_queries_blocked ON dns_queries(blocked);
      `;

      // Create DNS metrics table
      const metricsTable = `
        CREATE TABLE IF NOT EXISTS dns_metrics (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          queries_today INT NOT NULL,
          blocked_today INT NOT NULL,
          avg_response_time FLOAT DEFAULT 0,
          cache_hit_rate FLOAT,
          unique_clients INT,
          timestamp TIMESTAMP DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_dns_metrics_timestamp ON dns_metrics(timestamp);
      `;

      // Execute table creation
      const { error: domainsError } = await supabase.rpc('exec_sql', {
        query: domainsTable
      });
      
      if (domainsError && !domainsError.message.includes('already exists')) {
        this.logger.warn('Domains table might already exist or RPC not configured');
      }

      const { error: queriesError } = await supabase.rpc('exec_sql', {
        query: queriesTable
      });
      
      if (queriesError && !queriesError.message.includes('already exists')) {
        this.logger.warn('DNS queries table might already exist or RPC not configured');
      }

      const { error: metricsError } = await supabase.rpc('exec_sql', {
        query: metricsTable
      });
      
      if (metricsError && !metricsError.message.includes('already exists')) {
        this.logger.warn('DNS metrics table might already exist or RPC not configured');
      }

      this.logger.info('DNS database tables initialized');
    } catch (error) {
      this.logger.error('Failed to initialize database tables', error);
    }
  }

  /**
   * Upsert domain to database
   */
  async upsertDomain(domain: string, blocked: boolean, comment?: string): Promise<Domain | null> {
    try {
      const { data, error } = await supabase
        .from('domains')
        .upsert({
          domain,
          blocked,
          comment,
          updated_at: new Date()
        }, {
          onConflict: 'domain'
        })
        .select()
        .single();

      if (error) {
        this.logger.error('Failed to upsert domain', error);
        return null;
      }

      return data;
    } catch (error) {
      this.logger.error('Failed to upsert domain', error);
      return null;
    }
  }

  /**
   * Delete domain from database
   */
  async deleteDomain(domain: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('domains')
        .delete()
        .eq('domain', domain);

      if (error) {
        this.logger.error('Failed to delete domain', error);
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('Failed to delete domain', error);
      return false;
    }
  }

  /**
   * Get all domains
   */
  async getAllDomains(blocked?: boolean): Promise<Domain[]> {
    try {
      let query = supabase.from('domains').select('*');
      
      if (blocked !== undefined) {
        query = query.eq('blocked', blocked);
      }

      const { data, error } = await query.order('domain');

      if (error) {
        this.logger.error('Failed to get domains', error);
        return [];
      }

      return data || [];
    } catch (error) {
      this.logger.error('Failed to get domains', error);
      return [];
    }
  }

  /**
   * Log DNS query
   */
  async logQuery(
    domain: string, 
    clientIp: string, 
    queryType: string, 
    timestamp: number, 
    blocked: boolean,
    responseTime?: number
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('dns_queries')
        .insert({
          domain,
          client_ip: clientIp,
          query_type: queryType,
          timestamp,
          blocked,
          response_time: responseTime
        });

      if (error) {
        this.logger.error('Failed to log DNS query', error);
      }
    } catch (error) {
      this.logger.error('Failed to log DNS query', error);
    }
  }

  /**
   * Get query history
   */
  async getQueryHistory(limit: number = 100, offset: number = 0): Promise<DNSQuery[]> {
    try {
      const { data, error } = await supabase
        .from('dns_queries')
        .select('*')
        .order('timestamp', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        this.logger.error('Failed to get query history', error);
        return [];
      }

      return data || [];
    } catch (error) {
      this.logger.error('Failed to get query history', error);
      return [];
    }
  }

  /**
   * Save DNS metrics
   */
  async saveMetrics(
    queriesToday: number, 
    blockedToday: number, 
    avgResponseTime: number,
    cacheHitRate?: number,
    uniqueClients?: number
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('dns_metrics')
        .insert({
          queries_today: queriesToday,
          blocked_today: blockedToday,
          avg_response_time: avgResponseTime,
          cache_hit_rate: cacheHitRate,
          unique_clients: uniqueClients
        });

      if (error) {
        this.logger.error('Failed to save DNS metrics', error);
      }
    } catch (error) {
      this.logger.error('Failed to save DNS metrics', error);
    }
  }

  /**
   * Get historical metrics
   */
  async getHistoricalMetrics(period: string = '24h'): Promise<DNSMetrics[]> {
    try {
      let since = new Date();
      
      switch (period) {
        case '1h':
          since.setHours(since.getHours() - 1);
          break;
        case '24h':
          since.setHours(since.getHours() - 24);
          break;
        case '7d':
          since.setDate(since.getDate() - 7);
          break;
        case '30d':
          since.setDate(since.getDate() - 30);
          break;
        default:
          since.setHours(since.getHours() - 24);
      }

      const { data, error } = await supabase
        .from('dns_metrics')
        .select('*')
        .gte('timestamp', since.toISOString())
        .order('timestamp', { ascending: true });

      if (error) {
        this.logger.error('Failed to get historical metrics', error);
        return [];
      }

      return data || [];
    } catch (error) {
      this.logger.error('Failed to get historical metrics', error);
      return [];
    }
  }

  /**
   * Get top blocked domains
   */
  async getTopBlockedDomains(limit: number = 10): Promise<Array<{domain: string; count: number}>> {
    try {
      const { data, error } = await supabase
        .from('dns_queries')
        .select('domain')
        .eq('blocked', true)
        .gte('timestamp', Date.now() - 86400000); // Last 24 hours

      if (error) {
        this.logger.error('Failed to get top blocked domains', error);
        return [];
      }

      // Count occurrences
      const domainCounts = new Map<string, number>();
      (data || []).forEach(row => {
        const count = domainCounts.get(row.domain) || 0;
        domainCounts.set(row.domain, count + 1);
      });

      // Sort and return top N
      return Array.from(domainCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([domain, count]) => ({ domain, count }));
    } catch (error) {
      this.logger.error('Failed to get top blocked domains', error);
      return [];
    }
  }

  /**
   * Get client statistics
   */
  async getClientStats(): Promise<Array<{client_ip: string; queries: number; blocked: number}>> {
    try {
      const { data, error } = await supabase
        .from('dns_queries')
        .select('client_ip, blocked')
        .gte('timestamp', Date.now() - 86400000); // Last 24 hours

      if (error) {
        this.logger.error('Failed to get client stats', error);
        return [];
      }

      // Aggregate by client
      const clientStats = new Map<string, {queries: number; blocked: number}>();
      (data || []).forEach(row => {
        const stats = clientStats.get(row.client_ip) || { queries: 0, blocked: 0 };
        stats.queries++;
        if (row.blocked) stats.blocked++;
        clientStats.set(row.client_ip, stats);
      });

      return Array.from(clientStats.entries())
        .map(([client_ip, stats]) => ({ client_ip, ...stats }))
        .sort((a, b) => b.queries - a.queries);
    } catch (error) {
      this.logger.error('Failed to get client stats', error);
      return [];
    }
  }
}