import { renderHook, waitFor, act } from '@testing-library/react';
import { useContainerHealth } from '../useContainerHealth';
import { Container } from '../../types/monitoring';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const mockContainers: Container[] = [
  {
    id: 'container-1',
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
    ports: ['80:80'],
    created_at: '2024-01-20T08:00:00Z'
  },
  {
    id: 'container-2',
    name: 'redis',
    image: 'redis:alpine',
    status: 'running',
    cpu: 15.0,
    memory: 30.5,
    disk_read: 524288,
    disk_write: 262144,
    network_rx: 131072,
    network_tx: 65536,
    uptime: '5 hours',
    ports: ['6379:6379'],
    created_at: '2024-01-20T05:00:00Z'
  }
];

describe('useContainerHealth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Initial Data Fetch', () => {
    it('fetches container health data on mount', async () => {
      mockedAxios.get.mockResolvedValue({
        data: { containers: mockContainers }
      });

      const { result } = renderHook(() => useContainerHealth());

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(null);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.data).toEqual(mockContainers);
      expect(result.current.error).toBe(null);
      expect(mockedAxios.get).toHaveBeenCalledWith('/api/health/containers');
    });

    it('handles API errors gracefully', async () => {
      const errorMessage = 'Network Error';
      mockedAxios.get.mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useContainerHealth());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.data).toBe(null);
      expect(result.current.error).toBe(errorMessage);
    });

    it('handles HTTP error responses', async () => {
      mockedAxios.get.mockRejectedValue({
        response: {
          status: 500,
          data: { error: 'Internal Server Error' }
        }
      });

      const { result } = renderHook(() => useContainerHealth());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Internal Server Error');
    });
  });

  describe('Polling Mechanism', () => {
    it('polls container health every 10 seconds by default', async () => {
      mockedAxios.get.mockResolvedValue({
        data: { containers: mockContainers }
      });

      const { result } = renderHook(() => useContainerHealth());

      // Initial call
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);

      // Fast-forward 10 seconds
      act(() => {
        jest.advanceTimersByTime(10000);
      });

      await waitFor(() => {
        expect(mockedAxios.get).toHaveBeenCalledTimes(2);
      });

      // Fast-forward another 10 seconds
      act(() => {
        jest.advanceTimersByTime(10000);
      });

      await waitFor(() => {
        expect(mockedAxios.get).toHaveBeenCalledTimes(3);
      });
    });

    it('uses custom polling interval when specified', async () => {
      mockedAxios.get.mockResolvedValue({
        data: { containers: mockContainers }
      });

      const { result } = renderHook(() => useContainerHealth({ pollingInterval: 5000 }));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);

      // Fast-forward 5 seconds
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      await waitFor(() => {
        expect(mockedAxios.get).toHaveBeenCalledTimes(2);
      });
    });

    it('stops polling when component unmounts', async () => {
      mockedAxios.get.mockResolvedValue({
        data: { containers: mockContainers }
      });

      const { result, unmount } = renderHook(() => useContainerHealth());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      unmount();

      // Fast-forward time - no additional calls should be made
      act(() => {
        jest.advanceTimersByTime(20000);
      });

      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    });

    it('pauses polling when window is not visible', async () => {
      mockedAxios.get.mockResolvedValue({
        data: { containers: mockContainers }
      });

      // Mock document.hidden
      Object.defineProperty(document, 'hidden', {
        writable: true,
        value: false
      });

      const { result } = renderHook(() => useContainerHealth());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Hide the document
      Object.defineProperty(document, 'hidden', { value: true });
      
      // Trigger visibility change event
      act(() => {
        const event = new Event('visibilitychange');
        document.dispatchEvent(event);
      });

      // Fast-forward time - polling should be paused
      act(() => {
        jest.advanceTimersByTime(10000);
      });

      // Should still be just the initial call
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);

      // Show the document again
      Object.defineProperty(document, 'hidden', { value: false });
      
      act(() => {
        const event = new Event('visibilitychange');
        document.dispatchEvent(event);
      });

      // Polling should resume
      act(() => {
        jest.advanceTimersByTime(10000);
      });

      await waitFor(() => {
        expect(mockedAxios.get).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Data Updates', () => {
    it('updates data when new containers are added', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: { containers: [mockContainers[0]] }
      });

      const { result } = renderHook(() => useContainerHealth());

      await waitFor(() => {
        expect(result.current.data).toHaveLength(1);
      });

      // Add second container
      mockedAxios.get.mockResolvedValueOnce({
        data: { containers: mockContainers }
      });

      act(() => {
        jest.advanceTimersByTime(10000);
      });

      await waitFor(() => {
        expect(result.current.data).toHaveLength(2);
      });
    });

    it('handles container removal', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: { containers: mockContainers }
      });

      const { result } = renderHook(() => useContainerHealth());

      await waitFor(() => {
        expect(result.current.data).toHaveLength(2);
      });

      // Remove one container
      mockedAxios.get.mockResolvedValueOnce({
        data: { containers: [mockContainers[0]] }
      });

      act(() => {
        jest.advanceTimersByTime(10000);
      });

      await waitFor(() => {
        expect(result.current.data).toHaveLength(1);
        expect(result.current.data?.[0].id).toBe('container-1');
      });
    });

    it('updates metrics for existing containers', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: { containers: mockContainers }
      });

      const { result } = renderHook(() => useContainerHealth());

      await waitFor(() => {
        expect(result.current.data?.[0].cpu).toBe(25.5);
      });

      // Update metrics
      const updatedContainers = mockContainers.map(container =>
        container.id === 'container-1'
          ? { ...container, cpu: 35.8, memory: 52.1 }
          : container
      );

      mockedAxios.get.mockResolvedValueOnce({
        data: { containers: updatedContainers }
      });

      act(() => {
        jest.advanceTimersByTime(10000);
      });

      await waitFor(() => {
        expect(result.current.data?.[0].cpu).toBe(35.8);
        expect(result.current.data?.[0].memory).toBe(52.1);
      });
    });
  });

  describe('Manual Refresh', () => {
    it('provides refresh function that fetches data immediately', async () => {
      mockedAxios.get.mockResolvedValue({
        data: { containers: mockContainers }
      });

      const { result } = renderHook(() => useContainerHealth());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockedAxios.get).toHaveBeenCalledTimes(1);

      // Manual refresh
      act(() => {
        result.current.refresh();
      });

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    });

    it('handles refresh errors gracefully', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: { containers: mockContainers }
      });

      const { result } = renderHook(() => useContainerHealth());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Make refresh fail
      mockedAxios.get.mockRejectedValueOnce(new Error('Refresh failed'));

      act(() => {
        result.current.refresh();
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Refresh failed');
      // Previous data should be preserved
      expect(result.current.data).toEqual(mockContainers);
    });
  });

  describe('Filtering and Search', () => {
    it('filters containers by status', async () => {
      const mixedContainers = [
        ...mockContainers,
        {
          ...mockContainers[0],
          id: 'container-3',
          name: 'postgres',
          status: 'exited' as const
        }
      ];

      mockedAxios.get.mockResolvedValue({
        data: { containers: mixedContainers }
      });

      const { result } = renderHook(() => 
        useContainerHealth({ filter: { status: 'running' } })
      );

      await waitFor(() => {
        expect(result.current.data).toHaveLength(2);
      });

      expect(result.current.data?.every(c => c.status === 'running')).toBe(true);
    });

    it('searches containers by name', async () => {
      mockedAxios.get.mockResolvedValue({
        data: { containers: mockContainers }
      });

      const { result } = renderHook(() => 
        useContainerHealth({ filter: { search: 'nginx' } })
      );

      await waitFor(() => {
        expect(result.current.data).toHaveLength(1);
      });

      expect(result.current.data?.[0].name).toBe('nginx');
    });

    it('combines multiple filters', async () => {
      const mixedContainers = [
        ...mockContainers,
        {
          ...mockContainers[0],
          id: 'container-3',
          name: 'nginx-test',
          status: 'exited' as const
        }
      ];

      mockedAxios.get.mockResolvedValue({
        data: { containers: mixedContainers }
      });

      const { result } = renderHook(() => 
        useContainerHealth({ 
          filter: { 
            search: 'nginx',
            status: 'running'
          } 
        })
      );

      await waitFor(() => {
        expect(result.current.data).toHaveLength(1);
      });

      expect(result.current.data?.[0].name).toBe('nginx');
      expect(result.current.data?.[0].status).toBe('running');
    });
  });

  describe('WebSocket Integration', () => {
    it('connects to WebSocket for real-time updates when enabled', async () => {
      const mockWebSocket = {
        onmessage: null,
        onopen: null,
        onclose: null,
        onerror: null,
        close: jest.fn(),
        send: jest.fn()
      };

      (global as any).WebSocket = jest.fn().mockImplementation(() => mockWebSocket);

      mockedAxios.get.mockResolvedValue({
        data: { containers: mockContainers }
      });

      const { result } = renderHook(() => 
        useContainerHealth({ enableWebSocket: true })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(global.WebSocket).toHaveBeenCalledWith(
        expect.stringContaining('ws://') || expect.stringContaining('wss://')
      );

      // Simulate WebSocket message
      const updatedContainer = { ...mockContainers[0], cpu: 45.2 };
      
      act(() => {
        if (mockWebSocket.onmessage) {
          mockWebSocket.onmessage({
            data: JSON.stringify({
              type: 'containerUpdate',
              container: updatedContainer
            })
          } as any);
        }
      });

      await waitFor(() => {
        expect(result.current.data?.[0].cpu).toBe(45.2);
      });
    });

    it('falls back to polling when WebSocket connection fails', async () => {
      const mockWebSocket = {
        onmessage: null,
        onopen: null,
        onclose: null,
        onerror: null,
        close: jest.fn(),
        send: jest.fn()
      };

      (global as any).WebSocket = jest.fn().mockImplementation(() => mockWebSocket);

      mockedAxios.get.mockResolvedValue({
        data: { containers: mockContainers }
      });

      const { result } = renderHook(() => 
        useContainerHealth({ enableWebSocket: true })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Simulate WebSocket error
      act(() => {
        if (mockWebSocket.onerror) {
          mockWebSocket.onerror(new Event('error') as any);
        }
      });

      // Should fall back to polling
      act(() => {
        jest.advanceTimersByTime(10000);
      });

      await waitFor(() => {
        expect(mockedAxios.get).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Performance Optimizations', () => {
    it('debounces rapid API calls', async () => {
      mockedAxios.get.mockResolvedValue({
        data: { containers: mockContainers }
      });

      const { result } = renderHook(() => useContainerHealth());

      // Make multiple rapid refresh calls
      act(() => {
        result.current.refresh();
        result.current.refresh();
        result.current.refresh();
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should only make 2 calls (initial + debounced refresh)
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    });

    it('memoizes filtered results', async () => {
      mockedAxios.get.mockResolvedValue({
        data: { containers: mockContainers }
      });

      const { result, rerender } = renderHook(
        ({ filter }) => useContainerHealth({ filter }),
        { initialProps: { filter: { status: 'running' as const } } }
      );

      await waitFor(() => {
        expect(result.current.data).toHaveLength(2);
      });

      const firstResult = result.current.data;

      // Rerender with same filter
      rerender({ filter: { status: 'running' as const } });

      // Result should be memoized (same reference)
      expect(result.current.data).toBe(firstResult);
    });
  });

  describe('Error Recovery', () => {
    it('recovers from network errors automatically', async () => {
      mockedAxios.get
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ data: { containers: mockContainers } });

      const { result } = renderHook(() => useContainerHealth());

      // Initial error
      await waitFor(() => {
        expect(result.current.error).toBe('Network error');
      });

      // Next polling cycle should succeed
      act(() => {
        jest.advanceTimersByTime(10000);
      });

      await waitFor(() => {
        expect(result.current.error).toBe(null);
        expect(result.current.data).toEqual(mockContainers);
      });
    });

    it('implements exponential backoff on repeated failures', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Persistent error'));

      const { result } = renderHook(() => useContainerHealth());

      await waitFor(() => {
        expect(result.current.error).toBe('Persistent error');
      });

      const callTimes: number[] = [];
      
      // Track call times
      mockedAxios.get.mockImplementation(() => {
        callTimes.push(Date.now());
        return Promise.reject(new Error('Persistent error'));
      });

      // Fast-forward through several retry attempts
      for (let i = 0; i < 5; i++) {
        act(() => {
          jest.advanceTimersByTime(10000 * Math.pow(2, i));
        });
        await new Promise(resolve => setTimeout(resolve, 0));
      }

      expect(callTimes.length).toBeGreaterThan(2);
    });
  });
});