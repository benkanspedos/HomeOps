import { z } from 'zod';

// DNS Status Schema
export const PiHoleStatusSchema = z.object({
  status: z.string(),
  dns_queries_today: z.number(),
  ads_blocked_today: z.number(),
  ads_percentage_today: z.number(),
  unique_clients: z.number(),
  queries_forwarded: z.number(),
  queries_cached: z.number(),
  reply_NODATA: z.number(),
  reply_NXDOMAIN: z.number(),
  reply_CNAME: z.number(),
  reply_IP: z.number(),
  privacy_level: z.number(),
  gravity_last_updated: z.object({
    file_exists: z.boolean(),
    absolute: z.number(),
    relative: z.object({
      days: z.number(),
      hours: z.number(),
      minutes: z.number()
    })
  })
});

export const DNSStatusResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    connected: z.boolean(),
    status: PiHoleStatusSchema,
    timestamp: z.string()
  })
});

// Domain Schema
export const DomainSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  domain: z.string(),
  blocked: z.boolean(),
  comment: z.string().optional(),
  listType: z.enum(['black', 'white']).optional(),
  enabled: z.number().optional(),
  date_added: z.number().optional(),
  date_modified: z.number().optional(),
  groups: z.array(z.number()).optional()
});

export const DomainsResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    domains: z.array(DomainSchema),
    total: z.number(),
    timestamp: z.string()
  })
});

// Query Schema
export const DNSQuerySchema = z.object({
  id: z.string().optional(),
  timestamp: z.number(),
  type: z.string(),
  domain: z.string(),
  client: z.string(),
  answer_type: z.string().optional(),
  reply_type: z.string().optional(),
  reply_time: z.number().optional(),
  dnssec: z.string().optional(),
  status: z.string(),
  blocked: z.boolean().optional()
});

export const QueriesResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    queries: z.array(DNSQuerySchema),
    limit: z.number(),
    offset: z.number(),
    total: z.number(),
    timestamp: z.string()
  })
});

// Performance Metrics Schema
export const PerformanceMetricsSchema = z.object({
  queries_today: z.number(),
  blocked_today: z.number(),
  percent_blocked: z.number(),
  unique_clients: z.number(),
  queries_forwarded: z.number(),
  queries_cached: z.number(),
  average_response_time: z.number(),
  cache_hit_rate: z.number(),
  uptime: z.number()
});

export const PerformanceResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    metrics: PerformanceMetricsSchema,
    timestamp: z.string()
  })
});

// Top Items Schema
export const TopItemSchema = z.object({
  domain: z.string(),
  count: z.number()
});

export const TopItemsResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    topQueries: z.array(TopItemSchema).optional(),
    topBlocked: z.array(TopItemSchema).optional(),
    limit: z.number(),
    timestamp: z.string()
  })
});

// Form Schemas
export const AddDomainSchema = z.object({
  domain: z.string()
    .min(1, 'Domain is required')
    .regex(/^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i, 'Invalid domain format'),
  listType: z.enum(['black', 'white']).default('black'),
  comment: z.string().optional()
});

export const BlockDomainSchema = z.object({
  block: z.boolean()
});

export const DNSFilterSchema = z.object({
  listType: z.enum(['all', 'black', 'white']).optional(),
  search: z.string().optional(),
  blocked: z.boolean().optional()
});

export const QueryFilterSchema = z.object({
  limit: z.number().min(1).max(100).default(100),
  offset: z.number().min(0).default(0),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  blocked: z.boolean().optional(),
  client: z.string().optional(),
  search: z.string().optional()
});

// Type exports
export type PiHoleStatus = z.infer<typeof PiHoleStatusSchema>;
export type DNSStatusResponse = z.infer<typeof DNSStatusResponseSchema>;
export type Domain = z.infer<typeof DomainSchema>;
export type DomainsResponse = z.infer<typeof DomainsResponseSchema>;
export type DNSQuery = z.infer<typeof DNSQuerySchema>;
export type QueriesResponse = z.infer<typeof QueriesResponseSchema>;
export type PerformanceMetrics = z.infer<typeof PerformanceMetricsSchema>;
export type PerformanceResponse = z.infer<typeof PerformanceResponseSchema>;
export type TopItem = z.infer<typeof TopItemSchema>;
export type TopItemsResponse = z.infer<typeof TopItemsResponseSchema>;
export type AddDomainInput = z.infer<typeof AddDomainSchema>;
export type BlockDomainInput = z.infer<typeof BlockDomainSchema>;
export type DNSFilter = z.infer<typeof DNSFilterSchema>;
export type QueryFilter = z.infer<typeof QueryFilterSchema>;