import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Clock,
  Calendar,
  MapPin,
  TrendingUp,
  AlertTriangle,
  Zap,
  Rewind,
  FastForward,
  Gauge,
  Activity,
} from "lucide-react";
import { WorldMapSVG } from "./WorldMapSVG";
import { stationsApi, pollutionApi, forecastApi } from "../../api/client";
import type { Station, PollutionReading, ForecastOut } from "../../api/client";

interface TimelinePoint {
  date: Date;
  dateStr: string;
  shortDate: string;
  daysFromNow: number;
  aqi: number;
  pm25: number;
  pm10: number;
  no2: number;
  type: "past" | "current" | "future";
}

interface MapStation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  aqi: number;
  status: "safe" | "moderate" | "critical";
}

export function PollutionTimeMachine() {
  const [timelineData, setTimelineData] = useState<TimelinePoint[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(1);
  const [stationData, setStationData] = useState<MapStation[]>([]);
  const [timeFilter, setTimeFilter] = useState<"all" | "past" | "current" | "future">("all");
  const timelineRef = useRef<HTMLDivElement>(null);
  const playIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch real stations, readings and forecast data
  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        const [stList, rdList] = await Promise.all([
          stationsApi.list(),
          pollutionApi.list(undefined, 200),
        ]);
        if (cancelled) return;
        setStations(stList);

        // Build timeline from real readings (grouped by day)
        const byDay = new Map<string, PollutionReading[]>();
        for (const r of rdList) {
          const day = new Date(r.timestamp).toISOString().slice(0, 10);
          if (!byDay.has(day)) byDay.set(day, []);
          byDay.get(day)!.push(r);
        }

        const pastPoints: TimelinePoint[] = [];
        const now = new Date();
        const todayStr = now.toISOString().slice(0, 10);

        for (const [day, dayReadings] of Array.from(byDay.entries()).sort()) {
          const avgPm25 = dayReadings.reduce((s, r) => s + r.pm25, 0) / dayReadings.length;
          const avgPm10 = dayReadings.reduce((s, r) => s + r.pm10, 0) / dayReadings.length;
          const avgNo2 = dayReadings.reduce((s, r) => s + r.no2, 0) / dayReadings.length;
          const aqi = Math.round((avgPm25 + avgPm10) / 2);
          const date = new Date(day + "T12:00:00");
          const daysFromNow = Math.round((date.getTime() - now.getTime()) / 86400000);
          pastPoints.push({
            date,
            dateStr: date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
            shortDate: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            daysFromNow,
            aqi,
            pm25: Math.round(avgPm25 * 10) / 10,
            pm10: Math.round(avgPm10 * 10) / 10,
            no2: Math.round(avgNo2 * 10) / 10,
            type: day === todayStr ? "current" : daysFromNow < 0 ? "past" : "future",
          });
        }

        // Add forecast points for the future
        let forecastPoints: TimelinePoint[] = [];
        if (stList.length > 0) {
          try {
            const fc = await forecastApi.get(stList[0].id, "pm25", 30);
            forecastPoints = fc.forecast.map((fp) => {
              const date = new Date(fp.timestamp);
              const daysFromNow = Math.round((date.getTime() - now.getTime()) / 86400000);
              return {
                date,
                dateStr: date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
                shortDate: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
                daysFromNow,
                aqi: Math.round(fp.predicted_value),
                pm25: Math.round(fp.predicted_value * 10) / 10,
                pm10: Math.round(fp.predicted_value * 1.4 * 10) / 10,
                no2: Math.round(fp.predicted_value * 0.5 * 10) / 10,
                type: "future" as const,
              };
            });
          } catch {
            // Forecast may not be available; generate simple extrapolation
            const lastPast = pastPoints[pastPoints.length - 1];
            if (lastPast) {
              for (let i = 1; i <= 30; i++) {
                const date = new Date(now);
                date.setDate(date.getDate() + i);
                forecastPoints.push({
                  date,
                  dateStr: date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
                  shortDate: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
                  daysFromNow: i,
                  aqi: Math.round(lastPast.aqi + i * 0.5 + Math.sin(i / 5) * 10),
                  pm25: Math.round((lastPast.pm25 + i * 0.3) * 10) / 10,
                  pm10: Math.round((lastPast.pm10 + i * 0.4) * 10) / 10,
                  no2: Math.round((lastPast.no2 + i * 0.2) * 10) / 10,
                  type: "future" as const,
                });
              }
            }
          }
        }

        const allPoints = [...pastPoints, ...forecastPoints];
        if (cancelled) return;
        setTimelineData(allPoints);

        // Start at the "current" day or last past point
        const currIdx = allPoints.findIndex((p) => p.type === "current");
        setSelectedIndex(currIdx >= 0 ? currIdx : Math.max(0, pastPoints.length - 1));
      } catch (err) {
        console.error("PollutionTimeMachine: fetch error", err);
      }
    }
    fetchData();
    return () => { cancelled = true; };
  }, []);

  // Update station map data when index changes
  useEffect(() => {
    if (timelineData.length === 0 || stations.length === 0) return;
    const point = timelineData[selectedIndex];
    if (!point) return;
    const mapped: MapStation[] = stations.map((st) => {
      const variance = (Math.sin(st.id * 1000 + selectedIndex) * 0.5) * 20;
      const aqi = Math.max(20, point.aqi + variance);
      return {
        id: String(st.id),
        name: st.name,
        lat: st.latitude,
        lng: st.longitude,
        aqi,
        status: aqi > 150 ? "critical" : aqi > 100 ? "moderate" : "safe",
      };
    });
    setStationData(mapped);
  }, [selectedIndex, timelineData, stations]);

  const selectedData = timelineData[selectedIndex] ?? {
    date: new Date(),
    dateStr: "Loading...",
    shortDate: "...",
    daysFromNow: 0,
    aqi: 0,
    pm25: 0,
    pm10: 0,
    no2: 0,
    type: "current" as const,
  };
  const currentIndex = timelineData.findIndex((d) => d.type === "current");

  // Auto-play functionality
  useEffect(() => {
    if (isPlaying) {
      playIntervalRef.current = setInterval(() => {
        setSelectedIndex((prev) => {
          const next = prev + playSpeed;
          if (next >= timelineData.length - 1) {
            setIsPlaying(false);
            return timelineData.length - 1;
          }
          return next;
        });
      }, 100); // Update every 100ms
    } else {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    }

    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    };
  }, [isPlaying, playSpeed]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedIndex(parseInt(e.target.value));
  };

  const projectToMap = (lat: number, lng: number) => {
    const x = ((lng + 180) / 360) * 100;
    const y = ((90 - lat) / 180) * 100;
    return { x, y };
  };

  const getStationColor = (status: string) => {
    switch (status) {
      case "safe": return "var(--prithvi-aurora-green)";
      case "moderate": return "var(--prithvi-warm-amber)";
      case "critical": return "var(--prithvi-critical-red)";
      default: return "var(--prithvi-ocean-blue)";
    }
  };

  const getTimeZoneLabel = () => {
    if (selectedData.type === "past") return "HISTORICAL DATA";
    if (selectedData.type === "current") return "CURRENT CONDITIONS";
    return "FUTURE PREDICTION";
  };

  const getTimeZoneColor = () => {
    if (selectedData.type === "past") return "var(--prithvi-ocean-blue)";
    if (selectedData.type === "current") return "var(--prithvi-aurora-green)";
    return "var(--prithvi-electric-cyan)";
  };

  // Get context window of data around selected point
  const contextWindow = 30; // Days before and after

  // Filter data based on active time filter
  const filteredTimelineData = timeFilter === "all"
    ? timelineData
    : timelineData.filter((p) => p.type === timeFilter);

  const contextData = filteredTimelineData.slice(
    Math.max(0, filteredTimelineData.findIndex((p) => p === selectedData) - contextWindow),
    Math.min(filteredTimelineData.length, filteredTimelineData.findIndex((p) => p === selectedData) + contextWindow + 1)
  );

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div
          className="p-3 rounded-lg border backdrop-blur-xl"
          style={{
            background: "var(--prithvi-panel-bg-solid)",
            borderColor: "var(--prithvi-border-bright)",
          }}
        >
          <div className="text-xs font-mono mb-2 prithvi-text-electric">{payload[0].payload.shortDate}</div>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="text-xs font-mono" style={{ color: entry.color }}>
              {entry.name}: {entry.value}
            </div>
          ))}
        </div>
      );
    }
    return null;
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
            POLLUTION TIME MACHINE
          </h2>
          <p className="text-sm mt-1 opacity-70 prithvi-text-forest">
            Environmental Timeline Explorer • Historical Analysis • Future Predictions
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Time filter buttons */}
          {(["past", "current", "future"] as const).map((filter) => {
            const labels = { past: "HISTORICAL", current: "CURRENT", future: "PREDICTED" };
            const colors = {
              past: "var(--prithvi-ocean-blue)",
              current: "var(--prithvi-aurora-green)",
              future: "var(--prithvi-electric-cyan)",
            };
            const isActive = timeFilter === filter;
            return (
              <button
                key={filter}
                onClick={() => {
                  if (timeFilter === filter) {
                    setTimeFilter("all");
                    return;
                  }
                  setTimeFilter(filter);
                  // Jump to first point of this type
                  const idx = timelineData.findIndex((p) => p.type === filter);
                  if (idx >= 0) setSelectedIndex(idx);
                }}
                className="px-4 py-2 rounded-lg border text-xs font-mono font-bold transition-all"
                style={{
                  background: isActive ? colors[filter] : "var(--prithvi-glass)",
                  borderColor: isActive ? colors[filter] : "var(--prithvi-border-dim)",
                  color: isActive ? "#000" : colors[filter],
                  boxShadow: isActive ? `0 0 12px ${colors[filter]}` : "none",
                }}
              >
                {labels[filter]}
              </button>
            );
          })}

          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border"
            style={{
              background: "var(--prithvi-glass-bright)",
              borderColor: getTimeZoneColor(),
            }}
          >
            <Zap className="w-4 h-4" style={{ color: getTimeZoneColor() }} />
            <span className="text-xs font-mono font-bold" style={{ color: getTimeZoneColor() }}>
              {getTimeZoneLabel()}
            </span>
          </motion.div>
        </div>
      </motion.div>

      {/* Timeline Control Panel */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="p-6 rounded-lg border backdrop-blur-md prithvi-card-layered prithvi-inner-glow"
        style={{
          background: "var(--prithvi-panel-bg)",
          borderColor: "var(--prithvi-border-bright)",
        }}
      >
        {/* Date Display */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Calendar className="w-6 h-6 prithvi-text-electric" />
            <div>
              <motion.div
                key={selectedData.dateStr}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-3xl font-mono font-bold prithvi-text-electric"
              >
                {selectedData.dateStr}
              </motion.div>
              <div className="text-xs font-mono mt-1 opacity-60 prithvi-text-forest">
                {selectedData.daysFromNow === 0 ? (
                  "TODAY"
                ) : selectedData.daysFromNow < 0 ? (
                  `${Math.abs(selectedData.daysFromNow)} DAYS AGO`
                ) : (
                  `IN ${selectedData.daysFromNow} DAYS`
                )}
              </div>
            </div>
          </div>

          {/* Playback Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedIndex(0)}
              disabled={selectedIndex === 0}
              className="p-2 rounded-lg hover:bg-white/10 transition-all disabled:opacity-30"
              style={{ background: "var(--prithvi-glass)" }}
            >
              <SkipBack className="w-4 h-4 prithvi-text-electric" />
            </button>
            
            <button
              onClick={() => setSelectedIndex(Math.max(0, selectedIndex - 30))}
              disabled={selectedIndex === 0}
              className="p-2 rounded-lg hover:bg-white/10 transition-all disabled:opacity-30"
              style={{ background: "var(--prithvi-glass)" }}
            >
              <Rewind className="w-4 h-4 prithvi-text-electric" />
            </button>

            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-3 rounded-lg hover:bg-white/10 transition-all prithvi-glow-electric"
              style={{ background: "var(--prithvi-glass-bright)" }}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 prithvi-text-electric" />
              ) : (
                <Play className="w-5 h-5 prithvi-text-electric" />
              )}
            </button>

            <button
              onClick={() => setSelectedIndex(Math.min(timelineData.length - 1, selectedIndex + 30))}
              disabled={selectedIndex === timelineData.length - 1}
              className="p-2 rounded-lg hover:bg-white/10 transition-all disabled:opacity-30"
              style={{ background: "var(--prithvi-glass)" }}
            >
              <FastForward className="w-4 h-4 prithvi-text-electric" />
            </button>

            <button
              onClick={() => setSelectedIndex(timelineData.length - 1)}
              disabled={selectedIndex === timelineData.length - 1}
              className="p-2 rounded-lg hover:bg-white/10 transition-all disabled:opacity-30"
              style={{ background: "var(--prithvi-glass)" }}
            >
              <SkipForward className="w-4 h-4 prithvi-text-electric" />
            </button>

            <div className="ml-4 flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "var(--prithvi-glass)" }}>
              <Gauge className="w-4 h-4 prithvi-text-electric" />
              <select
                value={playSpeed}
                onChange={(e) => setPlaySpeed(parseInt(e.target.value))}
                className="bg-transparent text-xs font-mono prithvi-text-electric outline-none cursor-pointer"
                style={{ color: "var(--prithvi-electric-cyan)" }}
              >
                <option value={1} style={{ background: "var(--prithvi-panel-bg-solid)", color: "var(--prithvi-electric-cyan)" }}>1x</option>
                <option value={2} style={{ background: "var(--prithvi-panel-bg-solid)", color: "var(--prithvi-electric-cyan)" }}>2x</option>
                <option value={5} style={{ background: "var(--prithvi-panel-bg-solid)", color: "var(--prithvi-electric-cyan)" }}>5x</option>
                <option value={10} style={{ background: "var(--prithvi-panel-bg-solid)", color: "var(--prithvi-electric-cyan)" }}>10x</option>
              </select>
            </div>

            <button
              onClick={() => setSelectedIndex(currentIndex)}
              className="px-4 py-2 rounded-lg hover:bg-white/10 transition-all text-xs font-mono prithvi-text-aurora"
              style={{ background: "var(--prithvi-glass)" }}
            >
              JUMP TO TODAY
            </button>
          </div>
        </div>

        {/* Timeline Slider */}
        <div className="relative" ref={timelineRef}>
          {/* Timeline background zones */}
          <div className="absolute inset-x-0 h-24 flex rounded-lg overflow-hidden mb-4">
            <div
              className="flex-1 flex items-center justify-center text-xs font-mono opacity-40"
              style={{ background: "linear-gradient(to right, var(--prithvi-ocean-blue), var(--prithvi-ocean-blue))" }}
            >
              <span className="prithvi-text-ocean">PAST</span>
            </div>
            <div
              className="w-1 flex items-center justify-center"
              style={{ background: "var(--prithvi-aurora-green)" }}
            >
              <div className="w-full h-full" style={{ background: "var(--prithvi-aurora-green)" }} />
            </div>
            <div
              className="flex-1 flex items-center justify-center text-xs font-mono opacity-40"
              style={{ background: "linear-gradient(to right, var(--prithvi-electric-cyan), var(--prithvi-electric-cyan))" }}
            >
              <span className="prithvi-text-electric">FUTURE</span>
            </div>
          </div>

          {/* Slider */}
          <div className="relative pt-24 pb-4">
            <input
              type="range"
              min={0}
              max={Math.max(1, timelineData.length - 1)}
              value={selectedIndex}
              onChange={handleSliderChange}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer prithvi-timeline-slider"
              style={{
                background: timelineData.length > 0 ? `linear-gradient(to right,
                  var(--prithvi-ocean-blue) 0%,
                  var(--prithvi-ocean-blue) ${(currentIndex / timelineData.length) * 100}%,
                  var(--prithvi-aurora-green) ${(currentIndex / timelineData.length) * 100}%,
                  var(--prithvi-aurora-green) ${(currentIndex / timelineData.length) * 100}%,
                  var(--prithvi-electric-cyan) ${(currentIndex / timelineData.length) * 100}%,
                  var(--prithvi-electric-cyan) 100%)` : 'var(--prithvi-grid)',
              }}
            />

            {/* Current day marker */}
            <div
              className="absolute top-20 w-0.5 h-8 prithvi-glow-aurora"
              style={{
                left: `${timelineData.length > 0 ? (currentIndex / timelineData.length) * 100 : 50}%`,
                background: "var(--prithvi-aurora-green)",
              }}
            >
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-mono whitespace-nowrap prithvi-text-aurora">
                TODAY
              </div>
            </div>
          </div>

          {/* Timeline labels */}
          <div className="flex justify-between text-xs font-mono opacity-60 mt-2">
            <span className="prithvi-text-ocean">{timelineData[0]?.shortDate ?? "—"}</span>
            <span className="prithvi-text-aurora">{currentIndex >= 0 ? timelineData[currentIndex]?.shortDate : "—"}</span>
            <span className="prithvi-text-electric">{timelineData[timelineData.length - 1]?.shortDate ?? "—"}</span>
          </div>
        </div>
      </motion.div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-3 gap-6">
        {/* Map Visualization */}
        <motion.div
          className="col-span-2 p-6 rounded-lg border backdrop-blur-md prithvi-card-layered prithvi-inner-glow"
          style={{
            background: "var(--prithvi-panel-bg)",
            borderColor: "var(--prithvi-border-dim)",
          }}
        >
          <div className="flex items-center gap-3 mb-4">
            <MapPin className="w-5 h-5 prithvi-text-electric" />
            <h3 className="text-lg font-mono tracking-wider prithvi-text-electric">
              INDIA POLLUTION MAP
            </h3>
            <span className="ml-auto text-xs font-mono opacity-60 prithvi-text-forest">
              {selectedData.type === "future" ? "AI Predicted" : "Actual Data"}
            </span>
          </div>

          <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--prithvi-border-dim)", height: "400px" }}>
            <svg viewBox="0 0 100 100" className="w-full h-full" style={{ background: "rgba(5, 10, 20, 0.6)" }}>
              {/* Grid */}
              <defs>
                <pattern id="grid-tm" width="10" height="10" patternUnits="userSpaceOnUse">
                  <path d="M 10 0 L 0 0 0 10" fill="none" stroke="var(--prithvi-grid)" strokeWidth="0.1" opacity="0.3" />
                </pattern>
              </defs>
              <rect width="100" height="100" fill="url(#grid-tm)" />

              {/* World map outline */}
              <WorldMapSVG />

              {/* Stations with animated transitions */}
              <AnimatePresence mode="sync">
                {stationData.map((station) => {
                  const pos = projectToMap(station.lat, station.lng);
                  const color = getStationColor(station.status);

                  return (
                    <g key={station.id}>
                      {/* Heatmap effect */}
                      <motion.circle
                        cx={pos.x}
                        cy={pos.y}
                        r="0"
                        fill={color}
                        initial={{ r: 0, opacity: 0 }}
                        animate={{ r: 8, opacity: 0.2 }}
                        exit={{ r: 0, opacity: 0 }}
                        transition={{ duration: 0.5 }}
                      />

                      {/* Station marker */}
                      <motion.circle
                        cx={pos.x}
                        cy={pos.y}
                        r="0.8"
                        fill={color}
                        stroke="rgba(255, 255, 255, 0.3)"
                        strokeWidth="0.15"
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        style={{
                          filter: `drop-shadow(0 0 0.6px ${color})`,
                        }}
                      />

                      {/* AQI value */}
                      <motion.text
                        x={pos.x}
                        y={pos.y - 2}
                        textAnchor="middle"
                        fontSize="1.2"
                        fill={color}
                        initial={{ opacity: 0, y: pos.y }}
                        animate={{ opacity: 1, y: pos.y - 2 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        style={{
                          pointerEvents: "none",
                          textShadow: `0 0 2px ${color}`,
                        }}
                      >
                        {Math.round(station.aqi)}
                      </motion.text>
                    </g>
                  );
                })}
              </AnimatePresence>
            </svg>
          </div>
        </motion.div>

        {/* Risk Indicators */}
        <motion.div
          className="p-6 rounded-lg border backdrop-blur-md prithvi-card-layered"
          style={{
            background: "var(--prithvi-panel-bg)",
            borderColor: "var(--prithvi-border-dim)",
          }}
        >
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="w-5 h-5 prithvi-text-electric" />
            <h3 className="text-lg font-mono tracking-wider prithvi-text-electric">
              RISK INDICATORS
            </h3>
          </div>

          <div className="space-y-4">
            {/* AQI */}
            <motion.div
              key={`aqi-${selectedIndex}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              className="p-4 rounded-lg border"
              style={{ background: "var(--prithvi-glass)", borderColor: "var(--prithvi-border-dim)" }}
            >
              <div className="text-xs font-mono opacity-60 mb-2 prithvi-text-electric">AIR QUALITY INDEX</div>
              <motion.div
                key={selectedData.aqi}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-4xl font-bold font-mono mb-2"
                style={{
                  color: selectedData.aqi > 150 ? "var(--prithvi-critical-red)" : selectedData.aqi > 100 ? "var(--prithvi-warm-amber)" : "var(--prithvi-aurora-green)",
                }}
              >
                {selectedData.aqi}
              </motion.div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--prithvi-grid)" }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min((selectedData.aqi / 200) * 100, 100)}%` }}
                  transition={{ duration: 0.5 }}
                  className="h-full"
                  style={{
                    background: selectedData.aqi > 150 ? "var(--prithvi-critical-red)" : selectedData.aqi > 100 ? "var(--prithvi-warm-amber)" : "var(--prithvi-aurora-green)",
                    boxShadow: `0 0 10px ${selectedData.aqi > 150 ? "var(--prithvi-critical-red)" : selectedData.aqi > 100 ? "var(--prithvi-warm-amber)" : "var(--prithvi-aurora-green)"}`,
                  }}
                />
              </div>
            </motion.div>

            {/* PM2.5 */}
            <motion.div
              key={`pm25-${selectedIndex}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.05 }}
              className="p-4 rounded-lg border"
              style={{ background: "var(--prithvi-glass)", borderColor: "var(--prithvi-border-dim)" }}
            >
              <div className="text-xs font-mono opacity-60 mb-2 prithvi-text-electric">PM2.5 PARTICLES</div>
              <motion.div
                key={selectedData.pm25}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-3xl font-bold font-mono mb-1"
                style={{
                  color: selectedData.pm25 > 75 ? "var(--prithvi-critical-red)" : selectedData.pm25 > 50 ? "var(--prithvi-warm-amber)" : "var(--prithvi-aurora-green)",
                }}
              >
                {selectedData.pm25}
              </motion.div>
              <div className="text-xs opacity-60 prithvi-text-forest mb-2">μg/m³</div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--prithvi-grid)" }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min((selectedData.pm25 / 150) * 100, 100)}%` }}
                  transition={{ duration: 0.5 }}
                  className="h-full"
                  style={{
                    background: selectedData.pm25 > 75 ? "var(--prithvi-critical-red)" : selectedData.pm25 > 50 ? "var(--prithvi-warm-amber)" : "var(--prithvi-aurora-green)",
                  }}
                />
              </div>
            </motion.div>

            {/* PM10 */}
            <motion.div
              key={`pm10-${selectedIndex}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="p-4 rounded-lg border"
              style={{ background: "var(--prithvi-glass)", borderColor: "var(--prithvi-border-dim)" }}
            >
              <div className="text-xs font-mono opacity-60 mb-2 prithvi-text-electric">PM10 PARTICLES</div>
              <motion.div
                key={selectedData.pm10}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-3xl font-bold font-mono mb-1"
                style={{
                  color: selectedData.pm10 > 100 ? "var(--prithvi-critical-red)" : selectedData.pm10 > 75 ? "var(--prithvi-warm-amber)" : "var(--prithvi-aurora-green)",
                }}
              >
                {selectedData.pm10}
              </motion.div>
              <div className="text-xs opacity-60 prithvi-text-forest mb-2">μg/m³</div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--prithvi-grid)" }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min((selectedData.pm10 / 200) * 100, 100)}%` }}
                  transition={{ duration: 0.5 }}
                  className="h-full"
                  style={{
                    background: selectedData.pm10 > 100 ? "var(--prithvi-critical-red)" : selectedData.pm10 > 75 ? "var(--prithvi-warm-amber)" : "var(--prithvi-aurora-green)",
                  }}
                />
              </div>
            </motion.div>

            {/* NO2 */}
            <motion.div
              key={`no2-${selectedIndex}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.15 }}
              className="p-4 rounded-lg border"
              style={{ background: "var(--prithvi-glass)", borderColor: "var(--prithvi-border-dim)" }}
            >
              <div className="text-xs font-mono opacity-60 mb-2 prithvi-text-electric">NO₂ LEVELS</div>
              <motion.div
                key={selectedData.no2}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-3xl font-bold font-mono mb-1"
                style={{
                  color: selectedData.no2 > 60 ? "var(--prithvi-critical-red)" : selectedData.no2 > 40 ? "var(--prithvi-warm-amber)" : "var(--prithvi-aurora-green)",
                }}
              >
                {selectedData.no2}
              </motion.div>
              <div className="text-xs opacity-60 prithvi-text-forest mb-2">μg/m³</div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--prithvi-grid)" }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min((selectedData.no2 / 100) * 100, 100)}%` }}
                  transition={{ duration: 0.5 }}
                  className="h-full"
                  style={{
                    background: selectedData.no2 > 60 ? "var(--prithvi-critical-red)" : selectedData.no2 > 40 ? "var(--prithvi-warm-amber)" : "var(--prithvi-aurora-green)",
                  }}
                />
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-6">
        {/* Temporal Context Chart */}
        <motion.div
          className="p-6 rounded-lg border backdrop-blur-md prithvi-card-layered"
          style={{
            background: "var(--prithvi-panel-bg)",
            borderColor: "var(--prithvi-border-dim)",
          }}
        >
          <div className="flex items-center gap-3 mb-4">
            <TrendingUp className="w-5 h-5 prithvi-text-electric" />
            <h3 className="text-lg font-mono tracking-wider prithvi-text-electric">
              TEMPORAL CONTEXT • AQI TREND
            </h3>
          </div>

          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={contextData}>
              <defs>
                <linearGradient id="aqiGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--prithvi-electric-cyan)" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="var(--prithvi-electric-cyan)" stopOpacity={0} />
                </linearGradient>
                <filter id="chartGlow">
                  <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--prithvi-grid)" opacity={0.2} vertical={false} />
              <XAxis
                dataKey="shortDate"
                stroke="var(--prithvi-text-dim)"
                tick={{ fill: "var(--prithvi-text-dim)", fontSize: 9, fontFamily: "monospace" }}
                interval={5}
              />
              <YAxis
                stroke="var(--prithvi-text-dim)"
                tick={{ fill: "var(--prithvi-text-dim)", fontSize: 9, fontFamily: "monospace" }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="aqi"
                stroke="var(--prithvi-electric-cyan)"
                strokeWidth={2}
                fill="url(#aqiGradient)"
                filter="url(#chartGlow)"
              />
              <ReferenceLine
                x={selectedData.shortDate}
                stroke="var(--prithvi-aurora-green)"
                strokeWidth={2}
                strokeDasharray="3 3"
              />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Multi-Pollutant View */}
        <motion.div
          className="p-6 rounded-lg border backdrop-blur-md prithvi-card-layered"
          style={{
            background: "var(--prithvi-panel-bg)",
            borderColor: "var(--prithvi-border-dim)",
          }}
        >
          <div className="flex items-center gap-3 mb-4">
            <Activity className="w-5 h-5 prithvi-text-electric" />
            <h3 className="text-lg font-mono tracking-wider prithvi-text-electric">
              POLLUTANT BREAKDOWN
            </h3>
          </div>

          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={[selectedData]}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--prithvi-grid)" opacity={0.2} vertical={false} />
              <XAxis dataKey="dateStr" stroke="var(--prithvi-text-dim)" tick={{ fill: "var(--prithvi-text-dim)", fontSize: 9 }} />
              <YAxis stroke="var(--prithvi-text-dim)" tick={{ fill: "var(--prithvi-text-dim)", fontSize: 9 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="pm25" fill="var(--prithvi-electric-cyan)" radius={[4, 4, 0, 0]} name="PM2.5" />
              <Bar dataKey="pm10" fill="var(--prithvi-critical-red)" radius={[4, 4, 0, 0]} name="PM10" opacity={0.8} />
              <Bar dataKey="no2" fill="var(--prithvi-warm-amber)" radius={[4, 4, 0, 0]} name="NO₂" />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>
    </div>
  );
}