import { useState, useEffect, useMemo } from 'react';

export interface CommandSuggestion {
  command: string;
  description: string;
  category: 'container' | 'health' | 'dns' | 'system' | 'alert';
  confidence?: number;
  parameters?: string[];
}

const COMMAND_DATABASE: CommandSuggestion[] = [
  // Container Management
  { command: 'list containers', description: 'Show all Docker containers', category: 'container' },
  { command: 'show running containers', description: 'Display only running containers', category: 'container' },
  { command: 'restart {container}', description: 'Restart a specific container', category: 'container', parameters: ['container'] },
  { command: 'stop {container}', description: 'Stop a running container', category: 'container', parameters: ['container'] },
  { command: 'start {container}', description: 'Start a stopped container', category: 'container', parameters: ['container'] },
  { command: 'show container logs {container}', description: 'View container logs', category: 'container', parameters: ['container'] },
  { command: 'container status', description: 'Check status of all containers', category: 'container' },
  
  // Health Monitoring
  { command: 'system health', description: 'Display overall system health', category: 'health' },
  { command: 'show system status', description: 'View detailed system status', category: 'health' },
  { command: 'check health', description: 'Run health checks', category: 'health' },
  { command: 'system metrics', description: 'Display system metrics', category: 'health' },
  { command: 'cpu usage', description: 'Show CPU utilization', category: 'health' },
  { command: 'memory usage', description: 'Display memory statistics', category: 'health' },
  { command: 'disk usage', description: 'Show disk space information', category: 'health' },
  
  // DNS Management
  { command: 'dns status', description: 'Check DNS service status', category: 'dns' },
  { command: 'show dns queries', description: 'Display recent DNS queries', category: 'dns' },
  { command: 'top blocked domains', description: 'Show most blocked domains', category: 'dns' },
  { command: 'add domain {domain}', description: 'Add domain to blocklist', category: 'dns', parameters: ['domain'] },
  { command: 'remove domain {domain}', description: 'Remove domain from blocklist', category: 'dns', parameters: ['domain'] },
  { command: 'dns performance', description: 'View DNS performance metrics', category: 'dns' },
  { command: 'flush dns cache', description: 'Clear DNS cache', category: 'dns' },
  
  // System Operations
  { command: 'show logs', description: 'Display system logs', category: 'system' },
  { command: 'recent logs', description: 'Show recent log entries', category: 'system' },
  { command: 'system uptime', description: 'Display system uptime', category: 'system' },
  { command: 'network status', description: 'Check network connectivity', category: 'system' },
  { command: 'backup status', description: 'View backup status', category: 'system' },
  { command: 'system resources', description: 'Display resource usage', category: 'system' },
  
  // Alerts & Notifications
  { command: 'show alerts', description: 'Display active alerts', category: 'alert' },
  { command: 'recent alerts', description: 'View recent alert history', category: 'alert' },
  { command: 'clear alerts', description: 'Clear resolved alerts', category: 'alert' },
  { command: 'alert settings', description: 'View alert configuration', category: 'alert' },
  { command: 'test alert', description: 'Send test alert', category: 'alert' },
];

// Common container names for parameter suggestions
const COMMON_CONTAINERS = [
  'pihole',
  'nginx',
  'redis',
  'timescaledb',
  'postgres',
  'homeassistant',
  'portainer',
  'grafana',
  'prometheus'
];

export function useCommandSuggestions(input: string = '') {
  const [suggestions, setSuggestions] = useState<CommandSuggestion[]>([]);
  const [recentCommands, setRecentCommands] = useState<string[]>([]);

  // Load recent commands from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('homeops_recent_commands');
    if (stored) {
      try {
        setRecentCommands(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to load recent commands:', e);
      }
    }
  }, []);

  // Save command to history
  const addToHistory = (command: string) => {
    const updated = [command, ...recentCommands.filter(c => c !== command)].slice(0, 10);
    setRecentCommands(updated);
    localStorage.setItem('homeops_recent_commands', JSON.stringify(updated));
  };

  // Calculate suggestions based on input
  useEffect(() => {
    if (!input || input.length < 2) {
      setSuggestions([]);
      return;
    }

    const normalizedInput = input.toLowerCase().trim();
    const words = normalizedInput.split(' ');
    
    // Score and filter suggestions
    const scored = COMMAND_DATABASE.map(suggestion => {
      let score = 0;
      const commandWords = suggestion.command.toLowerCase().split(' ');
      
      // Check for exact prefix match
      if (suggestion.command.toLowerCase().startsWith(normalizedInput)) {
        score += 100;
      }
      
      // Check for word matches
      words.forEach(word => {
        if (suggestion.command.toLowerCase().includes(word)) {
          score += 50;
        }
        if (suggestion.description.toLowerCase().includes(word)) {
          score += 20;
        }
      });
      
      // Check for fuzzy matching
      const inputChars = normalizedInput.replace(/\s/g, '');
      const commandChars = suggestion.command.toLowerCase().replace(/\s/g, '');
      if (commandChars.includes(inputChars)) {
        score += 30;
      }
      
      // Boost score for recent commands
      if (recentCommands.includes(suggestion.command)) {
        score += 40;
      }
      
      return { ...suggestion, confidence: score / 100 };
    });
    
    // Filter and sort by score
    const filtered = scored
      .filter(s => s.confidence && s.confidence > 0.2)
      .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
      .slice(0, 10);
    
    setSuggestions(filtered);
  }, [input, recentCommands]);

  // Get parameter suggestions for commands with placeholders
  const getParameterSuggestions = (command: string): string[] => {
    if (command.includes('{container}')) {
      return COMMON_CONTAINERS.map(container => 
        command.replace('{container}', container)
      );
    }
    
    if (command.includes('{domain}')) {
      // Return example domains
      return [
        command.replace('{domain}', 'example.com'),
        command.replace('{domain}', 'ads.google.com'),
        command.replace('{domain}', 'tracking.site.com')
      ];
    }
    
    return [command];
  };

  // Get category-specific suggestions
  const getSuggestionsByCategory = (category: CommandSuggestion['category']) => {
    return COMMAND_DATABASE.filter(s => s.category === category);
  };

  // Get quick commands (most commonly used)
  const quickCommands = useMemo(() => {
    const defaultQuick = [
      'system health',
      'list containers',
      'show alerts',
      'dns status',
      'system metrics'
    ];
    
    // Merge with recent commands
    const combined = [...new Set([...recentCommands.slice(0, 3), ...defaultQuick])];
    return combined.slice(0, 5);
  }, [recentCommands]);

  // Fuzzy search for commands
  const searchCommands = (query: string): CommandSuggestion[] => {
    if (!query) return [];
    
    const normalizedQuery = query.toLowerCase();
    return COMMAND_DATABASE.filter(cmd => {
      const searchText = `${cmd.command} ${cmd.description}`.toLowerCase();
      return searchText.includes(normalizedQuery);
    });
  };

  // Get command help
  const getCommandHelp = (command: string): CommandSuggestion | undefined => {
    return COMMAND_DATABASE.find(cmd => 
      cmd.command.toLowerCase() === command.toLowerCase()
    );
  };

  return {
    suggestions,
    recentCommands,
    quickCommands,
    addToHistory,
    getParameterSuggestions,
    getSuggestionsByCategory,
    searchCommands,
    getCommandHelp,
    allCommands: COMMAND_DATABASE
  };
}

export default useCommandSuggestions;