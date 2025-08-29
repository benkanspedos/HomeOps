'use client';

import React, { useState } from 'react';
import { AlertHistoryTableProps, AlertHistory } from '@/types/monitoring';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Filter, CheckCircle, XCircle, AlertCircle, Clock } from 'lucide-react';

export function AlertHistoryTable({
  history,
  onLoadMore,
  onFilter,
  loading = false,
}: AlertHistoryTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'suppressed':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <Badge className="bg-green-500/10 text-green-600">Sent</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'suppressed':
        return <Badge className="bg-yellow-500/10 text-yellow-600">Suppressed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatTime = (date: Date | string) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString();
  };

  const filteredHistory = history.filter(alert => {
    const matchesSearch = searchTerm === '' || 
      alert.alertName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      alert.message.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || alert.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  return (
    <Card className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Alert History</h3>
        
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              type="text"
              placeholder="Search alerts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 w-64"
            />
          </div>
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="suppressed">Suppressed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Alert</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Channels</TableHead>
              <TableHead className="w-[300px]">Message</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredHistory.map((alert) => (
              <TableRow key={alert.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(alert.status)}
                    <span className="font-medium text-sm">{alert.alertName}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-gray-600">
                    {formatTime(alert.triggeredAt)}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    <span className="font-medium">{alert.metricValue.toFixed(1)}</span>
                    <span className="text-gray-500"> / {alert.thresholdValue}</span>
                  </div>
                </TableCell>
                <TableCell>{getStatusBadge(alert.status)}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {alert.channels.map((channel, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {channel}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <p className="text-sm text-gray-600 truncate max-w-xs" title={alert.message}>
                    {alert.message}
                  </p>
                  {alert.error && (
                    <p className="text-xs text-red-500 mt-1">Error: {alert.error}</p>
                  )}
                </TableCell>
              </TableRow>
            ))}
            
            {filteredHistory.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <AlertCircle className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p className="text-gray-500">No alerts found</p>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {onLoadMore && filteredHistory.length > 0 && (
        <div className="flex justify-center mt-4">
          <Button
            variant="outline"
            onClick={onLoadMore}
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Load More'}
          </Button>
        </div>
      )}
    </Card>
  );
}