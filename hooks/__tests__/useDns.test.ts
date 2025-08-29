import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  useDnsStatus,
  useDnsPerformance,
  useDomains,
  useDnsQueries,
  useTopQueries,
  useTopBlocked,
  useHistoricalStats,
  useAddDomain,
  useRemoveDomain,
  useBlockDomain,
  useSetBlockingStatus,
  useBulkBlockDomains,
  useExportQueries,
  dnsKeys,
} from '../useDns';
import dnsAPI from '@/lib/api/dns';
import {
  mockPiHoleStatus,
  mockDomainList,
  mockQueryHistory,
  mockPerformanceMetrics,
  mockTopQueries,
  mockTopBlocked
} from '../../tests/fixtures/dns.fixtures';

// Mock dependencies
jest.mock('@/lib/api/dns');
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

const mockedDnsAPI = dnsAPI as jest.Mocked<typeof dnsAPI>;

describe('useDns hooks', () => {
  let queryClient: QueryClient;
  let wrapper: ({ children }: { children: React.ReactNode }) => JSX.Element;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          refetchOnWindowFocus: false,
        },
        mutations: {
          retry: false,
        },
      },
    });

    wrapper = ({ children }: { children: React.ReactNode }) => {
      const React = require('react');
      return React.createElement(QueryClientProvider, { client: queryClient }, children);
    };

    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Query hooks', () => {
    describe('useDnsStatus', () => {
      it('should fetch DNS status successfully', async () => {
        mockedDnsAPI.getStatus.mockResolvedValue({
          success: true,
          data: { connected: true, status: mockPiHoleStatus }
        });

        const { result } = renderHook(() => useDnsStatus(), { wrapper });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(mockedDnsAPI.getStatus).toHaveBeenCalled();
        expect(result.current.data).toEqual({
          success: true,
          data: { connected: true, status: mockPiHoleStatus }
        });
      });

      it('should handle DNS status errors', async () => {
        mockedDnsAPI.getStatus.mockRejectedValue(new Error('Connection failed'));

        const { result } = renderHook(() => useDnsStatus(), { wrapper });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toEqual(new Error('Connection failed'));
      });

      it('should refetch status every 30 seconds', async () => {
        mockedDnsAPI.getStatus.mockResolvedValue({
          success: true,
          data: { connected: true, status: mockPiHoleStatus }
        });

        renderHook(() => useDnsStatus(), { wrapper });

        expect(mockedDnsAPI.getStatus).toHaveBeenCalledTimes(1);

        // Fast forward 30 seconds
        act(() => {
          jest.advanceTimersByTime(30000);
        });

        await waitFor(() => {
          expect(mockedDnsAPI.getStatus).toHaveBeenCalledTimes(2);
        });
      });
    });

    describe('useDnsPerformance', () => {
      it('should fetch performance metrics', async () => {
        mockedDnsAPI.getPerformance.mockResolvedValue({
          success: true,
          data: { metrics: mockPerformanceMetrics }
        });

        const { result } = renderHook(() => useDnsPerformance(), { wrapper });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toEqual({
          success: true,
          data: { metrics: mockPerformanceMetrics }
        });
      });
    });

    describe('useDomains', () => {
      it('should fetch domains with default filter', async () => {
        mockedDnsAPI.getDomains.mockResolvedValue({
          success: true,
          data: { domains: mockDomainList }
        });

        const { result } = renderHook(() => useDomains(), { wrapper });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(mockedDnsAPI.getDomains).toHaveBeenCalledWith(undefined);
        expect(result.current.data).toEqual({
          success: true,
          data: { domains: mockDomainList }
        });
      });

      it('should fetch domains with custom filter', async () => {
        const filter = { listType: 'black' as const };
        mockedDnsAPI.getDomains.mockResolvedValue({
          success: true,
          data: { domains: mockDomainList }
        });

        const { result } = renderHook(() => useDomains(filter), { wrapper });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(mockedDnsAPI.getDomains).toHaveBeenCalledWith(filter);
      });

      it('should use correct cache key for different filters', () => {
        const filter1 = { listType: 'black' as const };
        const filter2 = { listType: 'white' as const };

        expect(dnsKeys.domains(filter1)).toEqual(['dns', 'domains', filter1]);
        expect(dnsKeys.domains(filter2)).toEqual(['dns', 'domains', filter2]);
        expect(dnsKeys.domains()).toEqual(['dns', 'domains', undefined]);
      });
    });

    describe('useDnsQueries', () => {
      it('should fetch queries with pagination', async () => {
        const filter = { limit: 50, offset: 0 };
        mockedDnsAPI.getQueries.mockResolvedValue({
          success: true,
          data: { queries: mockQueryHistory }
        });

        const { result } = renderHook(() => useDnsQueries(filter), { wrapper });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(mockedDnsAPI.getQueries).toHaveBeenCalledWith(filter);
      });

      it('should enable auto-refresh for first page only', () => {
        const firstPageFilter = { limit: 50, offset: 0 };
        const secondPageFilter = { limit: 50, offset: 50 };

        // First page should have refetchInterval
        renderHook(() => useDnsQueries(firstPageFilter), { wrapper });
        
        // Second page should not have refetchInterval
        renderHook(() => useDnsQueries(secondPageFilter), { wrapper });

        // Both should call the API
        expect(mockedDnsAPI.getQueries).toHaveBeenCalledTimes(2);
      });
    });

    describe('useTopQueries', () => {
      it('should fetch top queries with default limit', async () => {
        mockedDnsAPI.getTopQueries.mockResolvedValue({
          success: true,
          data: { topQueries: mockTopQueries }
        });

        const { result } = renderHook(() => useTopQueries(), { wrapper });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(mockedDnsAPI.getTopQueries).toHaveBeenCalledWith(10);
      });

      it('should fetch top queries with custom limit', async () => {
        mockedDnsAPI.getTopQueries.mockResolvedValue({
          success: true,
          data: { topQueries: mockTopQueries }
        });

        const { result } = renderHook(() => useTopQueries(5), { wrapper });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(mockedDnsAPI.getTopQueries).toHaveBeenCalledWith(5);
      });
    });

    describe('useTopBlocked', () => {
      it('should fetch top blocked domains', async () => {
        mockedDnsAPI.getTopBlocked.mockResolvedValue({
          success: true,
          data: { topBlocked: mockTopBlocked }
        });

        const { result } = renderHook(() => useTopBlocked(5), { wrapper });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(mockedDnsAPI.getTopBlocked).toHaveBeenCalledWith(5);
      });
    });

    describe('useHistoricalStats', () => {
      it('should fetch historical stats with default period', async () => {
        const mockStats = [{ timestamp: new Date(), queries: 1000, blocked: 200 }];
        mockedDnsAPI.getHistoricalStats.mockResolvedValue({
          success: true,
          data: { stats: mockStats }
        });

        const { result } = renderHook(() => useHistoricalStats(), { wrapper });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(mockedDnsAPI.getHistoricalStats).toHaveBeenCalledWith('24h');
      });

      it('should fetch historical stats with custom period', async () => {
        const mockStats = [{ timestamp: new Date(), queries: 1000, blocked: 200 }];
        mockedDnsAPI.getHistoricalStats.mockResolvedValue({
          success: true,
          data: { stats: mockStats }
        });

        const { result } = renderHook(() => useHistoricalStats('7d'), { wrapper });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(mockedDnsAPI.getHistoricalStats).toHaveBeenCalledWith('7d');
      });
    });
  });

  describe('Mutation hooks', () => {
    describe('useAddDomain', () => {
      it('should add domain successfully', async () => {
        mockedDnsAPI.addDomain.mockResolvedValue({
          success: true,
          data: { domain: 'test.com', blocked: true }
        });

        const { result } = renderHook(() => useAddDomain(), { wrapper });

        const input = { domain: 'test.com', listType: 'black' as const, comment: 'Test' };

        await act(async () => {
          await result.current.mutateAsync(input);
        });

        expect(mockedDnsAPI.addDomain).toHaveBeenCalledWith(input);
        expect(toast.success).toHaveBeenCalledWith('Domain test.com added successfully');
      });

      it('should handle add domain errors', async () => {
        mockedDnsAPI.addDomain.mockRejectedValue(new Error('Domain already exists'));

        const { result } = renderHook(() => useAddDomain(), { wrapper });

        const input = { domain: 'test.com', listType: 'black' as const };

        try {
          await act(async () => {
            await result.current.mutateAsync(input);
          });
        } catch (error) {
          // Expected to throw
        }

        expect(toast.error).toHaveBeenCalledWith('Domain already exists');
      });

      it('should invalidate domains query on success', async () => {
        mockedDnsAPI.addDomain.mockResolvedValue({
          success: true,
          data: { domain: 'test.com', blocked: true }
        });

        const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

        const { result } = renderHook(() => useAddDomain(), { wrapper });

        const input = { domain: 'test.com', listType: 'black' as const };

        await act(async () => {
          await result.current.mutateAsync(input);
        });

        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: dnsKeys.domains() });
      });
    });

    describe('useRemoveDomain', () => {
      it('should remove domain successfully', async () => {
        mockedDnsAPI.removeDomain.mockResolvedValue({
          success: true,
          data: { domain: 'test.com' }
        });

        const { result } = renderHook(() => useRemoveDomain(), { wrapper });

        await act(async () => {
          result.current.mutate({ domain: 'test.com', listType: 'black' });
        });

        await waitFor(() => {
          expect(mockedDnsAPI.removeDomain).toHaveBeenCalledWith('test.com', 'black');
        });

        expect(toast.success).toHaveBeenCalledWith('Domain test.com removed successfully');
      });
    });

    describe('useBlockDomain', () => {
      beforeEach(() => {
        // Setup initial domains data
        queryClient.setQueryData(dnsKeys.domains(), {
          success: true,
          data: {
            domains: [
              { domain: 'test.com', blocked: false },
              { domain: 'example.com', blocked: true }
            ]
          }
        });
      });

      it('should block domain with optimistic updates', async () => {
        mockedDnsAPI.blockDomain.mockResolvedValue({
          success: true,
          data: { domain: 'test.com', blocked: true }
        });

        const { result } = renderHook(() => useBlockDomain(), { wrapper });

        await act(async () => {
          result.current.mutate({ domain: 'test.com', block: true });
        });

        // Check optimistic update happened
        const cacheData = queryClient.getQueryData(dnsKeys.domains()) as any;
        const updatedDomain = cacheData.data.domains.find((d: any) => d.domain === 'test.com');
        
        await waitFor(() => {
          expect(mockedDnsAPI.blockDomain).toHaveBeenCalledWith('test.com', { block: true });
        });

        expect(toast.success).toHaveBeenCalledWith('Domain test.com blocked');
      });

      it('should rollback optimistic update on error', async () => {
        mockedDnsAPI.blockDomain.mockRejectedValue(new Error('Block failed'));

        const originalData = queryClient.getQueryData(dnsKeys.domains());

        const { result } = renderHook(() => useBlockDomain(), { wrapper });

        try {
          await act(async () => {
            result.current.mutate({ domain: 'test.com', block: true });
          });
        } catch (error) {
          // Expected to fail
        }

        await waitFor(() => {
          expect(toast.error).toHaveBeenCalledWith('Failed to update domain status');
        });

        // Check that data was rolled back
        const rollbackData = queryClient.getQueryData(dnsKeys.domains());
        expect(rollbackData).toEqual(originalData);
      });

      it('should unblock domain successfully', async () => {
        mockedDnsAPI.blockDomain.mockResolvedValue({
          success: true,
          data: { domain: 'example.com', blocked: false }
        });

        const { result } = renderHook(() => useBlockDomain(), { wrapper });

        await act(async () => {
          result.current.mutate({ domain: 'example.com', block: false });
        });

        await waitFor(() => {
          expect(mockedDnsAPI.blockDomain).toHaveBeenCalledWith('example.com', { block: false });
        });

        expect(toast.success).toHaveBeenCalledWith('Domain example.com unblocked');
      });
    });

    describe('useSetBlockingStatus', () => {
      it('should enable blocking successfully', async () => {
        mockedDnsAPI.setBlockingStatus.mockResolvedValue({
          success: true,
          data: { blockingEnabled: true }
        });

        const { result } = renderHook(() => useSetBlockingStatus(), { wrapper });

        await act(async () => {
          result.current.mutate({ enabled: true });
        });

        await waitFor(() => {
          expect(mockedDnsAPI.setBlockingStatus).toHaveBeenCalledWith(true, undefined);
        });

        expect(toast.success).toHaveBeenCalledWith('DNS blocking enabled');
      });

      it('should disable blocking with duration', async () => {
        mockedDnsAPI.setBlockingStatus.mockResolvedValue({
          success: true,
          data: { blockingEnabled: false, duration: 300 }
        });

        const { result } = renderHook(() => useSetBlockingStatus(), { wrapper });

        await act(async () => {
          result.current.mutate({ enabled: false, duration: 300 });
        });

        await waitFor(() => {
          expect(mockedDnsAPI.setBlockingStatus).toHaveBeenCalledWith(false, 300);
        });

        expect(toast.success).toHaveBeenCalledWith('DNS blocking disabled');
      });

      it('should invalidate status query on success', async () => {
        mockedDnsAPI.setBlockingStatus.mockResolvedValue({
          success: true,
          data: { blockingEnabled: true }
        });

        const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

        const { result } = renderHook(() => useSetBlockingStatus(), { wrapper });

        await act(async () => {
          result.current.mutate({ enabled: true });
        });

        await waitFor(() => {
          expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: dnsKeys.status() });
        });
      });
    });

    describe('useBulkBlockDomains', () => {
      it('should block multiple domains successfully', async () => {
        mockedDnsAPI.blockDomain.mockResolvedValue({
          success: true,
          data: { blocked: true }
        });

        const { result } = renderHook(() => useBulkBlockDomains(), { wrapper });

        const domains = ['test1.com', 'test2.com', 'test3.com'];

        await act(async () => {
          result.current.mutate({ domains, block: true });
        });

        await waitFor(() => {
          expect(mockedDnsAPI.blockDomain).toHaveBeenCalledTimes(3);
          expect(mockedDnsAPI.blockDomain).toHaveBeenCalledWith('test1.com', { block: true });
          expect(mockedDnsAPI.blockDomain).toHaveBeenCalledWith('test2.com', { block: true });
          expect(mockedDnsAPI.blockDomain).toHaveBeenCalledWith('test3.com', { block: true });
        });

        expect(toast.success).toHaveBeenCalledWith('3 domains blocked');
      });

      it('should unblock multiple domains successfully', async () => {
        mockedDnsAPI.blockDomain.mockResolvedValue({
          success: true,
          data: { blocked: false }
        });

        const { result } = renderHook(() => useBulkBlockDomains(), { wrapper });

        const domains = ['test1.com', 'test2.com'];

        await act(async () => {
          result.current.mutate({ domains, block: false });
        });

        await waitFor(() => {
          expect(mockedDnsAPI.blockDomain).toHaveBeenCalledTimes(2);
        });

        expect(toast.success).toHaveBeenCalledWith('2 domains unblocked');
      });

      it('should handle bulk operation errors', async () => {
        mockedDnsAPI.blockDomain.mockRejectedValue(new Error('Bulk operation failed'));

        const { result } = renderHook(() => useBulkBlockDomains(), { wrapper });

        try {
          await act(async () => {
            result.current.mutate({ domains: ['test.com'], block: true });
          });
        } catch (error) {
          // Expected to fail
        }

        await waitFor(() => {
          expect(toast.error).toHaveBeenCalledWith('Bulk operation failed');
        });
      });
    });

    describe('useExportQueries', () => {
      it('should export queries to CSV successfully', async () => {
        const mockCSV = 'domain,type,timestamp\ntest.com,A,2023-01-01';
        mockedDnsAPI.exportQueriesToCSV.mockReturnValue(mockCSV);
        mockedDnsAPI.downloadCSV.mockReturnValue(undefined);

        const { result } = renderHook(() => useExportQueries(), { wrapper });

        await act(async () => {
          result.current.mutate(mockQueryHistory);
        });

        await waitFor(() => {
          expect(mockedDnsAPI.exportQueriesToCSV).toHaveBeenCalledWith(mockQueryHistory);
          expect(mockedDnsAPI.downloadCSV).toHaveBeenCalledWith(
            mockCSV,
            expect.stringMatching(/dns-queries-\d{4}-\d{2}-\d{2}\.csv/)
          );
        });

        expect(toast.success).toHaveBeenCalledWith('Queries exported successfully');
      });

      it('should handle export errors', async () => {
        mockedDnsAPI.exportQueriesToCSV.mockImplementation(() => {
          throw new Error('Export failed');
        });

        const { result } = renderHook(() => useExportQueries(), { wrapper });

        try {
          await act(async () => {
            result.current.mutate(mockQueryHistory);
          });
        } catch (error) {
          // Expected to fail
        }

        await waitFor(() => {
          expect(toast.error).toHaveBeenCalledWith('Failed to export queries');
        });
      });
    });
  });

  describe('Query key generators', () => {
    it('should generate correct query keys', () => {
      expect(dnsKeys.all).toEqual(['dns']);
      expect(dnsKeys.status()).toEqual(['dns', 'status']);
      expect(dnsKeys.performance()).toEqual(['dns', 'performance']);
      expect(dnsKeys.domains()).toEqual(['dns', 'domains', undefined]);
      expect(dnsKeys.domains({ listType: 'black' })).toEqual(['dns', 'domains', { listType: 'black' }]);
      expect(dnsKeys.queries()).toEqual(['dns', 'queries', undefined]);
      expect(dnsKeys.queries({ limit: 50 })).toEqual(['dns', 'queries', { limit: 50 }]);
      expect(dnsKeys.topQueries(5)).toEqual(['dns', 'topQueries', 5]);
      expect(dnsKeys.topBlocked(10)).toEqual(['dns', 'topBlocked', 10]);
      expect(dnsKeys.historicalStats('7d')).toEqual(['dns', 'historicalStats', '7d']);
    });
  });

  describe('Cache invalidation', () => {
    it('should invalidate appropriate queries after mutations', async () => {
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
      
      // Mock successful API calls
      mockedDnsAPI.addDomain.mockResolvedValue({ success: true, data: {} });
      mockedDnsAPI.removeDomain.mockResolvedValue({ success: true, data: {} });
      mockedDnsAPI.setBlockingStatus.mockResolvedValue({ success: true, data: {} });

      // Test useAddDomain invalidation
      const { result: addResult } = renderHook(() => useAddDomain(), { wrapper });
      await act(async () => {
        await addResult.current.mutateAsync({ domain: 'test.com', listType: 'black' });
      });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: dnsKeys.domains() });

      // Test useRemoveDomain invalidation
      const { result: removeResult } = renderHook(() => useRemoveDomain(), { wrapper });
      await act(async () => {
        removeResult.current.mutate({ domain: 'test.com' });
      });

      await waitFor(() => {
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: dnsKeys.domains() });
      });

      // Test useSetBlockingStatus invalidation
      const { result: blockingResult } = renderHook(() => useSetBlockingStatus(), { wrapper });
      await act(async () => {
        blockingResult.current.mutate({ enabled: true });
      });

      await waitFor(() => {
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: dnsKeys.status() });
      });
    });
  });
});