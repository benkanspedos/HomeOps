import { DelegationConfig } from '../types/delegation.js';

export const delegationConfig: DelegationConfig = {
  websocket: {
    port: parseInt(process.env.DELEGATION_WS_PORT || '3201'),
    path: '/delegation',
    pingInterval: 30000, // 30 seconds
    pongTimeout: 5000,   // 5 seconds
    maxConnections: 100  // Maximum concurrent connections
  },
  
  tasks: {
    defaultTimeout: 300000,    // 5 minutes default timeout
    defaultRetries: 3,         // Default number of retries
    maxQueueSize: 1000,        // Maximum tasks in queue
    priorityLevels: 10         // Priority levels (0-9, 9 highest)
  },
  
  agents: {
    heartbeatInterval: 30000,     // 30 seconds between heartbeats
    maxMissedHeartbeats: 3,       // Mark agent as stale after 3 missed heartbeats
    registrationTimeout: 60000    // 1 minute to complete registration
  },
  
  redis: {
    keyPrefix: 'homeops:delegation:',
    taskTtl: 86400,              // 24 hours task TTL
    agentTtl: 3600               // 1 hour agent TTL
  }
};

export const getDelegationConfig = (): DelegationConfig => {
  return {
    ...delegationConfig,
    websocket: {
      ...delegationConfig.websocket,
      port: parseInt(process.env.DELEGATION_WS_PORT || delegationConfig.websocket.port.toString())
    }
  };
};