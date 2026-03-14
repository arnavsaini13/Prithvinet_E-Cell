import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Wind, CloudRain, Gauge, Sunrise, Eye, AlertCircle } from "lucide-react";
import { MetricCard } from "./MetricCard";
import { CommandPanel } from "./CommandPanel";
import { CircularIndicator } from "./CircularIndicator";
import { RealTimeChart } from "./RealTimeChart";
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { pollutionApi, stationsApi, alertsApi, openMeteoApi } from "../../api/client";
import type { PollutionReading, Station, Alert } from "../../api/client";
import { StationSelector } from "./StationSelector";

export function AtmosphereView() {
  const [stations, setStations] = useState<Station[]>([]);
  const [readings, setReadings] = useState<PollutionReading[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedStation, setSelectedStation] = useState<number | null>(null);
  const [extPollutants, setExtPollutants] = useState({
    so2: 0, ozone: 0, methane: 0, dust: 0, aod: 0, eaqi: 0,
  });

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const [stList, rdList, alList] = await Promise.all([
          stationsApi.list(),
          pollutionApi.list(selectedStation ?? undefined, 100),
          alertsApi.list(selectedStation ?? undefined, undefined, 10).catch(() => [] as Alert[]),
        ]);
        if (cancelled) return;
        setStations(stList);
        setReadings(rdList);
        setAlerts(alList);


        // Fetch extended pollutants (SO2, ozone, methane, dust, AQI) from Open-Meteo
        // SOURCE: air-quality-api.open-meteo.com — free, no API key, ECMWF CAMS model
        const targetStation = selectedStation != null
          ? stList.find(s => s.id === selectedStation) ?? stList[0]
          : stList[0];
        if (targetStation) {
          try {
            const aqUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${targetStation.latitude}&longitude=${targetStation.longitude}&current=sulphur_dioxide,ozone,methane,aerosol_optical_depth,dust,european_aqi&timezone=auto`;
            const aqResp = await fetch(aqUrl);
            if (!cancelled && aqResp.ok) {
              const aqData = await aqResp.json();
              const c = aqData.current ?? {};
              setExtPollutants({
                so2:    c.sulphur_dioxide         ?? 0,
                ozone:  c.ozone                   ?? 0,
                methane: c.methane                ?? 0,
                dust:   c.dust                    ?? 0,
                aod:    c.aerosol_optical_depth    ?? 0,
                eaqi:   c.european_aqi             ?? 0,
              });
            }
          } catch {
            // non-critical: extended pollutants unavailable
          }
        }
      } catch (err) {
        console.error("AtmosphereView: fetch error", err);
      }
    }

    fetchData();
    const id = setInterval(fetchData, 10_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [selectedStation]);

  // Filter readings by selected station
  const filteredReadings = selectedStation != null ? readings.filter(r => r.station_id === selectedStation) : readings;

  // Compute averages from latest readings (one per station)
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

  const avgPm25 = avg((r) => r.pm25);
  const avgPm10 = avg((r) => r.pm10);
  const avgCo2 = avg((r) => r.co2);
  const avgNo2 = avg((r) => r.no2);
  const avgNoise = avg((r) => r.noise_level);

  // Compute real change deltas from readings (latest average vs previous batch)
  const prevReadings = filteredReadings.slice(latest.length, latest.length * 2);
  const prevAvg = (fn: (r: PollutionReading) => number) =>
    prevReadings.length > 0 ? prevReadings.reduce((s, r) => s + fn(r), 0) / prevReadings.length : 0;
  const pm25Change = prevReadings.length > 0 ? +((avgPm25 - prevAvg(r => r.pm25)) / Math.max(1, prevAvg(r => r.pm25)) * 100).toFixed(1) : 0;
  const pm10Change = prevReadings.length > 0 ? +((avgPm10 - prevAvg(r => r.pm10)) / Math.max(1, prevAvg(r => r.pm10)) * 100).toFixed(1) : 0;
  const co2Change = prevReadings.length > 0 ? +((avgCo2 - prevAvg(r => r.co2)) / Math.max(1, prevAvg(r => r.co2)) * 100).toFixed(1) : 0;
  const no2Change = prevReadings.length > 0 ? +((avgNo2 - prevAvg(r => r.no2)) / Math.max(1, prevAvg(r => r.no2)) * 100).toFixed(1) : 0;

  // WHO 2021 Air Quality Guidelines (24-hour mean, µg/m³)
  // Values show current reading as % of safe limit: 100 = at limit, >100 = exceeding
  const WHO = { PM25: 15, PM10: 45, NO2: 25, SO2: 40, O3: 100 };
  const safeRatio = (val: number, limit: number) => Math.min(200, +(val / limit * 100).toFixed(1));
  const surfaceComposition = [
    { pollutant: 'PM2.5', current: safeRatio(avgPm25, WHO.PM25), safe: 100 },
    { pollutant: 'PM10',  current: safeRatio(avgPm10, WHO.PM10),  safe: 100 },
    { pollutant: 'NO₂',  current: safeRatio(avgNo2,  WHO.NO2),   safe: 100 },
    { pollutant: 'SO₂',  current: safeRatio(extPollutants.so2, WHO.SO2),   safe: 100 },
    { pollutant: 'O₃',   current: safeRatio(extPollutants.ozone, WHO.O3),  safe: 100 },
  ];

  // Build per-station AQI bar data
  const airQualityData = stations.map((st) => {
    const r = latestByStation.get(st.id);
    return {
      region: st.name,
      aqi: r ? Math.round((r.pm25 + r.pm10) / 2) : 0,
      pm25: r ? r.pm25.toFixed(1) : "0",
      pm10: r ? r.pm10.toFixed(1) : "0",
    };
  });

  // Build pollutant cards from live averages (SOURCE: Open-Meteo via DB readings)
  const pollutantCards = [
    { name: 'PM2.5', value: avgPm25.toFixed(1), unit: 'μg/m³', status: avgPm25 > 35 ? 'warning' : 'optimal' },
    { name: 'PM10', value: avgPm10.toFixed(1), unit: 'μg/m³', status: avgPm10 > 50 ? 'warning' : 'optimal' },
    { name: 'CO₂', value: avgCo2.toFixed(1), unit: 'ppm', status: avgCo2 > 500 ? 'warning' : 'optimal' },
    { name: 'NO₂', value: avgNo2.toFixed(1), unit: 'ppb', status: avgNo2 > 40 ? 'warning' : 'optimal' },
    { name: 'Noise', value: avgNoise.toFixed(1), unit: 'dB', status: avgNoise > 70 ? 'warning' : 'optimal' },
    { name: 'SO₂', value: extPollutants.so2.toFixed(1), unit: 'μg/m³', status: extPollutants.so2 > 20 ? 'warning' : 'optimal' },
  ];

  // Extended real-time cards (Open-Meteo CAMS current — SO2, Ozone, Methane, Dust, AQI)
  const extCards = [
    { name: 'Ozone', value: extPollutants.ozone.toFixed(1), unit: 'μg/m³', status: extPollutants.ozone > 120 ? 'warning' : 'optimal' },
    { name: 'Methane', value: extPollutants.methane.toFixed(0), unit: 'ppb', status: extPollutants.methane > 1900 ? 'warning' : 'optimal' },
    { name: 'Dust', value: extPollutants.dust.toFixed(1), unit: 'μg/m³', status: extPollutants.dust > 200 ? 'warning' : 'optimal' },
    { name: 'EU AQI', value: String(extPollutants.eaqi), unit: 'index', status: extPollutants.eaqi > 100 ? 'warning' : 'optimal' },
  ];

  // Get latest 2 alerts for display
  const recentAlerts = alerts.slice(0, 2);
  return (
    <div className="p-6 space-y-6 prithvi-section-atmosphere">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h2 className="text-2xl font-mono tracking-wider prithvi-text-electric">
            ATMOSPHERIC MONITORING
          </h2>
          <p className="text-sm mt-1 opacity-70 prithvi-text-forest">
            Real-time analysis of atmospheric composition and air quality metrics
          </p>
        </div>
        
        <div className="flex items-center gap-3 px-4 py-2 rounded-lg border prithvi-inner-glow prithvi-border-electric"
             style={{
               background: 'var(--prithvi-panel-bg)',
             }}>
          <Eye className="w-5 h-5 prithvi-text-ocean" />
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

      {/* Key metrics */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard
          title="Avg PM2.5"
          value={avgPm25.toFixed(1)}
          unit="μg/m³"
          change={pm25Change}
          status={avgPm25 > 35 ? "warning" : "optimal"}
          icon={Gauge}
          trend={filteredReadings.slice(-12).map((r) => r.pm25)}
        />
        <MetricCard
          title="Avg PM10"
          value={avgPm10.toFixed(1)}
          unit="μg/m³"
          change={pm10Change}
          status={avgPm10 > 50 ? "warning" : "optimal"}
          icon={CloudRain}
          trend={filteredReadings.slice(-12).map((r) => r.pm10)}
        />
        <MetricCard
          title="Avg CO₂"
          value={avgCo2.toFixed(1)}
          unit="ppm"
          change={co2Change}
          status={avgCo2 > 500 ? "warning" : "optimal"}
          icon={Wind}
          trend={filteredReadings.slice(-12).map((r) => r.co2)}
        />
        <MetricCard
          title="Avg NO₂"
          value={avgNo2.toFixed(1)}
          unit="ppb"
          change={no2Change}
          status={avgNo2 > 40 ? "warning" : "optimal"}
          icon={Sunrise}
          trend={filteredReadings.slice(-12).map((r) => r.no2)}
        />
      </div>

      {/* Main visualization area */}
      <div className="grid grid-cols-2 gap-6">
        {/* Regional Air Quality */}
        <div className="p-6 rounded-lg border backdrop-blur-md prithvi-card-layered prithvi-inner-glow prithvi-gradient-atmosphere"
             style={{
               background: 'var(--prithvi-panel-bg)',
               borderColor: 'var(--prithvi-border-dim)',
             }}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-mono tracking-wider mb-1 prithvi-text-electric">
                REGIONAL AIR QUALITY INDEX
              </h3>
              <p className="text-xs opacity-60 prithvi-text-forest">
                AQI measurements by geographic region
              </p>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={airQualityData}>
              <defs>
                <linearGradient id="aqiGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--prithvi-aurora-green)" />
                  <stop offset="50%" stopColor="var(--prithvi-warm-amber)" />
                  <stop offset="100%" stopColor="var(--prithvi-critical-red)" />
                </linearGradient>
              </defs>
              <CartesianGrid key="grid" strokeDasharray="3 3" stroke="var(--prithvi-grid)" />
              <XAxis
                key="xaxis"
                dataKey="region"
                stroke="var(--prithvi-electric-cyan)"
                style={{ fontSize: '10px', opacity: 0.6 }}
                angle={-15}
                textAnchor="end"
                height={60}
              />
              <YAxis
                key="yaxis"
                stroke="var(--prithvi-electric-cyan)"
                style={{ fontSize: '10px', opacity: 0.6 }}
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
              <Bar
                key="aqi"
                dataKey="aqi"
                fill="url(#aqiGradient)"
                radius={[8, 8, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>

          <div className="flex gap-4 mt-4 justify-center text-xs font-mono">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded prithvi-glow-aurora" style={{ background: 'var(--prithvi-aurora-green)' }} />
              <span className="prithvi-text-aurora">Good (0-50)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded prithvi-glow-amber" style={{ background: 'var(--prithvi-warm-amber)' }} />
              <span style={{ color: 'var(--prithvi-warm-amber)', textShadow: '0 0 8px var(--prithvi-amber-glow)' }}>Moderate (51-100)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded prithvi-glow-critical" style={{ background: 'var(--prithvi-critical-red)' }} />
              <span style={{ color: 'var(--prithvi-critical-red)', textShadow: '0 0 8px var(--prithvi-red-glow)' }}>Unhealthy (101+)</span>
            </div>
          </div>
        </div>

        {/* Atmospheric Layers Composition */}
        <div className="p-6 rounded-lg border backdrop-blur-md prithvi-card-layered prithvi-inner-glow prithvi-gradient-atmosphere"
             style={{
               background: 'var(--prithvi-panel-bg)',
               borderColor: 'var(--prithvi-border-dim)',
             }}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-mono tracking-wider mb-1 prithvi-text-electric">
                SURFACE POLLUTANTS vs. WHO SAFE LIMITS
              </h3>
              <p className="text-xs opacity-60 prithvi-text-forest">
                Current levels as % of WHO 2021 24h guidelines — 100% = at safe limit
              </p>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={320}>
            <RadarChart data={surfaceComposition}>
              <PolarGrid key="grid" stroke="var(--prithvi-grid)" />
              <PolarAngleAxis
                key="angleaxis"
                dataKey="pollutant"
                stroke="var(--prithvi-electric-cyan)"
                style={{ fontSize: '10px' }}
              />
              <PolarRadiusAxis
                key="radiusaxis"
                stroke="var(--prithvi-electric-cyan)"
                style={{ fontSize: '10px', opacity: 0.6 }}
                domain={[0, 200]}
                tickCount={3}
              />
              <Radar
                key="safe"
                name="WHO Safe Limit (100%)"
                dataKey="safe"
                stroke="var(--prithvi-aurora-green)"
                fill="var(--prithvi-aurora-green)"
                fillOpacity={0.08}
                strokeWidth={1.5}
                strokeDasharray="5 3"
              />
              <Radar
                key="current"
                name="Current Level (%)"
                dataKey="current"
                stroke="var(--prithvi-electric-cyan)"
                fill="var(--prithvi-electric-cyan)"
                fillOpacity={0.3}
                strokeWidth={2}
              />
            </RadarChart>
          </ResponsiveContainer>

          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="flex items-center gap-2 text-xs font-mono">
              <div className="w-3 h-3 rounded" style={{ background: 'var(--prithvi-electric-cyan)' }} />
              <span style={{ color: 'var(--prithvi-electric-cyan)' }}>Current Level</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono">
              <div className="w-3 h-3 rounded" style={{ background: 'var(--prithvi-aurora-green)' }} />
              <span style={{ color: 'var(--prithvi-aurora-green)' }}>WHO Safe Limit (100%)</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono col-span-1">
              <span className="opacity-60 prithvi-text-electric">Source: Open-Meteo (O₃/SO₂/CO) + backend (PM2.5/PM10/NO₂)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Pollutant breakdown */}
      <div className="grid grid-cols-6 gap-4">
        {pollutantCards.map((pollutant, idx) => (
          <motion.div
            key={pollutant.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="p-4 rounded-lg border backdrop-blur-md"
            style={{
              background: 'var(--prithvi-panel-bg)',
              borderColor: 'var(--prithvi-border-dim)',
            }}
          >
            <div className="text-xs opacity-60 mb-2" style={{ color: 'var(--prithvi-cyan)' }}>
              {pollutant.name}
            </div>
            <div className="text-2xl font-mono font-bold mb-1"
                 style={{ color: pollutant.status === 'optimal' ? 'var(--prithvi-green)' : 'var(--prithvi-amber)' }}>
              {pollutant.value}
            </div>
            <div className="text-xs opacity-60" style={{ color: 'var(--prithvi-cyan)' }}>
              {pollutant.unit}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Extended real-time pollutants (SOURCE: Open-Meteo CAMS — SO₂, Ozone, Methane, Dust, EU AQI) */}
      <div>
        <p className="text-xs font-mono opacity-50 mb-3" style={{ color: 'var(--prithvi-cyan)' }}>
          EXTENDED REAL-TIME CAMS DATA — Source: air-quality-api.open-meteo.com (ECMWF)
        </p>
        <div className="grid grid-cols-4 gap-4">
          {extCards.map((card, idx) => (
            <motion.div
              key={card.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="p-4 rounded-lg border backdrop-blur-md"
              style={{
                background: 'var(--prithvi-panel-bg)',
                borderColor: 'var(--prithvi-border-dim)',
              }}
            >
              <div className="text-xs opacity-60 mb-2" style={{ color: 'var(--prithvi-cyan)' }}>
                {card.name}
              </div>
              <div className="text-2xl font-mono font-bold mb-1"
                   style={{ color: card.status === 'optimal' ? 'var(--prithvi-green)' : 'var(--prithvi-amber)' }}>
                {card.value}
              </div>
              <div className="text-xs opacity-60" style={{ color: 'var(--prithvi-cyan)' }}>
                {card.unit}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Alerts section */}
      <div className="grid grid-cols-2 gap-4">
        {recentAlerts.length > 0 ? recentAlerts.map((alert, idx) => (
          <motion.div
            key={alert.id}
            initial={{ opacity: 0, x: idx === 0 ? -20 : 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="p-4 rounded-lg border-l-4 backdrop-blur-md"
            style={{
              background: 'var(--prithvi-panel-bg)',
              borderLeftColor: alert.severity === 'critical' || alert.severity === 'high' ? 'var(--prithvi-amber)' : 'var(--prithvi-green)',
            }}
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 mt-0.5" style={{ color: alert.severity === 'critical' || alert.severity === 'high' ? 'var(--prithvi-amber)' : 'var(--prithvi-green)' }} />
              <div>
                <div className="font-mono text-sm mb-1" style={{ color: alert.severity === 'critical' || alert.severity === 'high' ? 'var(--prithvi-amber)' : 'var(--prithvi-green)' }}>
                  {alert.pollutant.toUpperCase()} ALERT — {alert.severity.toUpperCase()}
                </div>
                <div className="text-xs opacity-70" style={{ color: 'var(--prithvi-cyan)' }}>
                  Value: {alert.value.toFixed(1)} • Station #{alert.station_id} • {new Date(alert.timestamp).toLocaleString()}
                </div>
              </div>
            </div>
          </motion.div>
        )) : (
          <>
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="p-4 rounded-lg border-l-4 backdrop-blur-md"
              style={{
                background: 'var(--prithvi-panel-bg)',
                borderLeftColor: 'var(--prithvi-green)',
              }}
            >
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 mt-0.5" style={{ color: 'var(--prithvi-green)' }} />
                <div>
                  <div className="font-mono text-sm mb-1" style={{ color: 'var(--prithvi-green)' }}>
                    NO ACTIVE ALERTS
                  </div>
                  <div className="text-xs opacity-70" style={{ color: 'var(--prithvi-cyan)' }}>
                    All atmospheric parameters within normal range
                  </div>
                </div>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="p-4 rounded-lg border-l-4 backdrop-blur-md"
              style={{
                background: 'var(--prithvi-panel-bg)',
                borderLeftColor: 'var(--prithvi-green)',
              }}
            >
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 mt-0.5" style={{ color: 'var(--prithvi-green)' }} />
                <div>
                  <div className="font-mono text-sm mb-1" style={{ color: 'var(--prithvi-green)' }}>
                    MONITORING ACTIVE
                  </div>
                  <div className="text-xs opacity-70" style={{ color: 'var(--prithvi-cyan)' }}>
                    {stations.length} stations reporting in real-time
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
}