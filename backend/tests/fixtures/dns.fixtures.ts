export const mockPiHoleStatus = {
  status: "enabled",
  dns_queries_today: 1234,
  ads_blocked_today: 256,
  ads_percentage_today: 20.7,
  unique_clients: 8,
  queries_forwarded: 890,
  queries_cached: 344,
  reply_NODATA: 67,
  reply_NXDOMAIN: 45,
  reply_CNAME: 123,
  reply_IP: 999,
  privacy_level: 0,
  gravity_last_updated: {
    file_exists: true,
    absolute: 1692849600000,
    relative: {
      days: 1,
      hours: 2,
      minutes: 15
    }
  }
};

export const mockDomainList = [
  {
    id: 1,
    type: 1,
    domain: "ads.example.com",
    enabled: 1,
    date_added: 1692849600,
    date_modified: 1692849600,
    comment: "Test blocked domain",
    groups: [0]
  },
  {
    id: 2,
    type: 1,
    domain: "tracker.example.com", 
    enabled: 1,
    date_added: 1692849600,
    date_modified: 1692849600,
    comment: "Another test domain",
    groups: [0]
  }
];

export const mockWhiteList = [
  {
    id: 3,
    type: 0,
    domain: "safe.example.com",
    enabled: 1,
    date_added: 1692849600,
    date_modified: 1692849600,
    comment: "Whitelisted domain",
    groups: [0]
  }
];

export const mockQueryHistory = [
  {
    timestamp: 1692849600,
    type: "A",
    domain: "example.com",
    client: "192.168.1.10",
    answer_type: "IP",
    reply_type: "NODATA",
    reply_time: 45,
    dnssec: "secure",
    status: "allowed"
  },
  {
    timestamp: 1692849620,
    type: "A", 
    domain: "ads.badsite.com",
    client: "192.168.1.15",
    answer_type: "blocked",
    reply_type: "blocked",
    reply_time: 12,
    dnssec: "unknown",
    status: "blocked"
  }
];

export const mockPerformanceMetrics = {
  queries_today: 1234,
  blocked_today: 256,
  percent_blocked: 20.7,
  unique_clients: 8,
  queries_forwarded: 890,
  queries_cached: 344,
  average_response_time: 35.5,
  cache_hit_rate: 27.9,
  uptime: 86400
};

export const mockTopQueries = [
  { domain: "google.com", count: 45 },
  { domain: "facebook.com", count: 32 },
  { domain: "amazon.com", count: 28 }
];

export const mockTopBlocked = [
  { domain: "ads.tracker.com", count: 67 },
  { domain: "malware.site.com", count: 23 },
  { domain: "popup.ads.net", count: 18 }
];

export const mockApiResponses = {
  statusSuccess: { status: 200, data: mockPiHoleStatus },
  domainsSuccess: { status: 200, data: { data: mockDomainList } },
  whiteListSuccess: { status: 200, data: { data: mockWhiteList } },
  queryHistorySuccess: { status: 200, data: { data: mockQueryHistory } },
  topQueriesSuccess: { status: 200, data: { top_queries: { "google.com": 45, "facebook.com": 32 } } },
  topBlockedSuccess: { status: 200, data: { top_ads: { "ads.tracker.com": 67, "malware.site.com": 23 } } },
  addDomainSuccess: { status: 200, data: { success: true } },
  removeDomainSuccess: { status: 200, data: { success: true } },
  networkError: new Error("Network Error"),
  timeoutError: new Error("Timeout"),
  serverError: { status: 500, data: { error: "Internal Server Error" } }
};

export const validDomains = [
  "example.com",
  "test-domain.org",
  "sub.domain.co.uk",
  "valid123.net"
];

export const invalidDomains = [
  "invalid domain",
  "..invalid.com",
  "invalid..com",
  "invalid.",
  "192.168.1.1",
  ""
];

export const mockDatabaseRecords = {
  domains: [
    { id: 1, domain: "ads.example.com", blocked: true, created_at: new Date(), updated_at: new Date() },
    { id: 2, domain: "safe.example.com", blocked: false, created_at: new Date(), updated_at: new Date() }
  ],
  queries: [
    { id: 1, domain: "example.com", client_ip: "192.168.1.10", query_type: "A", timestamp: new Date(), blocked: false },
    { id: 2, domain: "ads.badsite.com", client_ip: "192.168.1.15", query_type: "A", timestamp: new Date(), blocked: true }
  ],
  metrics: [
    { id: 1, queries_count: 1234, blocked_count: 256, response_time: 35.5, timestamp: new Date() }
  ]
};