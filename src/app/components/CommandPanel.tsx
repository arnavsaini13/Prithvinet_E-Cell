import { motion } from "motion/react";
import { Terminal, ChevronRight } from "lucide-react";
import { useState, useEffect } from "react";
import { alertsApi, pollutionApi, stationsApi } from "../../api/client";
import type { Alert, Station } from "../../api/client";

interface CommandLog {
  id: string;
  timestamp: string;
  command: string;
  status: "success" | "warning" | "error" | "info";
}

export function CommandPanel() {
  const [logs, setLogs] = useState<CommandLog[]>([
    {
      id: "init-1",
      timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
      command: "INITIALIZING INDIA SENSOR ARRAY...",
      status: "success"
    },
  ]);

  useEffect(() => {
    let cancelled = false;

    async function fetchRealActivity() {
      try {
        const ts = () => new Date().toLocaleTimeString('en-US', { hour12: false });
        const newLogs: CommandLog[] = [];

        // Fetch real stations
        const stations = await stationsApi.list();
        if (cancelled) return;
        newLogs.push({
          id: `st-${Date.now()}`,
          timestamp: ts(),
          command: `CONNECTED TO ${stations.length} MONITORING STATIONS`,
          status: "success",
        });

        // Fetch recent readings count
        const readings = await pollutionApi.list(undefined, 50);
        if (cancelled) return;
        if (readings.length > 0) {
          const latestTs = new Date(readings[0].timestamp).toLocaleTimeString('en-US', { hour12: false });
          newLogs.push({
            id: `rd-${Date.now()}`,
            timestamp: ts(),
            command: `RECEIVED ${readings.length} DATA POINTS • LATEST: ${latestTs}`,
            status: "info",
          });

          // Report per-station latest readings
          const seen = new Set<number>();
          for (const r of readings) {
            if (seen.has(r.station_id)) continue;
            seen.add(r.station_id);
            const st = stations.find(s => s.id === r.station_id);
            const stName = st?.name ?? `Station #${r.station_id}`;
            newLogs.push({
              id: `rpt-${r.station_id}-${Date.now()}`,
              timestamp: ts(),
              command: `${stName.toUpperCase()} — PM2.5: ${r.pm25.toFixed(1)} μg/m³ • CO₂: ${r.co2.toFixed(0)} ppm`,
              status: r.pm25 > 75 ? "warning" : "success",
            });
          }
        }

        // Fetch real alerts
        const alerts = await alertsApi.list(undefined, undefined, 10);
        if (cancelled) return;
        if (alerts.length > 0) {
          for (const alert of alerts.slice(0, 3)) {
            newLogs.push({
              id: `al-${alert.id}`,
              timestamp: new Date(alert.timestamp).toLocaleTimeString('en-US', { hour12: false }),
              command: `ALERT: ${alert.pollutant.toUpperCase()} ${alert.severity.toUpperCase()} — VALUE: ${alert.value.toFixed(1)} • STATION #${alert.station_id}`,
              status: alert.severity === "critical" ? "error" : "warning",
            });
          }
        } else {
          newLogs.push({
            id: `noal-${Date.now()}`,
            timestamp: ts(),
            command: "ALL PARAMETERS WITHIN NORMAL RANGE — NO ACTIVE ALERTS",
            status: "success",
          });
        }

        newLogs.push({
          id: `sync-${Date.now()}`,
          timestamp: ts(),
          command: "ENVIRONMENTAL DATA SYNC COMPLETE",
          status: "success",
        });

        if (!cancelled) {
          setLogs(prev => [...prev, ...newLogs].slice(-20));
        }
      } catch (err) {
        if (!cancelled) {
          setLogs(prev => [...prev, {
            id: `err-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
            command: "RETRYING DATA STREAM CONNECTION...",
            status: "warning",
          }].slice(-20));
        }
      }
    }

    fetchRealActivity();
    const interval = setInterval(fetchRealActivity, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "success": return "var(--prithvi-aurora-green)";
      case "warning": return "var(--prithvi-warm-amber)";
      case "error": return "var(--prithvi-critical-red)";
      case "info": return "var(--prithvi-electric-cyan)";
      default: return "var(--prithvi-electric-cyan)";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success": return "✓";
      case "warning": return "⚠";
      case "error": return "✗";
      case "info": return "●";
      default: return "●";
    }
  };

  return (
    <div className="h-full flex flex-col p-4 rounded-lg border backdrop-blur-md prithvi-card-layered prithvi-inner-glow overflow-hidden"
         style={{
           background: 'var(--prithvi-panel-bg)',
           borderColor: 'var(--prithvi-border-dim)',
         }}>
      {/* Header */}
      <div className="flex items-center gap-2 pb-3 border-b" style={{ borderColor: 'var(--prithvi-border-dim)' }}>
        <Terminal className="w-4 h-4 prithvi-text-electric" />
        <h3 className="text-xs font-mono tracking-wider prithvi-text-electric">
          COMMAND LOG
        </h3>
        <motion.div
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="ml-auto"
        >
          <div className="w-2 h-2 rounded-full prithvi-pulse" style={{ background: 'var(--prithvi-aurora-green)' }} />
        </motion.div>
      </div>

      {/* Command output */}
      <div className="flex-1 overflow-y-auto mt-3 space-y-1 prithvi-scrollbar">
        {logs.map((log, index) => (
          <motion.div
            key={log.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            className="flex items-start gap-2 text-xs font-mono py-1"
          >
            <ChevronRight
              className="w-3 h-3 mt-0.5 flex-shrink-0"
              style={{ color: getStatusColor(log.status) }}
            />
            <span className="opacity-40 prithvi-text-electric flex-shrink-0 w-16">
              {log.timestamp}
            </span>
            <span
              className="flex-shrink-0"
              style={{ color: getStatusColor(log.status) }}
            >
              {getStatusIcon(log.status)}
            </span>
            <span
              className="prithvi-text-forest"
              style={{
                opacity: index === logs.length - 1 ? 1 : 0.7,
                color: index === logs.length - 1 ? getStatusColor(log.status) : undefined
              }}
            >
              {log.command}
            </span>
          </motion.div>
        ))}
      </div>

      {/* Input prompt */}
      <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--prithvi-border-dim)' }}>
        <div className="flex items-center gap-2 text-xs font-mono">
          <ChevronRight className="w-3 h-3 prithvi-text-electric" />
          <motion.div
            animate={{ opacity: [1, 0, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
            className="w-2 h-3"
            style={{ background: 'var(--prithvi-electric-cyan)' }}
          />
        </div>
      </div>
    </div>
  );
}
