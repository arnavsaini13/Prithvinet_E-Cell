import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MapPin, X, TrendingUp, TrendingDown, Minus, Radio, Search, Filter, Clock, ZoomIn, ZoomOut, RotateCcw, AlertCircle } from "lucide-react";
import { WorldMapSVG } from "./WorldMapSVG";
import { stationsApi, pollutionApi, type Station, type PollutionReading } from "../../api/client";

interface MonitoringStation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  region: string;
  pm25: number;
  pm10: number;
  noise: number;
  waterPh: number;
  status: "safe" | "moderate" | "critical";
  trend: "rising" | "stable" | "falling";
}

function deriveStatus(pm25: number): "safe" | "moderate" | "critical" {
  if (pm25 <= 35) return "safe";
  if (pm25 <= 75) return "moderate";
  return "critical";
}

export function PollutionMap() {
  const [monitoringStations, setMonitoringStations] = useState<MonitoringStation[]>([]);
  const [selectedStation, setSelectedStation] = useState<MonitoringStation | null>(null);
  const [hoveredStation, setHoveredStation] = useState<string | null>(null);
  const [activeLayer, setActiveLayer] = useState<"pm25" | "pm10" | "noise" | "water">("pm25");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "safe" | "moderate" | "critical">("all");
  const [showAlerts, setShowAlerts] = useState(true);
  const [timeRange, setTimeRange] = useState<"current" | "1h" | "24h" | "7d">("current");
  const [zoom, setZoom] = useState(1);

  // Determine how many readings to fetch based on time range
  const readingsLimit = timeRange === "current" ? 200 : timeRange === "1h" ? 300 : timeRange === "24h" ? 600 : 1000;

  // Fetch real stations + latest readings from backend
  useEffect(() => {
    const fetchStations = async () => {
      try {
        const [stations, readings] = await Promise.all([
          stationsApi.list(),
          pollutionApi.list(undefined, readingsLimit),
        ]);

        // For time-range filtering, compute cutoff timestamp
        const now = Date.now();
        const cutoffMs =
          timeRange === "1h" ? 60 * 60 * 1000
          : timeRange === "24h" ? 24 * 60 * 60 * 1000
          : timeRange === "7d" ? 7 * 24 * 60 * 60 * 1000
          : 0; // "current" = just the latest

        // For each station, find relevant readings and compute averages
        const mapped: MonitoringStation[] = stations.map((s: Station) => {
          let stationReadings = readings.filter((r: PollutionReading) => r.station_id === s.id);

          if (timeRange !== "current" && cutoffMs > 0) {
            stationReadings = stationReadings.filter(
              (r: PollutionReading) => now - new Date(r.timestamp).getTime() <= cutoffMs
            );
          }

          if (stationReadings.length === 0) {
            return {
              id: String(s.id), name: s.name, lat: s.latitude, lng: s.longitude,
              region: s.region, pm25: 0, pm10: 0, noise: 0, waterPh: 7,
              status: "safe" as const, trend: "stable" as const,
            };
          }

          if (timeRange === "current") {
            const latest = stationReadings[0];
            // Compute trend: compare latest to 2nd-latest
            let trend: "rising" | "stable" | "falling" = "stable";
            if (stationReadings.length >= 2) {
              const prev = stationReadings[1];
              if (latest.pm25 > prev.pm25 * 1.05) trend = "rising";
              else if (latest.pm25 < prev.pm25 * 0.95) trend = "falling";
            }
            return {
              id: String(s.id), name: s.name, lat: s.latitude, lng: s.longitude,
              region: s.region,
              pm25: latest.pm25, pm10: latest.pm10,
              noise: latest.noise_level, waterPh: latest.ph,
              status: deriveStatus(latest.pm25), trend,
            };
          }

          // For time ranges: average readings
          const avg = {
            pm25: stationReadings.reduce((a: number, r: PollutionReading) => a + r.pm25, 0) / stationReadings.length,
            pm10: stationReadings.reduce((a: number, r: PollutionReading) => a + r.pm10, 0) / stationReadings.length,
            noise: stationReadings.reduce((a: number, r: PollutionReading) => a + r.noise_level, 0) / stationReadings.length,
            ph: stationReadings.reduce((a: number, r: PollutionReading) => a + r.ph, 0) / stationReadings.length,
          };
          // Trend: compare first half to second half
          const mid = Math.floor(stationReadings.length / 2);
          const recentAvg = stationReadings.slice(0, mid).reduce((a: number, r: PollutionReading) => a + r.pm25, 0) / Math.max(mid, 1);
          const olderAvg = stationReadings.slice(mid).reduce((a: number, r: PollutionReading) => a + r.pm25, 0) / Math.max(stationReadings.length - mid, 1);
          let trend: "rising" | "stable" | "falling" = "stable";
          if (recentAvg > olderAvg * 1.05) trend = "rising";
          else if (recentAvg < olderAvg * 0.95) trend = "falling";

          return {
            id: String(s.id), name: s.name, lat: s.latitude, lng: s.longitude,
            region: s.region,
            pm25: Math.round(avg.pm25 * 10) / 10,
            pm10: Math.round(avg.pm10 * 10) / 10,
            noise: Math.round(avg.noise * 10) / 10,
            waterPh: Math.round(avg.ph * 100) / 100,
            status: deriveStatus(avg.pm25), trend,
          };
        });
        setMonitoringStations(mapped);
      } catch {
        // silently ignore, stations will be empty
      }
    };
    fetchStations();
    const interval = setInterval(fetchStations, 10000);
    return () => clearInterval(interval);
  }, [timeRange, readingsLimit]);

  // Filter stations based on search and status
  const filteredStations = monitoringStations.filter(station => {
    const matchesSearch = station.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         station.region.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterStatus === "all" || station.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  // Get critical alerts
  const criticalAlerts = monitoringStations.filter(s => 
    s.status === "critical" && s.trend === "rising"
  );

  // Convert lat/lng to SVG coordinates (simplified projection)
  const projectToMap = (lat: number, lng: number) => {
    // Simple equirectangular projection
    const x = ((lng + 180) / 360) * 100;
    const y = ((90 - lat) / 180) * 100;
    return { x, y };
  };

  const getStationColor = (station: MonitoringStation) => {
    switch (station.status) {
      case "safe": return "var(--prithvi-aurora-green)";
      case "moderate": return "var(--prithvi-warm-amber)";
      case "critical": return "var(--prithvi-critical-red)";
    }
  };

  const getMetricValue = (station: MonitoringStation, metric: string) => {
    switch (metric) {
      case "pm25": return station.pm25;
      case "pm10": return station.pm10;
      case "noise": return station.noise;
      case "water": return station.waterPh;
      default: return 0;
    }
  };

  const getMetricStatus = (value: number, metric: string) => {
    if (metric === "pm25") {
      if (value <= 50) return "safe";
      if (value <= 100) return "moderate";
      return "critical";
    }
    if (metric === "pm10") {
      if (value <= 50) return "safe";
      if (value <= 100) return "moderate";
      return "critical";
    }
    if (metric === "noise") {
      if (value <= 60) return "safe";
      if (value <= 75) return "moderate";
      return "critical";
    }
    if (metric === "water") {
      if (value >= 7.0 && value <= 8.5) return "safe";
      if (value >= 6.5 && value < 9.0) return "moderate";
      return "critical";
    }
    return "safe";
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h2 className="text-2xl font-mono tracking-wider prithvi-text-electric">
            INDIA POLLUTION MONITORING NETWORK
          </h2>
          <p className="text-sm mt-1 opacity-70 prithvi-text-forest">
            Real-time environmental sensor network • {monitoringStations.length} active stations across India
          </p>
        </div>

        {/* Layer selector */}
        <div className="flex gap-2">
          {[
            { id: "pm25", label: "PM2.5" },
            { id: "pm10", label: "PM10" },
            { id: "noise", label: "NOISE" },
            { id: "water", label: "WATER pH" },
          ].map((layer) => (
            <button
              key={layer.id}
              onClick={() => setActiveLayer(layer.id as typeof activeLayer)}
              className={`px-4 py-2 rounded-lg text-xs font-mono tracking-wider border transition-all ${
                activeLayer === layer.id
                  ? "prithvi-border-electric"
                  : "border-transparent opacity-60 hover:opacity-100"
              }`}
              style={{
                background: activeLayer === layer.id ? "var(--prithvi-glass-bright)" : "var(--prithvi-glass)",
                borderColor: activeLayer === layer.id ? "var(--prithvi-border-bright)" : "transparent",
              }}
            >
              {layer.label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Legend */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="flex items-center gap-6 px-4 py-3 rounded-lg border backdrop-blur-md"
        style={{
          background: "var(--prithvi-panel-bg)",
          borderColor: "var(--prithvi-border-dim)",
        }}
      >
        <span className="text-xs font-mono tracking-wider opacity-60 prithvi-text-electric">
          POLLUTION LEVELS:
        </span>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full prithvi-glow-aurora" style={{ background: "var(--prithvi-aurora-green)" }} />
          <span className="text-xs font-mono prithvi-text-aurora">SAFE</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full prithvi-glow-amber" style={{ background: "var(--prithvi-warm-amber)" }} />
          <span className="text-xs font-mono" style={{ color: "var(--prithvi-warm-amber)" }}>MODERATE</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full prithvi-glow-critical" style={{ background: "var(--prithvi-critical-red)" }} />
          <span className="text-xs font-mono" style={{ color: "var(--prithvi-critical-red)" }}>CRITICAL</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Radio className="w-4 h-4 prithvi-pulse prithvi-text-aurora" />
          <span className="text-xs font-mono prithvi-text-forest">
            {monitoringStations.filter(s => s.trend === "rising").length} STATIONS WITH RISING LEVELS
          </span>
        </div>
      </motion.div>

      {/* Search, Filter, and Time Controls */}
      <div className="grid grid-cols-3 gap-4">
        {/* Search */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="relative"
        >
          <div className="absolute left-3 top-1/2 -translate-y-1/2">
            <Search className="w-4 h-4 opacity-50 prithvi-text-electric" />
          </div>
          <input
            type="text"
            placeholder="Search stations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border bg-transparent text-sm font-mono prithvi-text-electric placeholder:opacity-40"
            style={{
              background: "var(--prithvi-glass)",
              borderColor: "var(--prithvi-border-dim)",
            }}
          />
        </motion.div>

        {/* Status Filter */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex gap-2"
        >
          {[
            { id: "all", label: "ALL" },
            { id: "safe", label: "SAFE" },
            { id: "moderate", label: "MODERATE" },
            { id: "critical", label: "CRITICAL" },
          ].map((filter) => (
            <button
              key={filter.id}
              onClick={() => setFilterStatus(filter.id as typeof filterStatus)}
              className={`flex-1 px-3 py-2.5 rounded-lg text-xs font-mono tracking-wider border transition-all ${
                filterStatus === filter.id
                  ? "prithvi-border-electric"
                  : "border-transparent opacity-60 hover:opacity-100"
              }`}
              style={{
                background: filterStatus === filter.id ? "var(--prithvi-glass-bright)" : "var(--prithvi-glass)",
                borderColor: filterStatus === filter.id ? "var(--prithvi-border-bright)" : "transparent",
              }}
            >
              <Filter className="w-3 h-3 inline mr-1" />
              {filter.label}
            </button>
          ))}
        </motion.div>

        {/* Time Range */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="flex gap-2"
        >
          {[
            { id: "current", label: "LIVE" },
            { id: "1h", label: "1H" },
            { id: "24h", label: "24H" },
            { id: "7d", label: "7D" },
          ].map((time) => (
            <button
              key={time.id}
              onClick={() => setTimeRange(time.id as typeof timeRange)}
              className={`flex-1 px-3 py-2.5 rounded-lg text-xs font-mono tracking-wider border transition-all ${
                timeRange === time.id
                  ? "prithvi-border-electric"
                  : "border-transparent opacity-60 hover:opacity-100"
              }`}
              style={{
                background: timeRange === time.id ? "var(--prithvi-glass-bright)" : "var(--prithvi-glass)",
                borderColor: timeRange === time.id ? "var(--prithvi-border-bright)" : "transparent",
              }}
            >
              <Clock className="w-3 h-3 inline mr-1" />
              {time.label}
            </button>
          ))}
        </motion.div>
      </div>

      {/* Critical Alerts Panel */}
      <AnimatePresence>
        {showAlerts && criticalAlerts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 rounded-lg border-l-4 backdrop-blur-md prithvi-glow-critical"
                 style={{
                   background: "var(--prithvi-panel-bg)",
                   borderLeftColor: "var(--prithvi-critical-red)",
                 }}>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <AlertCircle className="w-5 h-5 mt-0.5" style={{ color: "var(--prithvi-critical-red)" }} />
                  </motion.div>
                  <div className="flex-1">
                    <div className="font-mono text-sm mb-1 prithvi-pulse" style={{ color: "var(--prithvi-critical-red)" }}>
                      {criticalAlerts.length} CRITICAL ALERT{criticalAlerts.length > 1 ? "S" : ""} • RISING POLLUTION DETECTED
                    </div>
                    <div className="text-xs opacity-70 prithvi-text-electric mb-3">
                      The following stations are experiencing critical pollution levels with rising trends
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {criticalAlerts.map((alert) => (
                        <button
                          key={alert.id}
                          onClick={() => setSelectedStation(alert)}
                          className="px-3 py-2 rounded text-left text-xs font-mono border hover:bg-white/5 transition-all"
                          style={{
                            background: "var(--prithvi-glass)",
                            borderColor: "var(--prithvi-border-dim)",
                          }}
                        >
                          <div className="prithvi-text-electric font-bold">{alert.name}</div>
                          <div className="opacity-60 prithvi-text-forest">{alert.region} • PM2.5: {alert.pm25}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setShowAlerts(false)}
                  className="p-1.5 rounded hover:bg-white/10 transition-all"
                >
                  <X className="w-4 h-4 prithvi-text-electric" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Map container */}
      <div className="relative">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="rounded-lg border backdrop-blur-md overflow-hidden prithvi-card-layered prithvi-inner-glow"
          style={{
            background: "var(--prithvi-panel-bg)",
            borderColor: "var(--prithvi-border-dim)",
            height: "600px",
          }}
        >
          {/* World Map SVG */}
          <svg
            viewBox="0 0 100 100"
            className="w-full h-full"
            style={{ background: "rgba(5, 10, 20, 0.6)" }}
          >
            {/* Grid lines */}
            <defs>
              <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                <path
                  d="M 10 0 L 0 0 0 10"
                  fill="none"
                  stroke="var(--prithvi-grid)"
                  strokeWidth="0.1"
                  opacity="0.3"
                />
              </pattern>
            </defs>
            <rect width="100" height="100" fill="url(#grid)" />

            {/* Latitude lines */}
            {[-60, -30, 0, 30, 60].map((lat) => {
              const y = ((90 - lat) / 180) * 100;
              return (
                <line
                  key={lat}
                  x1="0"
                  y1={y}
                  x2="100"
                  y2={y}
                  stroke="var(--prithvi-electric-cyan)"
                  strokeWidth="0.1"
                  opacity="0.2"
                />
              );
            })}

            {/* Longitude lines */}
            {[-120, -60, 0, 60, 120].map((lng) => {
              const x = ((lng + 180) / 360) * 100;
              return (
                <line
                  key={lng}
                  x1={x}
                  y1="0"
                  x2={x}
                  y2="100"
                  stroke="var(--prithvi-electric-cyan)"
                  strokeWidth="0.1"
                  opacity="0.2"
                />
              );
            })}

            {/* Heatmap overlay - dynamic based on active layer */}
            {filteredStations.map((station) => {
              const pos = projectToMap(station.lat, station.lng);
              const value = getMetricValue(station, activeLayer);
              const status = getMetricStatus(value, activeLayer);
              const color =
                status === "safe"
                  ? "rgba(0, 255, 136, 0.15)"
                  : status === "moderate"
                  ? "rgba(255, 167, 38, 0.15)"
                  : "rgba(211, 47, 47, 0.15)";

              return (
                <motion.circle
                  key={`heatmap-${station.id}`}
                  cx={pos.x}
                  cy={pos.y}
                  r="8"
                  fill={color}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5 }}
                />
              );
            })}

            {/* Monitoring stations */}
            {filteredStations.map((station) => {
              const pos = projectToMap(station.lat, station.lng);
              const color = getStationColor(station);
              const isHovered = hoveredStation === station.id;
              const isSelected = selectedStation?.id === station.id;

              return (
                <g key={station.id}>
                  {/* Pulse rings for rising pollution */}
                  {station.trend === "rising" && (
                    <>
                      <motion.circle
                        cx={pos.x}
                        cy={pos.y}
                        r="2"
                        fill="none"
                        stroke={color}
                        strokeWidth="0.15"
                        initial={{ r: 2, opacity: 0.8 }}
                        animate={{ r: 4, opacity: 0 }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
                      />
                      <motion.circle
                        cx={pos.x}
                        cy={pos.y}
                        r="2"
                        fill="none"
                        stroke={color}
                        strokeWidth="0.15"
                        initial={{ r: 2, opacity: 0.8 }}
                        animate={{ r: 4, opacity: 0 }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeOut", delay: 1 }}
                      />
                    </>
                  )}

                  {/* Station marker */}
                  <motion.circle
                    cx={pos.x}
                    cy={pos.y}
                    r={isHovered || isSelected ? "1.2" : "0.8"}
                    fill={color}
                    stroke="rgba(255, 255, 255, 0.3)"
                    strokeWidth="0.15"
                    style={{
                      filter: `drop-shadow(0 0 ${isHovered || isSelected ? "0.8" : "0.4"}px ${color})`,
                      cursor: "pointer",
                    }}
                    onClick={() => setSelectedStation(station)}
                    onMouseEnter={() => setHoveredStation(station.id)}
                    onMouseLeave={() => setHoveredStation(null)}
                    whileHover={{ scale: 1.3 }}
                    animate={
                      station.trend === "rising"
                        ? {
                            scale: [1, 1.2, 1],
                          }
                        : {}
                    }
                    transition={
                      station.trend === "rising"
                        ? {
                            duration: 2,
                            repeat: Infinity,
                            ease: "easeInOut",
                          }
                        : {}
                    }
                  />

                  {/* Station label on hover */}
                  {(isHovered || isSelected) && (
                    <motion.text
                      x={pos.x}
                      y={pos.y - 2}
                      textAnchor="middle"
                      fontSize="1.2"
                      fill="var(--prithvi-electric-cyan)"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      style={{
                        pointerEvents: "none",
                        textShadow: "0 0 2px var(--prithvi-cyan-glow)",
                      }}
                    >
                      {station.name}
                    </motion.text>
                  )}
                </g>
              );
            })}
          </svg>
        </motion.div>

        {/* Data Panel */}
        <AnimatePresence>
          {selectedStation && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="absolute top-0 right-0 w-96 h-full p-6 rounded-lg border backdrop-blur-xl prithvi-card-layered prithvi-inner-glow"
              style={{
                background: "var(--prithvi-panel-bg-solid)",
                borderColor: "var(--prithvi-border-bright)",
                boxShadow: "0 0 30px rgba(0, 0, 0, 0.5)",
              }}
            >
              {/* Close button */}
              <button
                onClick={() => setSelectedStation(null)}
                className="absolute top-4 right-4 p-2 rounded-lg hover:bg-white/10 transition-all"
              >
                <X className="w-5 h-5 prithvi-text-electric" />
              </button>

              {/* Station info */}
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                  <MapPin className="w-5 h-5" style={{ color: getStationColor(selectedStation) }} />
                  <h3 className="text-lg font-mono tracking-wider prithvi-text-electric">
                    {selectedStation.name}
                  </h3>
                </div>
                <p className="text-xs opacity-60 prithvi-text-forest ml-8">
                  {selectedStation.region} • LAT {selectedStation.lat.toFixed(1)}° LNG{" "}
                  {selectedStation.lng.toFixed(1)}°
                </p>
                <div className="mt-3 ml-8">
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-mono prithvi-badge-${selectedStation.status}`}
                  >
                    {selectedStation.status.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Environmental metrics */}
              <div className="space-y-4">
                {/* PM2.5 */}
                <div className="p-4 rounded-lg border" style={{ background: "var(--prithvi-glass)", borderColor: "var(--prithvi-border-dim)" }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono tracking-wider opacity-60 prithvi-text-electric">
                      PM2.5 PARTICLES
                    </span>
                    {selectedStation.trend === "rising" ? (
                      <TrendingUp className="w-4 h-4" style={{ color: "var(--prithvi-critical-red)" }} />
                    ) : selectedStation.trend === "falling" ? (
                      <TrendingDown className="w-4 h-4 prithvi-text-aurora" />
                    ) : (
                      <Minus className="w-4 h-4 prithvi-text-ocean" />
                    )}
                  </div>
                  <div className="text-3xl font-bold font-mono mb-1"
                       style={{ 
                         color: selectedStation.pm25 <= 50 ? "var(--prithvi-aurora-green)" 
                              : selectedStation.pm25 <= 100 ? "var(--prithvi-warm-amber)" 
                              : "var(--prithvi-critical-red)" 
                       }}>
                    {selectedStation.pm25}
                  </div>
                  <div className="text-xs opacity-60 prithvi-text-forest">μg/m³</div>
                  
                  {/* Progress bar */}
                  <div className="mt-3 h-2 rounded-full overflow-hidden" style={{ background: "var(--prithvi-grid)" }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min((selectedStation.pm25 / 200) * 100, 100)}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className="h-full"
                      style={{ 
                        background: selectedStation.pm25 <= 50 ? "var(--prithvi-aurora-green)" 
                                 : selectedStation.pm25 <= 100 ? "var(--prithvi-warm-amber)" 
                                 : "var(--prithvi-critical-red)" 
                      }}
                    />
                  </div>
                </div>

                {/* PM10 */}
                <div className="p-4 rounded-lg border" style={{ background: "var(--prithvi-glass)", borderColor: "var(--prithvi-border-dim)" }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono tracking-wider opacity-60 prithvi-text-electric">
                      PM10 PARTICLES
                    </span>
                    {selectedStation.trend === "rising" ? (
                      <TrendingUp className="w-4 h-4" style={{ color: "var(--prithvi-critical-red)" }} />
                    ) : selectedStation.trend === "falling" ? (
                      <TrendingDown className="w-4 h-4 prithvi-text-aurora" />
                    ) : (
                      <Minus className="w-4 h-4 prithvi-text-ocean" />
                    )}
                  </div>
                  <div className="text-3xl font-bold font-mono mb-1"
                       style={{ 
                         color: selectedStation.pm10 <= 50 ? "var(--prithvi-aurora-green)" 
                              : selectedStation.pm10 <= 100 ? "var(--prithvi-warm-amber)" 
                              : "var(--prithvi-critical-red)" 
                       }}>
                    {selectedStation.pm10}
                  </div>
                  <div className="text-xs opacity-60 prithvi-text-forest">μg/m³</div>
                  
                  <div className="mt-3 h-2 rounded-full overflow-hidden" style={{ background: "var(--prithvi-grid)" }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min((selectedStation.pm10 / 250) * 100, 100)}%` }}
                      transition={{ duration: 1, ease: "easeOut", delay: 0.1 }}
                      className="h-full"
                      style={{ 
                        background: selectedStation.pm10 <= 50 ? "var(--prithvi-aurora-green)" 
                                 : selectedStation.pm10 <= 100 ? "var(--prithvi-warm-amber)" 
                                 : "var(--prithvi-critical-red)" 
                      }}
                    />
                  </div>
                </div>

                {/* Noise Levels */}
                <div className="p-4 rounded-lg border" style={{ background: "var(--prithvi-glass)", borderColor: "var(--prithvi-border-dim)" }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono tracking-wider opacity-60 prithvi-text-electric">
                      NOISE POLLUTION
                    </span>
                    {selectedStation.trend === "rising" ? (
                      <TrendingUp className="w-4 h-4" style={{ color: "var(--prithvi-critical-red)" }} />
                    ) : selectedStation.trend === "falling" ? (
                      <TrendingDown className="w-4 h-4 prithvi-text-aurora" />
                    ) : (
                      <Minus className="w-4 h-4 prithvi-text-ocean" />
                    )}
                  </div>
                  <div className="text-3xl font-bold font-mono mb-1"
                       style={{ 
                         color: selectedStation.noise <= 60 ? "var(--prithvi-aurora-green)" 
                              : selectedStation.noise <= 75 ? "var(--prithvi-warm-amber)" 
                              : "var(--prithvi-critical-red)" 
                       }}>
                    {selectedStation.noise} dB
                  </div>
                  <div className="text-xs opacity-60 prithvi-text-forest">Decibels</div>
                  
                  <div className="mt-3 h-2 rounded-full overflow-hidden" style={{ background: "var(--prithvi-grid)" }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min((selectedStation.noise / 120) * 100, 100)}%` }}
                      transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
                      className="h-full"
                      style={{ 
                        background: selectedStation.noise <= 60 ? "var(--prithvi-aurora-green)" 
                                 : selectedStation.noise <= 75 ? "var(--prithvi-warm-amber)" 
                                 : "var(--prithvi-critical-red)" 
                      }}
                    />
                  </div>
                </div>

                {/* Water pH */}
                <div className="p-4 rounded-lg border" style={{ background: "var(--prithvi-glass)", borderColor: "var(--prithvi-border-dim)" }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono tracking-wider opacity-60 prithvi-text-electric">
                      WATER pH LEVEL
                    </span>
                    {selectedStation.trend === "rising" ? (
                      <TrendingUp className="w-4 h-4" style={{ color: "var(--prithvi-critical-red)" }} />
                    ) : selectedStation.trend === "falling" ? (
                      <TrendingDown className="w-4 h-4 prithvi-text-aurora" />
                    ) : (
                      <Minus className="w-4 h-4 prithvi-text-ocean" />
                    )}
                  </div>
                  <div className="text-3xl font-bold font-mono mb-1"
                       style={{ 
                         color: (selectedStation.waterPh >= 7.0 && selectedStation.waterPh <= 8.5) ? "var(--prithvi-aurora-green)" 
                              : (selectedStation.waterPh >= 6.5 && selectedStation.waterPh < 9.0) ? "var(--prithvi-warm-amber)" 
                              : "var(--prithvi-critical-red)" 
                       }}>
                    {selectedStation.waterPh.toFixed(1)}
                  </div>
                  <div className="text-xs opacity-60 prithvi-text-forest">pH Scale</div>
                  
                  <div className="mt-3 h-2 rounded-full overflow-hidden" style={{ background: "var(--prithvi-grid)" }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${((selectedStation.waterPh - 6) / 3) * 100}%` }}
                      transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
                      className="h-full"
                      style={{ 
                        background: (selectedStation.waterPh >= 7.0 && selectedStation.waterPh <= 8.5) ? "var(--prithvi-aurora-green)" 
                                 : (selectedStation.waterPh >= 6.5 && selectedStation.waterPh < 9.0) ? "var(--prithvi-warm-amber)" 
                                 : "var(--prithvi-critical-red)" 
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Trend indicator */}
              <div className="mt-6 p-4 rounded-lg border" 
                   style={{ 
                     background: "var(--prithvi-glass)", 
                     borderColor: "var(--prithvi-border-dim)" 
                   }}>
                <div className="text-xs font-mono tracking-wider mb-2 opacity-60 prithvi-text-electric">
                  POLLUTION TREND
                </div>
                <div className="flex items-center gap-2">
                  {selectedStation.trend === "rising" ? (
                    <>
                      <TrendingUp className="w-5 h-5" style={{ color: "var(--prithvi-critical-red)" }} />
                      <span className="text-sm font-mono" style={{ color: "var(--prithvi-critical-red)" }}>
                        RISING • ALERT
                      </span>
                    </>
                  ) : selectedStation.trend === "falling" ? (
                    <>
                      <TrendingDown className="w-5 h-5 prithvi-text-aurora" />
                      <span className="text-sm font-mono prithvi-text-aurora">
                        FALLING • IMPROVING
                      </span>
                    </>
                  ) : (
                    <>
                      <Minus className="w-5 h-5 prithvi-text-ocean" />
                      <span className="text-sm font-mono prithvi-text-ocean">
                        STABLE • MONITORING
                      </span>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="p-4 rounded-lg border backdrop-blur-md"
          style={{
            background: "var(--prithvi-panel-bg)",
            borderColor: "var(--prithvi-border-dim)",
          }}
        >
          <div className="text-xs opacity-60 mb-2 prithvi-text-electric">SAFE ZONES</div>
          <div className="text-3xl font-bold font-mono prithvi-text-aurora">
            {filteredStations.filter((s) => s.status === "safe").length}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="p-4 rounded-lg border backdrop-blur-md"
          style={{
            background: "var(--prithvi-panel-bg)",
            borderColor: "var(--prithvi-border-dim)",
          }}
        >
          <div className="text-xs opacity-60 mb-2 prithvi-text-electric">MODERATE ZONES</div>
          <div className="text-3xl font-bold font-mono" style={{ color: "var(--prithvi-warm-amber)" }}>
            {filteredStations.filter((s) => s.status === "moderate").length}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="p-4 rounded-lg border backdrop-blur-md"
          style={{
            background: "var(--prithvi-panel-bg)",
            borderColor: "var(--prithvi-border-dim)",
          }}
        >
          <div className="text-xs opacity-60 mb-2 prithvi-text-electric">CRITICAL ZONES</div>
          <div className="text-3xl font-bold font-mono" style={{ color: "var(--prithvi-critical-red)" }}>
            {filteredStations.filter((s) => s.status === "critical").length}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="p-4 rounded-lg border backdrop-blur-md"
          style={{
            background: "var(--prithvi-panel-bg)",
            borderColor: "var(--prithvi-border-dim)",
          }}
        >
          <div className="text-xs opacity-60 mb-2 prithvi-text-electric">RISING TREND</div>
          <div className="text-3xl font-bold font-mono" style={{ color: "var(--prithvi-critical-red)" }}>
            {filteredStations.filter((s) => s.trend === "rising").length}
          </div>
        </motion.div>
      </div>
    </div>
  );
}