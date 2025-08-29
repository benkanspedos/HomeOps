import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import dnsAPI from '@/lib/api/dns';
import type { 
  AddDomainInput, 
  BlockDomainInput, 
  QueryFilter, 
  DNSFilter 
} from '@/types/dns';

// Query keys
export const dnsKeys = {
  all: ['dns'] as const,
  status: () => [...dnsKeys.all, 'status'] as const,
  performance: () => [...dnsKeys.all, 'performance'] as const,
  domains: (filter?: DNSFilter) => [...dnsKeys.all, 'domains', filter] as const,
  queries: (filter?: QueryFilter) => [...dnsKeys.all, 'queries', filter] as const,
  topQueries: (limit?: number) => [...dnsKeys.all, 'topQueries', limit] as const,
  topBlocked: (limit?: number) => [...dnsKeys.all, 'topBlocked', limit] as const,
  historicalStats: (period?: string) => [...dnsKeys.all, 'historicalStats', period] as const,
};

// Query hooks
export function useDnsStatus() {
  return useQuery({
    queryKey: dnsKeys.status(),
    queryFn: () => dnsAPI.getStatus(),
    refetchInterval: 30000, // Refresh every 30 seconds
    retry: 1,
  });
}

export function useDnsPerformance() {
  return useQuery({
    queryKey: dnsKeys.performance(),
    queryFn: () => dnsAPI.getPerformance(),
    refetchInterval: 30000,
    retry: 1,
  });
}

export function useDomains(filter?: DNSFilter) {
  return useQuery({
    queryKey: dnsKeys.domains(filter),
    queryFn: () => dnsAPI.getDomains(filter),
    staleTime: 60000, // Consider data stale after 1 minute
  });
}

export function useDnsQueries(filter?: QueryFilter) {
  return useQuery({
    queryKey: dnsKeys.queries(filter),
    queryFn: () => dnsAPI.getQueries(filter),
    refetchInterval: filter?.offset === 0 ? 30000 : false, // Auto-refresh first page
    keepPreviousData: true, // For pagination
  });
}

export function useTopQueries(limit: number = 10) {
  return useQuery({
    queryKey: dnsKeys.topQueries(limit),
    queryFn: () => dnsAPI.getTopQueries(limit),
    refetchInterval: 60000, // Refresh every minute
  });
}

export function useTopBlocked(limit: number = 10) {
  return useQuery({
    queryKey: dnsKeys.topBlocked(limit),
    queryFn: () => dnsAPI.getTopBlocked(limit),
    refetchInterval: 60000,
  });
}

export function useHistoricalStats(period: string = '24h') {
  return useQuery({
    queryKey: dnsKeys.historicalStats(period),
    queryFn: () => dnsAPI.getHistoricalStats(period),
    staleTime: 300000, // 5 minutes
  });
}

// Mutation hooks
export function useAddDomain() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (input: AddDomainInput) => dnsAPI.addDomain(input),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: dnsKeys.domains() });
      toast.success(`Domain ${variables.domain} added successfully`);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to add domain');
    },
  });
}

export function useRemoveDomain() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ domain, listType }: { domain: string; listType?: 'black' | 'white' }) => 
      dnsAPI.removeDomain(domain, listType),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: dnsKeys.domains() });
      toast.success(`Domain ${variables.domain} removed successfully`);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to remove domain');
    },
  });
}

export function useBlockDomain() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ domain, ...input }: { domain: string } & BlockDomainInput) => 
      dnsAPI.blockDomain(domain, input),
    onMutate: async ({ domain, block }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: dnsKeys.domains() });
      
      // Snapshot the previous value
      const previousDomains = queryClient.getQueryData(dnsKeys.domains());
      
      // Optimistically update
      queryClient.setQueryData(dnsKeys.domains(), (old: any) => {
        if (!old) return old;
        return {
          ...old,
          data: {
            ...old.data,
            domains: old.data.domains.map((d: any) =>
              d.domain === domain ? { ...d, blocked: block } : d
            ),
          },
        };
      });
      
      return { previousDomains };
    },
    onError: (err, _, context) => {
      // Rollback on error
      if (context?.previousDomains) {
        queryClient.setQueryData(dnsKeys.domains(), context.previousDomains);
      }
      toast.error('Failed to update domain status');
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: dnsKeys.domains() });
      toast.success(`Domain ${variables.domain} ${variables.block ? 'blocked' : 'unblocked'}`);
    },
  });
}

export function useSetBlockingStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ enabled, duration }: { enabled: boolean; duration?: number }) => 
      dnsAPI.setBlockingStatus(enabled, duration),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: dnsKeys.status() });
      toast.success(`DNS blocking ${variables.enabled ? 'enabled' : 'disabled'}`);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update blocking status');
    },
  });
}

// Bulk operations
export function useBulkBlockDomains() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ domains, block }: { domains: string[]; block: boolean }) => {
      const promises = domains.map(domain => 
        dnsAPI.blockDomain(domain, { block })
      );
      return Promise.all(promises);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: dnsKeys.domains() });
      toast.success(`${variables.domains.length} domains ${variables.block ? 'blocked' : 'unblocked'}`);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update domains');
    },
  });
}

// Export functionality
export function useExportQueries() {
  return useMutation({
    mutationFn: async (queries: any[]) => {
      const csv = dnsAPI.exportQueriesToCSV(queries);
      const timestamp = new Date().toISOString().split('T')[0];
      dnsAPI.downloadCSV(csv, `dns-queries-${timestamp}.csv`);
      return { success: true };
    },
    onSuccess: () => {
      toast.success('Queries exported successfully');
    },
    onError: () => {
      toast.error('Failed to export queries');
    },
  });
}