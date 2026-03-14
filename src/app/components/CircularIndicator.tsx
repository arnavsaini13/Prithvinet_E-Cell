import { motion } from "motion/react";
import { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";

interface CircularIndicatorProps {
  title: string;
  value: number;
  maxValue: number;
  unit?: string;
  icon: LucideIcon;
  color: string;
  status?: "optimal" | "warning" | "critical";
  realTime?: boolean;
}

export function CircularIndicator({
  title,
  value,
  maxValue,
  unit = "",
  icon: Icon,
  color,
  status = "optimal",
  realTime = false
}: CircularIndicatorProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const percentage = (displayValue / maxValue) * 100;
  const circumference = 2 * Math.PI * 45; // radius = 45
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  useEffect(() => {
    setDisplayValue(value);
  }, [value, maxValue, realTime]);

  const getStatusColor = () => {
    switch (status) {
      case "optimal": return "var(--prithvi-aurora-green)";
      case "warning": return "var(--prithvi-warm-amber)";
      case "critical": return "var(--prithvi-critical-red)";
      default: return color;
    }
  };

  return (
    <div className="relative group">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="p-6 rounded-xl border backdrop-blur-md prithvi-card-layered prithvi-inner-glow"
        style={{
          background: 'var(--prithvi-glass)',
          borderColor: 'var(--prithvi-border-dim)',
        }}
      >
        {/* Circular progress */}
        <div className="relative mx-auto w-32 h-32">
          <svg className="w-full h-full transform -rotate-90">
            {/* Background circle */}
            <circle
              cx="64"
              cy="64"
              r="45"
              fill="none"
              stroke="var(--prithvi-grid)"
              strokeWidth="8"
              opacity="0.2"
            />
            {/* Progress circle */}
            <motion.circle
              cx="64"
              cy="64"
              r="45"
              fill="none"
              stroke={getStatusColor()}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset }}
              transition={{ duration: 1, ease: "easeOut" }}
              style={{
                filter: `drop-shadow(0 0 8px ${getStatusColor()})`,
              }}
            />
          </svg>

          {/* Center icon and value */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.div
              animate={{ 
                rotate: status === "critical" ? [0, 5, -5, 0] : 0,
                scale: status === "critical" ? [1, 1.1, 1] : 1 
              }}
              transition={{ 
                duration: 2, 
                repeat: status === "critical" ? Infinity : 0,
                repeatDelay: 1 
              }}
            >
              <Icon 
                className="w-10 h-10 mb-1" 
                style={{ color: getStatusColor() }} 
              />
            </motion.div>
            <motion.div 
              key={Math.floor(displayValue)}
              initial={{ scale: 1.2, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-2xl font-bold font-mono"
              style={{ color: getStatusColor() }}
            >
              {Math.floor(displayValue)}
              {unit && <span className="text-sm ml-0.5">{unit}</span>}
            </motion.div>
          </div>

          {/* Rotating ring effects */}
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-transparent"
            style={{ borderTopColor: getStatusColor(), opacity: 0.3 }}
            animate={{ rotate: 360 }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          />
          <motion.div
            className="absolute -inset-2 rounded-full border border-transparent"
            style={{ borderTopColor: getStatusColor(), opacity: 0.2 }}
            animate={{ rotate: -360 }}
            transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
          />
        </div>

        {/* Title and status */}
        <div className="mt-4 text-center">
          <h3 className="text-sm font-mono tracking-wider opacity-70 prithvi-text-electric">
            {title}
          </h3>
          <div className="flex items-center justify-center gap-2 mt-2">
            <div 
              className="w-2 h-2 rounded-full prithvi-pulse"
              style={{ background: getStatusColor() }}
            />
            <span className="text-xs font-mono prithvi-text-forest">
              {realTime ? "Real-time" : status.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Percentage indicator */}
        <div className="mt-3 text-center">
          <div className="text-xs font-mono opacity-50 prithvi-text-electric">
            {percentage.toFixed(1)}% of max
          </div>
        </div>
      </motion.div>

      {/* Hover glow effect */}
      <div 
        className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity -z-10 blur-xl"
        style={{
          background: `radial-gradient(circle, ${getStatusColor()}20, transparent 70%)`,
        }}
      />
    </div>
  );
}
