/**
 * System Resource Check Script
 *
 * Monitors system resources (CPU, memory, disk) and returns current usage.
 * Compares against thresholds and flags resources that are running high.
 *
 * @returns System resource usage information
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface ResourceUsage {
  cpu: {
    usage: number;
    threshold: number;
    status: 'ok' | 'warning' | 'critical';
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
    threshold: number;
    status: 'ok' | 'warning' | 'critical';
  };
  disk: {
    used: number;
    total: number;
    percentage: number;
    threshold: number;
    status: 'ok' | 'warning' | 'critical';
  };
  timestamp: string;
}

/**
 * Get CPU usage percentage (simple average over 1 second)
 */
async function getCpuUsage(): Promise<number> {
  try {
    // For Windows
    if (process.platform === 'win32') {
      const { stdout } = await execAsync(
        'wmic cpu get loadpercentage /value'
      );
      const match = stdout.match(/LoadPercentage=(\d+)/);
      return match ? parseInt(match[1]) : 0;
    }

    // For Linux/Mac
    const { stdout } = await execAsync(
      "top -bn1 | grep 'Cpu(s)' | sed 's/.*, *\\([0-9.]*\\)%* id.*/\\1/' | awk '{print 100 - $1}'"
    );
    return parseFloat(stdout.trim()) || 0;
  } catch (error) {
    console.error('Error getting CPU usage:', error);
    return 0;
  }
}

/**
 * Get memory usage (in MB and percentage)
 */
async function getMemoryUsage(): Promise<{ used: number; total: number; percentage: number }> {
  try {
    // For Windows
    if (process.platform === 'win32') {
      const { stdout } = await execAsync(
        'wmic OS get FreePhysicalMemory,TotalVisibleMemorySize /value'
      );
      const totalMatch = stdout.match(/TotalVisibleMemorySize=(\d+)/);
      const freeMatch = stdout.match(/FreePhysicalMemory=(\d+)/);

      if (totalMatch && freeMatch) {
        const total = parseInt(totalMatch[1]) / 1024; // Convert to MB
        const free = parseInt(freeMatch[1]) / 1024;
        const used = total - free;
        return {
          used: Math.round(used),
          total: Math.round(total),
          percentage: Math.round((used / total) * 100)
        };
      }
    }

    // For Linux/Mac
    const { stdout } = await execAsync('free -m');
    const lines = stdout.split('\n');
    const memLine = lines[1].split(/\s+/);
    const total = parseInt(memLine[1]);
    const used = parseInt(memLine[2]);

    return {
      used,
      total,
      percentage: Math.round((used / total) * 100)
    };
  } catch (error) {
    console.error('Error getting memory usage:', error);
    return { used: 0, total: 0, percentage: 0 };
  }
}

/**
 * Get disk usage for root partition
 */
async function getDiskUsage(): Promise<{ used: number; total: number; percentage: number }> {
  try {
    // For Windows
    if (process.platform === 'win32') {
      const { stdout } = await execAsync(
        'wmic logicaldisk where "DeviceID=\'C:\'" get FreeSpace,Size /value'
      );
      const sizeMatch = stdout.match(/Size=(\d+)/);
      const freeMatch = stdout.match(/FreeSpace=(\d+)/);

      if (sizeMatch && freeMatch) {
        const total = parseInt(sizeMatch[1]) / (1024 ** 3); // Convert to GB
        const free = parseInt(freeMatch[1]) / (1024 ** 3);
        const used = total - free;
        return {
          used: Math.round(used),
          total: Math.round(total),
          percentage: Math.round((used / total) * 100)
        };
      }
    }

    // For Linux/Mac
    const { stdout } = await execAsync('df -BG / | tail -1');
    const parts = stdout.split(/\s+/);
    const total = parseInt(parts[1]);
    const used = parseInt(parts[2]);

    return {
      used,
      total,
      percentage: parseInt(parts[4])
    };
  } catch (error) {
    console.error('Error getting disk usage:', error);
    return { used: 0, total: 0, percentage: 0 };
  }
}

/**
 * Determine status based on usage and threshold
 */
function getStatus(usage: number, threshold: number): 'ok' | 'warning' | 'critical' {
  if (usage >= threshold) {
    return 'critical';
  } else if (usage >= threshold * 0.8) {
    return 'warning';
  }
  return 'ok';
}

export async function main(): Promise<ResourceUsage> {
  console.log('Checking system resources...');

  // Get thresholds from environment or use defaults
  const CPU_THRESHOLD = parseInt(process.env.CPU_USAGE_THRESHOLD || '80');
  const MEMORY_THRESHOLD = parseInt(process.env.MEMORY_USAGE_THRESHOLD || '85');
  const DISK_THRESHOLD = parseInt(process.env.DISK_USAGE_THRESHOLD || '90');

  // Gather resource usage
  const [cpu, memory, disk] = await Promise.all([
    getCpuUsage(),
    getMemoryUsage(),
    getDiskUsage()
  ]);

  const result: ResourceUsage = {
    cpu: {
      usage: Math.round(cpu),
      threshold: CPU_THRESHOLD,
      status: getStatus(cpu, CPU_THRESHOLD)
    },
    memory: {
      used: memory.used,
      total: memory.total,
      percentage: memory.percentage,
      threshold: MEMORY_THRESHOLD,
      status: getStatus(memory.percentage, MEMORY_THRESHOLD)
    },
    disk: {
      used: disk.used,
      total: disk.total,
      percentage: disk.percentage,
      threshold: DISK_THRESHOLD,
      status: getStatus(disk.percentage, DISK_THRESHOLD)
    },
    timestamp: new Date().toISOString()
  };

  // Log summary
  console.log('=== System Resource Usage ===');
  console.log(`CPU: ${result.cpu.usage}% [${result.cpu.status}]`);
  console.log(
    `Memory: ${result.memory.percentage}% (${result.memory.used}/${result.memory.total} MB) [${result.memory.status}]`
  );
  console.log(
    `Disk: ${result.disk.percentage}% (${result.disk.used}/${result.disk.total} GB) [${result.disk.status}]`
  );

  // Warn if any resource is critical
  const criticalResources = [];
  if (result.cpu.status === 'critical') criticalResources.push('CPU');
  if (result.memory.status === 'critical') criticalResources.push('Memory');
  if (result.disk.status === 'critical') criticalResources.push('Disk');

  if (criticalResources.length > 0) {
    console.warn(`⚠️  CRITICAL: ${criticalResources.join(', ')} usage is above threshold!`);
  }

  return result;
}

// Allow running standalone for testing
if (require.main === module) {
  main()
    .then(result => {
      console.log(JSON.stringify(result, null, 2));
      const hasCritical =
        result.cpu.status === 'critical' ||
        result.memory.status === 'critical' ||
        result.disk.status === 'critical';
      process.exit(hasCritical ? 1 : 0);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}
