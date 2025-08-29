import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MetricsChart } from '../MetricsChart';
import { MetricData } from '../../../types/monitoring';

const mockMetricData: MetricData[] = [
  { timestamp: '2024-01-20T10:00:00Z', value: 25.5, label: '10:00' },
  { timestamp: '2024-01-20T10:01:00Z', value: 28.2, label: '10:01' },
  { timestamp: '2024-01-20T10:02:00Z', value: 32.1, label: '10:02' },
  { timestamp: '2024-01-20T10:03:00Z', value: 29.8, label: '10:03' },
  { timestamp: '2024-01-20T10:04:00Z', value: 35.6, label: '10:04' },
  { timestamp: '2024-01-20T10:05:00Z', value: 31.2, label: '10:05' }
];

describe('MetricsChart', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders chart with data points', () => {
      render(
        <MetricsChart 
          data={mockMetricData}
          title="CPU Usage"
          unit="%"
        />
      );
      
      expect(screen.getByText('CPU Usage')).toBeInTheDocument();
      expect(screen.getByTestId('metrics-chart')).toBeInTheDocument();
    });

    it('renders empty state when no data', () => {
      render(
        <MetricsChart 
          data={[]}
          title="CPU Usage"
          unit="%"
        />
      );
      
      expect(screen.getByText('No data available')).toBeInTheDocument();
    });

    it('displays correct axes labels', () => {
      render(
        <MetricsChart 
          data={mockMetricData}
          title="Memory Usage"
          unit="MB"
          xAxisLabel="Time"
          yAxisLabel="Usage (MB)"
        />
      );
      
      expect(screen.getByText('Time')).toBeInTheDocument();
      expect(screen.getByText('Usage (MB)')).toBeInTheDocument();
    });

    it('formats values with specified unit', () => {
      render(
        <MetricsChart 
          data={mockMetricData}
          title="CPU Usage"
          unit="%"
        />
      );
      
      // Check tooltip formatting
      const chartArea = screen.getByTestId('chart-area');
      fireEvent.mouseMove(chartArea, { clientX: 100, clientY: 100 });
      
      waitFor(() => {
        expect(screen.getByText(/25.5%/)).toBeInTheDocument();
      });
    });
  });

  describe('Chart Types', () => {
    it('renders line chart by default', () => {
      render(
        <MetricsChart 
          data={mockMetricData}
          title="Metrics"
        />
      );
      
      const lineChart = screen.getByTestId('line-chart');
      expect(lineChart).toBeInTheDocument();
    });

    it('renders area chart when specified', () => {
      render(
        <MetricsChart 
          data={mockMetricData}
          title="Metrics"
          chartType="area"
        />
      );
      
      const areaChart = screen.getByTestId('area-chart');
      expect(areaChart).toBeInTheDocument();
    });

    it('renders bar chart when specified', () => {
      render(
        <MetricsChart 
          data={mockMetricData}
          title="Metrics"
          chartType="bar"
        />
      );
      
      const barChart = screen.getByTestId('bar-chart');
      expect(barChart).toBeInTheDocument();
    });
  });

  describe('Thresholds', () => {
    it('displays warning threshold line', () => {
      render(
        <MetricsChart 
          data={mockMetricData}
          title="CPU Usage"
          warningThreshold={30}
        />
      );
      
      const warningLine = screen.getByTestId('warning-threshold');
      expect(warningLine).toHaveAttribute('stroke', '#fbbf24');
    });

    it('displays critical threshold line', () => {
      render(
        <MetricsChart 
          data={mockMetricData}
          title="CPU Usage"
          criticalThreshold={35}
        />
      );
      
      const criticalLine = screen.getByTestId('critical-threshold');
      expect(criticalLine).toHaveAttribute('stroke', '#ef4444');
    });

    it('highlights data points above thresholds', () => {
      render(
        <MetricsChart 
          data={mockMetricData}
          title="CPU Usage"
          warningThreshold={30}
          criticalThreshold={35}
        />
      );
      
      const criticalPoints = screen.getAllByTestId('critical-point');
      expect(criticalPoints).toHaveLength(1); // One point above 35
      
      const warningPoints = screen.getAllByTestId('warning-point');
      expect(warningPoints).toHaveLength(2); // Two points between 30-35
    });
  });

  describe('Interactivity', () => {
    it('shows tooltip on hover', async () => {
      render(
        <MetricsChart 
          data={mockMetricData}
          title="CPU Usage"
          unit="%"
        />
      );
      
      const dataPoint = screen.getAllByTestId('data-point')[0];
      fireEvent.mouseEnter(dataPoint);
      
      await waitFor(() => {
        const tooltip = screen.getByRole('tooltip');
        expect(tooltip).toBeInTheDocument();
        expect(tooltip).toHaveTextContent('25.5%');
        expect(tooltip).toHaveTextContent('10:00');
      });
    });

    it('hides tooltip on mouse leave', async () => {
      render(
        <MetricsChart 
          data={mockMetricData}
          title="CPU Usage"
        />
      );
      
      const dataPoint = screen.getAllByTestId('data-point')[0];
      fireEvent.mouseEnter(dataPoint);
      
      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
      });
      
      fireEvent.mouseLeave(dataPoint);
      
      await waitFor(() => {
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
      });
    });

    it('allows zooming and panning', () => {
      render(
        <MetricsChart 
          data={mockMetricData}
          title="CPU Usage"
          enableZoom
        />
      );
      
      const chartArea = screen.getByTestId('chart-area');
      
      // Simulate zoom
      fireEvent.wheel(chartArea, { deltaY: -100 });
      expect(screen.getByTestId('zoom-level')).toHaveTextContent('120%');
      
      // Simulate pan
      fireEvent.mouseDown(chartArea, { clientX: 100, clientY: 100 });
      fireEvent.mouseMove(chartArea, { clientX: 150, clientY: 100 });
      fireEvent.mouseUp(chartArea);
      
      expect(screen.getByTestId('chart-viewport')).toHaveStyle({
        transform: expect.stringContaining('translate')
      });
    });

    it('resets zoom on double click', () => {
      render(
        <MetricsChart 
          data={mockMetricData}
          title="CPU Usage"
          enableZoom
        />
      );
      
      const chartArea = screen.getByTestId('chart-area');
      
      // Zoom in
      fireEvent.wheel(chartArea, { deltaY: -100 });
      expect(screen.getByTestId('zoom-level')).toHaveTextContent('120%');
      
      // Reset
      fireEvent.doubleClick(chartArea);
      expect(screen.getByTestId('zoom-level')).toHaveTextContent('100%');
    });
  });

  describe('Time Range Selection', () => {
    it('allows selecting time range', () => {
      const onRangeSelect = jest.fn();
      render(
        <MetricsChart 
          data={mockMetricData}
          title="CPU Usage"
          onRangeSelect={onRangeSelect}
          enableRangeSelection
        />
      );
      
      const chartArea = screen.getByTestId('chart-area');
      
      fireEvent.mouseDown(chartArea, { clientX: 100, clientY: 100, shiftKey: true });
      fireEvent.mouseMove(chartArea, { clientX: 200, clientY: 100, shiftKey: true });
      fireEvent.mouseUp(chartArea);
      
      expect(onRangeSelect).toHaveBeenCalledWith(
        expect.objectContaining({
          start: expect.any(String),
          end: expect.any(String)
        })
      );
    });

    it('shows selection overlay during range selection', () => {
      render(
        <MetricsChart 
          data={mockMetricData}
          title="CPU Usage"
          enableRangeSelection
        />
      );
      
      const chartArea = screen.getByTestId('chart-area');
      
      fireEvent.mouseDown(chartArea, { clientX: 100, clientY: 100, shiftKey: true });
      fireEvent.mouseMove(chartArea, { clientX: 200, clientY: 100, shiftKey: true });
      
      const selectionOverlay = screen.getByTestId('selection-overlay');
      expect(selectionOverlay).toBeInTheDocument();
      expect(selectionOverlay).toHaveStyle({ width: '100px' });
    });
  });

  describe('Real-time Updates', () => {
    it('smoothly animates new data points', async () => {
      const { rerender } = render(
        <MetricsChart 
          data={mockMetricData}
          title="CPU Usage"
          animateUpdates
        />
      );
      
      const newData = [
        ...mockMetricData,
        { timestamp: '2024-01-20T10:06:00Z', value: 38.5, label: '10:06' }
      ];
      
      rerender(
        <MetricsChart 
          data={newData}
          title="CPU Usage"
          animateUpdates
        />
      );
      
      const newPoint = screen.getAllByTestId('data-point').pop();
      expect(newPoint).toHaveClass('animate-fade-in');
    });

    it('maintains fixed window size for streaming data', () => {
      const { rerender } = render(
        <MetricsChart 
          data={mockMetricData}
          title="CPU Usage"
          maxDataPoints={5}
        />
      );
      
      expect(screen.getAllByTestId('data-point')).toHaveLength(5);
      
      const newData = [
        ...mockMetricData,
        { timestamp: '2024-01-20T10:06:00Z', value: 38.5, label: '10:06' }
      ];
      
      rerender(
        <MetricsChart 
          data={newData}
          title="CPU Usage"
          maxDataPoints={5}
        />
      );
      
      // Should still have 5 points (oldest dropped)
      expect(screen.getAllByTestId('data-point')).toHaveLength(5);
    });
  });

  describe('Export Functions', () => {
    it('exports chart as image', async () => {
      const onExport = jest.fn();
      render(
        <MetricsChart 
          data={mockMetricData}
          title="CPU Usage"
          onExport={onExport}
          showExportButton
        />
      );
      
      const exportButton = screen.getByRole('button', { name: /export/i });
      fireEvent.click(exportButton);
      
      const exportPNG = screen.getByText('Export as PNG');
      fireEvent.click(exportPNG);
      
      await waitFor(() => {
        expect(onExport).toHaveBeenCalledWith(
          expect.objectContaining({
            format: 'png',
            data: expect.any(String)
          })
        );
      });
    });

    it('exports data as CSV', async () => {
      const onExport = jest.fn();
      render(
        <MetricsChart 
          data={mockMetricData}
          title="CPU Usage"
          onExport={onExport}
          showExportButton
        />
      );
      
      const exportButton = screen.getByRole('button', { name: /export/i });
      fireEvent.click(exportButton);
      
      const exportCSV = screen.getByText('Export as CSV');
      fireEvent.click(exportCSV);
      
      await waitFor(() => {
        expect(onExport).toHaveBeenCalledWith(
          expect.objectContaining({
            format: 'csv',
            data: expect.stringContaining('timestamp,value')
          })
        );
      });
    });
  });

  describe('Accessibility', () => {
    it('provides keyboard navigation for data points', () => {
      render(
        <MetricsChart 
          data={mockMetricData}
          title="CPU Usage"
        />
      );
      
      const dataPoints = screen.getAllByTestId('data-point');
      dataPoints[0].focus();
      
      fireEvent.keyDown(dataPoints[0], { key: 'ArrowRight' });
      expect(dataPoints[1]).toHaveFocus();
      
      fireEvent.keyDown(dataPoints[1], { key: 'ArrowLeft' });
      expect(dataPoints[0]).toHaveFocus();
    });

    it('announces data values to screen readers', () => {
      render(
        <MetricsChart 
          data={mockMetricData}
          title="CPU Usage"
          unit="%"
        />
      );
      
      const dataPoints = screen.getAllByTestId('data-point');
      expect(dataPoints[0]).toHaveAttribute(
        'aria-label',
        'Data point: 25.5% at 10:00'
      );
    });

    it('provides chart description for screen readers', () => {
      render(
        <MetricsChart 
          data={mockMetricData}
          title="CPU Usage"
          description="CPU usage over the last hour"
        />
      );
      
      const chart = screen.getByRole('img', { name: /chart/i });
      expect(chart).toHaveAttribute(
        'aria-description',
        'CPU usage over the last hour'
      );
    });
  });

  describe('Performance', () => {
    it('uses canvas for large datasets', () => {
      const largeData = Array(1000).fill(null).map((_, i) => ({
        timestamp: new Date(2024, 0, 20, 10, i).toISOString(),
        value: Math.random() * 100,
        label: `${10}:${i.toString().padStart(2, '0')}`
      }));
      
      render(
        <MetricsChart 
          data={largeData}
          title="Large Dataset"
        />
      );
      
      const canvas = screen.getByTestId('chart-canvas');
      expect(canvas.tagName).toBe('CANVAS');
    });

    it('throttles render updates during rapid data changes', async () => {
      const renderSpy = jest.fn();
      const TestWrapper = ({ data }: any) => {
        renderSpy();
        return <MetricsChart data={data} title="Test" />;
      };
      
      const { rerender } = render(<TestWrapper data={mockMetricData} />);
      
      // Rapid updates
      for (let i = 0; i < 10; i++) {
        const newData = mockMetricData.map(d => ({
          ...d,
          value: d.value + i
        }));
        rerender(<TestWrapper data={newData} />);
      }
      
      // Should be throttled
      await waitFor(() => {
        expect(renderSpy).toHaveBeenCalledTimes(3); // Initial + throttled updates
      });
    });
  });
});