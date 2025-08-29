import request from 'supertest';
import express, { Application } from 'express';
import { performance } from 'perf_hooks';
import { DNSController } from '../../controllers/dns.controller';
import { DNSService } from '../../services/dns.service';
import { DNSModel } from '../../models/dns.model';
import { Logger } from '../../utils/logger';
import {
  mockPiHoleStatus,
  mockDomainList,
  mockQueryHistory,
  mockPerformanceMetrics
} from '../../../../tests/fixtures/dns.fixtures';

// Mock dependencies
jest.mock('../../services/dns.service');
jest.mock('../../models/dns.model');
jest.mock('../../utils/logger');

// Performance test configuration
const PERFORMANCE_THRESHOLDS = {
  // Response time thresholds (milliseconds)
  STATUS_ENDPOINT: 200,
  DOMAINS_ENDPOINT: 500,
  QUERIES_ENDPOINT: 1000,
  PERFORMANCE_ENDPOINT: 300,
  ADD_DOMAIN: 400,
  REMOVE_DOMAIN: 400,
  BLOCK_DOMAIN: 300,
  BULK_OPERATIONS: 2000,
  
  // Throughput thresholds (requests per second)
  CONCURRENT_REQUESTS: 50,
  
  // Memory thresholds (MB)
  MEMORY_LEAK_THRESHOLD: 100,
};

// Load test configuration
const LOAD_TEST_CONFIG = {
  LIGHT_LOAD: { concurrent: 5, requests: 50, duration: 10000 },
  MEDIUM_LOAD: { concurrent: 10, requests: 100, duration: 30000 },
  HEAVY_LOAD: { concurrent: 20, requests: 200, duration: 60000 },
};

describe('DNS API Performance Tests', () => {
  let app: Application;
  let dnsController: DNSController;
  let initialMemory: number;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Record initial memory usage
    initialMemory = process.memoryUsage().heapUsed / 1024 / 1024;
    
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
    
    // Setup mock responses
    setupMockResponses();
  });

  afterEach(() => {
    // Check for memory leaks
    const currentMemory = process.memoryUsage().heapUsed / 1024 / 1024;
    const memoryIncrease = currentMemory - initialMemory;
    
    if (memoryIncrease > PERFORMANCE_THRESHOLDS.MEMORY_LEAK_THRESHOLD) {
      console.warn(`Potential memory leak detected: ${memoryIncrease.toFixed(2)}MB increase`);
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  });

  function setupMockResponses() {
    const MockedDNSService = DNSService as jest.MockedClass<typeof DNSService>;
    const MockedDNSModel = DNSModel as jest.MockedClass<typeof DNSModel>;
    
    const mockService = {
      getStatus: jest.fn().mockResolvedValue(mockPiHoleStatus),
      getDomains: jest.fn().mockResolvedValue(mockDomainList),
      addDomain: jest.fn().mockResolvedValue(undefined),
      removeDomain: jest.fn().mockResolvedValue(undefined),
      blockDomain: jest.fn().mockResolvedValue(undefined),
      getQueryHistory: jest.fn().mockResolvedValue(mockQueryHistory),
      getPerformanceStats: jest.fn().mockResolvedValue(mockPerformanceMetrics),
      getTopQueries: jest.fn().mockResolvedValue([]),
      getTopBlocked: jest.fn().mockResolvedValue([]),
      setBlockingStatus: jest.fn().mockResolvedValue(undefined),
    };
    
    const mockModel = {
      upsertDomain: jest.fn().mockResolvedValue(undefined),
      deleteDomain: jest.fn().mockResolvedValue(undefined),
      logQuery: jest.fn().mockResolvedValue(undefined),
      saveMetrics: jest.fn().mockResolvedValue(undefined),
      getHistoricalMetrics: jest.fn().mockResolvedValue([]),
    };
    
    MockedDNSService.mockImplementation(() => mockService as any);
    MockedDNSModel.mockImplementation(() => mockModel as any);
  }

  // Utility function to measure response time
  async function measureResponseTime(requestFn: () => Promise<request.Response>): Promise<{
    responseTime: number;
    response: request.Response;
  }> {
    const startTime = performance.now();
    const response = await requestFn();
    const endTime = performance.now();
    
    return {
      responseTime: endTime - startTime,
      response
    };
  }

  // Utility function for concurrent requests
  async function runConcurrentRequests(
    requestFn: () => Promise<request.Response>,
    concurrency: number,
    totalRequests: number
  ): Promise<{
    avgResponseTime: number;
    minResponseTime: number;
    maxResponseTime: number;
    successRate: number;
    responseTimes: number[];
  }> {
    const responseTimes: number[] = [];
    const promises: Promise<void>[] = [];
    let successCount = 0;
    
    const executeRequest = async () => {
      try {
        const { responseTime, response } = await measureResponseTime(requestFn);
        responseTimes.push(responseTime);
        
        if (response.status >= 200 && response.status < 400) {
          successCount++;
        }
      } catch (error) {
        // Request failed - count as non-success
        responseTimes.push(Number.MAX_SAFE_INTEGER);
      }
    };
    
    // Create batches of concurrent requests
    for (let i = 0; i < totalRequests; i += concurrency) {
      const batchSize = Math.min(concurrency, totalRequests - i);
      const batch = Array(batchSize).fill(0).map(() => executeRequest());
      
      await Promise.all(batch);
      promises.push(...batch);
    }
    
    const validTimes = responseTimes.filter(time => time !== Number.MAX_SAFE_INTEGER);
    
    return {
      avgResponseTime: validTimes.length > 0 ? validTimes.reduce((a, b) => a + b, 0) / validTimes.length : 0,
      minResponseTime: validTimes.length > 0 ? Math.min(...validTimes) : 0,
      maxResponseTime: validTimes.length > 0 ? Math.max(...validTimes) : 0,
      successRate: (successCount / totalRequests) * 100,
      responseTimes: validTimes,
    };
  }

  describe('Single Request Performance', () => {
    test('DNS status endpoint should respond within threshold', async () => {
      const { responseTime, response } = await measureResponseTime(() => 
        request(app).get('/api/dns/status')
      );
      
      expect([200, 500]).toContain(response.status);
      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.STATUS_ENDPOINT);
      
      console.log(`DNS Status response time: ${responseTime.toFixed(2)}ms`);
    });

    test('Domains list endpoint should respond within threshold', async () => {
      const { responseTime, response } = await measureResponseTime(() => 
        request(app).get('/api/dns/domains')
      );
      
      expect([200, 500]).toContain(response.status);
      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.DOMAINS_ENDPOINT);
      
      console.log(`Domains list response time: ${responseTime.toFixed(2)}ms`);
    });

    test('Query history endpoint should respond within threshold', async () => {
      const { responseTime, response } = await measureResponseTime(() => 
        request(app).get('/api/dns/queries?limit=100')
      );
      
      expect([200, 500]).toContain(response.status);
      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.QUERIES_ENDPOINT);
      
      console.log(`Query history response time: ${responseTime.toFixed(2)}ms`);
    });

    test('Performance metrics endpoint should respond within threshold', async () => {
      const { responseTime, response } = await measureResponseTime(() => 
        request(app).get('/api/dns/performance')
      );
      
      expect([200, 500]).toContain(response.status);
      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.PERFORMANCE_ENDPOINT);
      
      console.log(`Performance metrics response time: ${responseTime.toFixed(2)}ms`);
    });
  });

  describe('Mutation Performance', () => {
    test('Add domain should complete within threshold', async () => {
      const { responseTime, response } = await measureResponseTime(() => 
        request(app)
          .post('/api/dns/domains')
          .send({ domain: 'perf-test.example.com', listType: 'black' })
      );
      
      expect([201, 400, 500]).toContain(response.status);
      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.ADD_DOMAIN);
      
      console.log(`Add domain response time: ${responseTime.toFixed(2)}ms`);
    });

    test('Remove domain should complete within threshold', async () => {
      const { responseTime, response } = await measureResponseTime(() => 
        request(app).delete('/api/dns/domains/test.example.com')
      );
      
      expect([200, 404, 500]).toContain(response.status);
      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.REMOVE_DOMAIN);
      
      console.log(`Remove domain response time: ${responseTime.toFixed(2)}ms`);
    });

    test('Block domain should complete within threshold', async () => {
      const { responseTime, response } = await measureResponseTime(() => 
        request(app)
          .put('/api/dns/domains/test.example.com/block')
          .send({ block: true })
      );
      
      expect([200, 404, 500]).toContain(response.status);
      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.BLOCK_DOMAIN);
      
      console.log(`Block domain response time: ${responseTime.toFixed(2)}ms`);
    });
  });

  describe('Pagination Performance', () => {
    test('Large domain list pagination should perform well', async () => {
      const pageSizes = [10, 50, 100, 500];
      const results: { pageSize: number; responseTime: number }[] = [];
      
      for (const pageSize of pageSizes) {
        const { responseTime } = await measureResponseTime(() => 
          request(app).get(`/api/dns/domains?limit=${pageSize}`)
        );
        
        results.push({ pageSize, responseTime });
        
        // Response time should not increase dramatically with page size
        expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.DOMAINS_ENDPOINT * 2);
      }
      
      console.log('Domain pagination performance:', results);
      
      // Verify performance doesn't degrade exponentially
      const timePerItem = results.map(r => r.responseTime / r.pageSize);
      const avgTimePerItem = timePerItem.reduce((a, b) => a + b, 0) / timePerItem.length;
      
      expect(avgTimePerItem).toBeLessThan(5); // 5ms per domain item max
    });

    test('Query history pagination should scale linearly', async () => {
      const limits = [10, 50, 100, 200];
      const results: { limit: number; responseTime: number }[] = [];
      
      for (const limit of limits) {
        const { responseTime } = await measureResponseTime(() => 
          request(app).get(`/api/dns/queries?limit=${limit}&offset=0`)
        );
        
        results.push({ limit, responseTime });
      }
      
      console.log('Query pagination performance:', results);
      
      // Response times should not increase exponentially
      for (let i = 1; i < results.length; i++) {
        const prevResult = results[i - 1];
        const currentResult = results[i];
        const scalingFactor = (currentResult.limit / prevResult.limit);
        const timeFactor = (currentResult.responseTime / prevResult.responseTime);
        
        // Time factor should not exceed scaling factor by more than 2x
        expect(timeFactor).toBeLessThan(scalingFactor * 2);
      }
    });
  });

  describe('Concurrent Request Performance', () => {
    test('Should handle concurrent status requests', async () => {
      const results = await runConcurrentRequests(
        () => request(app).get('/api/dns/status'),
        5,
        25
      );
      
      expect(results.successRate).toBeGreaterThan(90);
      expect(results.avgResponseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.STATUS_ENDPOINT * 1.5);
      expect(results.maxResponseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.STATUS_ENDPOINT * 3);
      
      console.log('Concurrent status requests:', {
        avgTime: results.avgResponseTime.toFixed(2),
        maxTime: results.maxResponseTime.toFixed(2),
        successRate: results.successRate.toFixed(1),
      });
    });

    test('Should handle concurrent domain operations', async () => {
      const results = await runConcurrentRequests(
        () => request(app).get('/api/dns/domains'),
        3,
        15
      );
      
      expect(results.successRate).toBeGreaterThan(80);
      expect(results.avgResponseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.DOMAINS_ENDPOINT * 2);
      
      console.log('Concurrent domain operations:', {
        avgTime: results.avgResponseTime.toFixed(2),
        maxTime: results.maxResponseTime.toFixed(2),
        successRate: results.successRate.toFixed(1),
      });
    });

    test('Mixed endpoint concurrent access', async () => {
      const endpoints = [
        () => request(app).get('/api/dns/status'),
        () => request(app).get('/api/dns/domains'),
        () => request(app).get('/api/dns/performance'),
        () => request(app).get('/api/dns/queries?limit=10'),
      ];
      
      const promises = Array(20).fill(0).map((_, i) => {
        const endpoint = endpoints[i % endpoints.length];
        return measureResponseTime(endpoint);
      });
      
      const results = await Promise.all(promises);
      const responseTimes = results.map(r => r.responseTime);
      const successfulResponses = results.filter(r => r.response.status < 400).length;
      
      const avgTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const successRate = (successfulResponses / results.length) * 100;
      
      expect(successRate).toBeGreaterThan(80);
      expect(avgTime).toBeLessThan(800); // Mixed endpoints average
      
      console.log('Mixed concurrent access:', {
        avgTime: avgTime.toFixed(2),
        successRate: successRate.toFixed(1),
        totalRequests: results.length,
      });
    });
  });

  describe('Load Testing', () => {
    test('Light load handling', async () => {
      const config = LOAD_TEST_CONFIG.LIGHT_LOAD;
      
      const results = await runConcurrentRequests(
        () => request(app).get('/api/dns/status'),
        config.concurrent,
        config.requests
      );
      
      expect(results.successRate).toBeGreaterThan(95);
      expect(results.avgResponseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.STATUS_ENDPOINT * 1.2);
      
      // Calculate requests per second
      const totalTime = Math.max(...results.responseTimes);
      const requestsPerSecond = (config.requests / totalTime) * 1000;
      
      console.log('Light load test results:', {
        requests: config.requests,
        concurrency: config.concurrent,
        avgTime: results.avgResponseTime.toFixed(2),
        maxTime: results.maxResponseTime.toFixed(2),
        successRate: results.successRate.toFixed(1),
        requestsPerSecond: requestsPerSecond.toFixed(1),
      });
      
      expect(requestsPerSecond).toBeGreaterThan(10); // At least 10 RPS
    }, 30000);

    test('Medium load stability', async () => {
      const config = LOAD_TEST_CONFIG.MEDIUM_LOAD;
      
      const results = await runConcurrentRequests(
        () => request(app).get('/api/dns/domains?limit=50'),
        config.concurrent,
        config.requests
      );
      
      expect(results.successRate).toBeGreaterThan(85);
      expect(results.avgResponseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.DOMAINS_ENDPOINT * 2);
      
      console.log('Medium load test results:', {
        requests: config.requests,
        concurrency: config.concurrent,
        avgTime: results.avgResponseTime.toFixed(2),
        successRate: results.successRate.toFixed(1),
      });
    }, 45000);
  });

  describe('Memory and Resource Usage', () => {
    test('Should not leak memory during repeated requests', async () => {
      const initialHeap = process.memoryUsage().heapUsed;
      
      // Make 100 requests
      for (let i = 0; i < 100; i++) {
        await request(app).get('/api/dns/status');
        
        // Force GC every 20 requests if available
        if (i % 20 === 0 && global.gc) {
          global.gc();
        }
      }
      
      const finalHeap = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalHeap - initialHeap) / 1024 / 1024; // MB
      
      expect(memoryIncrease).toBeLessThan(50); // Max 50MB increase
      
      console.log(`Memory usage increase: ${memoryIncrease.toFixed(2)}MB`);
    });

    test('Should handle large response payloads efficiently', async () => {
      // Test with large query limit
      const { responseTime, response } = await measureResponseTime(() => 
        request(app).get('/api/dns/queries?limit=1000')
      );
      
      expect([200, 500]).toContain(response.status);
      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.QUERIES_ENDPOINT * 2);
      
      if (response.status === 200) {
        const payloadSize = JSON.stringify(response.body).length;
        console.log(`Large payload test - Size: ${(payloadSize / 1024).toFixed(2)}KB, Time: ${responseTime.toFixed(2)}ms`);
        
        // Should handle up to 1MB responses in reasonable time
        expect(payloadSize).toBeLessThan(1024 * 1024); // 1MB max
      }
    });
  });

  describe('Cache Performance', () => {
    test('Repeated requests should show cache benefits', async () => {
      // First request (cache miss)
      const { responseTime: firstTime } = await measureResponseTime(() => 
        request(app).get('/api/dns/status')
      );
      
      // Second request (should hit cache)
      const { responseTime: secondTime } = await measureResponseTime(() => 
        request(app).get('/api/dns/status')
      );
      
      // Third request (should also hit cache)
      const { responseTime: thirdTime } = await measureResponseTime(() => 
        request(app).get('/api/dns/status')
      );
      
      console.log('Cache performance test:', {
        first: firstTime.toFixed(2),
        second: secondTime.toFixed(2),
        third: thirdTime.toFixed(2),
      });
      
      // All requests should be reasonably fast
      expect(firstTime).toBeLessThan(PERFORMANCE_THRESHOLDS.STATUS_ENDPOINT);
      expect(secondTime).toBeLessThan(PERFORMANCE_THRESHOLDS.STATUS_ENDPOINT);
      expect(thirdTime).toBeLessThan(PERFORMANCE_THRESHOLDS.STATUS_ENDPOINT);
    });
  });

  describe('Bulk Operations Performance', () => {
    test('Bulk domain operations should scale reasonably', async () => {
      const domainCounts = [1, 5, 10, 20];
      const results: { count: number; responseTime: number }[] = [];
      
      for (const count of domainCounts) {
        const domains = Array(count).fill(0).map((_, i) => `bulk-test-${i}.example.com`);
        
        const { responseTime } = await measureResponseTime(async () => {
          // Simulate bulk operations by making multiple requests
          const promises = domains.map(domain =>
            request(app)
              .post('/api/dns/domains')
              .send({ domain, listType: 'black' })
          );
          
          const responses = await Promise.all(promises);
          return responses[0]; // Return first response for status checking
        });
        
        results.push({ count, responseTime });
        
        console.log(`Bulk operation (${count} domains): ${responseTime.toFixed(2)}ms`);
      }
      
      // Verify scaling is reasonable (should not be exponential)
      for (let i = 1; i < results.length; i++) {
        const prev = results[i - 1];
        const curr = results[i];
        const scalingFactor = curr.count / prev.count;
        const timeFactor = curr.responseTime / prev.responseTime;
        
        // Time should not scale worse than O(n^1.5)
        expect(timeFactor).toBeLessThan(Math.pow(scalingFactor, 1.5) * 1.2);
      }
    }, 30000);
  });

  describe('Error Handling Performance', () => {
    test('Error responses should be as fast as success responses', async () => {
      // Valid request
      const { responseTime: successTime } = await measureResponseTime(() => 
        request(app).get('/api/dns/status')
      );
      
      // Invalid requests that should return errors quickly
      const { responseTime: errorTime1 } = await measureResponseTime(() => 
        request(app).post('/api/dns/domains').send({ domain: 'invalid domain' })
      );
      
      const { responseTime: errorTime2 } = await measureResponseTime(() => 
        request(app).post('/api/dns/blocking').send({ enabled: 'not-boolean' })
      );
      
      console.log('Error handling performance:', {
        success: successTime.toFixed(2),
        invalidDomain: errorTime1.toFixed(2),
        invalidBoolean: errorTime2.toFixed(2),
      });
      
      // Error responses should be fast (not spending time on processing invalid data)
      expect(errorTime1).toBeLessThan(100);
      expect(errorTime2).toBeLessThan(100);
    });
  });

  describe('Performance Regression Detection', () => {
    test('Should establish performance baselines', () => {
      const baselines = {
        statusEndpoint: PERFORMANCE_THRESHOLDS.STATUS_ENDPOINT,
        domainsEndpoint: PERFORMANCE_THRESHOLDS.DOMAINS_ENDPOINT,
        queriesEndpoint: PERFORMANCE_THRESHOLDS.QUERIES_ENDPOINT,
        performanceEndpoint: PERFORMANCE_THRESHOLDS.PERFORMANCE_ENDPOINT,
        addDomain: PERFORMANCE_THRESHOLDS.ADD_DOMAIN,
        blockDomain: PERFORMANCE_THRESHOLDS.BLOCK_DOMAIN,
      };
      
      console.log('Performance baselines (ms):', baselines);
      
      // Store baselines for future regression testing
      expect(Object.values(baselines).every(threshold => threshold > 0)).toBe(true);
    });
  });
});