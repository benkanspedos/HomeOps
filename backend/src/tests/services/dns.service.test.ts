import axios from "axios";
import { DNSService } from "../../services/dns.service";
import { CacheService } from "../../services/cache.service";
import { Logger } from "../../utils/logger";
import {
  mockPiHoleStatus,
  mockDomainList,
  mockWhiteList,
  mockQueryHistory,
  mockPerformanceMetrics,
  mockTopQueries,
  mockTopBlocked,
  mockApiResponses
} from "../../../../tests/fixtures/dns.fixtures";

// Mock dependencies
jest.mock("axios");
jest.mock("../../services/cache.service");
jest.mock("../../utils/logger");

const mockedAxios = axios as jest.Mocked<typeof axios>;
const MockedCacheService = CacheService as jest.MockedClass<typeof CacheService>;
const MockedLogger = Logger as jest.MockedClass<typeof Logger>;

describe("DNSService", () => {
  let dnsService: DNSService;
  let mockAxiosInstance: jest.Mocked<any>;
  let mockCacheService: jest.Mocked<CacheService>;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock axios create
    mockAxiosInstance = {
      get: jest.fn(),
      post: jest.fn(),
    };
    mockedAxios.create.mockReturnValue(mockAxiosInstance);
    
    // Mock cache service
    mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
    } as any;
    MockedCacheService.mockImplementation(() => mockCacheService);
    
    // Mock logger
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    } as any;
    MockedLogger.mockImplementation(() => mockLogger);
    
    // Set environment variables
    process.env.PIHOLE_API_URL = "http://test-pihole:8080/admin/api.php";
    process.env.PIHOLE_PASSWORD = "testpassword";
    
    dnsService = new DNSService();
  });

  afterEach(() => {
    delete process.env.PIHOLE_API_URL;
    delete process.env.PIHOLE_PASSWORD;
  });

  describe("constructor", () => {
    it("should initialize with correct configuration", () => {
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: "http://test-pihole:8080/admin/api.php",
        timeout: 10000
      });
      expect(MockedLogger).toHaveBeenCalledWith("DNSService");
      expect(MockedCacheService).toHaveBeenCalled();
    });

    it("should handle missing environment variables", () => {
      delete process.env.PIHOLE_API_URL;
      delete process.env.PIHOLE_PASSWORD;
      
      new DNSService();
      
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: "http://localhost:8081/admin/api.php",
        timeout: 10000
      });
    });
  });

  describe("getStatus", () => {
    it("should return cached status when available", async () => {
      mockCacheService.get.mockResolvedValue(mockPiHoleStatus);
      
      const result = await dnsService.getStatus();
      
      expect(mockCacheService.get).toHaveBeenCalledWith("dns:status");
      expect(result).toEqual(mockPiHoleStatus);
      expect(mockAxiosInstance.get).not.toHaveBeenCalled();
    });

    it("should fetch and cache new status when not cached", async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockAxiosInstance.get.mockResolvedValue(mockApiResponses.statusSuccess);
      
      const result = await dnsService.getStatus();
      
      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/stats/summary");
      expect(mockCacheService.set).toHaveBeenCalledWith("dns:status", mockPiHoleStatus, 30);
      expect(result).toEqual(mockPiHoleStatus);
    });

    it("should return mock data when Pi-hole is unavailable", async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockAxiosInstance.get.mockRejectedValue(mockApiResponses.networkError);
      
      const result = await dnsService.getStatus();
      
      expect(mockLogger.error).toHaveBeenCalledWith("Failed to get Pi-hole status", mockApiResponses.networkError);
      expect(mockLogger.warn).toHaveBeenCalledWith("Using mock Pi-hole data - Pi-hole may be unavailable or API changed");
      expect(result).toHaveProperty("status", "enabled");
      expect(result).toHaveProperty("dns_queries_today");
      expect(result).toHaveProperty("ads_blocked_today");
    });
  });

  describe("getDomains", () => {
    it("should return cached domains when available", async () => {
      mockCacheService.get.mockResolvedValue(mockDomainList);
      
      const result = await dnsService.getDomains("black");
      
      expect(mockCacheService.get).toHaveBeenCalledWith("dns:domains:black");
      expect(result).toEqual(mockDomainList);
      expect(mockAxiosInstance.get).not.toHaveBeenCalled();
    });

    it("should fetch black list domains", async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockAxiosInstance.get.mockResolvedValue(mockApiResponses.domainsSuccess);
      
      const result = await dnsService.getDomains("black");
      
      expect(mockAxiosInstance.get).toHaveBeenCalledWith("", {
        params: {
          auth: expect.any(String),
          list: "black",
          action: "get_list"
        }
      });
      expect(mockCacheService.set).toHaveBeenCalledWith("dns:domains:black", mockDomainList, 300);
      expect(result).toEqual(mockDomainList);
    });

    it("should fetch white list domains", async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockAxiosInstance.get.mockResolvedValue(mockApiResponses.whiteListSuccess);
      
      const result = await dnsService.getDomains("white");
      
      expect(mockAxiosInstance.get).toHaveBeenCalledWith("", {
        params: {
          auth: expect.any(String),
          list: "white",
          action: "get_list"
        }
      });
    });

    it("should fetch regex list domains", async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockAxiosInstance.get.mockResolvedValue(mockApiResponses.domainsSuccess);
      
      await dnsService.getDomains("regex");
      
      expect(mockAxiosInstance.get).toHaveBeenCalledWith("", {
        params: {
          auth: expect.any(String),
          list: "regex_black",
          action: "get_list"
        }
      });
    });

    it("should handle API errors", async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockAxiosInstance.get.mockRejectedValue(mockApiResponses.networkError);
      
      await expect(dnsService.getDomains("black")).rejects.toThrow("Failed to retrieve black list");
      expect(mockLogger.error).toHaveBeenCalledWith("Failed to get black list domains", mockApiResponses.networkError);
    });
  });

  describe("addDomain", () => {
    it("should add domain to black list", async () => {
      mockAxiosInstance.post.mockResolvedValue(mockApiResponses.addDomainSuccess);
      
      await dnsService.addDomain("test.com", "black", "Test comment");
      
      expect(mockAxiosInstance.post).toHaveBeenCalledWith("", null, {
        params: {
          auth: expect.any(String),
          list: "black",
          add: "test.com",
          comment: "Test comment",
          action: "add"
        }
      });
      expect(mockCacheService.delete).toHaveBeenCalledWith("dns:domains:black");
      expect(mockLogger.info).toHaveBeenCalledWith("Added domain test.com to black list");
    });

    it("should add domain to white list", async () => {
      mockAxiosInstance.post.mockResolvedValue(mockApiResponses.addDomainSuccess);
      
      await dnsService.addDomain("safe.com", "white");
      
      expect(mockAxiosInstance.post).toHaveBeenCalledWith("", null, {
        params: {
          auth: expect.any(String),
          list: "white",
          add: "safe.com",
          comment: "Added via HomeOps API",
          action: "add"
        }
      });
      expect(mockCacheService.delete).toHaveBeenCalledWith("dns:domains:white");
    });

    it("should handle add domain errors", async () => {
      mockAxiosInstance.post.mockRejectedValue(mockApiResponses.networkError);
      
      await expect(dnsService.addDomain("test.com", "black")).rejects.toThrow("Failed to add domain");
      expect(mockLogger.error).toHaveBeenCalledWith("Failed to add domain test.com", mockApiResponses.networkError);
    });
  });

  describe("removeDomain", () => {
    it("should remove domain from black list", async () => {
      mockAxiosInstance.post.mockResolvedValue(mockApiResponses.removeDomainSuccess);
      
      await dnsService.removeDomain("test.com", "black");
      
      expect(mockAxiosInstance.post).toHaveBeenCalledWith("", null, {
        params: {
          auth: expect.any(String),
          list: "black",
          sub: "test.com",
          action: "sub"
        }
      });
      expect(mockCacheService.delete).toHaveBeenCalledWith("dns:domains:black");
      expect(mockLogger.info).toHaveBeenCalledWith("Removed domain test.com from black list");
    });

    it("should handle remove domain errors", async () => {
      mockAxiosInstance.post.mockRejectedValue(mockApiResponses.networkError);
      
      await expect(dnsService.removeDomain("test.com", "black")).rejects.toThrow("Failed to remove domain");
      expect(mockLogger.error).toHaveBeenCalledWith("Failed to remove domain test.com", mockApiResponses.networkError);
    });
  });

  describe("blockDomain", () => {
    it("should block domain by adding to black list", async () => {
      mockAxiosInstance.post.mockResolvedValue(mockApiResponses.addDomainSuccess);
      
      await dnsService.blockDomain("ads.com", true);
      
      expect(mockAxiosInstance.post).toHaveBeenCalledWith("", null, {
        params: {
          auth: expect.any(String),
          list: "black",
          add: "ads.com",
          comment: "Added via HomeOps API",
          action: "add"
        }
      });
    });

    it("should unblock domain by removing from black list and adding to white list", async () => {
      mockAxiosInstance.post.mockResolvedValue(mockApiResponses.addDomainSuccess);
      
      await dnsService.blockDomain("safe.com", false);
      
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(2);
      expect(mockAxiosInstance.post).toHaveBeenNthCalledWith(1, "", null, {
        params: {
          auth: expect.any(String),
          list: "black",
          sub: "safe.com",
          action: "sub"
        }
      });
      expect(mockAxiosInstance.post).toHaveBeenNthCalledWith(2, "", null, {
        params: {
          auth: expect.any(String),
          list: "white",
          add: "safe.com",
          comment: "Added via HomeOps API",
          action: "add"
        }
      });
    });
  });

  describe("getQueryHistory", () => {
    it("should return cached query history when available", async () => {
      mockCacheService.get.mockResolvedValue(mockQueryHistory);
      
      const result = await dnsService.getQueryHistory(100, 0);
      
      expect(mockCacheService.get).toHaveBeenCalledWith("dns:queries:100:0");
      expect(result).toEqual(mockQueryHistory);
      expect(mockAxiosInstance.get).not.toHaveBeenCalled();
    });

    it("should fetch and cache query history", async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockAxiosInstance.get.mockResolvedValue(mockApiResponses.queryHistorySuccess);
      
      const result = await dnsService.getQueryHistory(50, 10);
      
      expect(mockAxiosInstance.get).toHaveBeenCalledWith("", {
        params: {
          auth: expect.any(String),
          getAllQueries: 50,
          from: 10,
          until: 999999999999
        }
      });
      expect(mockCacheService.set).toHaveBeenCalledWith("dns:queries:50:10", mockQueryHistory, 60);
      expect(result).toEqual(mockQueryHistory);
    });

    it("should handle query history errors", async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockAxiosInstance.get.mockRejectedValue(mockApiResponses.networkError);
      
      await expect(dnsService.getQueryHistory()).rejects.toThrow("Failed to retrieve query history");
      expect(mockLogger.error).toHaveBeenCalledWith("Failed to get query history", mockApiResponses.networkError);
    });
  });

  describe("getPerformanceStats", () => {
    it("should return cached performance stats when available", async () => {
      mockCacheService.get.mockResolvedValue(mockPerformanceMetrics);
      
      const result = await dnsService.getPerformanceStats();
      
      expect(mockCacheService.get).toHaveBeenCalledWith("dns:performance");
      expect(result).toEqual(mockPerformanceMetrics);
    });

    it("should calculate performance stats from Pi-hole data", async () => {
      mockCacheService.get.mockResolvedValueOnce(null); // performance cache
      mockCacheService.get.mockResolvedValueOnce(mockPiHoleStatus); // status cache
      mockAxiosInstance.get.mockResolvedValueOnce(mockApiResponses.topQueriesSuccess);
      mockAxiosInstance.get.mockResolvedValueOnce(mockApiResponses.topBlockedSuccess);
      
      const result = await dnsService.getPerformanceStats();
      
      expect(result).toHaveProperty("queries_today", mockPiHoleStatus.dns_queries_today);
      expect(result).toHaveProperty("blocked_today", mockPiHoleStatus.ads_blocked_today);
      expect(result).toHaveProperty("percent_blocked", mockPiHoleStatus.ads_percentage_today);
      expect(result).toHaveProperty("cache_hit_rate");
      expect(mockCacheService.set).toHaveBeenCalledWith("dns:performance", expect.any(Object), 30);
    });

    it("should handle performance stats errors", async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockAxiosInstance.get.mockRejectedValue(mockApiResponses.networkError);
      
      await expect(dnsService.getPerformanceStats()).rejects.toThrow("Failed to retrieve performance metrics");
      expect(mockLogger.error).toHaveBeenCalledWith("Failed to get performance stats", mockApiResponses.networkError);
    });
  });

  describe("getTopQueries", () => {
    it("should fetch top queries successfully", async () => {
      mockAxiosInstance.get.mockResolvedValue(mockApiResponses.topQueriesSuccess);
      
      const result = await dnsService.getTopQueries(5);
      
      expect(mockAxiosInstance.get).toHaveBeenCalledWith("", {
        params: {
          auth: expect.any(String),
          topItems: 5
        }
      });
      expect(result).toEqual([
        { domain: "google.com", count: 45 },
        { domain: "facebook.com", count: 32 }
      ]);
    });

    it("should handle top queries errors gracefully", async () => {
      mockAxiosInstance.get.mockRejectedValue(mockApiResponses.networkError);
      
      const result = await dnsService.getTopQueries();
      
      expect(result).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalledWith("Failed to get top queries", mockApiResponses.networkError);
    });
  });

  describe("getTopBlocked", () => {
    it("should fetch top blocked domains successfully", async () => {
      mockAxiosInstance.get.mockResolvedValue(mockApiResponses.topBlockedSuccess);
      
      const result = await dnsService.getTopBlocked(5);
      
      expect(mockAxiosInstance.get).toHaveBeenCalledWith("", {
        params: {
          auth: expect.any(String),
          topItems: 5
        }
      });
      expect(result).toEqual([
        { domain: "ads.tracker.com", count: 67 },
        { domain: "malware.site.com", count: 23 }
      ]);
    });

    it("should handle top blocked errors gracefully", async () => {
      mockAxiosInstance.get.mockRejectedValue(mockApiResponses.networkError);
      
      const result = await dnsService.getTopBlocked();
      
      expect(result).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalledWith("Failed to get top blocked", mockApiResponses.networkError);
    });
  });

  describe("setBlockingStatus", () => {
    it("should enable Pi-hole blocking", async () => {
      mockAxiosInstance.get.mockResolvedValue({ status: 200, data: {} });
      
      await dnsService.setBlockingStatus(true);
      
      expect(mockAxiosInstance.get).toHaveBeenCalledWith("", {
        params: {
          auth: expect.any(String),
          enable: ""
        }
      });
      expect(mockCacheService.delete).toHaveBeenCalledWith("dns:status");
      expect(mockLogger.info).toHaveBeenCalledWith("Pi-hole blocking enabled");
    });

    it("should disable Pi-hole blocking with duration", async () => {
      mockAxiosInstance.get.mockResolvedValue({ status: 200, data: {} });
      
      await dnsService.setBlockingStatus(false, 300);
      
      expect(mockAxiosInstance.get).toHaveBeenCalledWith("", {
        params: {
          auth: expect.any(String),
          disable: 300
        }
      });
      expect(mockLogger.info).toHaveBeenCalledWith("Pi-hole blocking disabled");
    });

    it("should handle blocking status errors", async () => {
      mockAxiosInstance.get.mockRejectedValue(mockApiResponses.networkError);
      
      await expect(dnsService.setBlockingStatus(true)).rejects.toThrow("Failed to update blocking status");
      expect(mockLogger.error).toHaveBeenCalledWith("Failed to set blocking status", mockApiResponses.networkError);
    });
  });

  describe("cache interactions", () => {
    it("should properly invalidate cache when adding domains", async () => {
      mockAxiosInstance.post.mockResolvedValue(mockApiResponses.addDomainSuccess);
      
      await dnsService.addDomain("test.com", "black");
      
      expect(mockCacheService.delete).toHaveBeenCalledWith("dns:domains:black");
    });

    it("should properly invalidate cache when removing domains", async () => {
      mockAxiosInstance.post.mockResolvedValue(mockApiResponses.removeDomainSuccess);
      
      await dnsService.removeDomain("test.com", "white");
      
      expect(mockCacheService.delete).toHaveBeenCalledWith("dns:domains:white");
    });

    it("should properly invalidate status cache when changing blocking", async () => {
      mockAxiosInstance.get.mockResolvedValue({ status: 200, data: {} });
      
      await dnsService.setBlockingStatus(false);
      
      expect(mockCacheService.delete).toHaveBeenCalledWith("dns:status");
    });
  });
});