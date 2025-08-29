'use client';

import { useState, useEffect } from 'react';
import { Search, Download, RefreshCw, Filter, Calendar, Clock, Shield, Globe } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useDnsQueries, useExportQueries } from '@/hooks/useDns';
import type { QueryFilter, DNSQuery } from '@/types/dns';

const ITEMS_PER_PAGE = 50;

export default function QueryHistory() {
  const [filter, setFilter] = useState<QueryFilter>({
    limit: ITEMS_PER_PAGE,
    offset: 0,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [blockedOnly, setBlockedOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const { data, isLoading, error, refetch } = useDnsQueries({
    ...filter,
    search: searchQuery || undefined,
    blocked: blockedOnly || undefined,
  });

  const exportQueries = useExportQueries();

  const queries: DNSQuery[] = (data as any)?.data?.queries || [];
  const totalQueries = (data as any)?.data?.total || 0;
  const totalPages = Math.ceil(totalQueries / ITEMS_PER_PAGE);

  // Auto-refresh effect
  useEffect(() => {
    if (autoRefresh && currentPage === 1) {
      const interval = setInterval(() => {
        refetch();
      }, 30000); // 30 seconds

      return () => clearInterval(interval);
    }
  }, [autoRefresh, currentPage, refetch]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    setFilter({
      ...filter,
      offset: (page - 1) * ITEMS_PER_PAGE,
    });
  };

  const handleExport = () => {
    if (queries.length > 0) {
      exportQueries.mutate(queries);
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return format(date, 'MMM dd, HH:mm:ss');
  };

  const getQueryTypeColor = (type: string) => {
    switch (type.toUpperCase()) {
      case 'A':
        return 'default';
      case 'AAAA':
        return 'secondary';
      case 'CNAME':
        return 'outline';
      case 'MX':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const getStatusBadge = (status: string, blocked?: boolean) => {
    if (blocked) {
      return (
        <Badge variant="destructive">
          <Shield className="mr-1 h-3 w-3" />
          Blocked
        </Badge>
      );
    }
    if (status === 'OK' || status === 'NOERROR') {
      return (
        <Badge variant="success">
          <Globe className="mr-1 h-3 w-3" />
          Allowed
        </Badge>
      );
    }
    return <Badge variant="outline">{status}</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Query History</CardTitle>
            <CardDescription>
              Recent DNS queries and their status
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center space-x-2">
              <Label htmlFor="auto-refresh" className="text-sm">
                Auto-refresh
              </Label>
              <Switch
                id="auto-refresh"
                checked={autoRefresh}
                onCheckedChange={setAutoRefresh}
              />
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCw className={cn(
                "mr-2 h-4 w-4",
                isLoading && "animate-spin"
              )} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={queries.length === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search domains..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
          <div className="flex items-center space-x-2">
            <Label htmlFor="blocked-only" className="text-sm">
              Blocked only
            </Label>
            <Switch
              id="blocked-only"
              checked={blockedOnly}
              onCheckedChange={setBlockedOnly}
            />
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="mr-2 h-4 w-4" />
                Filters
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Client IP</Label>
                  <Input
                    placeholder="192.168.1.100"
                    value={filter.client || ''}
                    onChange={(e) => setFilter({ ...filter, client: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date Range</Label>
                  <div className="text-sm text-muted-foreground">
                    Date filtering coming soon
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Query Table */}
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-4 text-muted-foreground">
            Failed to load query history
          </div>
        ) : queries.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No queries found
          </div>
        ) : (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Domain</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Response Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {queries.map((query, index) => (
                    <TableRow key={`${query.timestamp}-${index}`}>
                      <TableCell className="font-mono text-sm">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          {formatTimestamp(query.timestamp)}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium max-w-[300px] truncate">
                        {query.domain}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {query.client}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getQueryTypeColor(query.type)}>
                          {query.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(query.status, query.blocked)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {query.reply_time ? `${query.reply_time}ms` : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Showing {filter.offset + 1} to {Math.min(filter.offset + ITEMS_PER_PAGE, totalQueries)} of {totalQueries} queries
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <div className="flex items-center gap-1">
                    {[...Array(Math.min(5, totalPages))].map((_, i) => {
                      const page = i + 1;
                      if (
                        page === 1 ||
                        page === totalPages ||
                        (page >= currentPage - 1 && page <= currentPage + 1)
                      ) {
                        return (
                          <Button
                            key={page}
                            variant={page === currentPage ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => handlePageChange(page)}
                          >
                            {page}
                          </Button>
                        );
                      }
                      if (page === currentPage - 2 || page === currentPage + 2) {
                        return <span key={page}>...</span>;
                      }
                      return null;
                    })}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}