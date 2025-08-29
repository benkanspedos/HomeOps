'use client';

import { useState } from 'react';
import { TrendingUp, TrendingDown, Activity, BarChart2, Clock, Shield } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useDnsPerformance, useHistoricalStats, useTopQueries, useTopBlocked } from '@/hooks/useDns';
import { formatNumber, formatPercentage } from '@/lib/utils';

interface PerformanceMonitorProps {
  compact?: boolean;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export default function PerformanceMonitor({ compact = false }: PerformanceMonitorProps) {
  const [period, setPeriod] = useState('24h');
  
  const { data: performanceData, isLoading: perfLoading } = useDnsPerformance();
  const { data: historicalData, isLoading: histLoading } = useHistoricalStats(period);
  const { data: topQueriesData, isLoading: topQueriesLoading } = useTopQueries(compact ? 5 : 10);
  const { data: topBlockedData, isLoading: topBlockedLoading } = useTopBlocked(compact ? 5 : 10);

  const metrics = performanceData?.data?.metrics;
  const stats = historicalData?.stats || [];
  const topQueries = topQueriesData?.data?.topQueries || [];
  const topBlocked = topBlockedData?.data?.topBlocked || [];

  // Transform historical data for charts
  const chartData = stats.map((stat: any) => ({
    time: new Date(stat.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    queries: stat.queries_today,
    blocked: stat.blocked_today,
    blockRate: (stat.blocked_today / stat.queries_today) * 100,
    responseTime: stat.avg_response_time,
    cacheHitRate: stat.cache_hit_rate,
  }));

  // Prepare pie chart data
  const pieData = [
    { name: 'Allowed', value: (metrics?.queries_today || 0) - (metrics?.blocked_today || 0) },
    { name: 'Blocked', value: metrics?.blocked_today || 0 },
  ];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded-lg shadow-lg p-3">
          <p className="font-medium">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {formatNumber(entry.value)}
              {entry.name.includes('Rate') && '%'}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (compact) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Performance Overview</CardTitle>
          <CardDescription>Real-time DNS performance metrics</CardDescription>
        </CardHeader>
        <CardContent>
          {perfLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-[200px] w-full" />
              <Skeleton className="h-[100px] w-full" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Mini Query Volume Chart */}
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData.slice(-12)}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="time" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip content={<CustomTooltip />} />
                    <Area 
                      type="monotone" 
                      dataKey="queries" 
                      stroke="#8884d8" 
                      fill="#8884d8" 
                      fillOpacity={0.6}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="blocked" 
                      stroke="#ef4444" 
                      fill="#ef4444" 
                      fillOpacity={0.6}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Key Metrics */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Block Rate</p>
                  <div className="flex items-center gap-1">
                    <p className="text-2xl font-bold">
                      {formatPercentage(metrics?.percent_blocked || 0)}%
                    </p>
                    {metrics?.percent_blocked && metrics.percent_blocked > 20 && (
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Cache Efficiency</p>
                  <div className="flex items-center gap-1">
                    <p className="text-2xl font-bold">
                      {formatPercentage(metrics?.cache_hit_rate || 0)}%
                    </p>
                    {metrics?.cache_hit_rate && metrics.cache_hit_rate > 50 && (
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Performance Analytics</h3>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1h">Last Hour</SelectItem>
            <SelectItem value="24h">Last 24 Hours</SelectItem>
            <SelectItem value="7d">Last 7 Days</SelectItem>
            <SelectItem value="30d">Last 30 Days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Performance Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Query Volume</CardTitle>
          </CardHeader>
          <CardContent>
            {perfLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="space-y-1">
                <p className="text-2xl font-bold">
                  {formatNumber(metrics?.queries_today || 0)}
                </p>
                <Progress value={75} className="h-1" />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Block Efficiency</CardTitle>
          </CardHeader>
          <CardContent>
            {perfLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="space-y-1">
                <p className="text-2xl font-bold">
                  {formatPercentage(metrics?.percent_blocked || 0)}%
                </p>
                <Progress value={metrics?.percent_blocked || 0} className="h-1" />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg Response</CardTitle>
          </CardHeader>
          <CardContent>
            {perfLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="space-y-1">
                <p className="text-2xl font-bold">
                  {metrics?.average_response_time || 0}ms
                </p>
                <Badge variant={metrics?.average_response_time && metrics.average_response_time < 50 ? 'success' : 'warning'}>
                  {metrics?.average_response_time && metrics.average_response_time < 50 ? 'Fast' : 'Moderate'}
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Cache Hit Rate</CardTitle>
          </CardHeader>
          <CardContent>
            {perfLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="space-y-1">
                <p className="text-2xl font-bold">
                  {formatPercentage(metrics?.cache_hit_rate || 0)}%
                </p>
                <Progress value={metrics?.cache_hit_rate || 0} className="h-1" />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Query Volume Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Query Volume Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            {histLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="time" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Area 
                      type="monotone" 
                      dataKey="queries" 
                      name="Total Queries"
                      stroke="#8884d8" 
                      fill="#8884d8" 
                      fillOpacity={0.6}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="blocked" 
                      name="Blocked"
                      stroke="#ef4444" 
                      fill="#ef4444" 
                      fillOpacity={0.6}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Query Distribution Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Query Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {perfLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      <Cell fill="#10b981" />
                      <Cell fill="#ef4444" />
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Queried Domains */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Queried Domains</CardTitle>
          </CardHeader>
          <CardContent>
            {topQueriesLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : topQueries.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                No data available
              </div>
            ) : (
              <div className="space-y-2">
                {topQueries.map((item, index) => (
                  <div key={item.domain} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono text-muted-foreground">
                        #{index + 1}
                      </span>
                      <span className="text-sm truncate max-w-[200px]">
                        {item.domain}
                      </span>
                    </div>
                    <Badge variant="outline">
                      {formatNumber(item.count)}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Blocked Domains */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Blocked Domains</CardTitle>
          </CardHeader>
          <CardContent>
            {topBlockedLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : topBlocked.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                No blocked domains
              </div>
            ) : (
              <div className="space-y-2">
                {topBlocked.map((item, index) => (
                  <div key={item.domain} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono text-muted-foreground">
                        #{index + 1}
                      </span>
                      <span className="text-sm truncate max-w-[200px]">
                        {item.domain}
                      </span>
                    </div>
                    <Badge variant="destructive">
                      {formatNumber(item.count)}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Response Time Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Response Time & Cache Performance</CardTitle>
        </CardHeader>
        <CardContent>
          {histLoading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="time" className="text-xs" />
                  <YAxis yAxisId="left" className="text-xs" />
                  <YAxis yAxisId="right" orientation="right" className="text-xs" />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="responseTime"
                    name="Response Time (ms)"
                    stroke="#8884d8"
                    strokeWidth={2}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="cacheHitRate"
                    name="Cache Hit Rate (%)"
                    stroke="#10b981"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}