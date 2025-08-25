import { Request } from 'express';

interface DockerContainer {
  id: string;
  name: string;
  image: string;
  status: string;
  state: string;
  created: string;
  ports: Array<{
    privatePort: number;
    publicPort?: number;
    type: string;
  }>;
  labels?: Record<string, string>;
  healthStatus?: string;
  stats?: {
    cpuUsage: number;
    memoryUsage: number;
    memoryLimit: number;
    networkRx: number;
    networkTx: number;
  };
}

interface DockerServiceConfig {
  name: string;
  container_name: string;
  image: string;
  status: 'running' | 'stopped' | 'error' | 'unknown';
  health_check_url?: string;
  ports: Array<{ host: number; container: number; protocol: string }>;
  environment: Record<string, string>;
  labels: Record<string, string>;
  priority: 'critical' | 'high' | 'medium' | 'low';
  service_type: 'vpn' | 'dns' | 'cache' | 'metrics' | 'management' | 'updater';
}

class DockerService {
  private containers: Map<string, DockerContainer> = new Map();
  private services: Map<string, DockerServiceConfig> = new Map();

  constructor() {
    this.initializeServices();
  }

  private initializeServices() {
    // Define HomeOps service configurations
    const services: DockerServiceConfig[] = [
      {
        name: 'gluetun',
        container_name: 'homeops-gluetun',
        image: 'qmcgaw/gluetun:latest',
        status: 'unknown',
        health_check_url: 'http://localhost:8000/health',
        ports: [
          { host: 53, container: 53, protocol: 'tcp' },
          { host: 53, container: 53, protocol: 'udp' },
          { host: 8080, container: 80, protocol: 'tcp' },
          { host: 6379, container: 6379, protocol: 'tcp' },
          { host: 5433, container: 5432, protocol: 'tcp' },
          { host: 8000, container: 8000, protocol: 'tcp' }
        ],
        environment: {
          VPN_SERVICE_PROVIDER: 'nordvpn',
          VPN_TYPE: 'openvpn',
          NORDVPN_USER: process.env.NORDVPN_USERNAME || '',
          NORDVPN_PASSWORD: process.env.NORDVPN_PASSWORD || '',
          NORDVPN_COUNTRY: process.env.NORDVPN_COUNTRY || 'United States'
        },
        labels: {
          'homeops.service': 'vpn',
          'homeops.priority': 'critical',
          'homeops.health_url': 'http://localhost:8000/health'
        },
        priority: 'critical',
        service_type: 'vpn'
      },
      {
        name: 'pihole',
        container_name: 'homeops-pihole',
        image: 'pihole/pihole:latest',
        status: 'unknown',
        health_check_url: 'http://localhost:8080/admin',
        ports: [],
        environment: {
          TZ: 'America/New_York',
          WEBPASSWORD: process.env.PIHOLE_ADMIN_PASSWORD || 'admin123',
          PIHOLE_DNS_1: '1.1.1.1',
          PIHOLE_DNS_2: '8.8.8.8'
        },
        labels: {
          'homeops.service': 'dns',
          'homeops.priority': 'high',
          'homeops.health_url': 'http://localhost:8080/admin'
        },
        priority: 'high',
        service_type: 'dns'
      },
      {
        name: 'redis',
        container_name: 'homeops-redis',
        image: 'redis:7-alpine',
        status: 'unknown',
        ports: [],
        environment: {
          REDIS_PASSWORD: process.env.REDIS_PASSWORD || 'homeops123'
        },
        labels: {
          'homeops.service': 'cache',
          'homeops.priority': 'medium'
        },
        priority: 'medium',
        service_type: 'cache'
      },
      {
        name: 'timescaledb',
        container_name: 'homeops-timescaledb',
        image: 'timescale/timescaledb:latest-pg15',
        status: 'unknown',
        ports: [],
        environment: {
          POSTGRES_DB: process.env.TIMESCALE_DB || 'homeops_metrics',
          POSTGRES_USER: process.env.TIMESCALE_USER || 'homeops',
          POSTGRES_PASSWORD: process.env.TIMESCALE_PASSWORD || 'localdev123'
        },
        labels: {
          'homeops.service': 'metrics',
          'homeops.priority': 'medium'
        },
        priority: 'medium',
        service_type: 'metrics'
      },
      {
        name: 'portainer',
        container_name: 'homeops-portainer',
        image: 'portainer/portainer-ce:latest',
        status: 'unknown',
        health_check_url: 'http://localhost:9000/api/status',
        ports: [
          { host: 9000, container: 9000, protocol: 'tcp' }
        ],
        environment: {
          VIRTUAL_HOST: 'portainer.homeops.local'
        },
        labels: {
          'homeops.service': 'management',
          'homeops.priority': 'low'
        },
        priority: 'low',
        service_type: 'management'
      }
    ];

    services.forEach(service => {
      this.services.set(service.name, service);
    });

    console.log(`Docker Service: Initialized ${services.length} HomeOps service configurations`);
  }

  // Simulate Docker MCP integration - replace with actual MCP calls when available
  async listContainers(): Promise<DockerContainer[]> {
    try {
      // TODO: Replace with actual Docker MCP call
      // const containers = await dockerMCP.listContainers();
      
      // For now, simulate container data based on our service definitions
      const mockContainers: DockerContainer[] = Array.from(this.services.values()).map(service => ({
        id: `mock-${service.name}-${Date.now()}`,
        name: service.container_name,
        image: service.image,
        status: this.generateMockStatus(),
        state: this.generateMockState(),
        created: new Date().toISOString(),
        ports: service.ports.map(p => ({
          privatePort: p.container,
          publicPort: p.host,
          type: p.protocol
        })),
        labels: service.labels,
        healthStatus: this.generateMockHealthStatus(),
        stats: this.generateMockStats()
      }));

      // Update internal container cache
      mockContainers.forEach(container => {
        this.containers.set(container.name, container);
      });

      return mockContainers;
    } catch (error) {
      console.error('Docker Service: Failed to list containers:', error);
      throw new Error('Failed to retrieve container list');
    }
  }

  async getContainer(nameOrId: string): Promise<DockerContainer | null> {
    try {
      // TODO: Replace with actual Docker MCP call
      // const container = await dockerMCP.getContainer(nameOrId);
      
      const container = this.containers.get(nameOrId);
      if (container) {
        // Refresh stats
        container.stats = this.generateMockStats();
        return container;
      }

      // Try to find by ID prefix
      for (const [name, cont] of this.containers) {
        if (cont.id.startsWith(nameOrId)) {
          cont.stats = this.generateMockStats();
          return cont;
        }
      }

      return null;
    } catch (error) {
      console.error(`Docker Service: Failed to get container ${nameOrId}:`, error);
      return null;
    }
  }

  async startContainer(nameOrId: string): Promise<boolean> {
    try {
      // TODO: Replace with actual Docker MCP call
      // const result = await dockerMCP.startContainer(nameOrId);
      
      console.log(`Docker Service: Starting container: ${nameOrId}`);
      
      // Update container status in cache
      const container = this.containers.get(nameOrId);
      if (container) {
        container.status = 'running';
        container.state = 'running';
        container.healthStatus = 'starting';
      }

      return true;
    } catch (error) {
      console.error(`Docker Service: Failed to start container ${nameOrId}:`, error);
      return false;
    }
  }

  async stopContainer(nameOrId: string): Promise<boolean> {
    try {
      // TODO: Replace with actual Docker MCP call
      // const result = await dockerMCP.stopContainer(nameOrId);
      
      console.log(`Docker Service: Stopping container: ${nameOrId}`);
      
      // Update container status in cache
      const container = this.containers.get(nameOrId);
      if (container) {
        container.status = 'exited';
        container.state = 'exited';
        container.healthStatus = 'none';
      }

      return true;
    } catch (error) {
      console.error(`Docker Service: Failed to stop container ${nameOrId}:`, error);
      return false;
    }
  }

  async restartContainer(nameOrId: string): Promise<boolean> {
    try {
      // TODO: Replace with actual Docker MCP call
      // const result = await dockerMCP.restartContainer(nameOrId);
      
      console.log(`Docker Service: Restarting container: ${nameOrId}`);
      
      // Update container status in cache
      const container = this.containers.get(nameOrId);
      if (container) {
        container.status = 'running';
        container.state = 'running';
        container.healthStatus = 'starting';
      }

      return true;
    } catch (error) {
      console.error(`Docker Service: Failed to restart container ${nameOrId}:`, error);
      return false;
    }
  }

  async getServiceHealth(): Promise<Array<{
    name: string;
    status: string;
    health: string;
    uptime?: string;
    lastCheck: string;
  }>> {
    const containers = await this.listContainers();
    
    return containers.map(container => {
      const service = this.services.get(container.name.replace('homeops-', ''));
      return {
        name: service?.name || container.name,
        status: container.status,
        health: container.healthStatus || 'unknown',
        uptime: this.calculateUptime(container.created),
        lastCheck: new Date().toISOString()
      };
    });
  }

  getServiceConfig(serviceName: string): DockerServiceConfig | null {
    return this.services.get(serviceName) || null;
  }

  getAllServiceConfigs(): DockerServiceConfig[] {
    return Array.from(this.services.values());
  }

  // Mock data generators (remove when Docker MCP is integrated)
  private generateMockStatus(): string {
    const statuses = ['running', 'exited', 'paused', 'restarting'];
    return statuses[Math.floor(Math.random() * statuses.length)];
  }

  private generateMockState(): string {
    const states = ['running', 'exited', 'paused', 'restarting', 'dead'];
    return states[Math.floor(Math.random() * states.length)];
  }

  private generateMockHealthStatus(): string {
    const healthStatuses = ['healthy', 'unhealthy', 'starting', 'none'];
    return healthStatuses[Math.floor(Math.random() * healthStatuses.length)];
  }

  private generateMockStats() {
    return {
      cpuUsage: Math.random() * 100,
      memoryUsage: Math.floor(Math.random() * 1024 * 1024 * 500), // Up to 500MB
      memoryLimit: 1024 * 1024 * 1024, // 1GB limit
      networkRx: Math.floor(Math.random() * 1024 * 1024), // Up to 1MB
      networkTx: Math.floor(Math.random() * 1024 * 1024)  // Up to 1MB
    };
  }

  private calculateUptime(created: string): string {
    const createdTime = new Date(created);
    const now = new Date();
    const diffMs = now.getTime() - createdTime.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${diffHours}h ${diffMinutes}m`;
  }
}

export const dockerService = new DockerService();
export default dockerService;