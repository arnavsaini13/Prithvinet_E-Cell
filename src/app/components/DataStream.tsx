import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { pollutionApi, stationsApi } from "../../api/client";
import type { Station, PollutionReading } from "../../api/client";

interface DataPoint {
  id: string;
  text: string;
  value: string;
  timestamp: string;
}

const metricKeys: { key: string; field: keyof PollutionReading; unit: string }[] = [
  { key: "PM2.5", field: "pm25", unit: "μg/m³" },
  { key: "PM10", field: "pm10", unit: "μg/m³" },
  { key: "CO2", field: "co2", unit: "ppm" },
  { key: "NO2", field: "no2", unit: "ppb" },
  { key: "PH", field: "ph", unit: "pH" },
  { key: "TURBIDITY", field: "turbidity", unit: "NTU" },
  { key: "DISSOLVED O₂", field: "dissolved_oxygen", unit: "mg/L" },
  { key: "NOISE", field: "noise_level", unit: "dB" },
];

export function DataStream() {
  const [dataPoints, setDataPoints] = useState<DataPoint[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [readings, setReadings] = useState<PollutionReading[]>([]);

  // Fetch real stations and readings
  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        const [stList, rdList] = await Promise.all([
          stationsApi.list(),
          pollutionApi.list(undefined, 50),
        ]);
        if (cancelled) return;
        setStations(stList);
        setReadings(rdList);
      } catch (err) {
        console.error("DataStream: fetch error", err);
      }
    }
    fetchData();
    const id = setInterval(fetchData, 10_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // Generate stream entries from real data
  useEffect(() => {
    if (stations.length === 0 || readings.length === 0) return;

    const interval = setInterval(() => {
      const station = stations[Math.floor(Math.random() * stations.length)];
      // Pick a random reading for that station, or any reading
      const stationReadings = readings.filter(r => r.station_id === station.id);
      const reading = stationReadings.length > 0
        ? stationReadings[Math.floor(Math.random() * stationReadings.length)]
        : readings[Math.floor(Math.random() * readings.length)];
      const metric = metricKeys[Math.floor(Math.random() * metricKeys.length)];
      const value = Number(reading[metric.field]);

      const newPoint: DataPoint = {
        id: Date.now().toString(),
        text: `${station.name.toUpperCase()} › ${metric.key}`,
        value: value.toFixed(2),
        timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
      };

      setDataPoints(prev => [newPoint, ...prev].slice(0, 12));
    }, 2000);

    return () => clearInterval(interval);
  }, [stations, readings]);

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b prithvi-shimmer" style={{ borderColor: 'var(--prithvi-border-bright)' }}>
        <h3 className="text-sm font-mono tracking-wider prithvi-text-electric">
          LIVE DATA STREAM
        </h3>
      </div>

      <div className="flex-1 overflow-hidden relative">
        {/* Scanline effect */}
        <div className="absolute inset-0 prithvi-scanline pointer-events-none" />
        
        <div className="space-y-1 p-2">
          {dataPoints.map((point, idx) => (
            <motion.div
              key={point.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1 - (idx * 0.08), x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex items-center justify-between px-3 py-2 rounded border backdrop-blur-sm prithvi-inner-glow"
              style={{
                background: 'var(--prithvi-glass)',
                borderColor: 'var(--prithvi-border-dim)',
              }}
            >
              <div className="flex-1 min-w-0">
                <div className="text-xs font-mono truncate prithvi-text-forest">
                  {point.text}
                </div>
              </div>
              
              <div className="flex items-center gap-3 ml-3">
                <div className="text-sm font-mono font-bold prithvi-text-aurora">
                  {point.value}
                </div>
                <div className="text-xs opacity-50 prithvi-text-electric">
                  {point.timestamp}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Fade gradient at bottom */}
        <div 
          className="absolute bottom-0 left-0 right-0 h-20 pointer-events-none"
          style={{
            background: 'linear-gradient(to top, var(--prithvi-deep-space), transparent)'
          }}
        />
      </div>
    </div>
  );
}