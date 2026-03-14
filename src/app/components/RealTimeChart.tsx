import { useState, useEffect, useRef, useMemo } from "react";
import { motion } from "motion/react";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Activity } from "lucide-react";

interface RealTimeChartProps {
  title: string;
  subtitle?: string;
  dataPoints?: number;
  updateInterval?: number;
  chartType?: "line" | "area";
  color?: string;
  height?: number;
  yAxisDomain?: [number, number];
  /** If provided, chart uses this live data instead of generating random values */
  externalData?: number[];
}

export function RealTimeChart({
  title,
  subtitle,
  dataPoints = 20,
  updateInterval = 2000,
  chartType = "area",
  color = "var(--prithvi-electric-cyan)",
  height = 200,
  yAxisDomain = [0, 100],
  externalData,
}: RealTimeChartProps) {
  // Generate unique ID for this chart instance using useRef to ensure stability across renders
  const chartId = useRef(`chart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`).current;
  const gradientId = useMemo(() => `gradient-${chartId}`, [chartId]);

  // Use a counter ref to track data point IDs
  const dataPointCounter = useRef(0);

  // Build data from externalData if provided
  const data = useMemo(() => {
    if (externalData && externalData.length > 0) {
      return externalData.map((val, i) => ({
        time: i,
        value: val,
        id: `${chartId}-ext-${i}`,
      }));
    }
    return null;
  }, [externalData, chartId]);

  // Fallback random data if no externalData
  const [randomData, setRandomData] = useState(() =>
    Array.from({ length: dataPoints }, (_, i) => {
      const id = dataPointCounter.current++;
      return {
        time: id,
        value: Math.random() * (yAxisDomain[1] - yAxisDomain[0]) + yAxisDomain[0],
        id: `${chartId}-${id}`,
      };
    })
  );

  useEffect(() => {
    if (externalData) return; // Don't run random updates when using external data
    const interval = setInterval(() => {
      setRandomData(prevData => {
        const newData = [...prevData.slice(1)];
        const lastValue = prevData[prevData.length - 1].value;
        const change = (Math.random() - 0.5) * 10;
        const newValue = Math.max(
          yAxisDomain[0],
          Math.min(yAxisDomain[1], lastValue + change)
        );

        const newId = dataPointCounter.current++;
        newData.push({
          time: newId,
          value: newValue,
          id: `${chartId}-${newId}`,
        });

        return newData;
      });
    }, updateInterval);

    return () => clearInterval(interval);
  }, [updateInterval, yAxisDomain, chartId, externalData]);

  const chartData = data || randomData;
  const currentValue = chartData[chartData.length - 1]?.value || 0;
  const previousValue = chartData[chartData.length - 2]?.value || 0;
  const trend = currentValue > previousValue ? "up" : "down";

  return (
    <motion.div
      key={chartId}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 rounded-lg border backdrop-blur-md prithvi-card-layered prithvi-inner-glow"
      style={{
        background: 'var(--prithvi-panel-bg)',
        borderColor: 'var(--prithvi-border-dim)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-mono tracking-wider prithvi-text-electric">
              {title}
            </h3>
            <motion.div
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Activity className="w-4 h-4" style={{ color }} />
            </motion.div>
          </div>
          {subtitle && (
            <p className="text-xs opacity-60 prithvi-text-forest mt-1">
              {subtitle}
            </p>
          )}
        </div>

        {/* Current value indicator */}
        <div className="text-right">
          <motion.div
            key={Math.floor(currentValue)}
            initial={{ scale: 1.2, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-2xl font-bold font-mono"
            style={{ color }}
          >
            {currentValue.toFixed(1)}
          </motion.div>
          <div className="flex items-center gap-1 text-xs font-mono opacity-60">
            <span style={{
              color: trend === "up"
                ? "var(--prithvi-critical-red)"
                : "var(--prithvi-aurora-green)"
            }}>
              {trend === "up" ? "↑" : "↓"}
            </span>
            <span className="prithvi-text-forest">{externalData ? "Real-time" : "Live"}</span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={height}>
        {chartType === "area" ? (
          <AreaChart
            data={chartData}
            syncId={chartId}
            margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.4}/>
                <stop offset="95%" stopColor={color} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--prithvi-grid)" opacity={0.3} />
            <XAxis
              dataKey="id"
              stroke="var(--prithvi-electric-cyan)"
              tick={false}
              axisLine={{ stroke: 'var(--prithvi-electric-cyan)', opacity: 0.5 }}
            />
            <YAxis
              domain={yAxisDomain}
              stroke="var(--prithvi-electric-cyan)"
              tick={{ fill: "var(--prithvi-electric-cyan)", fontSize: 9, fontFamily: "monospace" }}
              tickLine={{ stroke: "var(--prithvi-electric-cyan)", opacity: 0.5 }}
              axisLine={{ stroke: 'var(--prithvi-electric-cyan)', opacity: 0.6 }}
              width={40}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--prithvi-panel-bg-solid)',
                border: '1px solid var(--prithvi-border-bright)',
                borderRadius: '8px',
                fontSize: '12px',
                fontFamily: 'monospace',
              }}
              formatter={(value: number) => [value.toFixed(2), 'Value']}
              animationDuration={0}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              fill={`url(#${gradientId})`}
              strokeWidth={2}
              isAnimationActive={false}
              animationDuration={0}
            />
          </AreaChart>
        ) : (
          <LineChart
            data={chartData}
            syncId={chartId}
            margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--prithvi-grid)" opacity={0.3} />
            <XAxis
              dataKey="id"
              stroke="var(--prithvi-electric-cyan)"
              tick={false}
              axisLine={{ stroke: 'var(--prithvi-electric-cyan)', opacity: 0.5 }}
            />
            <YAxis
              domain={yAxisDomain}
              stroke="var(--prithvi-electric-cyan)"
              tick={{ fill: "var(--prithvi-electric-cyan)", fontSize: 9, fontFamily: "monospace" }}
              tickLine={{ stroke: "var(--prithvi-electric-cyan)", opacity: 0.5 }}
              axisLine={{ stroke: 'var(--prithvi-electric-cyan)', opacity: 0.6 }}
              width={40}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--prithvi-panel-bg-solid)',
                border: '1px solid var(--prithvi-border-bright)',
                borderRadius: '8px',
                fontSize: '12px',
                fontFamily: 'monospace',
              }}
              formatter={(value: number) => [value.toFixed(2), 'Value']}
              animationDuration={0}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              animationDuration={0}
            />
          </LineChart>
        )}
      </ResponsiveContainer>

      {/* Status bar */}
      <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--prithvi-border-dim)' }}>
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="opacity-60 prithvi-text-electric">
            {externalData ? "SOURCE" : "SAMPLING RATE"}
          </span>
          <span className="prithvi-text-ocean">
            {externalData ? "Open-Meteo API" : `${(updateInterval / 1000).toFixed(1)}s`}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
