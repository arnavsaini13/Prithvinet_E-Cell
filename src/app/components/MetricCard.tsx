import { motion } from "motion/react";
import { LucideIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string;
  unit?: string;
  change?: number;
  status: "optimal" | "warning" | "critical";
  icon: LucideIcon;
  trend?: number[];
}

export function MetricCard({ title, value, unit, change, status, icon: Icon, trend }: MetricCardProps) {
  const statusColors = {
    optimal: 'var(--prithvi-aurora-green)',
    warning: 'var(--prithvi-warm-amber)',
    critical: 'var(--prithvi-critical-red)',
  };

  const statusGlows = {
    optimal: 'var(--prithvi-aurora-glow)',
    warning: 'var(--prithvi-amber-glow)',
    critical: 'var(--prithvi-red-glow)',
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="relative p-4 rounded-lg border backdrop-blur-md overflow-hidden group prithvi-card-layered prithvi-inner-glow"
      style={{
        background: 'var(--prithvi-panel-bg)',
        borderColor: 'var(--prithvi-border-dim)',
      }}
    >
      {/* Animated scan line */}
      <div className="absolute top-0 left-0 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity prithvi-shimmer"
           style={{
             background: `linear-gradient(90deg, transparent, ${statusColors[status]}, transparent)`
           }}
      />

      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded relative" style={{ 
            background: `${statusGlows[status]}`,
            border: `1px solid ${statusColors[status]}`
          }}>
            <Icon className="w-4 h-4" style={{ color: statusColors[status] }} />
          </div>
          <span className="text-xs uppercase tracking-wider opacity-70 prithvi-text-electric">
            {title}
          </span>
        </div>

        {change !== undefined && (
          <div className={`text-xs font-mono px-2 py-1 rounded ${change >= 0 ? 'status-critical' : 'status-optimal'}`}>
            {change >= 0 ? '+' : ''}{change.toFixed(1)}%
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-3xl font-bold font-mono" style={{ 
          color: statusColors[status],
          textShadow: `0 0 15px ${statusGlows[status]}`
        }}>
          {value}
        </span>
        {unit && (
          <span className="text-sm opacity-60" style={{ color: statusColors[status] }}>
            {unit}
          </span>
        )}
      </div>

      {/* Mini trend chart */}
      {trend && (
        <div className="flex items-end gap-0.5 h-8 mt-3">
          {trend.map((val, idx) => (
            <div
              key={idx}
              className="flex-1 rounded-t transition-all"
              style={{
                height: `${val}%`,
                background: statusColors[status],
                opacity: 0.3 + (idx / trend.length) * 0.7,
                boxShadow: `0 0 8px ${statusGlows[status]}`
              }}
            />
          ))}
        </div>
      )}

      {/* Enhanced glow effect */}
      <div 
        className="absolute -inset-px rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
        style={{
          boxShadow: `0 0 30px ${statusGlows[status]}, inset 0 0 20px ${statusGlows[status]}`
        }}
      />
    </motion.div>
  );
}