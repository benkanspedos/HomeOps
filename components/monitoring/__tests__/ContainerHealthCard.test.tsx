import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ContainerHealthCard } from '../ContainerHealthCard';
import { Container } from '../../../types/monitoring';

const mockContainer: Container = {
  id: 'container-123',
  name: 'nginx',
  image: 'nginx:latest',
  status: 'running',
  cpu: 25.5,
  memory: 45.2,
  disk_read: 1048576,
  disk_write: 524288,
  network_rx: 262144,
  network_tx: 131072,
  uptime: '2 hours',
  ports: ['80:80', '443:443'],
  created_at: '2024-01-20T08:00:00Z'
};

describe('ContainerHealthCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Display', () => {
    it('displays container status correctly', () => {
      render(<ContainerHealthCard container={mockContainer} />);
      
      expect(screen.getByText('nginx')).toBeInTheDocument();
      expect(screen.getByText('Running')).toBeInTheDocument();
      expect(screen.getByText('nginx:latest')).toBeInTheDocument();
      expect(screen.getByText('2 hours')).toBeInTheDocument();
    });

    it('shows correct status icon for running containers', () => {
      render(<ContainerHealthCard container={mockContainer} />);
      
      const statusIcon = screen.getByTestId('status-icon');
      expect(statusIcon).toHaveClass('text-green-500');
      expect(statusIcon).toHaveAttribute('aria-label', 'Container running');
    });

    it('shows correct status icon for stopped containers', () => {
      const stoppedContainer = { ...mockContainer, status: 'exited' };
      render(<ContainerHealthCard container={stoppedContainer} />);
      
      const statusIcon = screen.getByTestId('status-icon');
      expect(statusIcon).toHaveClass('text-red-500');
      expect(statusIcon).toHaveAttribute('aria-label', 'Container stopped');
    });

    it('displays resource usage metrics', () => {
      render(<ContainerHealthCard container={mockContainer} />);
      
      expect(screen.getByText('CPU: 25.5%')).toBeInTheDocument();
      expect(screen.getByText('Memory: 45.2%')).toBeInTheDocument();
    });

    it('displays port mappings', () => {
      render(<ContainerHealthCard container={mockContainer} />);
      
      expect(screen.getByText('80:80')).toBeInTheDocument();
      expect(screen.getByText('443:443')).toBeInTheDocument();
    });

    it('handles containers without ports gracefully', () => {
      const containerNoPorts = { ...mockContainer, ports: [] };
      render(<ContainerHealthCard container={containerNoPorts} />);
      
      expect(screen.getByText('No ports exposed')).toBeInTheDocument();
    });
  });

  describe('Resource Warnings', () => {
    it('shows warning for high CPU usage', () => {
      const highCpuContainer = { ...mockContainer, cpu: 85 };
      render(<ContainerHealthCard container={highCpuContainer} />);
      
      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('bg-yellow-50');
      expect(screen.getByText(/High CPU usage/i)).toBeInTheDocument();
    });

    it('shows critical alert for very high CPU usage', () => {
      const criticalCpuContainer = { ...mockContainer, cpu: 95 };
      render(<ContainerHealthCard container={criticalCpuContainer} />);
      
      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('bg-red-50');
      expect(screen.getByText(/Critical CPU usage/i)).toBeInTheDocument();
    });

    it('shows warning for high memory usage', () => {
      const highMemoryContainer = { ...mockContainer, memory: 82 };
      render(<ContainerHealthCard container={highMemoryContainer} />);
      
      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('bg-yellow-50');
      expect(screen.getByText(/High memory usage/i)).toBeInTheDocument();
    });

    it('shows multiple warnings when both CPU and memory are high', () => {
      const highResourceContainer = { 
        ...mockContainer, 
        cpu: 85,
        memory: 88 
      };
      render(<ContainerHealthCard container={highResourceContainer} />);
      
      expect(screen.getByText(/High CPU usage/i)).toBeInTheDocument();
      expect(screen.getByText(/High memory usage/i)).toBeInTheDocument();
    });

    it('shows no warnings for normal resource usage', () => {
      render(<ContainerHealthCard container={mockContainer} />);
      
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('expands to show detailed metrics on click', () => {
      render(<ContainerHealthCard container={mockContainer} />);
      
      const expandButton = screen.getByRole('button', { name: /expand/i });
      fireEvent.click(expandButton);
      
      expect(screen.getByText(/Network RX:/i)).toBeInTheDocument();
      expect(screen.getByText(/Network TX:/i)).toBeInTheDocument();
      expect(screen.getByText(/Disk Read:/i)).toBeInTheDocument();
      expect(screen.getByText(/Disk Write:/i)).toBeInTheDocument();
    });

    it('collapses detailed view on second click', () => {
      render(<ContainerHealthCard container={mockContainer} />);
      
      const expandButton = screen.getByRole('button', { name: /expand/i });
      fireEvent.click(expandButton);
      expect(screen.getByText(/Network RX:/i)).toBeInTheDocument();
      
      fireEvent.click(expandButton);
      expect(screen.queryByText(/Network RX:/i)).not.toBeInTheDocument();
    });

    it('calls onRestart when restart button is clicked', async () => {
      const onRestart = jest.fn();
      render(
        <ContainerHealthCard 
          container={mockContainer} 
          onRestart={onRestart}
        />
      );
      
      const restartButton = screen.getByRole('button', { name: /restart/i });
      fireEvent.click(restartButton);
      
      await waitFor(() => {
        expect(onRestart).toHaveBeenCalledWith('container-123');
      });
    });

    it('disables restart button during restart operation', async () => {
      const onRestart = jest.fn(() => new Promise(resolve => setTimeout(resolve, 100)));
      render(
        <ContainerHealthCard 
          container={mockContainer} 
          onRestart={onRestart}
        />
      );
      
      const restartButton = screen.getByRole('button', { name: /restart/i });
      fireEvent.click(restartButton);
      
      expect(restartButton).toBeDisabled();
      expect(screen.getByText(/Restarting.../i)).toBeInTheDocument();
      
      await waitFor(() => {
        expect(restartButton).not.toBeDisabled();
      });
    });

    it('calls onStop when stop button is clicked', async () => {
      const onStop = jest.fn();
      render(
        <ContainerHealthCard 
          container={mockContainer} 
          onStop={onStop}
        />
      );
      
      const stopButton = screen.getByRole('button', { name: /stop/i });
      fireEvent.click(stopButton);
      
      await waitFor(() => {
        expect(onStop).toHaveBeenCalledWith('container-123');
      });
    });

    it('shows confirmation dialog before stopping container', () => {
      const onStop = jest.fn();
      render(
        <ContainerHealthCard 
          container={mockContainer} 
          onStop={onStop}
          confirmBeforeStop
        />
      );
      
      const stopButton = screen.getByRole('button', { name: /stop/i });
      fireEvent.click(stopButton);
      
      expect(screen.getByText(/Are you sure/i)).toBeInTheDocument();
      
      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      fireEvent.click(confirmButton);
      
      expect(onStop).toHaveBeenCalledWith('container-123');
    });
  });

  describe('Real-time Updates', () => {
    it('updates metrics when container prop changes', () => {
      const { rerender } = render(<ContainerHealthCard container={mockContainer} />);
      
      expect(screen.getByText('CPU: 25.5%')).toBeInTheDocument();
      
      const updatedContainer = { ...mockContainer, cpu: 35.0 };
      rerender(<ContainerHealthCard container={updatedContainer} />);
      
      expect(screen.getByText('CPU: 35.0%')).toBeInTheDocument();
    });

    it('shows update indicator when metrics change', () => {
      const { rerender } = render(
        <ContainerHealthCard container={mockContainer} showUpdateIndicator />
      );
      
      const updatedContainer = { 
        ...mockContainer, 
        cpu: 35.0,
        lastUpdated: new Date().toISOString() 
      };
      rerender(<ContainerHealthCard container={updatedContainer} showUpdateIndicator />);
      
      expect(screen.getByTestId('update-indicator')).toBeInTheDocument();
    });

    it('removes update indicator after animation completes', async () => {
      const { rerender } = render(
        <ContainerHealthCard container={mockContainer} showUpdateIndicator />
      );
      
      const updatedContainer = { 
        ...mockContainer, 
        cpu: 35.0,
        lastUpdated: new Date().toISOString() 
      };
      rerender(<ContainerHealthCard container={updatedContainer} showUpdateIndicator />);
      
      await waitFor(() => {
        expect(screen.queryByTestId('update-indicator')).not.toBeInTheDocument();
      }, { timeout: 2000 });
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      render(<ContainerHealthCard container={mockContainer} />);
      
      expect(screen.getByRole('article')).toHaveAttribute(
        'aria-label',
        'Container health card for nginx'
      );
    });

    it('keyboard navigation works correctly', () => {
      render(<ContainerHealthCard container={mockContainer} />);
      
      const expandButton = screen.getByRole('button', { name: /expand/i });
      expandButton.focus();
      
      fireEvent.keyDown(expandButton, { key: 'Enter' });
      expect(screen.getByText(/Network RX:/i)).toBeInTheDocument();
      
      fireEvent.keyDown(expandButton, { key: 'Space' });
      expect(screen.queryByText(/Network RX:/i)).not.toBeInTheDocument();
    });

    it('announces status changes to screen readers', () => {
      const { rerender } = render(<ContainerHealthCard container={mockContainer} />);
      
      const stoppedContainer = { ...mockContainer, status: 'exited' };
      rerender(<ContainerHealthCard container={stoppedContainer} />);
      
      const announcement = screen.getByRole('status');
      expect(announcement).toHaveTextContent('nginx status changed to exited');
    });
  });

  describe('Performance', () => {
    it('memoizes expensive calculations', () => {
      const calculateSpy = jest.spyOn(React, 'useMemo');
      
      const { rerender } = render(<ContainerHealthCard container={mockContainer} />);
      
      // Update a prop that doesn't affect calculations
      rerender(<ContainerHealthCard container={mockContainer} className="new-class" />);
      
      // useMemo should prevent recalculation
      expect(calculateSpy).toHaveBeenCalled();
      calculateSpy.mockRestore();
    });

    it('throttles rapid metric updates', async () => {
      const { rerender } = render(<ContainerHealthCard container={mockContainer} />);
      
      // Simulate rapid updates
      for (let i = 0; i < 10; i++) {
        const updatedContainer = { ...mockContainer, cpu: 25 + i };
        rerender(<ContainerHealthCard container={updatedContainer} />);
      }
      
      // Should only show the latest value
      await waitFor(() => {
        expect(screen.getByText('CPU: 34.0%')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('handles missing container data gracefully', () => {
      const incompleteContainer = {
        id: 'test',
        name: 'test-container',
        status: 'running'
      } as Container;
      
      render(<ContainerHealthCard container={incompleteContainer} />);
      
      expect(screen.getByText('test-container')).toBeInTheDocument();
      expect(screen.getByText('CPU: N/A')).toBeInTheDocument();
      expect(screen.getByText('Memory: N/A')).toBeInTheDocument();
    });

    it('shows error state when container operations fail', async () => {
      const onRestart = jest.fn().mockRejectedValue(new Error('Restart failed'));
      render(
        <ContainerHealthCard 
          container={mockContainer} 
          onRestart={onRestart}
        />
      );
      
      const restartButton = screen.getByRole('button', { name: /restart/i });
      fireEvent.click(restartButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Restart failed/i)).toBeInTheDocument();
      });
    });
  });
});