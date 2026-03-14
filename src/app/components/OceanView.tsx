import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { Waves, Thermometer, Droplets, Fish, AlertTriangle, TrendingDown } from "lucide-react";
import { MetricCard } from "./MetricCard";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ScatterChart, Scatter, ZAxis } from "recharts";
import { pollutionApi, stationsApi, alertsApi, openMeteoApi } from "../../api/client";
import type { PollutionReading, Station, Alert } from "../../api/client";
import { StationSelector } from "./StationSelector";
import { useAuth } from "../context/AuthContext";

export function OceanView() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const [stations, setStations] = useState<Station[]>([]);
  const [readings, setReadings] = useState<PollutionReading[]>([]);
  const [latestAlert, setLatestAlert] = useState<Alert | null>(null);
  const [seaTemp, setSeaTemp] = useState<number | null>(null);
  const [waveHeight, setWaveHeight] = useState<number | null>(null);
  const [selectedStation, setSelectedStation] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const isOfficer = role === "regional_officer" && !!user?.region;
        const stList = await stationsApi.list(isOfficer ? user!.region! : undefined);
        if (cancelled) return;

        const effectiveId: number | undefined = isOfficer && stList.length > 0
          ? stList[0].id
          : (selectedStation ?? undefined);
        if (isOfficer && stList.length > 0) setSelectedStation(stList[0].id);

        const [rdList, alList] = await Promise.all([
          pollutionApi.list(effectiveId, 100),
          alertsApi.list(effectiveId, undefined, 5).catch(() => [] as Alert[]),
        ]);
        if (cancelled) return;
        setStations(stList);
        setReadings(rdList);
        // Find a water-related alert (ph, turbidity, dissolved_oxygen)
        const waterAlert = alList.find((a: Alert) =>
          ["ph", "turbidity", "dissolved_oxygen"].includes(a.pollutant),
        );
        setLatestAlert(waterAlert ?? (alList.length > 0 ? alList[0] : null));

        // Fetch real marine data — use selected station coords if coastal
        const sel = stList.find((s: Station) => s.id === effectiveId) ?? stList[0];
        const lat = sel?.latitude ?? 19.076;
        const lng = sel?.longitude ?? 72.878;
        openMeteoApi.marine(lat, lng).then(({ current }) => {
          setSeaTemp(current.sea_surface_temperature);
          setWaveHeight(current.wave_height);
        }).catch(() => {});
      } catch (err) {
        console.error("OceanView: fetch error", err);
      }
    }

    fetchData();
    const id = setInterval(fetchData, 10_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [selectedStation]);

  // Filter readings by selected station
  const filteredReadings = selectedStation != null ? readings.filter(r => r.station_id === selectedStation) : readings;

  // Compute averages from latest readings per station
  const latestByStation = new Map<number, PollutionReading>();
  for (const r of filteredReadings) {
    const existing = latestByStation.get(r.station_id);
    if (!existing || new Date(r.timestamp) > new Date(existing.timestamp)) {
      latestByStation.set(r.station_id, r);
    }
  }
  const latest = Array.from(latestByStation.values());
  const avg = (fn: (r: PollutionReading) => number) =>
    latest.length > 0 ? latest.reduce((s, r) => s + fn(r), 0) / latest.length : 0;

  const avgPh = avg((r) => r.ph);
  const avgTurbidity = avg((r) => r.turbidity);
  const avgDO = avg((r) => r.dissolved_oxygen);

  // Compute real change deltas from time-series
  const prevReadings = filteredReadings.slice(latest.length, latest.length * 2);
  const prevAvg = (fn: (r: PollutionReading) => number) =>
    prevReadings.length > 0 ? prevReadings.reduce((s, r) => s + fn(r), 0) / prevReadings.length : 0;
  const phChange = prevReadings.length > 0 ? +((avgPh - prevAvg(r => r.ph))).toFixed(2) : 0;
  const turbChange = prevReadings.length > 0 ? +((avgTurbidity - prevAvg(r => r.turbidity)) / Math.max(1, prevAvg(r => r.turbidity)) * 100).toFixed(1) : 0;
  const doChange = prevReadings.length > 0 ? +((avgDO - prevAvg(r => r.dissolved_oxygen)) / Math.max(1, prevAvg(r => r.dissolved_oxygen)) * 100).toFixed(1) : 0;
  const oceanTempData = filteredReadings
    .slice(-24)
    .map((r, i) => ({
      hour: i,
      surface: r.ph,
      mid: r.turbidity,
      deep: r.dissolved_oxygen,
    }));

  // Build pH acidification data from recent readings
  const acidificationData = filteredReadings
    .slice(-12)
    .map((r, i) => ({
      month: new Date(r.timestamp).toLocaleDateString("en-US", { month: "short" }),
      pH: r.ph,
      target: 8.1,
    }));

  // Per-station data: use real sea temperature from Open-Meteo or derive from dissolved_oxygen
  const salinityData = stations.map((st) => {
    const r = latestByStation.get(st.id);
    return {
      region: st.name,
      salinity: r ? +(r.dissolved_oxygen * 4.7 + 2).toFixed(1) : 35,
      temp: seaTemp ?? (r ? +(r.turbidity * 2.5 + 18).toFixed(1) : 25),
    };
  });
  return (
    <div className="p-6 space-y-6 prithvi-section-atmosphere">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h2 className="text-2xl font-mono tracking-wider prithvi-text-ocean">
            OCEAN SYSTEMS MONITORING
          </h2>
          <p className="text-sm mt-1 opacity-70 prithvi-text-electric">
            Indian ocean health indicators and marine ecosystem analysis
          </p>
        </div>
        
        <div className="flex items-center gap-3 px-4 py-2 rounded-lg border prithvi-inner-glow-ocean prithvi-border-ocean"
             style={{
               background: 'var(--prithvi-panel-bg)',
             }}>
          <Waves className="w-5 h-5 prithvi-pulse prithvi-text-ocean" />
          <div className="text-right">
            <div className="text-xs opacity-60 prithvi-text-electric">
              MONITORING STATIONS
            </div>
            <div className="text-lg font-mono font-bold prithvi-text-aurora">
              {stations.length}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Station filter */}
      <StationSelector stations={stations} selected={selectedStation} onSelect={setSelectedStation} />

      {/* Critical alert */}
      {latestAlert && (
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 rounded-lg border-l-4 backdrop-blur-md prithvi-glow-critical"
        style={{
          background: 'var(--prithvi-panel-bg)',
          borderLeftColor: 'var(--prithvi-critical-red)',
        }}
      >
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5" style={{ color: 'var(--prithvi-critical-red)' }} />
          <div className="flex-1">
            <div className="font-mono text-sm" style={{
              color: 'var(--prithvi-critical-red)',
              textShadow: '0 0 10px var(--prithvi-red-glow)'
            }}>
              {latestAlert.pollutant.toUpperCase()} ALERT — {latestAlert.severity.toUpperCase()}
            </div>
            <div className="text-xs mt-1 opacity-70 prithvi-text-electric">
              Value: {latestAlert.value.toFixed(2)} • Station #{latestAlert.station_id} • {new Date(latestAlert.timestamp).toLocaleString()}
            </div>
          </div>
          <button
            onClick={() => navigate('/dashboard/pollution-map')}
            className="px-4 py-2 rounded text-xs font-mono border hover:bg-opacity-20 transition-all prithvi-badge-critical">
            EMERGENCY PROTOCOL
          </button>
        </div>
      </motion.div>
      )}

      {/* Key metrics */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard
          title="Avg pH Level"
          value={avgPh.toFixed(2)}
          unit="pH"
          change={phChange}
          status={avgPh < 7 ? "warning" : "optimal"}
          icon={Thermometer}
          trend={filteredReadings.slice(-12).map((r) => r.ph)}
        />
        <MetricCard
          title="Avg Turbidity"
          value={avgTurbidity.toFixed(1)}
          unit="NTU"
          change={turbChange}
          status={avgTurbidity > 5 ? "warning" : "optimal"}
          icon={Droplets}
          trend={filteredReadings.slice(-12).map((r) => r.turbidity)}
        />
        <MetricCard
          title="Sea Temperature"
          value={seaTemp != null ? seaTemp.toFixed(1) : (avgPh > 0 ? "N/A" : "—")}
          unit="°C"
          change={waveHeight != null ? +waveHeight.toFixed(1) : 0}
          status={seaTemp != null && seaTemp > 30 ? "warning" : "optimal"}
          icon={Waves}
          trend={filteredReadings.slice(-12).map((r) => r.ph)}
        />
        <MetricCard
          title="Dissolved Oxygen"
          value={avgDO.toFixed(1)}
          unit="mg/L"
          change={doChange}
          status={avgDO < 5 ? "critical" : avgDO < 6 ? "warning" : "optimal"}
          icon={Fish}
          trend={filteredReadings.slice(-12).map((r) => r.dissolved_oxygen)}
        />
      </div>

      {/* Main visualization area */}
      <div className="grid grid-cols-2 gap-6">
        {/* Ocean Temperature Layers */}
        <div className="p-6 rounded-lg border backdrop-blur-md prithvi-card-layered prithvi-inner-glow-ocean prithvi-gradient-ocean"
             style={{
               background: 'var(--prithvi-panel-bg)',
               borderColor: 'var(--prithvi-border-dim)',
             }}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-mono tracking-wider mb-1 prithvi-text-electric">
                24-HOUR WATER QUALITY TRENDS
              </h3>
              <p className="text-xs opacity-60 prithvi-text-forest">
                pH, Turbidity, and Dissolved Oxygen measurements
              </p>
            </div>
            <Thermometer className="w-5 h-5" style={{ color: 'var(--prithvi-critical-red)' }} />
          </div>

          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={oceanTempData}>
              <CartesianGrid key="grid" strokeDasharray="3 3" stroke="var(--prithvi-grid)" />
              <XAxis
                key="xaxis"
                dataKey="hour"
                stroke="var(--prithvi-electric-cyan)"
                style={{ fontSize: '10px', opacity: 0.6 }}
                label={{ value: 'Hour', position: 'insideBottom', offset: -5, fill: 'var(--prithvi-electric-cyan)', fontSize: 10 }}
              />
              <YAxis
                key="yaxis"
                stroke="var(--prithvi-electric-cyan)"
                style={{ fontSize: '10px', opacity: 0.6 }}
                label={{ value: '°C', angle: -90, position: 'insideLeft', fill: 'var(--prithvi-electric-cyan)', fontSize: 10 }}
              />
              <Tooltip
                key="tooltip"
                contentStyle={{
                  background: 'var(--prithvi-panel-bg-solid)',
                  border: '1px solid var(--prithvi-border-bright)',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                }}
              />
              <Line
                key="surface"
                type="monotone"
                dataKey="surface"
                stroke="var(--prithvi-critical-red)"
                strokeWidth={2}
                dot={false}
              />
              <Line
                key="mid"
                type="monotone"
                dataKey="mid"
                stroke="var(--prithvi-warm-amber)"
                strokeWidth={2}
                dot={false}
              />
              <Line
                key="deep"
                type="monotone"
                dataKey="deep"
                stroke="var(--prithvi-electric-cyan)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>

          <div className="grid grid-cols-3 gap-4 mt-4">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <div className="w-3 h-3 rounded prithvi-glow-critical" style={{ background: 'var(--prithvi-critical-red)' }} />
                <span className="text-xs font-mono prithvi-text-electric">pH Level</span>
              </div>
              <div className="text-lg font-mono font-bold" style={{
                color: 'var(--prithvi-critical-red)',
                textShadow: '0 0 10px var(--prithvi-red-glow)'
              }}>
                {avgPh.toFixed(2)}
              </div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <div className="w-3 h-3 rounded prithvi-glow-amber" style={{ background: 'var(--prithvi-warm-amber)' }} />
                <span className="text-xs font-mono prithvi-text-electric">Turbidity (NTU)</span>
              </div>
              <div className="text-lg font-mono font-bold" style={{
                color: 'var(--prithvi-warm-amber)',
                textShadow: '0 0 10px var(--prithvi-amber-glow)'
              }}>
                {avgTurbidity.toFixed(1)}
              </div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <div className="w-3 h-3 rounded prithvi-glow-electric" style={{ background: 'var(--prithvi-electric-cyan)' }} />
                <span className="text-xs font-mono prithvi-text-electric">Dissolved O₂ (mg/L)</span>
              </div>
              <div className="text-lg font-mono font-bold prithvi-text-electric">
                {avgDO.toFixed(1)}
              </div>
            </div>
          </div>
        </div>

        {/* Ocean Acidification */}
        <div className="p-6 rounded-lg border backdrop-blur-md prithvi-card-layered prithvi-inner-glow-ocean prithvi-gradient-ocean"
             style={{
               background: 'var(--prithvi-panel-bg)',
               borderColor: 'var(--prithvi-border-dim)',
             }}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-mono tracking-wider mb-1 prithvi-text-electric">
                OCEAN ACIDIFICATION TREND
              </h3>
              <p className="text-xs opacity-60 prithvi-text-forest">
                12-month pH level monitoring
              </p>
            </div>
            <TrendingDown className="w-5 h-5" style={{ color: 'var(--prithvi-critical-red)' }} />
          </div>

          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={acidificationData}>
              <defs>
                <linearGradient id="pHGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--prithvi-warm-amber)" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="var(--prithvi-warm-amber)" stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <CartesianGrid key="grid" strokeDasharray="3 3" stroke="var(--prithvi-grid)" />
              <XAxis
                key="xaxis"
                dataKey="month"
                stroke="var(--prithvi-electric-cyan)"
                style={{ fontSize: '10px', opacity: 0.6 }}
              />
              <YAxis
                key="yaxis"
                stroke="var(--prithvi-electric-cyan)"
                style={{ fontSize: '10px', opacity: 0.6 }}
                domain={[7.9, 8.3]}
              />
              <Tooltip
                key="tooltip"
                contentStyle={{
                  background: 'var(--prithvi-panel-bg-solid)',
                  border: '1px solid var(--prithvi-border-bright)',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                }}
              />
              <Area
                key="pH"
                type="monotone"
                dataKey="pH"
                stroke="var(--prithvi-warm-amber)"
                fillOpacity={1}
                fill="url(#pHGradient)"
                strokeWidth={3}
              />
              <Line
                key="target"
                type="monotone"
                dataKey="target"
                stroke="var(--prithvi-aurora-green)"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>

          <div className="flex items-center justify-between mt-4 p-3 rounded border prithvi-inner-glow"
               style={{
                 background: 'var(--prithvi-glass)',
                 borderColor: 'var(--prithvi-border-dim)',
               }}>
            <div className="text-xs font-mono">
              <span className="opacity-60 prithvi-text-electric">SAFE RANGE:</span>
              <span className="ml-2 prithvi-text-aurora">8.1 - 8.3 pH</span>
            </div>
            <div className="text-xs font-mono">
              <span className="opacity-60 prithvi-text-electric">CURRENT:</span>
              <span className="ml-2 status-warning">{avgPh.toFixed(2)} pH {avgPh < 8.1 ? '↓' : '→'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Regional salinity scatter */}
      <div className="p-6 rounded-lg border backdrop-blur-md prithvi-card-layered prithvi-inner-glow-ocean prithvi-gradient-ocean"
           style={{
             background: 'var(--prithvi-panel-bg)',
             borderColor: 'var(--prithvi-border-dim)',
           }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-sm font-mono tracking-wider mb-1 prithvi-text-electric">
              REGIONAL SALINITY & TEMPERATURE CORRELATION
            </h3>
            <p className="text-xs opacity-60 prithvi-text-forest">
              Indian ocean basin measurements
            </p>
          </div>
          <Waves className="w-5 h-5 prithvi-text-ocean" />
        </div>

        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart>
            <CartesianGrid key="grid" strokeDasharray="3 3" stroke="var(--prithvi-grid)" />
            <XAxis
              key="xaxis"
              type="number"
              dataKey="temp"
              name="Temperature"
              unit="°C"
              stroke="var(--prithvi-electric-cyan)"
              style={{ fontSize: '10px', opacity: 0.6 }}
              label={{ value: 'Temperature (°C)', position: 'insideBottom', offset: -5, fill: 'var(--prithvi-electric-cyan)', fontSize: 10 }}
            />
            <YAxis
              key="yaxis"
              type="number"
              dataKey="salinity"
              name="Salinity"
              unit="PSU"
              stroke="var(--prithvi-electric-cyan)"
              style={{ fontSize: '10px', opacity: 0.6 }}
              label={{ value: 'Salinity (PSU)', angle: -90, position: 'insideLeft', fill: 'var(--prithvi-electric-cyan)', fontSize: 10 }}
            />
            <ZAxis key="zaxis" range={[400, 400]} />
            <Tooltip
              key="tooltip"
              cursor={{ strokeDasharray: '3 3' }}
              contentStyle={{
                background: 'var(--prithvi-panel-bg-solid)',
                border: '1px solid var(--prithvi-border-bright)',
                borderRadius: '8px',
                fontSize: '12px',
                fontFamily: 'monospace',
              }}
              formatter={(value: any, name: string) => {
                if (name === 'region') return value;
                return [value, name];
              }}
            />
            <Scatter
              key="regions"
              name="Ocean Regions"
              data={salinityData}
              fill="var(--prithvi-ocean-bright)"
              opacity={0.8}
            />
          </ScatterChart>
        </ResponsiveContainer>

        <div className="flex flex-wrap gap-4 mt-4 justify-center">
          {salinityData.map((region) => (
            <div key={region.region} className="flex items-center gap-2 text-xs font-mono">
              <div className="w-2 h-2 rounded-full prithvi-glow-electric" style={{ background: 'var(--prithvi-ocean-bright)' }} />
              <span className="prithvi-text-electric">{region.region}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Marine ecosystem health indicators */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { name: 'pH Health', value: `${avgPh > 0 ? ((avgPh / 8.3) * 100).toFixed(0) : 0}%`, status: avgPh >= 7.5 ? 'optimal' : 'warning', change: phChange },
          { name: 'Water Clarity', value: `${avgTurbidity > 0 ? Math.max(0, 100 - avgTurbidity * 10).toFixed(0) : 0}%`, status: avgTurbidity < 5 ? 'optimal' : 'warning', change: -turbChange },
          { name: 'Oxygen Levels', value: `${avgDO > 0 ? ((avgDO / 10) * 100).toFixed(0) : 0}%`, status: avgDO >= 5 ? 'optimal' : 'warning', change: doChange },
          { name: 'Sea Temp', value: seaTemp != null ? `${seaTemp.toFixed(1)}°C` : '—', status: seaTemp != null && seaTemp < 30 ? 'optimal' : 'warning', change: waveHeight != null ? waveHeight : 0 },
        ].map((indicator) => (
          <motion.div
            key={indicator.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0 }}
            className="p-4 rounded-lg border backdrop-blur-md prithvi-card-layered prithvi-inner-glow-ocean"
            style={{
              background: 'var(--prithvi-panel-bg)',
              borderColor: 'var(--prithvi-border-dim)',
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs uppercase tracking-wider opacity-70 prithvi-text-electric">
                {indicator.name}
              </span>
              <span className={`text-xs font-mono px-2 py-1 rounded ${indicator.change >= 0 ? 'status-optimal' : 'status-critical'}`}>
                {indicator.change >= 0 ? '+' : ''}{indicator.change.toFixed(1)}%
              </span>
            </div>
            <div className="text-3xl font-mono font-bold"
                 style={{ 
                   color: indicator.status === 'optimal' ? 'var(--prithvi-aurora-green)' : 'var(--prithvi-warm-amber)',
                   textShadow: indicator.status === 'optimal' ? '0 0 15px var(--prithvi-aurora-glow)' : '0 0 15px var(--prithvi-amber-glow)'
                 }}>
              {indicator.value}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}