'use client';

import React from 'react';
import { MetricsChartProps } from '@/types/monitoring';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Download, Maximize2, RefreshCw } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function MetricsChart({
  data,
  timeRange,
  onRangeChange,
  height = 300,
  showLegend = true,
}: MetricsChartProps) {
  // Transform data for recharts
  const chartData = React.useMemo(() => {
    const maxPoints = 50; // Limit data points for performance
    const cpuData = data.cpu || [];
    const memoryData = data.memory || [];
    const networkData = data.network || [];
    
    // Combine all data points
    const combinedData = cpuData.map((cpu, index) => ({
      time: cpu.time,
      cpu: cpu.value,
      memory: memoryData[index]?.value || 0,
      network: networkData[index]?.value || 0,
    }));
    
    // Sample data if too many points
    if (combinedData.length > maxPoints) {
      const step = Math.ceil(combinedData.length / maxPoints);
      return combinedData.filter((_, index) => index % step === 0);
    }
    
    return combinedData;
  }, [data]);

  const handleExportCSV = () => {
    const csv = [
      ['Time', 'CPU (%)', 'Memory (%)', 'Network (MB)'],
      ...chartData.map(row => [
        row.time,
        row.cpu.toFixed(2),
        row.memory.toFixed(2),
        row.network.toFixed(2),
      ]),
    ]
      .map(row => row.join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `metrics-${timeRange}-${Date.now()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border">
          <p className="text-sm font-medium mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4">
              <span
                className="text-xs"
                style={{ color: entry.color }}
              >
                {entry.name}:
              </span>
              <span className="text-xs font-medium">
                {entry.value.toFixed(2)}
                {entry.name === 'network' ? ' MB' : '%'}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Resource Metrics</h3>
        
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={onRangeChange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last Hour</SelectItem>
              <SelectItem value="6h">Last 6 Hours</SelectItem>
              <SelectItem value="24h">Last 24 Hours</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.location.reload()}
            className="h-8 w-8 p-0"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExportCSV}
            className="h-8 w-8 p-0"
          >
            <Download className="h-4 w-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorMemory" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorNetwork" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
            </linearGradient>
          </defs>
          
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          
          <XAxis
            dataKey="time"
            className="text-xs"
            tick={{ fontSize: 11 }}
            interval="preserveStartEnd"
          />
          
          <YAxis
            className="text-xs"
            tick={{ fontSize: 11 }}
            domain={[0, 100]}
          />
          
          <Tooltip content={<CustomTooltip />} />
          
          {showLegend && (
            <Legend
              wrapperStyle={{ fontSize: '12px' }}
              iconType="line"
            />
          )}
          
          <Area
            type="monotone"
            dataKey="cpu"
            stroke="#3b82f6"
            fillOpacity={1}
            fill="url(#colorCpu)"
            strokeWidth={2}
            name="CPU"
          />
          
          <Area
            type="monotone"
            dataKey="memory"
            stroke="#10b981"
            fillOpacity={1}
            fill="url(#colorMemory)"
            strokeWidth={2}
            name="Memory"
          />
          
          {data.network && data.network.length > 0 && (
            <Area
              type="monotone"
              dataKey="network"
              stroke="#f59e0b"
              fillOpacity={1}
              fill="url(#colorNetwork)"
              strokeWidth={2}
              name="Network"
              yAxisId="right"
            />
          )}
        </AreaChart>
      </ResponsiveContainer>

      {chartData.length === 0 && (
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-500">No data available for the selected time range</p>
        </div>
      )}
    </Card>
  );
}