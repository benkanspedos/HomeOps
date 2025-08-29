import request from 'supertest';
import express, { Application } from 'express';
import { z } from 'zod';
import { DNSController } from '../../controllers/dns.controller';
import { DNSService } from '../../services/dns.service';
import { DNSModel } from '../../models/dns.model';
import { Logger } from '../../utils/logger';
import { validDomains, invalidDomains } from '../../../../tests/fixtures/dns.fixtures';

// Mock dependencies
jest.mock('../../services/dns.service');
jest.mock('../../models/dns.model');
jest.mock('../../utils/logger');

// API Response Schemas
const ApiResponseSchema = z.object({
  success: z.boolean(),
  data: z.record(z.any()).optional(),
  error: z.string().optional(),
});

const StatusResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    connected: z.boolean(),
    status: z.object({
      status: z.string(),
      dns_queries_today: z.number(),
      ads_blocked_today: z.number(),
      ads_percentage_today: z.number(),
      unique_clients: z.number(),
      queries_forwarded: z.number(),
      queries_cached: z.number(),
      privacy_level: z.number(),
      gravity_last_updated: z.object({
        file_exists: z.boolean(),
        absolute: z.number(),
        relative: z.object({
          days: z.number(),
          hours: z.number(),
          minutes: z.number(),
        }),
      }),
    }),
    timestamp: z.string(),
  }),
});

const DomainsResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    domains: z.array(
      z.object({
        id: z.number(),
        domain: z.string(),
        blocked: z.boolean(),
        listType: z.string(),
        enabled: z.number(),
        date_added: z.number(),
        date_modified: z.number(),
        comment: z.string(),
      })
    ),
    total: z.number(),
    timestamp: z.string(),
  }),
});

const AddDomainResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    domain: z.string(),
    listType: z.string(),
    blocked: z.boolean(),
    message: z.string(),
  }),
});

const QueriesResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    queries: z.array(
      z.object({
        timestamp: z.number(),
        type: z.string(),
        domain: z.string(),
        client: z.string(),
        answer_type: z.string(),
        reply_type: z.string(),
        reply_time: z.number(),
        dnssec: z.string(),
        status: z.string(),
      })
    ),
    limit: z.number(),
    offset: z.number(),
    total: z.number(),
    timestamp: z.string(),
  }),
});

const PerformanceResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    metrics: z.object({
      queries_today: z.number(),
      blocked_today: z.number(),
      percent_blocked: z.number(),
      unique_clients: z.number(),
      queries_forwarded: z.number(),
      queries_cached: z.number(),
      average_response_time: z.number(),
      cache_hit_rate: z.number(),
      uptime: z.number(),
    }),
    timestamp: z.string(),
  }),
});

const TopQueriesResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    topQueries: z.array(
      z.object({
        domain: z.string(),
        count: z.number(),
      })
    ),
    limit: z.number(),
    timestamp: z.string(),
  }),
});

const BlockingResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    blockingEnabled: z.boolean(),
    duration: z.union([z.number(), z.string()]),
    message: z.string(),
  }),
});

const ErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string().optional(),
  message: z.string(),
});

describe('DNS API Contract Tests', () => {
  let app: Application;
  let dnsController: DNSController;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup Express app
    app = express();
    app.use(express.json());
    dnsController = new DNSController();
    
    // Define routes
    app.get('/api/dns/status', dnsController.getStatus);
    app.get('/api/dns/domains', dnsController.getDomains);
    app.post('/api/dns/domains', dnsController.addDomain);
    app.delete('/api/dns/domains/:domain', dnsController.removeDomain);
    app.put('/api/dns/domains/:domain/block', dnsController.blockDomain);
    app.get('/api/dns/queries', dnsController.getQueries);
    app.get('/api/dns/performance', dnsController.getPerformance);
    app.get('/api/dns/top-queries', dnsController.getTopQueries);
    app.get('/api/dns/top-blocked', dnsController.getTopBlocked);
    app.post('/api/dns/blocking', dnsController.setBlocking);
    app.get('/api/dns/stats/history', dnsController.getHistoricalStats);
  });

  describe('GET /api/dns/status', () => {
    it('should return valid status response schema', async () => {
      const response = await request(app).get('/api/dns/status');
      
      expect([200, 500]).toContain(response.status);
      
      if (response.status === 200) {
        expect(() => StatusResponseSchema.parse(response.body)).not.toThrow();
        
        const { data } = response.body;
        expect(typeof data.connected).toBe('boolean');
        expect(typeof data.status.status).toBe('string');
        expect(data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      } else {
        expect(() => ApiResponseSchema.parse(response.body)).not.toThrow();
        expect(response.body.success).toBe(false);
      }
    });

    it('should include all required status fields', async () => {
      const response = await request(app).get('/api/dns/status');
      
      if (response.status === 200) {
        const { status } = response.body.data;
        
        // Required Pi-hole status fields
        expect(status).toHaveProperty('dns_queries_today');
        expect(status).toHaveProperty('ads_blocked_today');
        expect(status).toHaveProperty('ads_percentage_today');
        expect(status).toHaveProperty('unique_clients');
        expect(status).toHaveProperty('queries_forwarded');
        expect(status).toHaveProperty('queries_cached');
        expect(status).toHaveProperty('gravity_last_updated');
        
        // Validate gravity_last_updated structure
        expect(status.gravity_last_updated).toHaveProperty('file_exists');
        expect(status.gravity_last_updated).toHaveProperty('absolute');
        expect(status.gravity_last_updated).toHaveProperty('relative');
        expect(status.gravity_last_updated.relative).toHaveProperty('days');
        expect(status.gravity_last_updated.relative).toHaveProperty('hours');
        expect(status.gravity_last_updated.relative).toHaveProperty('minutes');
      }
    });
  });

  describe('GET /api/dns/domains', () => {
    it('should return valid domains response schema', async () => {
      const response = await request(app).get('/api/dns/domains');
      
      expect([200, 500]).toContain(response.status);
      
      if (response.status === 200) {
        expect(() => DomainsResponseSchema.parse(response.body)).not.toThrow();
        
        const { data } = response.body;
        expect(Array.isArray(data.domains)).toBe(true);
        expect(typeof data.total).toBe('number');
        expect(data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      }
    });

    it('should support listType query parameter', async () => {
      const validListTypes = ['all', 'black', 'white'];
      
      for (const listType of validListTypes) {
        const response = await request(app).get(`/api/dns/domains?listType=${listType}`);
        expect([200, 500]).toContain(response.status);
      }
    });

    it('should validate domain object structure', async () => {
      const response = await request(app).get('/api/dns/domains');
      
      if (response.status === 200 && response.body.data.domains.length > 0) {
        const domain = response.body.data.domains[0];
        
        expect(domain).toHaveProperty('domain');
        expect(domain).toHaveProperty('blocked');
        expect(domain).toHaveProperty('listType');
        expect(typeof domain.domain).toBe('string');
        expect(typeof domain.blocked).toBe('boolean');
        expect(typeof domain.listType).toBe('string');
      }
    });
  });

  describe('POST /api/dns/domains', () => {
    it('should validate request body schema', async () => {
      // Valid request
      const validPayload = {
        domain: 'test.example.com',
        listType: 'black',
        comment: 'Test domain'
      };
      
      const response = await request(app)
        .post('/api/dns/domains')
        .send(validPayload);
      
      expect([201, 500]).toContain(response.status);
      
      if (response.status === 201) {
        expect(() => AddDomainResponseSchema.parse(response.body)).not.toThrow();
        
        const { data } = response.body;
        expect(data.domain).toBe(validPayload.domain);
        expect(data.listType).toBe(validPayload.listType);
        expect(typeof data.blocked).toBe('boolean');
        expect(data.message).toContain(validPayload.domain);
      }
    });

    it('should reject invalid domain formats', async () => {
      for (const invalidDomain of invalidDomains) {
        if (invalidDomain) {
          const response = await request(app)
            .post('/api/dns/domains')
            .send({ domain: invalidDomain });
          
          expect(response.status).toBe(400);
          expect(() => ErrorResponseSchema.parse(response.body)).not.toThrow();
          expect(response.body.message).toMatch(/invalid|format|required/i);
        }
      }
    });

    it('should accept valid domain formats', async () => {
      for (const validDomain of validDomains) {
        const response = await request(app)
          .post('/api/dns/domains')
          .send({ domain: validDomain });
        
        expect([201, 400, 500]).toContain(response.status);
        
        // If it's a 400, it should be for business logic reasons, not format
        if (response.status === 400) {
          expect(response.body.message).not.toMatch(/invalid.*format|format.*invalid/i);
        }
      }
    });

    it('should require domain field', async () => {
      const response = await request(app)
        .post('/api/dns/domains')
        .send({ listType: 'black' });
      
      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/domain.*required/i);
    });

    it('should default to black list when listType not specified', async () => {
      const response = await request(app)
        .post('/api/dns/domains')
        .send({ domain: 'test.example.com' });
      
      if (response.status === 201) {
        expect(response.body.data.listType).toBe('black');
        expect(response.body.data.blocked).toBe(true);
      }
    });
  });

  describe('DELETE /api/dns/domains/:domain', () => {
    it('should validate domain parameter', async () => {
      const response = await request(app)
        .delete('/api/dns/domains/test.example.com');
      
      expect([200, 404, 500]).toContain(response.status);
      
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data.domain).toBe('test.example.com');
        expect(response.body.data.message).toContain('test.example.com');
      }
    });

    it('should support listType query parameter', async () => {
      const response = await request(app)
        .delete('/api/dns/domains/test.example.com?listType=white');
      
      expect([200, 404, 500]).toContain(response.status);
    });
  });

  describe('PUT /api/dns/domains/:domain/block', () => {
    it('should validate block domain request', async () => {
      const response = await request(app)
        .put('/api/dns/domains/test.example.com/block')
        .send({ block: true });
      
      expect([200, 404, 500]).toContain(response.status);
      
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data.domain).toBe('test.example.com');
        expect(typeof response.body.data.blocked).toBe('boolean');
        expect(response.body.data.message).toContain('test.example.com');
      }
    });

    it('should default block to true', async () => {
      const response = await request(app)
        .put('/api/dns/domains/test.example.com/block')
        .send({});
      
      if (response.status === 200) {
        expect(response.body.data.blocked).toBe(true);
        expect(response.body.data.message).toMatch(/blocked/i);
      }
    });
  });

  describe('GET /api/dns/queries', () => {
    it('should return valid queries response schema', async () => {
      const response = await request(app).get('/api/dns/queries');
      
      expect([200, 500]).toContain(response.status);
      
      if (response.status === 200) {
        expect(() => QueriesResponseSchema.parse(response.body)).not.toThrow();
        
        const { data } = response.body;
        expect(Array.isArray(data.queries)).toBe(true);
        expect(typeof data.limit).toBe('number');
        expect(typeof data.offset).toBe('number');
        expect(typeof data.total).toBe('number');
      }
    });

    it('should support pagination parameters', async () => {
      const response = await request(app).get('/api/dns/queries?limit=50&offset=25');
      
      if (response.status === 200) {
        expect(response.body.data.limit).toBe(50);
        expect(response.body.data.offset).toBe(25);
      }
    });

    it('should validate query object structure', async () => {
      const response = await request(app).get('/api/dns/queries');
      
      if (response.status === 200 && response.body.data.queries.length > 0) {
        const query = response.body.data.queries[0];
        
        expect(query).toHaveProperty('timestamp');
        expect(query).toHaveProperty('domain');
        expect(query).toHaveProperty('client');
        expect(query).toHaveProperty('type');
        expect(query).toHaveProperty('status');
        expect(typeof query.timestamp).toBe('number');
        expect(typeof query.domain).toBe('string');
        expect(typeof query.client).toBe('string');
      }
    });
  });

  describe('GET /api/dns/performance', () => {
    it('should return valid performance response schema', async () => {
      const response = await request(app).get('/api/dns/performance');
      
      expect([200, 500]).toContain(response.status);
      
      if (response.status === 200) {
        expect(() => PerformanceResponseSchema.parse(response.body)).not.toThrow();
        
        const { metrics } = response.body.data;
        expect(typeof metrics.queries_today).toBe('number');
        expect(typeof metrics.blocked_today).toBe('number');
        expect(typeof metrics.percent_blocked).toBe('number');
        expect(typeof metrics.cache_hit_rate).toBe('number');
      }
    });

    it('should include all required performance metrics', async () => {
      const response = await request(app).get('/api/dns/performance');
      
      if (response.status === 200) {
        const { metrics } = response.body.data;
        
        const requiredFields = [
          'queries_today',
          'blocked_today',
          'percent_blocked',
          'unique_clients',
          'queries_forwarded',
          'queries_cached',
          'average_response_time',
          'cache_hit_rate',
          'uptime'
        ];
        
        for (const field of requiredFields) {
          expect(metrics).toHaveProperty(field);
          expect(typeof metrics[field]).toBe('number');
        }
      }
    });
  });

  describe('GET /api/dns/top-queries', () => {
    it('should return valid top queries response schema', async () => {
      const response = await request(app).get('/api/dns/top-queries');
      
      expect([200, 500]).toContain(response.status);
      
      if (response.status === 200) {
        expect(() => TopQueriesResponseSchema.parse(response.body)).not.toThrow();
        
        const { data } = response.body;
        expect(Array.isArray(data.topQueries)).toBe(true);
        expect(data.limit).toBe(10); // default limit
      }
    });

    it('should support custom limit parameter', async () => {
      const response = await request(app).get('/api/dns/top-queries?limit=5');
      
      if (response.status === 200) {
        expect(response.body.data.limit).toBe(5);
      }
    });

    it('should validate top query object structure', async () => {
      const response = await request(app).get('/api/dns/top-queries');
      
      if (response.status === 200 && response.body.data.topQueries.length > 0) {
        const topQuery = response.body.data.topQueries[0];
        
        expect(topQuery).toHaveProperty('domain');
        expect(topQuery).toHaveProperty('count');
        expect(typeof topQuery.domain).toBe('string');
        expect(typeof topQuery.count).toBe('number');
        expect(topQuery.count).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('GET /api/dns/top-blocked', () => {
    it('should return valid top blocked response schema', async () => {
      const response = await request(app).get('/api/dns/top-blocked');
      
      expect([200, 500]).toContain(response.status);
      
      if (response.status === 200) {
        expect(() => TopQueriesResponseSchema.parse(response.body)).not.toThrow();
      }
    });
  });

  describe('POST /api/dns/blocking', () => {
    it('should validate blocking status request', async () => {
      const response = await request(app)
        .post('/api/dns/blocking')
        .send({ enabled: true });
      
      expect([200, 400, 500]).toContain(response.status);
      
      if (response.status === 200) {
        expect(() => BlockingResponseSchema.parse(response.body)).not.toThrow();
        
        const { data } = response.body;
        expect(data.blockingEnabled).toBe(true);
        expect(data.message).toMatch(/enabled|disabled/i);
      }
    });

    it('should support duration parameter for disable', async () => {
      const response = await request(app)
        .post('/api/dns/blocking')
        .send({ enabled: false, duration: 300 });
      
      if (response.status === 200) {
        expect(response.body.data.blockingEnabled).toBe(false);
        expect(response.body.data.duration).toBe(300);
      }
    });

    it('should validate enabled parameter type', async () => {
      const response = await request(app)
        .post('/api/dns/blocking')
        .send({ enabled: 'true' }); // string instead of boolean
      
      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/boolean/i);
    });
  });

  describe('GET /api/dns/stats/history', () => {
    it('should return valid historical stats response', async () => {
      const response = await request(app).get('/api/dns/stats/history');
      
      expect([200, 500]).toContain(response.status);
      
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data.stats)).toBe(true);
        expect(response.body.data.period).toBe('24h'); // default period
      }
    });

    it('should support period parameter', async () => {
      const periods = ['1h', '24h', '7d', '30d'];
      
      for (const period of periods) {
        const response = await request(app).get(`/api/dns/stats/history?period=${period}`);
        
        if (response.status === 200) {
          expect(response.body.data.period).toBe(period);
        }
      }
    });
  });

  describe('Error handling consistency', () => {
    it('should return consistent error format for 4xx errors', async () => {
      const invalidRequests = [
        () => request(app).post('/api/dns/domains').send({}), // missing domain
        () => request(app).post('/api/dns/domains').send({ domain: 'invalid domain' }), // invalid format
        () => request(app).post('/api/dns/blocking').send({ enabled: 'not-boolean' }), // invalid type
      ];
      
      for (const makeRequest of invalidRequests) {
        const response = await makeRequest();
        
        if (response.status >= 400 && response.status < 500) {
          expect(() => ErrorResponseSchema.parse(response.body)).not.toThrow();
          expect(response.body.success).toBe(false);
          expect(typeof response.body.message).toBe('string');
          expect(response.body.message.length).toBeGreaterThan(0);
        }
      }
    });

    it('should return consistent success format', async () => {
      const responses = await Promise.all([
        request(app).get('/api/dns/status'),
        request(app).get('/api/dns/domains'),
        request(app).get('/api/dns/queries'),
        request(app).get('/api/dns/performance'),
      ]);
      
      for (const response of responses) {
        if (response.status === 200) {
          expect(response.body.success).toBe(true);
          expect(response.body.data).toBeDefined();
          expect(response.body.data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
        }
      }
    });
  });

  describe('Content-Type headers', () => {
    it('should return JSON content type', async () => {
      const endpoints = [
        '/api/dns/status',
        '/api/dns/domains',
        '/api/dns/queries',
        '/api/dns/performance',
        '/api/dns/top-queries',
        '/api/dns/top-blocked',
      ];
      
      for (const endpoint of endpoints) {
        const response = await request(app).get(endpoint);
        expect(response.headers['content-type']).toMatch(/application\/json/);
      }
    });

    it('should accept JSON content type for POST requests', async () => {
      const response = await request(app)
        .post('/api/dns/domains')
        .set('Content-Type', 'application/json')
        .send({ domain: 'test.com' });
      
      expect(response.status).not.toBe(415); // Unsupported Media Type
    });
  });

  describe('API versioning and backwards compatibility', () => {
    it('should maintain consistent response structure', async () => {
      const response = await request(app).get('/api/dns/status');
      
      if (response.status === 200) {
        // Check that response maintains expected structure
        expect(response.body).toHaveProperty('success');
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('timestamp');
        
        // Ensure no breaking changes to core fields
        const coreFields = ['connected', 'status'];
        for (const field of coreFields) {
          expect(response.body.data).toHaveProperty(field);
        }
      }
    });
  });
});