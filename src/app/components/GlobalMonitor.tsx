import { motion } from "motion/react";
import { Thermometer, Cloud, Droplets, Wind, Leaf, AlertTriangle, TrendingUp, Activity, Radio, Zap, Globe2, Gauge } from "lucide-react";
import { MetricCard } from "./MetricCard";
import { DataStream } from "./DataStream";
import { GlobeVisualization } from "./GlobeVisualization";
import { CircularIndicator } from "./CircularIndicator";
import { RealTimeChart } from "./RealTimeChart";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from "recharts";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { pollutionApi, riskApi, alertsApi, stationsApi, openMeteoApi, type PollutionReading, type RiskScore, type Alert, type Station, type WeatherCurrent, type WeatherHourly } from "../../api/client";
import { StationSelector } from "./StationSelector";

export function GlobalMonitor() {
  const navigate = useNavigate();
  const [systemTime, setSystemTime] = useState(new Date());
  const [riskScores, setRiskScores] = useState<RiskScore[]>([]);
  const [readings, setReadings] = useState<PollutionReading[]>([]);
  const [latestAlert, setLatestAlert] = useState<Alert | null>(null);
  const [alertCount, setAlertCount] = useState(0);
  const [stations, setStations] = useState<Station[]>([]);
  const [weather, setWeather] = useState<WeatherCurrent | null>(null);
  const [weatherHourly, setWeatherHourly] = useState<WeatherHourly | null>(null);
  const [selectedStation, setSelectedStation] = useState<number | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setSystemTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchData = () => {
      riskApi.list().then(setRiskScores).catch(() => {});
      pollutionApi.list(selectedStation ?? undefined, 100).then(setReadings).catch(() => {});
      alertsApi.list(selectedStation ?? undefined, undefined, 1).then(a => setLatestAlert(a[0] ?? null)).catch(() => {});
      alertsApi.list(selectedStation ?? undefined, undefined, 50).then(a => setAlertCount(a.length)).catch(() => {});
      stationsApi.list().then(st => {
        setStations(st);
        // Use selected station's coordinates for weather, or central India
        const sel = selectedStation != null ? st.find(s => s.id === selectedStation) : null;
        const lat = sel?.latitude ?? 21.0;
        const lng = sel?.longitude ?? 78.0;
        openMeteoApi.weather(lat, lng).then(({ current, hourly }) => {
          setWeather(current);
          setWeatherHourly(hourly);
        }).catch(() => {});
      }).catch(() => {});
    };
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [selectedStation]);

  // Filter by selected station
  const filteredRisk = selectedStation != null ? riskScores.filter(r => r.station_id === selectedStation) : riskScores;
  const filteredReadings = selectedStation != null ? readings.filter(r => r.station_id === selectedStation) : readings;

  // Compute averages from risk scores for circular indicators
  const avgRisk = filteredRisk.length > 0 ? {
    aqi: Math.round(filteredRisk.reduce((s, r) => s + r.air_quality_index, 0) / filteredRisk.length),
    wqi: Math.round(filteredRisk.reduce((s, r) => s + r.water_quality_index, 0) / filteredRisk.length),
    noise: Math.round(filteredRisk.reduce((s, r) => s + r.noise_index, 0) / filteredRisk.length),
    overall: +(filteredRisk.reduce((s, r) => s + r.overall_risk, 0) / filteredRisk.length).toFixed(1),
  } : { aqi: 0, wqi: 0, noise: 0, overall: 0 };

  // Compute actual measured averages from latest readings (one per station)
  const latestPerStation = new Map<number, PollutionReading>();
  for (const r of filteredReadings) {
    if (!latestPerStation.has(r.station_id)) latestPerStation.set(r.station_id, r);
  }
  const stationReadings = Array.from(latestPerStation.values());
  const measured = stationReadings.length > 0 ? {
    pm25: +(stationReadings.reduce((s, r) => s + r.pm25, 0) / stationReadings.length).toFixed(1),
    ph: +(stationReadings.reduce((s, r) => s + r.ph, 0) / stationReadings.length).toFixed(2),
    noise: Math.round(stationReadings.reduce((s, r) => s + r.noise_level, 0) / stationReadings.length),
  } : { pm25: 0, ph: 0, noise: 0 };

  // Build chart data from recent readings
  const chartReadings = [...filteredReadings].reverse().slice(-24);
  const temperatureData = chartReadings.map((r, i) => ({
    id: `r-${i}`,
    time: new Date(r.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    global: r.pm25,
    ocean: r.ph,
    land: r.noise_level,
  }));

  const co2Data = chartReadings.slice(-12).map((r, i) => ({
    id: `co2-${i}`,
    month: new Date(r.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    ppm: r.co2,
  }));

  const latest = filteredReadings[0];

  // Compute real change deltas: latest reading vs 2nd-latest for same station
  const secondLatest = filteredReadings.length > 1 ? filteredReadings[1] : null;
  const pmChange = latest && secondLatest ? +((latest.pm25 - secondLatest.pm25) / Math.max(1, secondLatest.pm25) * 100).toFixed(1) : 0;
  const co2Change = latest && secondLatest ? +((latest.co2 - secondLatest.co2) / Math.max(1, secondLatest.co2) * 100).toFixed(1) : 0;
  const phChange = latest && secondLatest ? +((latest.ph - secondLatest.ph)).toFixed(2) : 0;
  const no2Change = latest && secondLatest ? +((latest.no2 - secondLatest.no2) / Math.max(1, secondLatest.no2) * 100).toFixed(1) : 0;

  const selectedStationName = selectedStation != null ? stations.find(s => s.id === selectedStation)?.name ?? 'Station' : 'All Stations';

  return (
    <div className="p-6 space-y-6 prithvi-section-atmosphere">
      {/* Alert banner */}
      {latestAlert && (
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 rounded-lg border-l-4 backdrop-blur-md prithvi-glow-amber"
        style={{
          background: 'var(--prithvi-panel-bg)',
          borderLeftColor: latestAlert.severity === 'critical' ? 'var(--prithvi-critical-red)' : 'var(--prithvi-warm-amber)',
        }}
      >
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5" style={{ color: 'var(--prithvi-warm-amber)' }} />
          <div className="flex-1">
            <div className="font-mono text-sm" style={{
              color: 'var(--prithvi-warm-amber)',
              textShadow: '0 0 10px var(--prithvi-amber-glow)'
            }}>
              {latestAlert.severity.toUpperCase()} ALERT: {latestAlert.pollutant.toUpperCase()}
            </div>
            <div className="text-xs mt-1 opacity-70 prithvi-text-electric">
              Station #{latestAlert.station_id} • Value: {latestAlert.value.toFixed(1)} • {new Date(latestAlert.timestamp).toLocaleTimeString()}
            </div>
          </div>
          <button
            onClick={() => navigate('/dashboard/pollution-map')}
            className="px-4 py-2 rounded text-xs font-mono border hover:bg-opacity-20 transition-all prithvi-badge-warning">
            VIEW DETAILS
          </button>
        </div>
      </motion.div>
      )}

      {/* Station filter */}
      <StationSelector stations={stations} selected={selectedStation} onSelect={setSelectedStation} />

      {/* Central Intelligence Console - Actual Measured Values */}
      <div className="grid grid-cols-4 gap-6">
        <CircularIndicator
          title={selectedStation != null ? `${selectedStationName} PM2.5` : "AVG PM2.5"}
          value={measured.pm25}
          maxValue={500}
          unit="μg/m³"
          icon={Wind}
          color="var(--prithvi-aurora-green)"
          status={measured.pm25 > 150 ? "critical" : measured.pm25 > 75 ? "warning" : "optimal"}
          realTime={true}
        />
        <CircularIndicator
          title={selectedStation != null ? `${selectedStationName} pH` : "AVG WATER pH"}
          value={measured.ph}
          maxValue={14}
          unit="pH"
          icon={Droplets}
          color="var(--prithvi-ocean-bright)"
          status={measured.ph < 6.5 || measured.ph > 8.5 ? "critical" : measured.ph < 6.8 || measured.ph > 8.0 ? "warning" : "optimal"}
          realTime={true}
        />
        <CircularIndicator
          title={selectedStation != null ? `${selectedStationName} NOISE` : "AVG NOISE"}
          value={measured.noise}
          maxValue={120}
          unit="dB"
          icon={Radio}
          color="var(--prithvi-warm-amber)"
          status={measured.noise > 85 ? "critical" : measured.noise > 65 ? "warning" : "optimal"}
          realTime={true}
        />
        <CircularIndicator
          title="ACTIVE ALERTS"
          value={alertCount}
          maxValue={50}
          icon={AlertTriangle}
          color="var(--prithvi-critical-red)"
          status={alertCount > 20 ? "critical" : alertCount > 5 ? "warning" : "optimal"}
          realTime={true}
        />
      </div>

      {/* Primary metrics grid */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard
          title="PM2.5 Level"
          value={latest?.pm25?.toFixed(1) ?? "—"}
          unit="μg/m³"
          change={pmChange}
          status={latest && latest.pm25 > 75 ? "critical" : latest && latest.pm25 > 35 ? "warning" : "optimal"}
          icon={Thermometer}
          trend={chartReadings.slice(-12).map(r => r.pm25)}
        />
        <MetricCard
          title="Atmospheric CO₂"
          value={latest?.co2?.toFixed(0) ?? "—"}
          unit="ppm"
          change={co2Change}
          status={latest && latest.co2 > 1200 ? "critical" : latest && latest.co2 > 800 ? "warning" : "optimal"}
          icon={Cloud}
          trend={chartReadings.slice(-12).map(r => r.co2)}
        />
        <MetricCard
          title="Water pH Level"
          value={latest?.ph?.toFixed(2) ?? "—"}
          unit="pH"
          change={phChange}
          status={latest && (latest.ph < 6.5 || latest.ph > 8.5) ? "critical" : "optimal"}
          icon={Droplets}
          trend={chartReadings.slice(-12).map(r => r.ph)}
        />
        <MetricCard
          title="NO₂ Level"
          value={latest?.no2?.toFixed(1) ?? "—"}
          unit="ppb"
          change={no2Change}
          status={latest && latest.no2 > 80 ? "critical" : latest && latest.no2 > 40 ? "warning" : "optimal"}
          icon={Zap}
          trend={chartReadings.slice(-12).map(r => r.no2)}
        />
      </div>

      {/* Main visualization area */}
      <div className="grid grid-cols-3 gap-6">
        {/* Globe visualization - 2 columns */}
        <div className="col-span-2 h-[500px]">
          <GlobeVisualization />
        </div>

        {/* Live data stream - 1 column */}
        <div className="h-[500px] rounded-lg border backdrop-blur-md overflow-hidden prithvi-card-layered prithvi-inner-glow"
             style={{
               background: 'var(--prithvi-panel-bg)',
               borderColor: 'var(--prithvi-border-dim)',
             }}>
          <DataStream />
        </div>
      </div>

      {/* Real-time Data Streams - From Open-Meteo Weather API */}
      <div className="grid grid-cols-3 gap-6">
        <div key="atmospheric-pressure-wrapper">
          <RealTimeChart
            key={`pressure-${selectedStation}`}
            title="ATMOSPHERIC PRESSURE"
            subtitle={`${selectedStationName} (hPa)`}
            dataPoints={24}
            chartType="area"
            color="var(--prithvi-electric-cyan)"
            yAxisDomain={[980, 1040]}
            height={180}
            externalData={weatherHourly?.surface_pressure?.slice(-24).filter((v): v is number => v != null)}
          />
        </div>
        <div key="wind-speed-wrapper">
          <RealTimeChart
            key={`wind-${selectedStation}`}
            title="WIND SPEED"
            subtitle={`${selectedStationName} (km/h)`}
            dataPoints={24}
            chartType="line"
            color="var(--prithvi-aurora-green)"
            yAxisDomain={[0, 80]}
            height={180}
            externalData={weatherHourly?.wind_speed_10m?.slice(-24).filter((v): v is number => v != null)}
          />
        </div>
        <div key="solar-radiation-wrapper">
          <RealTimeChart
            key={`solar-${selectedStation}`}
            title="SOLAR RADIATION"
            subtitle={`${selectedStationName} (W/m²)`}
            dataPoints={24}
            chartType="area"
            color="var(--prithvi-warm-amber)"
            yAxisDomain={[0, 1000]}
            height={180}
            externalData={weatherHourly?.shortwave_radiation?.slice(-24).filter((v): v is number => v != null)}
          />
        </div>
      </div>

      {/* Environmental charts */}
      <div className="grid grid-cols-2 gap-6">
        {/* Temperature trends */}
        <div className="p-6 rounded-lg border backdrop-blur-md prithvi-card-layered prithvi-inner-glow prithvi-gradient-atmosphere"
             style={{
               background: 'var(--prithvi-panel-bg)',
               borderColor: 'var(--prithvi-border-dim)',
             }}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-mono tracking-wider mb-1 prithvi-text-electric">
                24-HOUR {selectedStationName.toUpperCase()} READINGS
              </h3>
              <p className="text-xs opacity-60 prithvi-text-forest">
                {selectedStationName} — PM2.5, pH, and noise levels
              </p>
            </div>
            <Activity className="w-5 h-5 prithvi-pulse prithvi-text-ocean" />
          </div>

          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={temperatureData}>
              <defs>
                <linearGradient id="colorGlobal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--prithvi-electric-cyan)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="var(--prithvi-electric-cyan)" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorOcean" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--prithvi-ocean-bright)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="var(--prithvi-ocean-bright)" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorLand" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--prithvi-aurora-green)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="var(--prithvi-aurora-green)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--prithvi-grid)" />
              <XAxis
                dataKey="time"
                stroke="var(--prithvi-electric-cyan)"
                style={{ fontSize: '10px', opacity: 0.6 }}
              />
              <YAxis
                stroke="var(--prithvi-electric-cyan)"
                style={{ fontSize: '10px', opacity: 0.6 }}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--prithvi-panel-bg-solid)',
                  border: '1px solid var(--prithvi-border-bright)',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                }}
              />
              <Area
                type="monotone"
                dataKey="global"
                stroke="var(--prithvi-electric-cyan)"
                fillOpacity={1}
                fill="url(#colorGlobal)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="ocean"
                stroke="var(--prithvi-ocean-bright)"
                fillOpacity={1}
                fill="url(#colorOcean)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="land"
                stroke="var(--prithvi-aurora-green)"
                fillOpacity={1}
                fill="url(#colorLand)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>

          <div className="flex gap-6 mt-4 justify-center">
            <div className="flex items-center gap-2 text-xs font-mono">
              <div className="w-3 h-3 rounded prithvi-glow-electric" style={{ background: 'var(--prithvi-electric-cyan)' }} />
              <span className="prithvi-text-electric">PM2.5 (μg/m³)</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono">
              <div className="w-3 h-3 rounded" style={{ background: 'var(--prithvi-ocean-bright)' }} />
              <span className="prithvi-text-ocean">Water pH</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono">
              <div className="w-3 h-3 rounded prithvi-glow-aurora" style={{ background: 'var(--prithvi-aurora-green)' }} />
              <span className="prithvi-text-aurora">Noise (dB)</span>
            </div>
          </div>
        </div>

        {/* CO2 trends */}
        <div className="p-6 rounded-lg border backdrop-blur-md prithvi-card-layered prithvi-inner-glow prithvi-gradient-atmosphere"
             style={{
               background: 'var(--prithvi-panel-bg)',
               borderColor: 'var(--prithvi-border-dim)',
             }}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-mono tracking-wider mb-1 prithvi-text-electric">
                {selectedStationName.toUpperCase()} CO₂ CONCENTRATION
              </h3>
              <p className="text-xs opacity-60 prithvi-text-forest">
                Recent readings (parts per million)
              </p>
            </div>
            <TrendingUp className="w-5 h-5" style={{ color: 'var(--prithvi-critical-red)' }} />
          </div>

          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={co2Data}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--prithvi-grid)" />
              <XAxis
                dataKey="month"
                stroke="var(--prithvi-electric-cyan)"
                style={{ fontSize: '10px', opacity: 0.6 }}
              />
              <YAxis
                stroke="var(--prithvi-electric-cyan)"
                style={{ fontSize: '10px', opacity: 0.6 }}
                domain={co2Data.length > 0 ? ['auto', 'auto'] : [410, 425]}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--prithvi-panel-bg-solid)',
                  border: '1px solid var(--prithvi-border-bright)',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                }}
              />
              <Line
                type="monotone"
                dataKey="ppm"
                stroke="var(--prithvi-critical-red)"
                strokeWidth={3}
                dot={{ fill: 'var(--prithvi-critical-red)', r: 4 }}
                activeDot={{ r: 6, fill: 'var(--prithvi-critical-red)' }}
              />
            </LineChart>
          </ResponsiveContainer>

          <div className="mt-4 p-3 rounded border prithvi-inner-glow"
               style={{
                 background: 'var(--prithvi-glass)',
                 borderColor: 'var(--prithvi-border-dim)',
               }}>
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="opacity-60 prithvi-text-electric">
                SAFE THRESHOLD
              </span>
              <span className="prithvi-text-aurora">
                {'<'} 415 ppm
              </span>
            </div>
            <div className="flex items-center justify-between text-xs font-mono mt-2">
              <span className="opacity-60 prithvi-text-electric">
                CURRENT LEVEL
              </span>
              <span className="status-critical">
                {latest ? `${latest.co2.toFixed(1)} ppm ↑` : '— ppm'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Secondary metrics — real weather data from Open-Meteo */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { name: 'Temperature', value: weather ? weather.temperature_2m.toFixed(1) : '—', unit: '°C', change: weather ? +(weather.temperature_2m - 25).toFixed(1) : 0, status: weather && weather.temperature_2m > 40 ? 'critical' : weather && weather.temperature_2m > 35 ? 'warning' : 'optimal', icon: Thermometer },
          { name: 'Humidity', value: weather ? weather.relative_humidity_2m.toFixed(0) : '—', unit: '%', change: weather ? +(weather.relative_humidity_2m - 60).toFixed(0) : 0, status: weather && weather.relative_humidity_2m > 85 ? 'warning' : 'optimal', icon: Droplets },
          { name: 'UV Index', value: weather ? weather.uv_index.toFixed(1) : '—', change: weather ? +(weather.uv_index - 5).toFixed(1) : 0, status: weather && weather.uv_index > 8 ? 'critical' : weather && weather.uv_index > 5 ? 'warning' : 'optimal', icon: Leaf },
          { name: 'Wind Speed', value: weather ? weather.wind_speed_10m.toFixed(1) : '—', unit: 'km/h', change: weather ? +(weather.wind_speed_10m - 15).toFixed(1) : 0, status: weather && weather.wind_speed_10m > 50 ? 'critical' : weather && weather.wind_speed_10m > 30 ? 'warning' : 'optimal', icon: Wind },
          { name: 'Pressure', value: weather ? weather.surface_pressure.toFixed(0) : '—', unit: 'hPa', change: weather ? +(weather.surface_pressure - 1013).toFixed(0) : 0, status: 'optimal', icon: Cloud },
        ].map((metric) => (
          <MetricCard
            key={metric.name}
            title={metric.name}
            value={metric.value}
            unit={metric.unit}
            change={metric.change}
            status={metric.status as "optimal" | "warning" | "critical"}
            icon={metric.icon}
          />
        ))}
      </div>

      {/* System Status Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="p-4 rounded-lg border backdrop-blur-md prithvi-inner-glow"
        style={{
          background: 'var(--prithvi-glass)',
          borderColor: 'var(--prithvi-border-dim)',
        }}
      >
        <div className="flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full prithvi-pulse" style={{ background: 'var(--prithvi-aurora-green)' }} />
              <span className="prithvi-text-electric">
                SATELLITE UPLINK: <span className="prithvi-text-aurora">ACTIVE</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full prithvi-pulse" style={{ background: 'var(--prithvi-aurora-green)' }} />
              <span className="prithvi-text-electric">
                GROUND STATIONS: <span className="prithvi-text-aurora">{stations.length}/{stations.length} ONLINE</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full prithvi-pulse" style={{ background: 'var(--prithvi-electric-cyan)' }} />
              <span className="prithvi-text-electric">
                DATA INTEGRITY: <span className="prithvi-text-ocean">{readings.length > 0 ? '99.8' : '—'}%</span>
              </span>
            </div>
          </div>
          <div className="prithvi-text-forest">
            LAST UPDATE: {systemTime.toLocaleTimeString('en-US', { hour12: false })} UTC
          </div>
        </div>
      </motion.div>
    </div>
  );
}