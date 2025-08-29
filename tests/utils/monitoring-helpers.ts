import { Container, MetricData, AlertRule, SystemMetrics } from '../../types/monitoring';

/**
 * Generate mock container data for testing
 */
export const generateMockContainer = (overrides: Partial<Container> = {}): Container => {
  return {
    id: 'container-' + Math.random().toString(36).substr(2, 9),
    name: 'test-container',
    image: 'nginx:latest',
    status: 'running',
    cpu: Math.random() * 100,
    memory: Math.random() * 100,
    disk_read: Math.floor(Math.random() * 10000000),
    disk_write: Math.floor(Math.random() * 5000000),
    network_rx: Math.floor(Math.random() * 1000000),
    network_tx: Math.floor(Math.random() * 500000),
    uptime: '2 hours',
    ports: ['80:80'],
    created_at: new Date().toISOString(),
    ...overrides
  };
};

/**
 * Generate multiple mock containers
 */
export const generateMockContainers = (count: number): Container[] => {
  const containerNames = ['nginx', 'redis', 'postgres', 'mongodb', 'elasticsearch', 'rabbitmq'];
  const images = ['nginx:latest', 'redis:alpine', 'postgres:13', 'mongo:latest', 'elasticsearch:7.17', 'rabbitmq:management'];
  
  return Array(count).fill(null).map((_, index) => 
    generateMockContainer({
      name: containerNames[index % containerNames.length] + (index >= containerNames.length ? `-${Math.floor(index / containerNames.length)}` : ''),
      image: images[index % images.length],
      status: Math.random() > 0.1 ? 'running' : Math.random() > 0.5 ? 'exited' : 'restarting'
    })
  );
};

/**
 * Generate mock metrics data for charts
 */
export const generateMockMetrics = (count: number, timeRange: number = 3600000): MetricData[] => {
  const now = new Date();
  const interval = timeRange / count;
  
  return Array(count).fill(null).map((_, index) => {
    const timestamp = new Date(now.getTime() - (count - index - 1) * interval);
    return {
      timestamp: timestamp.toISOString(),
      value: Math.random() * 100,
      label: timestamp.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      })
    };
  });
};

/**
 * Generate realistic CPU metrics with patterns
 */
export const generateRealisticCpuMetrics = (count: number): MetricData[] => {
  const baseUsage = 20 + Math.random() * 30; // Base 20-50%
  const now = new Date();
  const interval = 60000; // 1 minute intervals
  
  return Array(count).fill(null).map((_, index) => {
    const timestamp = new Date(now.getTime() - (count - index - 1) * interval);
    
    // Add some realistic patterns
    const timeOfDay = timestamp.getHours();
    const dayMultiplier = timeOfDay >= 9 && timeOfDay <= 17 ? 1.5 : 0.8; // Higher during business hours
    const noise = (Math.random() - 0.5) * 20; // Random variation
    const spike = Math.random() < 0.05 ? Math.random() * 40 : 0; // 5% chance of spike
    
    const value = Math.max(0, Math.min(100, baseUsage * dayMultiplier + noise + spike));
    
    return {
      timestamp: timestamp.toISOString(),
      value: Math.round(value * 10) / 10, // Round to 1 decimal
      label: timestamp.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      })
    };
  });
};

/**
 * Generate mock alert rule
 */
export const createTestAlert = (overrides: Partial<AlertRule> = {}): AlertRule => {
  return {
    id: 'alert-' + Math.random().toString(36).substr(2, 9),
    name: 'Test Alert Rule',
    metric: 'cpu',
    threshold: 80,
    operator: '>',
    severity: 'warning',
    channels: ['email'],
    cooldown_minutes: 5,
    enabled: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides
  };
};

/**
 * Generate mock system metrics
 */
export const generateMockSystemMetrics = (): SystemMetrics => {
  return {
    timestamp: new Date().toISOString(),
    cpu: {
      usage: Math.random() * 100,
      cores: 8,
      load_average: [
        Math.random() * 2,
        Math.random() * 2,
        Math.random() * 2
      ]
    },
    memory: {
      total: 16384,
      used: Math.random() * 16384,
      free: 16384 - (Math.random() * 16384),
      percentage: Math.random() * 100
    },
    disk: {
      total: 512000,
      used: Math.random() * 512000,
      free: 512000 - (Math.random() * 512000),
      percentage: Math.random() * 100
    },
    network: {
      interfaces: [
        {
          name: 'eth0',
          rx: Math.floor(Math.random() * 1000000000),
          tx: Math.floor(Math.random() * 1000000000)
        }
      ]
    }
  };
};

/**
 * Simulate high load conditions for testing
 */
export const simulateHighLoad = async (duration: number = 5000): Promise<void> => {
  const startTime = Date.now();
  
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      if (Date.now() - startTime >= duration) {
        clearInterval(interval);
        resolve();
      }
      
      // Simulate CPU intensive task
      let result = 0;
      for (let i = 0; i < 1000000; i++) {
        result += Math.sqrt(i);
      }
    }, 10);
  });
};

/**
 * Mock Docker API responses
 */
export const mockDockerResponses = {
  containers: [
    {
      Id: 'sha256:abc123',
      Names: ['/nginx'],
      Image: 'nginx:latest',
      State: 'running',
      Status: 'Up 2 hours',
      Ports: [
        { PrivatePort: 80, PublicPort: 80, Type: 'tcp' }
      ],
      Created: Math.floor(Date.now() / 1000) - 7200
    },
    {
      Id: 'sha256:def456',
      Names: ['/redis'],
      Image: 'redis:alpine',
      State: 'running',
      Status: 'Up 5 hours',
      Ports: [
        { PrivatePort: 6379, PublicPort: 6379, Type: 'tcp' }
      ],
      Created: Math.floor(Date.now() / 1000) - 18000
    }
  ],
  stats: {
    cpu_stats: {
      cpu_usage: {
        total_usage: 1000000000,
        percpu_usage: [500000000, 500000000]
      },
      system_cpu_usage: 10000000000,
      online_cpus: 2
    },
    memory_stats: {
      usage: 104857600,
      limit: 2147483648
    },
    blkio_stats: {
      io_service_bytes_recursive: [
        { op: 'read', value: 1048576 },
        { op: 'write', value: 524288 }
      ]
    },
    networks: {
      eth0: {
        rx_bytes: 262144,
        tx_bytes: 131072
      }
    }
  }
};

/**
 * Wait for condition with timeout
 */
export const waitForCondition = async (
  condition: () => boolean | Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> => {
  const startTime = Date.now();
  
  return new Promise((resolve, reject) => {
    const check = async () => {
      try {
        if (await condition()) {
          resolve();
          return;
        }
        
        if (Date.now() - startTime >= timeout) {
          reject(new Error('Condition timeout'));
          return;
        }
        
        setTimeout(check, interval);
      } catch (error) {
        reject(error);
      }
    };
    
    check();
  });
};

/**
 * Create test database with sample data
 */
export const createTestDatabase = async () => {
  // Mock database setup
  return {
    async query(sql: string, params: any[] = []) {
      if (sql.includes('container_metrics')) {
        return {
          rows: Array(10).fill(null).map((_, i) => ({
            timestamp: new Date(Date.now() - i * 60000).toISOString(),
            container_id: 'container-1',
            container_name: 'nginx',
            cpu: Math.random() * 100,
            memory: Math.random() * 100
          }))
        };
      }
      
      if (sql.includes('alert_rules')) {
        return {
          rows: [
            createTestAlert({ name: 'High CPU Alert' }),
            createTestAlert({ name: 'High Memory Alert', metric: 'memory' })
          ]
        };
      }
      
      return { rows: [] };
    },
    
    async end() {
      // Cleanup
    }
  };
};

/**
 * Mock notification services
 */
export const mockNotificationServices = {
  email: {
    async sendMail(options: any) {
      console.log('Mock email sent:', options.subject);
      return { messageId: 'test-message-id' };
    }
  },
  
  slack: {
    async sendMessage(webhook: string, message: any) {
      console.log('Mock Slack message sent:', message.text);
      return { ok: true };
    }
  },
  
  webhook: {
    async post(url: string, data: any) {
      console.log('Mock webhook called:', url, data);
      return { status: 200, data: { success: true } };
    }
  }
};

/**
 * Performance testing utilities
 */
export const performanceHelpers = {
  /**
   * Measure execution time of a function
   */
  async measureTime<T>(fn: () => Promise<T> | T): Promise<{ result: T; duration: number }> {
    const start = performance.now();
    const result = await fn();
    const end = performance.now();
    
    return {
      result,
      duration: end - start
    };
  },

  /**
   * Run function multiple times and get average execution time
   */
  async benchmarkFunction<T>(
    fn: () => Promise<T> | T,
    iterations: number = 10
  ): Promise<{ averageDuration: number; minDuration: number; maxDuration: number }> {
    const durations: number[] = [];
    
    for (let i = 0; i < iterations; i++) {
      const { duration } = await this.measureTime(fn);
      durations.push(duration);
    }
    
    return {
      averageDuration: durations.reduce((a, b) => a + b) / durations.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations)
    };
  },

  /**
   * Simulate network latency
   */
  async simulateLatency(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
};

/**
 * Test data cleanup utilities
 */
export const cleanupHelpers = {
  /**
   * Clean up test containers
   */
  async cleanupTestContainers() {
    // Mock cleanup - in real implementation would stop/remove test containers
    console.log('Cleaning up test containers');
  },

  /**
   * Reset test database
   */
  async resetTestDatabase() {
    // Mock database reset
    console.log('Resetting test database');
  },

  /**
   * Clear test files
   */
  async clearTestFiles() {
    // Mock file cleanup
    console.log('Clearing test files');
  }
};

/**
 * Assert helpers for complex objects
 */
export const assertHelpers = {
  /**
   * Assert container has expected structure
   */
  assertValidContainer(container: any): asserts container is Container {
    expect(container).toHaveProperty('id');
    expect(container).toHaveProperty('name');
    expect(container).toHaveProperty('status');
    expect(typeof container.cpu).toBe('number');
    expect(typeof container.memory).toBe('number');
  },

  /**
   * Assert metric data has expected structure
   */
  assertValidMetricData(data: any): asserts data is MetricData {
    expect(data).toHaveProperty('timestamp');
    expect(data).toHaveProperty('value');
    expect(typeof data.value).toBe('number');
  },

  /**
   * Assert alert rule has expected structure
   */
  assertValidAlertRule(rule: any): asserts rule is AlertRule {
    expect(rule).toHaveProperty('id');
    expect(rule).toHaveProperty('name');
    expect(rule).toHaveProperty('metric');
    expect(rule).toHaveProperty('threshold');
    expect(rule).toHaveProperty('operator');
    expect(typeof rule.threshold).toBe('number');
  }
};