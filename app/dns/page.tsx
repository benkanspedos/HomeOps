'use client';

import { useState } from 'react';
import { Shield, Globe, Activity, Database, AlertCircle, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import DomainManager from '@/components/dns/DomainManager';
import QueryHistory from '@/components/dns/QueryHistory';
import PerformanceMonitor from '@/components/dns/PerformanceMonitor';
import { useDnsStatus, useDnsPerformance, useSetBlockingStatus } from '@/hooks/useDns';
import { formatNumber, formatPercentage } from '@/lib/utils';

export default function DNSPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const { data: statusData, isLoading: statusLoading, error: statusError } = useDnsStatus();
  const { data: performanceData, isLoading: perfLoading } = useDnsPerformance();
  const setBlockingStatus = useSetBlockingStatus();

  const isConnected = statusData?.data?.connected ?? false;
  const status = statusData?.data?.status;
  const metrics = performanceData?.data?.metrics;

  const handleBlockingToggle = (checked: boolean) => {
    setBlockingStatus.mutate({ enabled: checked });
  };

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">DNS Management</h2>
          <p className="text-muted-foreground">
            Monitor and manage your network's DNS filtering and protection
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="icon" onClick={() => window.location.reload()}>
            <Activity className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Connection Status Alert */}
      {statusError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to connect to DNS server. Please check your configuration.
          </AlertDescription>
        </Alert>
      )}

      {/* Server Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Shield className="h-5 w-5" />
              <CardTitle>DNS Server Status</CardTitle>
            </div>
            {statusLoading ? (
              <Skeleton className="h-6 w-20" />
            ) : (
              <Badge variant={isConnected ? 'default' : 'destructive'}>
                {isConnected ? (
                  <>
                    <CheckCircle className="mr-1 h-3 w-3" />
                    Connected
                  </>
                ) : (
                  <>
                    <AlertCircle className="mr-1 h-3 w-3" />
                    Disconnected
                  </>
                )}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">DNS Blocking</p>
              <p className="text-sm text-muted-foreground">
                {status?.status === 'enabled' ? 'Active protection' : 'Protection disabled'}
              </p>
            </div>
            <Switch
              checked={status?.status === 'enabled'}
              onCheckedChange={handleBlockingToggle}
              disabled={!isConnected || setBlockingStatus.isPending}
            />
          </div>
        </CardContent>
      </Card>

      {/* Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Queries</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {perfLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {formatNumber(metrics?.queries_today || 0)}
                </div>
                <p className="text-xs text-muted-foreground">Today</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Blocked</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {perfLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {formatNumber(metrics?.blocked_today || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatPercentage(metrics?.percent_blocked || 0)}% of queries
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cache Hit Rate</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {perfLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {formatPercentage(metrics?.cache_hit_rate || 0)}%
                </div>
                <p className="text-xs text-muted-foreground">Efficiency</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Clients</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {perfLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {metrics?.unique_clients || 0}
                </div>
                <p className="text-xs text-muted-foreground">Devices</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="domains">Domains</TabsTrigger>
          <TabsTrigger value="queries">Query History</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <PerformanceMonitor compact />
            <Card>
              <CardHeader>
                <CardTitle>Quick Stats</CardTitle>
                <CardDescription>Last update information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {status?.gravity_last_updated && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Blocklist Updated</span>
                    <span>
                      {status.gravity_last_updated.relative.days > 0
                        ? `${status.gravity_last_updated.relative.days} days ago`
                        : status.gravity_last_updated.relative.hours > 0
                        ? `${status.gravity_last_updated.relative.hours} hours ago`
                        : `${status.gravity_last_updated.relative.minutes} minutes ago`}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Forwarded Queries</span>
                  <span>{formatNumber(metrics?.queries_forwarded || 0)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Cached Queries</span>
                  <span>{formatNumber(metrics?.queries_cached || 0)}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="domains">
          <DomainManager />
        </TabsContent>

        <TabsContent value="queries">
          <QueryHistory />
        </TabsContent>

        <TabsContent value="performance">
          <PerformanceMonitor />
        </TabsContent>
      </Tabs>
    </div>
  );
}