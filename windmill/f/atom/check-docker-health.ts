/**
 * Docker Health Check Script
 *
 * Checks the health status of all running Docker containers.
 * Returns a list of unhealthy containers and their status.
 *
 * @returns Array of container health information
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface ContainerHealth {
  id: string;
  name: string;
  status: string;
  health: string;
  uptime: string;
  image: string;
}

export async function main(): Promise<{
  healthy: ContainerHealth[];
  unhealthy: ContainerHealth[];
  total: number;
  timestamp: string;
}> {
  console.log('Checking Docker container health...');

  try {
    // Get list of all containers with health information
    const { stdout } = await execAsync(
      'docker ps --format "{{.ID}}|{{.Names}}|{{.Status}}|{{.RunningFor}}|{{.Image}}"'
    );

    const containers = stdout
      .trim()
      .split('\n')
      .filter(line => line.length > 0)
      .map(line => {
        const [id, name, status, uptime, image] = line.split('|');

        // Parse health status from docker status string
        let health = 'healthy';
        if (status.includes('(unhealthy)')) {
          health = 'unhealthy';
        } else if (status.includes('(health: starting)')) {
          health = 'starting';
        } else if (status.includes('Exited') || status.includes('Dead')) {
          health = 'stopped';
        }

        return {
          id: id.substring(0, 12), // Short ID
          name,
          status,
          health,
          uptime,
          image
        };
      });

    // Separate healthy and unhealthy containers
    const healthy = containers.filter(c => c.health === 'healthy');
    const unhealthy = containers.filter(c => c.health !== 'healthy');

    const result = {
      healthy,
      unhealthy,
      total: containers.length,
      timestamp: new Date().toISOString()
    };

    // Log summary
    console.log(`Total containers: ${result.total}`);
    console.log(`Healthy: ${healthy.length}`);
    console.log(`Unhealthy: ${unhealthy.length}`);

    if (unhealthy.length > 0) {
      console.warn('⚠️  Unhealthy containers detected:');
      unhealthy.forEach(c => {
        console.warn(`  - ${c.name} (${c.id}): ${c.health} - ${c.status}`);
      });
    }

    return result;
  } catch (error) {
    console.error('Error checking Docker health:', error);
    throw new Error(`Failed to check Docker health: ${error.message}`);
  }
}

// Allow running standalone for testing
if (require.main === module) {
  main()
    .then(result => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.unhealthy.length > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}
