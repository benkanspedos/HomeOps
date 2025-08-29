import { EventEmitter } from 'events';
import { Agent, AgentStatus, DelegationConfig } from '../../types/delegation.js';
import { DelegationMessageBroker } from './message-broker.js';
import { logger } from '../../utils/logger.js';

export interface AgentCapability {
  name: string;
  description: string;
  version: string;
  parameters?: Record<string, any>;
}

export interface AgentMetrics {
  tasksCompleted: number;
  tasksInProgress: number;
  tasksFailed: number;
  averageTaskDuration: number;
  lastTaskCompletedAt?: number;
  successRate: number;
  uptimeSeconds: number;
}

export interface EnhancedAgent extends Agent {
  capabilities: string[];
  detailedCapabilities?: AgentCapability[];
  metrics?: AgentMetrics;
  healthScore: number;
  isHealthy: boolean;
}

export class AgentRegistry extends EventEmitter {
  private messageBroker: DelegationMessageBroker;
  private config: DelegationConfig;
  private agents = new Map<string, EnhancedAgent>();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private metricsUpdateInterval: NodeJS.Timeout | null = null;
  private capabilityIndex = new Map<string, Set<string>>(); // capability -> Set of agentIds

  constructor(messageBroker: DelegationMessageBroker, config: DelegationConfig) {
    super();
    this.messageBroker = messageBroker;
    this.config = config;
    
    this.setupEventHandlers();
    this.startHealthChecking();
    this.startMetricsUpdating();
    
    logger.info('Agent Registry initialized');
  }

  private setupEventHandlers(): void {
    // Listen for agent registration
    this.messageBroker.on('agent_registered', (agent: Agent) => {
      this.registerAgent(agent);
    });

    // Listen for agent heartbeats
    this.messageBroker.on('agent_heartbeat', ({ agent }: { agent: Agent }) => {
      this.updateAgentFromHeartbeat(agent);
    });

    // Listen for task responses to update metrics
    this.messageBroker.on('task_response', (response: any) => {
      this.updateAgentMetrics(response);
    });
  }

  public async registerAgent(agent: Agent): Promise<void> {
    try {
      const enhancedAgent: EnhancedAgent = {
        ...agent,
        healthScore: 100,
        isHealthy: true,
        metrics: {
          tasksCompleted: 0,
          tasksInProgress: 0,
          tasksFailed: 0,
          averageTaskDuration: 0,
          successRate: 100,
          uptimeSeconds: 0
        }
      };

      // Store in local registry
      this.agents.set(agent.id, enhancedAgent);
      
      // Update capability index
      this.updateCapabilityIndex(agent.id, agent.capabilities, []);
      
      // Store in Redis via message broker
      await this.messageBroker.storeAgent(agent);
      
      logger.info(`Agent registered in registry: ${agent.name} (${agent.id})`);
      logger.debug(`Agent capabilities:`, agent.capabilities);
      
      this.emit('agent_registered', enhancedAgent);
      
    } catch (error) {
      logger.error(`Failed to register agent ${agent.id}:`, error);
    }
  }

  public async unregisterAgent(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    
    if (agent) {
      // Remove from capability index
      this.updateCapabilityIndex(agentId, [], agent.capabilities);
      
      // Remove from local registry
      this.agents.delete(agentId);
      
      logger.info(`Agent unregistered from registry: ${agent.name} (${agentId})`);
      
      this.emit('agent_unregistered', agent);
    }
  }

  private updateAgentFromHeartbeat(agent: Agent): void {
    const existingAgent = this.agents.get(agent.id);
    
    if (existingAgent) {
      // Update existing agent with heartbeat data
      const updatedAgent: EnhancedAgent = {
        ...existingAgent,
        ...agent,
        // Preserve enhanced properties
        healthScore: existingAgent.healthScore,
        isHealthy: existingAgent.isHealthy,
        metrics: existingAgent.metrics
      };

      this.agents.set(agent.id, updatedAgent);
      
      // Update health score based on heartbeat regularity
      this.updateAgentHealth(agent.id);
      
      this.emit('agent_heartbeat', updatedAgent);
    }
  }

  private updateAgentMetrics(taskResponse: any): void {
    const agent = this.agents.get(taskResponse.agentId);
    
    if (!agent || !agent.metrics) return;

    const metrics = agent.metrics;
    
    if (taskResponse.status === 'completed') {
      metrics.tasksCompleted++;
      metrics.lastTaskCompletedAt = Date.now();
      
      // Update average task duration if we have the data
      // TODO: Calculate duration from task start time
      
    } else if (taskResponse.status === 'failed') {
      metrics.tasksFailed++;
    }

    // Update success rate
    const totalTasks = metrics.tasksCompleted + metrics.tasksFailed;
    metrics.successRate = totalTasks > 0 ? (metrics.tasksCompleted / totalTasks) * 100 : 100;
    
    // Update health score based on success rate
    this.updateAgentHealth(agent.id);
    
    this.emit('agent_metrics_updated', { agentId: agent.id, metrics });
  }

  private updateAgentHealth(agentId: string): void {
    const agent = this.agents.get(agentId);
    
    if (!agent) return;

    let healthScore = 100;
    
    // Factor in success rate
    if (agent.metrics) {
      healthScore *= (agent.metrics.successRate / 100);
    }
    
    // Factor in heartbeat regularity
    const now = Date.now();
    const timeSinceLastSeen = now - agent.lastSeen;
    const heartbeatInterval = this.config.agents.heartbeatInterval;
    
    if (timeSinceLastSeen > heartbeatInterval * 2) {
      healthScore *= 0.8; // 20% penalty for late heartbeat
    }
    
    if (timeSinceLastSeen > heartbeatInterval * 4) {
      healthScore *= 0.5; // 50% penalty for very late heartbeat
    }
    
    // Factor in current load
    const loadFactor = agent.currentTasks / agent.maxConcurrentTasks;
    if (loadFactor > 0.8) {
      healthScore *= 0.9; // 10% penalty for high load
    }
    
    agent.healthScore = Math.max(0, Math.min(100, healthScore));
    agent.isHealthy = agent.healthScore > 50 && agent.status === AgentStatus.AVAILABLE;
    
    if (!agent.isHealthy && agent.status === AgentStatus.AVAILABLE) {
      logger.warn(`Agent ${agent.name} (${agent.id}) health degraded: score ${agent.healthScore.toFixed(1)}`);
    }
  }

  private updateCapabilityIndex(agentId: string, newCapabilities: string[], oldCapabilities: string[]): void {
    // Remove from old capabilities
    for (const capability of oldCapabilities) {
      const agentSet = this.capabilityIndex.get(capability);
      if (agentSet) {
        agentSet.delete(agentId);
        if (agentSet.size === 0) {
          this.capabilityIndex.delete(capability);
        }
      }
    }
    
    // Add to new capabilities
    for (const capability of newCapabilities) {
      if (!this.capabilityIndex.has(capability)) {
        this.capabilityIndex.set(capability, new Set());
      }
      this.capabilityIndex.get(capability)!.add(agentId);
    }
  }

  private startHealthChecking(): void {
    this.healthCheckInterval = setInterval(() => {
      for (const [agentId] of this.agents) {
        this.updateAgentHealth(agentId);
      }
    }, this.config.agents.heartbeatInterval);
  }

  private startMetricsUpdating(): void {
    this.metricsUpdateInterval = setInterval(async () => {
      for (const [agentId, agent] of this.agents) {
        if (agent.metrics && agent.registeredAt) {
          agent.metrics.uptimeSeconds = Math.floor((Date.now() - agent.registeredAt) / 1000);
        }
      }
    }, 60000); // Update every minute
  }

  // Public Query Methods
  public getAgent(agentId: string): EnhancedAgent | undefined {
    return this.agents.get(agentId);
  }

  public getAllAgents(): EnhancedAgent[] {
    return Array.from(this.agents.values());
  }

  public getActiveAgents(): EnhancedAgent[] {
    return Array.from(this.agents.values()).filter(agent => 
      agent.status === AgentStatus.AVAILABLE && agent.isHealthy
    );
  }

  public getAgentsByCapability(capability: string): EnhancedAgent[] {
    const agentIds = this.capabilityIndex.get(capability) || new Set();
    return Array.from(agentIds)
      .map(id => this.agents.get(id))
      .filter((agent): agent is EnhancedAgent => agent !== undefined);
  }

  public getAgentsByCapabilities(capabilities: string[], requireAll = true): EnhancedAgent[] {
    if (capabilities.length === 0) {
      return this.getActiveAgents();
    }

    if (requireAll) {
      // Agent must have all capabilities
      return this.getActiveAgents().filter(agent =>
        capabilities.every(cap => agent.capabilities.includes(cap))
      );
    } else {
      // Agent must have at least one capability
      const agentIds = new Set<string>();
      
      for (const capability of capabilities) {
        const capabilityAgents = this.capabilityIndex.get(capability) || new Set();
        capabilityAgents.forEach(id => agentIds.add(id));
      }
      
      return Array.from(agentIds)
        .map(id => this.agents.get(id))
        .filter((agent): agent is EnhancedAgent => 
          agent !== undefined && agent.isHealthy && agent.status === AgentStatus.AVAILABLE
        );
    }
  }

  public findBestAgent(
    capabilities: string[], 
    options: {
      requireAll?: boolean;
      preferLowLoad?: boolean;
      preferHighSuccess?: boolean;
      preferHighHealth?: boolean;
    } = {}
  ): EnhancedAgent | null {
    const {
      requireAll = true,
      preferLowLoad = true,
      preferHighSuccess = true,
      preferHighHealth = true
    } = options;

    const candidateAgents = this.getAgentsByCapabilities(capabilities, requireAll);
    
    if (candidateAgents.length === 0) {
      return null;
    }

    if (candidateAgents.length === 1) {
      return candidateAgents[0];
    }

    // Score agents based on preferences
    const scoredAgents = candidateAgents.map(agent => {
      let score = 0;
      
      if (preferLowLoad) {
        const loadFactor = agent.currentTasks / agent.maxConcurrentTasks;
        score += (1 - loadFactor) * 30; // 30 points max for low load
      }
      
      if (preferHighSuccess && agent.metrics) {
        score += (agent.metrics.successRate / 100) * 30; // 30 points max for high success
      }
      
      if (preferHighHealth) {
        score += (agent.healthScore / 100) * 40; // 40 points max for health
      }
      
      return { agent, score };
    });

    // Sort by score (highest first)
    scoredAgents.sort((a, b) => b.score - a.score);
    
    return scoredAgents[0].agent;
  }

  public getAvailableCapabilities(): string[] {
    return Array.from(this.capabilityIndex.keys()).sort();
  }

  public getCapabilityStats(): Record<string, { agentCount: number; activeCount: number }> {
    const stats: Record<string, { agentCount: number; activeCount: number }> = {};
    
    for (const [capability, agentIds] of this.capabilityIndex) {
      const agents = Array.from(agentIds).map(id => this.agents.get(id)).filter(Boolean) as EnhancedAgent[];
      
      stats[capability] = {
        agentCount: agents.length,
        activeCount: agents.filter(agent => agent.isHealthy && agent.status === AgentStatus.AVAILABLE).length
      };
    }
    
    return stats;
  }

  public getRegistryStats(): any {
    const agents = this.getAllAgents();
    
    return {
      totalAgents: agents.length,
      activeAgents: agents.filter(a => a.status === AgentStatus.AVAILABLE).length,
      healthyAgents: agents.filter(a => a.isHealthy).length,
      busyAgents: agents.filter(a => a.status === AgentStatus.BUSY).length,
      offlineAgents: agents.filter(a => a.status === AgentStatus.OFFLINE).length,
      averageHealthScore: agents.length > 0 ? 
        agents.reduce((sum, a) => sum + a.healthScore, 0) / agents.length : 0,
      totalCapabilities: this.capabilityIndex.size,
      capabilityStats: this.getCapabilityStats()
    };
  }

  public async cleanup(): Promise<void> {
    logger.info('Cleaning up Agent Registry...');
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    if (this.metricsUpdateInterval) {
      clearInterval(this.metricsUpdateInterval);
    }
    
    this.agents.clear();
    this.capabilityIndex.clear();
    
    logger.info('Agent Registry cleanup complete');
  }
}