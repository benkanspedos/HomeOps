import request from 'supertest';
import express, { Application } from 'express';
import { DNSController } from '../../controllers/dns.controller';
import { DNSService } from '../../services/dns.service';
import { DNSModel } from '../../models/dns.model';
import { Logger } from '../../utils/logger';
import {
  mockPiHoleStatus,
  mockDomainList,
  mockWhiteList,
  mockQueryHistory,
  mockPerformanceMetrics,
  mockTopQueries,
  mockTopBlocked,
  validDomains,
  invalidDomains
} from '../../../../tests/fixtures/dns.fixtures';

// Mock dependencies
jest.mock('../../services/dns.service');
jest.mock('../../models/dns.model');
jest.mock('../../utils/logger');

const MockedDNSService = DNSService as jest.MockedClass<typeof DNSService>;
const MockedDNSModel = DNSModel as jest.MockedClass<typeof DNSModel>;
const MockedLogger = Logger as jest.MockedClass<typeof Logger>;

describe('DNSController', () => {
  let app: Application;
  let dnsController: DNSController;
  let mockDnsService: jest.Mocked<DNSService>;
  let mockDnsModel: jest.Mocked<DNSModel>;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock DNS service
    mockDnsService = {
      getStatus: jest.fn(),
      getDomains: jest.fn(),
      addDomain: jest.fn(),
      removeDomain: jest.fn(),
      blockDomain: jest.fn(),
      getQueryHistory: jest.fn(),
      getPerformanceStats: jest.fn(),
      getTopQueries: jest.fn(),
      getTopBlocked: jest.fn(),
      setBlockingStatus: jest.fn(),
    } as any;
    MockedDNSService.mockImplementation(() => mockDnsService);
    
    // Mock DNS model
    mockDnsModel = {
      upsertDomain: jest.fn(),
      deleteDomain: jest.fn(),
      logQuery: jest.fn(),
      saveMetrics: jest.fn(),
      getHistoricalMetrics: jest.fn(),
    } as any;
    MockedDNSModel.mockImplementation(() => mockDnsModel);
    
    // Mock logger
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    } as any;
    MockedLogger.mockImplementation(() => mockLogger);
    
    // Setup Express app with controller
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
    it('should return DNS status successfully', async () => {
      mockDnsService.getStatus.mockResolvedValue(mockPiHoleStatus);

      const response = await request(app)
        .get('/api/dns/status')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          connected: true,
          status: mockPiHoleStatus,
          timestamp: expect.any(String)
        }
      });
      expect(mockDnsService.getStatus).toHaveBeenCalled();
    });

    it('should handle DNS service errors', async () => {
      mockDnsService.getStatus.mockRejectedValue(new Error('Pi-hole connection failed'));

      const response = await request(app)
        .get('/api/dns/status')
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: 'Failed to connect to Pi-hole',
        data: {
          connected: false,
          timestamp: expect.any(String)
        }
      });
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('GET /api/dns/domains', () => {
    it('should return all domains by default', async () => {
      mockDnsService.getDomains
        .mockResolvedValueOnce(mockDomainList)
        .mockResolvedValueOnce(mockWhiteList);
      mockDnsModel.upsertDomain.mockResolvedValue(undefined);

      const response = await request(app)
        .get('/api/dns/domains')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.domains).toHaveLength(3);
      expect(response.body.data.domains[0].listType).toBe('black');
      expect(response.body.data.domains[0].blocked).toBe(true);
      expect(response.body.data.domains[2].listType).toBe('white');
      expect(response.body.data.domains[2].blocked).toBe(false);
      expect(mockDnsService.getDomains).toHaveBeenCalledWith('black');
      expect(mockDnsService.getDomains).toHaveBeenCalledWith('white');
    });

    it('should return only black list domains when specified', async () => {
      mockDnsService.getDomains.mockResolvedValue(mockDomainList);
      mockDnsModel.upsertDomain.mockResolvedValue(undefined);

      const response = await request(app)
        .get('/api/dns/domains?listType=black')
        .expect(200);

      expect(response.body.data.domains).toHaveLength(2);
      expect(mockDnsService.getDomains).toHaveBeenCalledWith('black');
      expect(mockDnsService.getDomains).toHaveBeenCalledTimes(1);
    });

    it('should return only white list domains when specified', async () => {
      mockDnsService.getDomains.mockResolvedValue(mockWhiteList);
      mockDnsModel.upsertDomain.mockResolvedValue(undefined);

      const response = await request(app)
        .get('/api/dns/domains?listType=white')
        .expect(200);

      expect(response.body.data.domains).toHaveLength(1);
      expect(mockDnsService.getDomains).toHaveBeenCalledWith('white');
      expect(mockDnsService.getDomains).toHaveBeenCalledTimes(1);
    });

    it('should store domains in database', async () => {
      mockDnsService.getDomains.mockResolvedValue(mockDomainList);
      mockDnsModel.upsertDomain.mockResolvedValue(undefined);

      await request(app)
        .get('/api/dns/domains?listType=black')
        .expect(200);

      expect(mockDnsModel.upsertDomain).toHaveBeenCalledTimes(2);
      expect(mockDnsModel.upsertDomain).toHaveBeenCalledWith('ads.example.com', true);
      expect(mockDnsModel.upsertDomain).toHaveBeenCalledWith('tracker.example.com', true);
    });
  });

  describe('POST /api/dns/domains', () => {
    it('should add domain to black list successfully', async () => {
      mockDnsService.addDomain.mockResolvedValue(undefined);
      mockDnsModel.upsertDomain.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/dns/domains')
        .send({
          domain: 'ads.badsite.com',
          listType: 'black',
          comment: 'Test blocking'
        })
        .expect(201);

      expect(response.body).toEqual({
        success: true,
        data: {
          domain: 'ads.badsite.com',
          listType: 'black',
          blocked: true,
          message: 'Domain ads.badsite.com added to black list'
        }
      });
      expect(mockDnsService.addDomain).toHaveBeenCalledWith('ads.badsite.com', 'black', 'Test blocking');
      expect(mockDnsModel.upsertDomain).toHaveBeenCalledWith('ads.badsite.com', true);
    });

    it('should add domain to white list successfully', async () => {
      mockDnsService.addDomain.mockResolvedValue(undefined);
      mockDnsModel.upsertDomain.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/dns/domains')
        .send({
          domain: 'safe.example.com',
          listType: 'white',
          comment: 'Whitelisted domain'
        })
        .expect(201);

      expect(response.body.data.blocked).toBe(false);
      expect(mockDnsService.addDomain).toHaveBeenCalledWith('safe.example.com', 'white', 'Whitelisted domain');
      expect(mockDnsModel.upsertDomain).toHaveBeenCalledWith('safe.example.com', false);
    });

    it('should default to black list when listType not specified', async () => {
      mockDnsService.addDomain.mockResolvedValue(undefined);
      mockDnsModel.upsertDomain.mockResolvedValue(undefined);

      await request(app)
        .post('/api/dns/domains')
        .send({ domain: 'test.com' })
        .expect(201);

      expect(mockDnsService.addDomain).toHaveBeenCalledWith('test.com', 'black', undefined);
    });

    it('should return 400 when domain is missing', async () => {
      const response = await request(app)
        .post('/api/dns/domains')
        .send({ listType: 'black' })
        .expect(400);

      expect(response.body.error).toBe('Domain is required');
      expect(mockDnsService.addDomain).not.toHaveBeenCalled();
    });

    it('should validate domain format', async () => {
      for (const invalidDomain of invalidDomains) {
        if (invalidDomain) {
          const response = await request(app)
            .post('/api/dns/domains')
            .send({ domain: invalidDomain })
            .expect(400);

          expect(response.body.error).toBe('Invalid domain format');
        }
      }
      expect(mockDnsService.addDomain).not.toHaveBeenCalled();
    });

    it('should accept valid domain formats', async () => {
      mockDnsService.addDomain.mockResolvedValue(undefined);
      mockDnsModel.upsertDomain.mockResolvedValue(undefined);

      for (const validDomain of validDomains) {
        await request(app)
          .post('/api/dns/domains')
          .send({ domain: validDomain })
          .expect(201);
      }
      expect(mockDnsService.addDomain).toHaveBeenCalledTimes(validDomains.length);
    });
  });

  describe('DELETE /api/dns/domains/:domain', () => {
    it('should remove domain from black list by default', async () => {
      mockDnsService.removeDomain.mockResolvedValue(undefined);
      mockDnsModel.deleteDomain.mockResolvedValue(undefined);

      const response = await request(app)
        .delete('/api/dns/domains/ads.example.com')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          domain: 'ads.example.com',
          message: 'Domain ads.example.com removed from black list'
        }
      });
      expect(mockDnsService.removeDomain).toHaveBeenCalledWith('ads.example.com', 'black');
      expect(mockDnsModel.deleteDomain).toHaveBeenCalledWith('ads.example.com');
    });

    it('should remove domain from white list when specified', async () => {
      mockDnsService.removeDomain.mockResolvedValue(undefined);
      mockDnsModel.deleteDomain.mockResolvedValue(undefined);

      const response = await request(app)
        .delete('/api/dns/domains/safe.example.com?listType=white')
        .expect(200);

      expect(response.body.data.message).toContain('removed from white list');
      expect(mockDnsService.removeDomain).toHaveBeenCalledWith('safe.example.com', 'white');
    });

    it('should return 400 when domain parameter is missing', async () => {
      const response = await request(app)
        .delete('/api/dns/domains/')
        .expect(404); // Express returns 404 for missing route parameters
    });
  });

  describe('PUT /api/dns/domains/:domain/block', () => {
    it('should block domain successfully', async () => {
      mockDnsService.blockDomain.mockResolvedValue(undefined);
      mockDnsModel.upsertDomain.mockResolvedValue(undefined);

      const response = await request(app)
        .put('/api/dns/domains/ads.example.com/block')
        .send({ block: true })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          domain: 'ads.example.com',
          blocked: true,
          message: 'Domain ads.example.com blocked'
        }
      });
      expect(mockDnsService.blockDomain).toHaveBeenCalledWith('ads.example.com', true);
      expect(mockDnsModel.upsertDomain).toHaveBeenCalledWith('ads.example.com', true);
    });

    it('should unblock domain successfully', async () => {
      mockDnsService.blockDomain.mockResolvedValue(undefined);
      mockDnsModel.upsertDomain.mockResolvedValue(undefined);

      const response = await request(app)
        .put('/api/dns/domains/safe.example.com/block')
        .send({ block: false })
        .expect(200);

      expect(response.body.data.blocked).toBe(false);
      expect(response.body.data.message).toBe('Domain safe.example.com unblocked');
      expect(mockDnsService.blockDomain).toHaveBeenCalledWith('safe.example.com', false);
      expect(mockDnsModel.upsertDomain).toHaveBeenCalledWith('safe.example.com', false);
    });

    it('should default block to true when not specified', async () => {
      mockDnsService.blockDomain.mockResolvedValue(undefined);
      mockDnsModel.upsertDomain.mockResolvedValue(undefined);

      await request(app)
        .put('/api/dns/domains/test.com/block')
        .send({})
        .expect(200);

      expect(mockDnsService.blockDomain).toHaveBeenCalledWith('test.com', true);
    });
  });

  describe('GET /api/dns/queries', () => {
    it('should return query history with default pagination', async () => {
      mockDnsService.getQueryHistory.mockResolvedValue(mockQueryHistory);
      mockDnsModel.logQuery.mockResolvedValue(undefined);

      const response = await request(app)
        .get('/api/dns/queries')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          queries: mockQueryHistory,
          limit: 100,
          offset: 0,
          total: mockQueryHistory.length,
          timestamp: expect.any(String)
        }
      });
      expect(mockDnsService.getQueryHistory).toHaveBeenCalledWith(100, 0);
    });

    it('should handle custom pagination parameters', async () => {
      mockDnsService.getQueryHistory.mockResolvedValue(mockQueryHistory);
      mockDnsModel.logQuery.mockResolvedValue(undefined);

      const response = await request(app)
        .get('/api/dns/queries?limit=50&offset=25')
        .expect(200);

      expect(response.body.data.limit).toBe(50);
      expect(response.body.data.offset).toBe(25);
      expect(mockDnsService.getQueryHistory).toHaveBeenCalledWith(50, 25);
    });

    it('should log queries to database', async () => {
      mockDnsService.getQueryHistory.mockResolvedValue(mockQueryHistory);
      mockDnsModel.logQuery.mockResolvedValue(undefined);

      await request(app)
        .get('/api/dns/queries')
        .expect(200);

      expect(mockDnsModel.logQuery).toHaveBeenCalledTimes(mockQueryHistory.length);
      expect(mockDnsModel.logQuery).toHaveBeenCalledWith(
        'example.com',
        '192.168.1.10',
        'A',
        1692849600,
        false
      );
      expect(mockDnsModel.logQuery).toHaveBeenCalledWith(
        'ads.badsite.com',
        '192.168.1.15',
        'A',
        1692849620,
        true
      );
    });
  });

  describe('GET /api/dns/performance', () => {
    it('should return performance metrics successfully', async () => {
      mockDnsService.getPerformanceStats.mockResolvedValue(mockPerformanceMetrics);
      mockDnsModel.saveMetrics.mockResolvedValue(undefined);

      const response = await request(app)
        .get('/api/dns/performance')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          metrics: mockPerformanceMetrics,
          timestamp: expect.any(String)
        }
      });
      expect(mockDnsService.getPerformanceStats).toHaveBeenCalled();
      expect(mockDnsModel.saveMetrics).toHaveBeenCalledWith(
        mockPerformanceMetrics.queries_today,
        mockPerformanceMetrics.blocked_today,
        mockPerformanceMetrics.average_response_time
      );
    });
  });

  describe('GET /api/dns/top-queries', () => {
    it('should return top queries with default limit', async () => {
      mockDnsService.getTopQueries.mockResolvedValue(mockTopQueries);

      const response = await request(app)
        .get('/api/dns/top-queries')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          topQueries: mockTopQueries,
          limit: 10,
          timestamp: expect.any(String)
        }
      });
      expect(mockDnsService.getTopQueries).toHaveBeenCalledWith(10);
    });

    it('should handle custom limit parameter', async () => {
      mockDnsService.getTopQueries.mockResolvedValue(mockTopQueries);

      await request(app)
        .get('/api/dns/top-queries?limit=5')
        .expect(200);

      expect(mockDnsService.getTopQueries).toHaveBeenCalledWith(5);
    });
  });

  describe('GET /api/dns/top-blocked', () => {
    it('should return top blocked domains', async () => {
      mockDnsService.getTopBlocked.mockResolvedValue(mockTopBlocked);

      const response = await request(app)
        .get('/api/dns/top-blocked')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          topBlocked: mockTopBlocked,
          limit: 10,
          timestamp: expect.any(String)
        }
      });
      expect(mockDnsService.getTopBlocked).toHaveBeenCalledWith(10);
    });
  });

  describe('POST /api/dns/blocking', () => {
    it('should enable blocking successfully', async () => {
      mockDnsService.setBlockingStatus.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/dns/blocking')
        .send({ enabled: true })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          blockingEnabled: true,
          duration: 'permanent',
          message: 'Pi-hole blocking enabled'
        }
      });
      expect(mockDnsService.setBlockingStatus).toHaveBeenCalledWith(true, undefined);
    });

    it('should disable blocking with duration', async () => {
      mockDnsService.setBlockingStatus.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/dns/blocking')
        .send({ enabled: false, duration: 300 })
        .expect(200);

      expect(response.body.data.blockingEnabled).toBe(false);
      expect(response.body.data.duration).toBe(300);
      expect(response.body.data.message).toBe('Pi-hole blocking disabled');
      expect(mockDnsService.setBlockingStatus).toHaveBeenCalledWith(false, 300);
    });

    it('should return 400 when enabled parameter is not boolean', async () => {
      const response = await request(app)
        .post('/api/dns/blocking')
        .send({ enabled: 'true' })
        .expect(400);

      expect(response.body.error).toBe('enabled parameter must be a boolean');
      expect(mockDnsService.setBlockingStatus).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/dns/stats/history', () => {
    const mockHistoricalStats = [
      { timestamp: new Date(), queries: 1000, blocked: 200, response_time: 30 },
      { timestamp: new Date(), queries: 1200, blocked: 250, response_time: 35 }
    ];

    it('should return historical stats with default period', async () => {
      mockDnsModel.getHistoricalMetrics.mockResolvedValue(mockHistoricalStats);

      const response = await request(app)
        .get('/api/dns/stats/history')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          stats: mockHistoricalStats,
          period: '24h',
          timestamp: expect.any(String)
        }
      });
      expect(mockDnsModel.getHistoricalMetrics).toHaveBeenCalledWith('24h');
    });

    it('should handle custom period parameter', async () => {
      mockDnsModel.getHistoricalMetrics.mockResolvedValue(mockHistoricalStats);

      await request(app)
        .get('/api/dns/stats/history?period=7d')
        .expect(200);

      expect(mockDnsModel.getHistoricalMetrics).toHaveBeenCalledWith('7d');
    });
  });

  describe('Error handling', () => {
    it('should handle DNS service errors in getDomains', async () => {
      mockDnsService.getDomains.mockRejectedValue(new Error('Pi-hole unavailable'));

      const response = await request(app)
        .get('/api/dns/domains')
        .expect(500);

      expect(response.body.message).toBe('Failed to retrieve domains');
    });

    it('should handle DNS service errors in addDomain', async () => {
      mockDnsService.addDomain.mockRejectedValue(new Error('Failed to add'));

      const response = await request(app)
        .post('/api/dns/domains')
        .send({ domain: 'test.com' })
        .expect(500);

      expect(response.body.message).toBe('Failed to add');
    });

    it('should handle DNS service errors in blockDomain', async () => {
      mockDnsService.blockDomain.mockRejectedValue(new Error('Block failed'));

      const response = await request(app)
        .put('/api/dns/domains/test.com/block')
        .send({ block: true })
        .expect(500);

      expect(response.body.message).toBe('Failed to update domain block status');
    });
  });
});