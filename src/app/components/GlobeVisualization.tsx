import { motion } from "motion/react";
import { MapPin, Radio } from "lucide-react";
import { useEffect, useState } from "react";
import { stationsApi, pollutionApi, riskApi } from "../../api/client";
import type { Station as ApiStation, PollutionReading, RiskScore } from "../../api/client";

interface MonitoringStation {
  id: number;
  name: string;
  x: number;
  y: number;
  status: "optimal" | "warning" | "critical";
}

// Convert lat/lng to globe x/y percentages (map onto sphere-like projection)
function latLngToGlobe(lat: number, lng: number): { x: number; y: number } {
  // Normalize longitude from [-180,180] to [10,90] (globe visible area)
  const x = 10 + ((lng + 180) / 360) * 80;
  // Normalize latitude from [90,-90] to [15,85]
  const y = 15 + ((90 - lat) / 180) * 70;
  return { x, y };
}

export function GlobeVisualization() {
  const [stations, setStations] = useState<MonitoringStation[]>([]);
  const [selectedStation, setSelectedStation] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        const [stList, riskScores] = await Promise.all([
          stationsApi.list(),
          riskApi.list().catch(() => [] as RiskScore[]),
        ]);
        if (cancelled) return;

        const mapped: MonitoringStation[] = stList.map((st: ApiStation) => {
          const pos = latLngToGlobe(st.latitude, st.longitude);
          const risk = riskScores.find((r: RiskScore) => r.station_id === st.id);
          let status: "optimal" | "warning" | "critical" = "optimal";
          if (risk) {
            if (risk.overall_risk > 60) status = "critical";
            else if (risk.overall_risk > 30) status = "warning";
          }
          return { id: st.id, name: st.name, x: pos.x, y: pos.y, status };
        });

        setStations(mapped);
      } catch (err) {
        console.error("GlobeVisualization: fetch error", err);
      }
    }
    fetchData();
    const id = setInterval(fetchData, 15_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const statusColors = {
    optimal: 'var(--prithvi-aurora-green)',
    warning: 'var(--prithvi-warm-amber)',
    critical: 'var(--prithvi-critical-red)',
  };

  return (
    <div className="relative w-full h-full rounded-lg border overflow-hidden prithvi-card-layered prithvi-inner-glow"
         style={{
           background: 'var(--prithvi-ocean-deep)',
           borderColor: 'var(--prithvi-border-dim)',
         }}>
      
      {/* Globe representation with orbital rings */}
      <div className="absolute inset-0 flex items-center justify-center">
        {/* Central sphere */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 120, repeat: Infinity, ease: "linear" }}
          className="relative w-80 h-80 rounded-full border-2"
          style={{
            background: 'radial-gradient(circle at 30% 30%, var(--prithvi-ocean-blue), var(--prithvi-ocean-deep))',
            borderColor: 'var(--prithvi-border-bright)',
            boxShadow: '0 0 60px var(--prithvi-cyan-glow), inset 0 0 60px var(--prithvi-cyan-glow)',
          }}
        >
          {/* Latitude/longitude grid */}
          <svg className="absolute inset-0 w-full h-full opacity-20">
            {/* Latitude lines */}
            {[0.25, 0.5, 0.75].map((ratio, idx) => (
              <ellipse
                key={`lat-${idx}`}
                cx="50%"
                cy="50%"
                rx={`${40 * (1 - Math.abs(ratio - 0.5))}%`}
                ry="2%"
                fill="none"
                stroke="var(--prithvi-electric-cyan)"
                strokeWidth="0.5"
                transform={`translate(0, ${(ratio - 0.5) * 80}%)`}
              />
            ))}
            
            {/* Longitude lines */}
            {[0, 30, 60, 90, 120, 150].map((angle) => (
              <ellipse
                key={`lon-${angle}`}
                cx="50%"
                cy="50%"
                rx="40%"
                ry="40%"
                fill="none"
                stroke="var(--prithvi-electric-cyan)"
                strokeWidth="0.5"
                transform={`rotate(${angle} 160 160)`}
              />
            ))}
          </svg>

          {/* Monitoring stations */}
          {stations.map((station) => (
            <motion.div
              key={station.id}
              className="absolute cursor-pointer"
              style={{
                left: `${station.x}%`,
                top: `${station.y}%`,
                transform: 'translate(-50%, -50%)',
              }}
              whileHover={{ scale: 1.3 }}
              onClick={() => setSelectedStation(station.id)}
            >
              <div className="relative">
                {/* Pulsing ring */}
                <motion.div
                  className="absolute inset-0 rounded-full"
                  style={{
                    border: `2px solid ${statusColors[station.status]}`,
                    width: '24px',
                    height: '24px',
                    left: '-12px',
                    top: '-12px',
                  }}
                  animate={{
                    scale: [1, 1.5, 1],
                    opacity: [0.8, 0, 0.8],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeOut",
                  }}
                />
                
                {/* Station marker */}
                <div
                  className="w-3 h-3 rounded-full border-2"
                  style={{
                    background: statusColors[station.status],
                    borderColor: statusColors[station.status],
                    boxShadow: `0 0 10px ${statusColors[station.status]}`,
                  }}
                />
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Outer orbital rings */}
        {[1, 2, 3].map((ring) => (
          <motion.div
            key={ring}
            className="absolute rounded-full border border-dashed opacity-20"
            style={{
              width: `${320 + ring * 40}px`,
              height: `${320 + ring * 40}px`,
              borderColor: 'var(--prithvi-electric-cyan)',
            }}
            animate={{ rotate: ring % 2 === 0 ? 360 : -360 }}
            transition={{
              duration: 40 + ring * 20,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        ))}
      </div>

      {/* Station info overlay */}
      {selectedStation && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-6 right-6 p-4 rounded-lg border backdrop-blur-md min-w-64 prithvi-inner-glow prithvi-elevation-3"
          style={{
            background: 'var(--prithvi-panel-bg-solid)',
            borderColor: 'var(--prithvi-border-bright)',
          }}
        >
          {(() => {
            const station = stations.find(s => s.id === selectedStation);
            if (!station) return null;
            
            return (
              <>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" style={{ color: statusColors[station.status] }} />
                    <span className="font-mono text-sm prithvi-text-electric">
                      {station.name}
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedStation(null)}
                    className="text-xs opacity-60 hover:opacity-100 prithvi-text-electric"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-2 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="opacity-60 prithvi-text-electric">STATUS:</span>
                    <span className={`status-${station.status}`}>
                      {station.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="opacity-60 prithvi-text-electric">SENSORS:</span>
                    <span className="prithvi-text-aurora">{stations.length}/{stations.length} ACTIVE</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="opacity-60 prithvi-text-electric">LAST UPDATE:</span>
                    <span style={{ color: 'var(--prithvi-teal-bright)' }}>LIVE</span>
                  </div>
                </div>
              </>
            );
          })()}
        </motion.div>
      )}

      {/* Corner stats */}
      <div className="absolute bottom-4 left-4 space-y-2">
        <div className="flex items-center gap-2 text-xs font-mono">
          <Radio className="w-3 h-3 prithvi-pulse prithvi-text-aurora" />
          <span className="prithvi-text-electric">
            {stations.length} MONITORING STATIONS ACTIVE
          </span>
        </div>
        <div className="text-xs font-mono opacity-60 prithvi-text-forest">
          REAL-TIME INDIA SURVEILLANCE
        </div>
      </div>
    </div>
  );
}