/**
 * RegionalDashboard — for regional_officer role only.
 * Shows environmental data scoped exclusively to the officer's assigned region.
 * Tabs: Overview | Monitoring | Forecast | Take Actions (Gemini AI)
 */

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import {
  Wind, Droplets, Volume2, AlertTriangle, Activity,
  MapPin, Brain, Zap, RefreshCw, CheckCircle, Info,
  TrendingUp, Eye, AlertCircle, Leaf, Waves, Factory,
  MessageSquare, Clock, User, FileText, ChevronDown,
} from "lucide-react";
import {
  stationsApi, pollutionApi, riskApi, alertsApi, forecastApi, regionalApi, complaintsApi,
  type Station, type PollutionReading, type RiskScore, type Alert,
  type ForecastOut, type AIAlert, type Complaint,
} from "../../api/client";
import { useAuth } from "../context/AuthContext";

// ── Helpers ────────────────────────────────────────────────────

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function fmtVal(v: number | undefined, dec = 1) {
  return v !== undefined ? v.toFixed(dec) : "—";
}

const POLLUTANTS = [
  { key: "pm25",    label: "PM2.5",     unit: "µg/m³" },
  { key: "pm10",    label: "PM10",      unit: "µg/m³" },
  { key: "co2",     label: "CO2",       unit: "ppm"   },
  { key: "no2",     label: "NO2",       unit: "µg/m³" },
] as const;

const WATER_PARAMS = [
  { key: "ph",               label: "pH",          unit: "" },
  { key: "turbidity",        label: "Turbidity",    unit: "NTU" },
  { key: "dissolved_oxygen", label: "Dissolved O₂", unit: "mg/L" },
] as const;

const TAB_FORECAST_OPTS = [
  { key: "pm25", label: "PM2.5" },
  { key: "pm10", label: "PM10"  },
  { key: "co2",  label: "CO2"   },
  { key: "no2",  label: "NO2"   },
  { key: "ph",   label: "pH"    },
  { key: "noise_level", label: "Noise" },
];

function riskColor(level: string) {
  if (level === "critical") return "var(--prithvi-critical-red)";
  if (level === "high")     return "var(--prithvi-warm-amber)";
  if (level === "moderate") return "var(--prithvi-electric-cyan)";
  return "var(--prithvi-aurora-green)";
}

function severityColor(s: string) {
  if (s === "critical") return { bg: "rgba(211,47,47,0.15)", border: "var(--prithvi-critical-red)", text: "var(--prithvi-critical-red)" };
  if (s === "high")     return { bg: "rgba(245,124,0,0.12)", border: "var(--prithvi-warm-amber)", text: "#ffb74d" };
  if (s === "medium")   return { bg: "rgba(0,200,255,0.1)", border: "var(--prithvi-electric-cyan)", text: "var(--prithvi-electric-cyan)" };
  return { bg: "rgba(0,255,136,0.1)", border: "var(--prithvi-aurora-green)", text: "var(--prithvi-aurora-green)" };
}

function categoryIcon(cat: string) {
  if (cat === "air_quality")   return <Wind className="w-4 h-4" />;
  if (cat === "water_quality") return <Droplets className="w-4 h-4" />;
  if (cat === "noise")         return <Volume2 className="w-4 h-4" />;
  if (cat === "industrial")    return <Factory className="w-4 h-4" />;
  return <Leaf className="w-4 h-4" />;
}

// ── Custom tooltip ─────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border px-3 py-2 text-xs font-mono"
         style={{ background: "var(--prithvi-panel-bg-solid)", borderColor: "var(--prithvi-border-bright)" }}>
      <p className="prithvi-text-electric opacity-60 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: {typeof p.value === "number" ? p.value.toFixed(2) : p.value}</p>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// Tab: Overview
// ══════════════════════════════════════════════════════════════════

function OverviewTab({ station, risk, latestReading, alerts }: {
  station: Station;
  risk: RiskScore | null;
  latestReading: PollutionReading | null;
  alerts: Alert[];
}) {
  if (!latestReading) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="font-mono prithvi-text-electric opacity-50">No readings available yet.</p>
      </div>
    );
  }

  const riskLevel = risk?.risk_level ?? "unknown";
  const rCol = riskColor(riskLevel);

  return (
    <div className="space-y-6">
      {/* Station hero */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border p-6"
        style={{ background: "var(--prithvi-glass)", borderColor: "var(--prithvi-border-bright)" }}
      >
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <MapPin className="w-4 h-4 prithvi-text-aurora" />
              <h2 className="text-xl font-bold font-mono prithvi-text-aurora">{station.name}</h2>
            </div>
            <p className="text-xs font-mono opacity-50 prithvi-text-electric">
              {station.latitude.toFixed(4)}°N, {station.longitude.toFixed(4)}°E · Region: {station.region}
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs font-mono opacity-50 prithvi-text-electric mb-1">OVERALL RISK</div>
            <div className="text-3xl font-bold font-mono" style={{ color: rCol }}>
              {risk?.overall_risk?.toFixed(1) ?? "—"}<span className="text-base opacity-50">/100</span>
            </div>
            <div className="text-xs font-mono uppercase tracking-widest mt-0.5" style={{ color: rCol }}>
              {riskLevel}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Risk index cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "AIR RISK", value: risk?.air_quality_index, icon: Wind,         col: "var(--prithvi-aurora-green)" },
          { label: "WATER RISK",  value: risk?.water_quality_index, icon: Droplets, col: "var(--prithvi-ocean-bright)" },
          { label: "NOISE RISK",  value: risk?.noise_index,         icon: Volume2,  col: "var(--prithvi-warm-amber)" },
          { label: "OVERALL",     value: risk?.overall_risk,        icon: AlertTriangle, col: rCol },
        ].map((card, i) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="rounded-xl p-5 border"
              style={{ background: "var(--prithvi-glass)", borderColor: "var(--prithvi-border-dim)" }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Icon className="w-4 h-4" style={{ color: card.col }} />
                <span className="text-[10px] font-mono tracking-wider opacity-60 prithvi-text-electric">{card.label}</span>
              </div>
              <div className="text-2xl font-bold font-mono" style={{ color: card.col }}>
                {card.value !== undefined ? card.value.toFixed(1) : "—"}
                <span className="text-sm opacity-50">/100</span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Pollutant grid */}
      <div>
        <h3 className="text-xs font-mono tracking-wider opacity-50 prithvi-text-electric mb-3">CURRENT READINGS</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "PM2.5",      value: latestReading.pm25,             unit: "µg/m³", threshold: 15  },
            { label: "PM10",       value: latestReading.pm10,             unit: "µg/m³", threshold: 45  },
            { label: "CO2",        value: latestReading.co2,              unit: "ppm",   threshold: 1000 },
            { label: "NO2",        value: latestReading.no2,              unit: "µg/m³", threshold: 25  },
            { label: "pH",         value: latestReading.ph,               unit: "",      threshold: null },
            { label: "Turbidity",  value: latestReading.turbidity,        unit: "NTU",   threshold: 4   },
            { label: "Dissolved O₂", value: latestReading.dissolved_oxygen, unit: "mg/L", threshold: null },
            { label: "Noise",      value: latestReading.noise_level,      unit: "dB",    threshold: 55  },
          ].map((item, i) => {
            const over = item.threshold !== null
              ? (item.label === "Dissolved O₂" ? item.value < 6 : item.label === "pH" ? false : item.value > item.threshold)
              : false;
            const col = over ? "var(--prithvi-critical-red)" : "var(--prithvi-aurora-green)";
            return (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 + i * 0.04 }}
                className="rounded-lg p-3 border"
                style={{ background: "var(--prithvi-glass)", borderColor: over ? "var(--prithvi-critical-red)" : "var(--prithvi-border-dim)" }}
              >
                <div className="text-[10px] font-mono tracking-wider opacity-50 prithvi-text-electric mb-1">{item.label}</div>
                <div className="text-lg font-bold font-mono" style={{ color: col }}>
                  {fmtVal(item.value, item.label === "CO2" ? 0 : 2)}
                </div>
                <div className="text-[10px] font-mono opacity-40 prithvi-text-electric">{item.unit}</div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Recent alerts from sensor data */}
      {alerts.length > 0 && (
        <div>
          <h3 className="text-xs font-mono tracking-wider opacity-50 prithvi-text-electric mb-3">RECENT SENSOR ALERTS</h3>
          <div className="space-y-2">
            {alerts.slice(0, 5).map((a, i) => (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-3 px-4 py-3 rounded-lg border"
                style={{
                  background: "var(--prithvi-glass)",
                  borderColor: a.severity === "critical" ? "var(--prithvi-critical-red)" : "var(--prithvi-border-dim)",
                }}
              >
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: riskColor(a.severity) }} />
                <span className="text-xs font-mono prithvi-text-electric flex-1">
                  <span className="uppercase font-bold" style={{ color: riskColor(a.severity) }}>{a.severity}</span>
                  {" · "}{a.pollutant.toUpperCase()} = {a.value.toFixed(1)}
                </span>
                <span className="text-[10px] font-mono opacity-40 prithvi-text-electric">{fmtTime(a.timestamp)}</span>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// Tab: Monitoring
// ══════════════════════════════════════════════════════════════════

function MonitoringTab({ readings }: { readings: PollutionReading[] }) {
  const chartData = [...readings].reverse().map(r => ({
    time: fmtTime(r.timestamp),
    pm25: +r.pm25.toFixed(2),
    pm10: +r.pm10.toFixed(2),
    co2:  +r.co2.toFixed(1),
    no2:  +r.no2.toFixed(2),
    ph:   +r.ph.toFixed(2),
    turbidity: +r.turbidity.toFixed(2),
    dissolved_oxygen: +r.dissolved_oxygen.toFixed(2),
    noise: +r.noise_level.toFixed(1),
  }));

  const chartStyle = {
    background: "var(--prithvi-glass)",
    border: "1px solid var(--prithvi-border-dim)",
    borderRadius: "12px",
    padding: "20px",
  };

  return (
    <div className="space-y-6">
      {/* Air Quality */}
      <div style={chartStyle}>
        <h3 className="text-xs font-mono tracking-wider opacity-60 prithvi-text-electric mb-4 flex items-center gap-2">
          <Wind className="w-3.5 h-3.5 prithvi-text-aurora" /> AIR QUALITY — PM2.5 & PM10
        </h3>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="pm25g" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--prithvi-aurora-green)" stopOpacity={0.4} />
                <stop offset="100%" stopColor="var(--prithvi-aurora-green)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="pm10g" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--prithvi-electric-cyan)" stopOpacity={0.4} />
                <stop offset="100%" stopColor="var(--prithvi-electric-cyan)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="time" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10, fontFamily: "monospace" }} />
            <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10, fontFamily: "monospace" }} />
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 10, fontFamily: "monospace", color: "rgba(255,255,255,0.5)" }} />
            <Area type="monotone" dataKey="pm25" stroke="var(--prithvi-aurora-green)" fill="url(#pm25g)" name="PM2.5 µg/m³" strokeWidth={2} dot={false} />
            <Area type="monotone" dataKey="pm10" stroke="var(--prithvi-electric-cyan)" fill="url(#pm10g)" name="PM10 µg/m³" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* CO2 & NO2 */}
      <div style={chartStyle}>
        <h3 className="text-xs font-mono tracking-wider opacity-60 prithvi-text-electric mb-4 flex items-center gap-2">
          <Activity className="w-3.5 h-3.5" style={{ color: "var(--prithvi-warm-amber)" }} /> GAS LEVELS — CO2 & NO2
        </h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="time" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10, fontFamily: "monospace" }} />
            <YAxis yAxisId="co2" orientation="left" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10, fontFamily: "monospace" }} />
            <YAxis yAxisId="no2" orientation="right" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10, fontFamily: "monospace" }} />
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 10, fontFamily: "monospace", color: "rgba(255,255,255,0.5)" }} />
            <Line yAxisId="co2" type="monotone" dataKey="co2" stroke="var(--prithvi-warm-amber)" name="CO2 ppm" strokeWidth={2} dot={false} />
            <Line yAxisId="no2" type="monotone" dataKey="no2" stroke="var(--prithvi-critical-red)" name="NO2 µg/m³" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Water Quality */}
      <div style={chartStyle}>
        <h3 className="text-xs font-mono tracking-wider opacity-60 prithvi-text-electric mb-4 flex items-center gap-2">
          <Droplets className="w-3.5 h-3.5 prithvi-text-ocean" /> WATER QUALITY
        </h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="time" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10, fontFamily: "monospace" }} />
            <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10, fontFamily: "monospace" }} />
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 10, fontFamily: "monospace", color: "rgba(255,255,255,0.5)" }} />
            <Line type="monotone" dataKey="ph" stroke="var(--prithvi-ocean-bright)" name="pH" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="turbidity" stroke="var(--prithvi-warm-amber)" name="Turbidity NTU" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="dissolved_oxygen" stroke="var(--prithvi-aurora-green)" name="DO mg/L" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Noise */}
      <div style={chartStyle}>
        <h3 className="text-xs font-mono tracking-wider opacity-60 prithvi-text-electric mb-4 flex items-center gap-2">
          <Volume2 className="w-3.5 h-3.5" style={{ color: "var(--prithvi-warm-amber)" }} /> NOISE LEVEL (dB)
        </h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="time" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10, fontFamily: "monospace" }} />
            <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10, fontFamily: "monospace" }} />
            <Tooltip content={<ChartTooltip />} />
            <Bar dataKey="noise" name="Noise dB" fill="var(--prithvi-warm-amber)" fillOpacity={0.75} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// Tab: Forecast
// ══════════════════════════════════════════════════════════════════

function ForecastTab({ stationId }: { stationId: number }) {
  const [pollutant, setPollutant] = useState("pm25");
  const [forecast, setForecast] = useState<ForecastOut | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (p: string) => {
    setLoading(true);
    try {
      const f = await forecastApi.get(stationId, p, 24);
      setForecast(f);
    } catch {}
    setLoading(false);
  }, [stationId]);

  useEffect(() => { load(pollutant); }, [pollutant, load]);

  const chartData = (forecast?.forecast ?? []).map(pt => ({
    time:  new Date(pt.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
    value: +pt.predicted_value.toFixed(3),
    upper: +pt.upper_bound.toFixed(3),
    lower: +pt.lower_bound.toFixed(3),
  }));

  return (
    <div className="space-y-5">
      {/* Pollutant picker */}
      <div className="flex flex-wrap gap-2">
        {TAB_FORECAST_OPTS.map(opt => (
          <button
            key={opt.key}
            onClick={() => setPollutant(opt.key)}
            className="px-3 py-1.5 rounded-lg text-xs font-mono transition-all"
            style={{
              background: pollutant === opt.key ? "var(--prithvi-electric-cyan)" : "var(--prithvi-glass)",
              color: pollutant === opt.key ? "#000" : "var(--prithvi-atmospheric-teal)",
              border: "1px solid",
              borderColor: pollutant === opt.key ? "var(--prithvi-electric-cyan)" : "var(--prithvi-border-dim)",
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="rounded-xl border p-5"
           style={{ background: "var(--prithvi-glass)", borderColor: "var(--prithvi-border-dim)" }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-mono tracking-wider opacity-60 prithvi-text-electric flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 prithvi-text-electric" />
            24-HOUR FORECAST — {pollutant.toUpperCase()}
          </h3>
          {loading && (
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="w-4 h-4 border-2 rounded-full"
              style={{ borderColor: "var(--prithvi-electric-cyan)", borderTopColor: "transparent" }} />
          )}
        </div>

        {!loading && chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={chartData}>
              <defs>
                <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--prithvi-electric-cyan)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="var(--prithvi-electric-cyan)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="time" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10, fontFamily: "monospace" }} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10, fontFamily: "monospace" }} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="upper" stroke="transparent" fill="url(#forecastGrad)" name="Upper" />
              <Area type="monotone" dataKey="lower" stroke="transparent" fill="white" fillOpacity={0.02} name="Lower" />
              <Line type="monotone" dataKey="value" stroke="var(--prithvi-electric-cyan)" strokeWidth={2.5} dot={false} name="Predicted" />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          !loading && (
            <div className="flex justify-center items-center py-16">
              <p className="text-xs font-mono prithvi-text-electric opacity-40">No forecast data available.</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// Tab: Take Actions (Gemini AI)
// ══════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════
// Tab: Citizen Reports
// ══════════════════════════════════════════════════════════════════

const STATUS_OPTS = ["pending", "under_review", "resolved"] as const;
type ComplaintStatus = typeof STATUS_OPTS[number];

function statusStyle(s: string) {
  if (s === "resolved")    return { bg: "rgba(0,255,136,0.1)", border: "var(--prithvi-aurora-green)", text: "var(--prithvi-aurora-green)" };
  if (s === "under_review") return { bg: "rgba(0,200,255,0.1)", border: "var(--prithvi-electric-cyan)", text: "var(--prithvi-electric-cyan)" };
  return { bg: "rgba(245,124,0,0.1)", border: "var(--prithvi-warm-amber)", text: "#ffb74d" };
}
function statusLabel(s: string) {
  if (s === "under_review") return "Under Review";
  if (s === "resolved") return "Resolved";
  return "Pending";
}

function CitizenReportsSection() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<number | null>(null);

  useEffect(() => {
    complaintsApi.list()
      .then(setComplaints)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const changeStatus = async (id: number, newStatus: string) => {
    setUpdating(id);
    try {
      const updated = await complaintsApi.updateStatus(id, newStatus);
      setComplaints(prev => prev.map(c => c.id === id ? updated : c));
    } catch { /* ignore */ } finally {
      setUpdating(null);
    }
  };

  const pending   = complaints.filter(c => c.status === "pending");
  const active    = complaints.filter(c => c.status === "under_review");
  const resolved  = complaints.filter(c => c.status === "resolved");

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-xl border p-6"
           style={{ background: "var(--prithvi-glass)", borderColor: "var(--prithvi-border-bright)" }}>
        <div className="flex items-center gap-3 mb-2">
          <MessageSquare className="w-5 h-5 prithvi-text-aurora" />
          <h2 className="text-base font-bold font-mono prithvi-text-aurora">CITIZEN REPORTS — YOUR REGION</h2>
        </div>
        <p className="text-xs font-mono opacity-60 prithvi-text-electric leading-relaxed">
          Environmental violation reports submitted by citizens in your region. Review and update status to keep citizens informed.
        </p>
        {/* Counts */}
        <div className="flex gap-4 mt-4 flex-wrap">
          {[
            { label: "PENDING",      count: pending.length,  col: "#ffb74d" },
            { label: "UNDER REVIEW", count: active.length,   col: "var(--prithvi-electric-cyan)" },
            { label: "RESOLVED",     count: resolved.length, col: "var(--prithvi-aurora-green)" },
          ].map(b => (
            <div key={b.label} className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                 style={{ background: "rgba(0,0,0,0.3)", border: `1px solid ${b.col}33` }}>
              <span className="text-lg font-bold font-mono" style={{ color: b.col }}>{b.count}</span>
              <span className="text-[10px] font-mono tracking-wider opacity-60 prithvi-text-electric">{b.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
            className="w-6 h-6 border-2 border-t-transparent rounded-full"
            style={{ borderColor: "var(--prithvi-aurora-green)", borderTopColor: "transparent" }} />
        </div>
      )}

      {/* Empty state */}
      {!loading && complaints.length === 0 && (
        <div className="rounded-xl border py-20 flex flex-col items-center gap-3"
             style={{ background: "var(--prithvi-glass)", borderColor: "var(--prithvi-border-dim)" }}>
          <FileText className="w-10 h-10 prithvi-text-aurora opacity-25" />
          <p className="font-mono text-sm prithvi-text-electric opacity-50">No citizen reports for your region yet.</p>
          <p className="font-mono text-xs prithvi-text-electric opacity-35">Reports appear here when citizens tag your region.</p>
        </div>
      )}

      {/* Complaint cards */}
      <AnimatePresence>
        {complaints.map((c, i) => {
          const ss = statusStyle(c.status);
          return (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-xl border p-5 space-y-4"
              style={{ background: "var(--prithvi-glass)", borderColor: "var(--prithvi-border-dim)" }}
            >
              {/* Title row */}
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                       style={{ background: ss.bg, border: `1px solid ${ss.border}` }}>
                    <AlertTriangle className="w-4 h-4" style={{ color: ss.text }} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold font-mono text-sm prithvi-text-aurora leading-tight">{c.title}</p>
                    {c.location && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 opacity-40" style={{ color: "var(--prithvi-electric-cyan)" }} />
                        <span className="text-xs font-mono opacity-50 prithvi-text-electric">{c.location}</span>
                      </div>
                    )}
                  </div>
                </div>
                {/* Status badge */}
                <span className="text-[10px] font-bold font-mono px-2.5 py-1 rounded-full uppercase tracking-wider flex-shrink-0"
                      style={{ background: ss.bg, border: `1px solid ${ss.border}`, color: ss.text }}>
                  {statusLabel(c.status)}
                </span>
              </div>

              {/* Description */}
              <p className="text-sm font-mono leading-relaxed opacity-70 prithvi-text-electric pl-11">{c.description}</p>

              {/* Photo */}
              {c.photo_data && (
                <div className="pl-11">
                  <img
                    src={`data:image/jpeg;base64,${c.photo_data}`}
                    alt="Evidence"
                    className="rounded-lg max-h-48 object-cover"
                    style={{ border: "1px solid var(--prithvi-border-dim)" }}
                  />
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between flex-wrap gap-3 pl-11">
                <div className="flex items-center gap-3 text-[11px] font-mono opacity-40 prithvi-text-electric">
                  <div className="flex items-center gap-1"><User className="w-3 h-3" /> Report #{c.id}</div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(c.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </div>
                </div>

                {/* Status change */}
                <div className="relative">
                  <select
                    value={c.status}
                    disabled={updating === c.id}
                    onChange={e => changeStatus(c.id, e.target.value)}
                    className="appearance-none pl-3 pr-7 py-1.5 rounded-lg text-xs font-mono font-bold cursor-pointer outline-none transition-all"
                    style={{ background: ss.bg, border: `1px solid ${ss.border}`, color: ss.text, opacity: updating === c.id ? 0.5 : 1 }}
                  >
                    <option value="pending">Pending</option>
                    <option value="under_review">Under Review</option>
                    <option value="resolved">Resolved</option>
                  </select>
                  <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: ss.text }} />
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// Tab: Take Actions (AI Alerts + Citizen Reports)
// ══════════════════════════════════════════════════════════════════

function TakeActionsTab() {
  const [alerts, setAlerts] = useState<AIAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState(false);

  const generate = async () => {
    setLoading(true);
    setError(null);
    setAlerts([]);
    try {
      const result = await regionalApi.aiAlerts();
      setAlerts(result);
      setGenerated(true);
    } catch (err: any) {
      setError(err.message ?? "Failed to generate AI analysis.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl border p-6"
           style={{ background: "var(--prithvi-glass)", borderColor: "var(--prithvi-border-bright)" }}>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Brain className="w-5 h-5 prithvi-text-aurora" />
              <h2 className="text-base font-bold font-mono prithvi-text-aurora">AI-POWERED ENVIRONMENTAL ANALYSIS</h2>
            </div>
            <p className="text-xs font-mono opacity-60 prithvi-text-electric max-w-lg leading-relaxed">
              Gemini AI analyzes your region's live sensor data — air quality, water quality, noise levels —
              and generates specific, actionable alerts with recommendations for immediate action.
            </p>
          </div>
          <motion.button
            onClick={generate}
            disabled={loading}
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            className="flex items-center gap-2 px-5 py-3 rounded-xl font-mono font-bold text-sm disabled:opacity-50 transition-all"
            style={{ background: "var(--prithvi-aurora-green)", color: "#000" }}
          >
            {loading ? (
              <>
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                  className="w-4 h-4 border-2 border-black border-t-transparent rounded-full" />
                ANALYZING...
              </>
            ) : (
              <><Zap className="w-4 h-4" /> {generated ? "REGENERATE" : "GENERATE AI ANALYSIS"}</>
            )}
          </motion.button>
        </div>

        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-4 flex items-center gap-3 text-xs font-mono opacity-60 prithvi-text-aurora"
          >
            <motion.div className="flex gap-1">
              {[0, 1, 2].map(i => (
                <motion.span key={i} className="w-1.5 h-1.5 rounded-full"
                  style={{ background: "var(--prithvi-aurora-green)" }}
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }} />
              ))}
            </motion.div>
            Analyzing regional data with Gemini AI…
          </motion.div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 px-4 py-4 rounded-xl border text-sm font-mono"
             style={{ background: "rgba(211,47,47,0.1)", borderColor: "var(--prithvi-critical-red)", color: "var(--prithvi-critical-red)" }}>
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-bold mb-0.5">Analysis failed</div>
            <div className="opacity-80">{error}</div>
            {error.includes("GEMINI_API_KEY") && (
              <div className="mt-2 opacity-70">
                Add your key to <code className="px-1.5 py-0.5 rounded" style={{ background: "rgba(211,47,47,0.2)" }}>backend/.env</code>{" "}
                as <code>GEMINI_API_KEY=your_key_here</code> and restart the backend.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty state - not yet generated */}
      {!generated && !loading && !error && (
        <div className="rounded-xl border py-20 flex flex-col items-center gap-4"
             style={{ background: "var(--prithvi-glass)", borderColor: "var(--prithvi-border-dim)" }}>
          <Brain className="w-12 h-12 prithvi-text-aurora opacity-30" />
          <p className="font-mono text-sm prithvi-text-electric opacity-50">
            Click "Generate AI Analysis" to get Gemini-powered insights for your region.
          </p>
        </div>
      )}

      {/* Alert cards */}
      <AnimatePresence>
        {alerts.map((alert, i) => {
          const sc = severityColor(alert.severity);
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="rounded-xl border p-5 space-y-3"
              style={{ background: sc.bg, borderColor: sc.border }}
            >
              {/* Header */}
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                     style={{ background: sc.bg, border: `1px solid ${sc.border}`, color: sc.text }}>
                  {categoryIcon(alert.category)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold font-mono text-sm prithvi-text-aurora">{alert.title}</span>
                    <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full uppercase tracking-wider"
                          style={{ background: sc.bg, border: `1px solid ${sc.border}`, color: sc.text }}>
                      {alert.severity}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full uppercase tracking-wider opacity-60 prithvi-text-electric"
                          style={{ border: "1px solid var(--prithvi-border-dim)" }}>
                      {alert.category.replace("_", " ")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Description */}
              <p className="text-sm leading-relaxed font-mono opacity-80 prithvi-text-electric pl-10">
                {alert.description}
              </p>

              {/* Recommendation */}
              <div className="pl-10">
                <div className="rounded-lg px-4 py-3 border"
                     style={{ background: "rgba(0,0,0,0.2)", borderColor: sc.border + "66" }}>
                  <div className="flex items-center gap-1.5 text-[10px] font-mono tracking-wider mb-1.5" style={{ color: sc.text }}>
                    <CheckCircle className="w-3 h-3" /> RECOMMENDED ACTION
                  </div>
                  <p className="text-xs font-mono leading-relaxed prithvi-text-electric">
                    {alert.recommendation}
                  </p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* ── Divider ── */}
      <div className="flex items-center gap-4 pt-2">
        <div className="flex-1 h-px" style={{ background: "var(--prithvi-border-dim)" }} />
        <span className="text-[10px] font-mono uppercase tracking-widest opacity-40 prithvi-text-electric">Citizen Reports</span>
        <div className="flex-1 h-px" style={{ background: "var(--prithvi-border-dim)" }} />
      </div>

      {/* ── Citizen Reports ── */}
      <CitizenReportsSection />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// MAIN — RegionalDashboard
// ══════════════════════════════════════════════════════════════════

type Tab = "overview" | "monitoring" | "forecast" | "actions";

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: "overview",   label: "Overview",     icon: <Eye className="w-4 h-4" /> },
  { key: "monitoring", label: "Monitoring",   icon: <Activity className="w-4 h-4" /> },
  { key: "forecast",   label: "Forecast",     icon: <TrendingUp className="w-4 h-4" /> },
  { key: "actions",    label: "Take Actions", icon: <Brain className="w-4 h-4" /> },
];

export function RegionalDashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("overview");

  const [station, setStation] = useState<Station | null>(null);
  const [readings, setReadings] = useState<PollutionReading[]>([]);
  const [risk, setRisk] = useState<RiskScore | null>(null);
  const [sensorAlerts, setSensorAlerts] = useState<Alert[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [regionError, setRegionError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.region) return;

    const fetchAll = async () => {
      try {
        // 1. Find this officer's station
        const stations = await stationsApi.list(user.region!);
        if (stations.length === 0) {
          setRegionError(`No monitoring station found for region "${user.region}".`);
          setLoadingInitial(false);
          return;
        }
        const st = stations[0];
        setStation(st);

        // 2. Fetch all region data in parallel
        const [rds, riskList, alts] = await Promise.all([
          pollutionApi.list(st.id, 50),
          riskApi.list(st.id),
          alertsApi.list(st.id, undefined, 20),
        ]);

        setReadings(rds);
        setRisk(riskList[0] ?? null);
        setSensorAlerts(alts);
      } catch {
        setRegionError("Failed to load regional data.");
      } finally {
        setLoadingInitial(false);
      }
    };

    fetchAll();
    const interval = setInterval(fetchAll, 60_000); // refresh every minute
    return () => clearInterval(interval);
  }, [user?.region]);

  if (loadingInitial) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: "60vh" }}>
        <div className="flex flex-col items-center gap-4">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-10 h-10 border-2 rounded-full"
            style={{ borderColor: "var(--prithvi-aurora-green)", borderTopColor: "transparent" }} />
          <p className="text-xs font-mono prithvi-text-electric opacity-50">
            Loading regional data for {user?.region}…
          </p>
        </div>
      </div>
    );
  }

  if (regionError) {
    return (
      <div className="flex items-center justify-center p-8" style={{ minHeight: "60vh" }}>
        <div className="rounded-xl border p-8 text-center max-w-md"
             style={{ background: "var(--prithvi-glass)", borderColor: "var(--prithvi-border-dim)" }}>
          <AlertCircle className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--prithvi-critical-red)" }} />
          <p className="font-mono text-sm prithvi-text-electric">{regionError}</p>
          <p className="text-xs mt-2 opacity-50 prithvi-text-electric">Contact the system administrator.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <Waves className="w-4 h-4 prithvi-text-aurora" />
            <h1 className="text-xl font-bold font-mono tracking-wider prithvi-text-aurora">
              REGIONAL DASHBOARD
            </h1>
          </div>
          <p className="text-xs font-mono opacity-50 prithvi-text-electric flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {station?.name ?? user?.region} · {user?.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full prithvi-pulse" style={{ background: "var(--prithvi-aurora-green)" }} />
          <span className="text-xs font-mono prithvi-text-aurora opacity-70">LIVE DATA</span>
          {risk && (
            <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold uppercase"
                  style={{
                    background: `${riskColor(risk.risk_level)}22`,
                    border: `1px solid ${riskColor(risk.risk_level)}`,
                    color: riskColor(risk.risk_level),
                  }}>
              {risk.risk_level}
            </span>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-xl border"
           style={{ background: "var(--prithvi-glass)", borderColor: "var(--prithvi-border-dim)" }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-mono font-semibold transition-all"
            style={{
              background: tab === t.key ? "var(--prithvi-glass-bright)" : "transparent",
              color: tab === t.key ? "var(--prithvi-electric-cyan)" : "var(--prithvi-atmospheric-teal)",
              borderBottom: tab === t.key ? "2px solid var(--prithvi-electric-cyan)" : "2px solid transparent",
            }}
          >
            {t.icon}
            <span className="hidden sm:inline">{t.label}</span>
            {t.key === "actions" && (
              <span className="w-1.5 h-1.5 rounded-full prithvi-pulse"
                    style={{ background: "var(--prithvi-aurora-green)" }} />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {tab === "overview"   && station && <OverviewTab station={station} risk={risk} latestReading={readings[0] ?? null} alerts={sensorAlerts} />}
          {tab === "monitoring" && <MonitoringTab readings={readings} />}
          {tab === "forecast"   && station && <ForecastTab stationId={station.id} />}
          {tab === "actions"    && <TakeActionsTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
