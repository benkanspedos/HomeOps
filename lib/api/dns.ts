import { 
  DNSStatusResponse, 
  DomainsResponse, 
  QueriesResponse, 
  PerformanceResponse, 
  TopItemsResponse,
  AddDomainInput,
  BlockDomainInput,
  QueryFilter,
  DNSFilter
} from '@/types/dns';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3101/api';

class APIError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'APIError';
  }
}

async function fetchAPI<T>(
  endpoint: string, 
  options?: RequestInit
): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options?.headers,
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new APIError(response.status, data.error || 'An error occurred');
  }
  
  return data;
}

export const dnsAPI = {
  // Status endpoints
  async getStatus(): Promise<DNSStatusResponse> {
    return fetchAPI<DNSStatusResponse>('/dns/status');
  },

  async getPerformance(): Promise<PerformanceResponse> {
    return fetchAPI<PerformanceResponse>('/dns/performance');
  },

  // Domain management
  async getDomains(filter?: DNSFilter): Promise<DomainsResponse> {
    const params = new URLSearchParams();
    if (filter?.listType) params.append('listType', filter.listType);
    if (filter?.search) params.append('search', filter.search);
    if (filter?.blocked !== undefined) params.append('blocked', String(filter.blocked));
    
    const queryString = params.toString();
    return fetchAPI<DomainsResponse>(`/dns/domains${queryString ? `?${queryString}` : ''}`);
  },

  async addDomain(input: AddDomainInput): Promise<{ success: boolean; data: any }> {
    return fetchAPI('/dns/domains', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async removeDomain(domain: string, listType: 'black' | 'white' = 'black'): Promise<{ success: boolean }> {
    return fetchAPI(`/dns/domains/${encodeURIComponent(domain)}?listType=${listType}`, {
      method: 'DELETE',
    });
  },

  async blockDomain(domain: string, input: BlockDomainInput): Promise<{ success: boolean }> {
    return fetchAPI(`/dns/domains/${encodeURIComponent(domain)}/block`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },

  // Query history
  async getQueries(filter?: QueryFilter): Promise<QueriesResponse> {
    const params = new URLSearchParams();
    if (filter?.limit) params.append('limit', String(filter.limit));
    if (filter?.offset) params.append('offset', String(filter.offset));
    if (filter?.blocked !== undefined) params.append('blocked', String(filter.blocked));
    if (filter?.client) params.append('client', filter.client);
    if (filter?.search) params.append('search', filter.search);
    
    const queryString = params.toString();
    return fetchAPI<QueriesResponse>(`/dns/queries${queryString ? `?${queryString}` : ''}`);
  },

  // Top items
  async getTopQueries(limit: number = 10): Promise<TopItemsResponse> {
    return fetchAPI<TopItemsResponse>(`/dns/top-queries?limit=${limit}`);
  },

  async getTopBlocked(limit: number = 10): Promise<TopItemsResponse> {
    return fetchAPI<TopItemsResponse>(`/dns/top-blocked?limit=${limit}`);
  },

  // Blocking control
  async setBlockingStatus(enabled: boolean, duration?: number): Promise<{ success: boolean }> {
    return fetchAPI('/dns/blocking', {
      method: 'POST',
      body: JSON.stringify({ enabled, duration }),
    });
  },

  // Historical stats
  async getHistoricalStats(period: string = '24h'): Promise<any> {
    return fetchAPI(`/dns/stats/history?period=${period}`);
  },

  // Export queries to CSV
  exportQueriesToCSV(queries: any[]): string {
    const headers = ['Timestamp', 'Domain', 'Client', 'Type', 'Status', 'Response Time'];
    const rows = queries.map(q => [
      new Date(q.timestamp * 1000).toLocaleString(),
      q.domain,
      q.client,
      q.type,
      q.status,
      q.reply_time || 'N/A'
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    return csvContent;
  },

  downloadCSV(content: string, filename: string = 'dns-queries.csv'): void {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

export default dnsAPI;