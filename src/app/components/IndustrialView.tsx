import { useState, useEffect } from "react";
import { motion } from "motion/react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Cell,
} from "recharts";
import {
  Factory,
  AlertTriangle,
  CheckCircle,
  Activity,
  MapPin,
  Wind,
  RefreshCw,
} from "lucide-react";
import { industriesApi, type EnrichedIndustry } from "../../api/client";

function complianceColor(score: number): string {
  if (score >= 80) return "var(--prithvi-aurora-green)";
  if (score >= 60) return "var(--prithvi-warm-amber)";
  return "var(--prithvi-critical-red)";
}

function complianceLabel(score: number): string {
  if (score >= 80) return "COMPLIANT";
  if (score >= 60) return "MODERATE";
  return "CRITICAL";
}

export function IndustrialView() {
  const [industries, setIndustries] = useState<EnrichedIndustry[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  async function fetchData() {
    try {
      const data = await industriesApi.enriched();
      setIndustries(data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("IndustrialView: fetch error", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 300_000); // refresh every 5 minutes
    return () => clearInterval(id);
  }, []);

  const avgCompliance =
    industries.length > 0
      ? industries.reduce((s, i) => s + i.compliance_score, 0) / industries.length
      : 0;
  const criticalCount = industries.filter(i => i.compliance_score < 60).length;
  const compliantCount = industries.filter(i => i.compliance_score >= 80).length;

  // Data for the horizontal compliance bar chart
  const barData = [...industries]
    .sort((a, b) => a.compliance_score - b.compliance_score)
    .map(i => ({
      name: i.name.replace(" Plant", "").replace(" Works", "").replace(" Refinery", "").replace(" Aluminium", ""),
      score: i.compliance_score,
      eaqi: i.eaqi,
    }));

  // Data for the pollutant radar (per-company)
  const radarData = industries.map(i => ({
    company: i.name.split(" ")[0],
    PM25:  Math.min(100, Math.round(i.pm25 / 60 * 100)),
    SO2:   Math.min(100, Math.round(i.so2 / 80 * 100)),
    NO2:   Math.min(100, Math.round(i.no2 / 80 * 100)),
    PM10:  Math.min(100, Math.round(i.pm10 / 150 * 100)),
  }));

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
            INDUSTRIAL COMPLIANCE MONITOR
          </h2>
          <p className="text-sm mt-1 opacity-70 prithvi-text-forest">
            Real-Time Environmental Compliance • CPCB NAAQS + WHO 2021 Standards
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs font-mono opacity-50 prithvi-text-electric">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={fetchData}
            className="p-2 rounded-lg border opacity-60 hover:opacity-100 transition-all"
            style={{ borderColor: "var(--prithvi-border-dim)", background: "var(--prithvi-glass)" }}
          >
            <RefreshCw className="w-4 h-4 prithvi-text-electric" />
          </button>
        </div>
      </motion.div>

      {/* Data source badge */}
      <div
        className="flex items-center gap-3 px-4 py-3 rounded-lg border text-xs font-mono"
        style={{ background: "var(--prithvi-glass)", borderColor: "var(--prithvi-border-dim)" }}
      >
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="w-2 h-2 rounded-full"
          style={{ background: "var(--prithvi-aurora-green)" }}
        />
        <Wind className="w-4 h-4 prithvi-text-electric" />
        <span className="prithvi-text-aurora">
          SOURCE: Open-Meteo Air Quality API (ECMWF CAMS) — real-time PM2.5, PM10, SO2, NO2 at each facility's GPS coordinates
        </span>
        <span className="opacity-40 ml-auto">Compliance = CPCB NAAQS 2009 + WHO 2021</span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          {
            label: "AVG COMPLIANCE",
            value: `${avgCompliance.toFixed(1)}%`,
            icon: Activity,
            color: complianceColor(avgCompliance),
          },
          {
            label: "CRITICAL (< 60%)",
            value: String(criticalCount),
            icon: AlertTriangle,
            color: "var(--prithvi-critical-red)",
          },
          {
            label: "COMPLIANT (≥ 80%)",
            value: String(compliantCount),
            icon: CheckCircle,
            color: "var(--prithvi-aurora-green)",
          },
          {
            label: "FACILITIES MONITORED",
            value: String(industries.length),
            icon: Factory,
            color: "var(--prithvi-electric-cyan)",
          },
        ].map((card, idx) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="p-5 rounded-lg border backdrop-blur-md"
            style={{
              background: "var(--prithvi-panel-bg)",
              borderColor: "var(--prithvi-border-dim)",
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <card.icon className="w-4 h-4" style={{ color: card.color }} />
              <span className="text-xs font-mono opacity-60 prithvi-text-electric">{card.label}</span>
            </div>
            <div className="text-3xl font-mono font-bold" style={{ color: card.color }}>
              {loading ? "..." : card.value}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Compliance bar chart + pollutant breakdown */}
      <div className="grid grid-cols-3 gap-6">
        {/* Compliance bar chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="col-span-2 p-6 rounded-lg border backdrop-blur-md prithvi-card-layered"
          style={{
            background: "var(--prithvi-panel-bg)",
            borderColor: "var(--prithvi-border-dim)",
          }}
        >
          <h3 className="text-lg font-mono tracking-wider prithvi-text-electric mb-4">
            COMPLIANCE SCORE BY FACILITY
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={barData} layout="vertical" margin={{ left: 20, right: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--prithvi-grid)" opacity={0.2} horizontal={false} />
              <XAxis
                type="number"
                domain={[0, 100]}
                stroke="var(--prithvi-text-dim)"
                tick={{ fill: "var(--prithvi-text-dim)", fontSize: 10, fontFamily: "monospace" }}
              />
              <YAxis
                type="category"
                dataKey="name"
                stroke="var(--prithvi-text-dim)"
                tick={{ fill: "var(--prithvi-text-dim)", fontSize: 10, fontFamily: "monospace" }}
                width={100}
              />
              <Tooltip
                formatter={(v: number) => [`${v}%`, "Compliance"]}
                contentStyle={{
                  background: "var(--prithvi-panel-bg-solid)",
                  border: "1px solid var(--prithvi-border-bright)",
                  fontFamily: "monospace",
                  fontSize: 12,
                }}
              />
              <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                {barData.map((entry, i) => (
                  <Cell key={i} fill={complianceColor(entry.score)} opacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Legend */}
          <div className="flex gap-6 mt-3 text-xs font-mono">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ background: "var(--prithvi-aurora-green)" }} />
              <span style={{ color: "var(--prithvi-aurora-green)" }}>Compliant ≥ 80%</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ background: "var(--prithvi-warm-amber)" }} />
              <span style={{ color: "var(--prithvi-warm-amber)" }}>Moderate 60–80%</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ background: "var(--prithvi-critical-red)" }} />
              <span style={{ color: "var(--prithvi-critical-red)" }}>Critical &lt; 60%</span>
            </div>
          </div>
        </motion.div>

        {/* Pollutant radar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="p-6 rounded-lg border backdrop-blur-md prithvi-card-layered"
          style={{
            background: "var(--prithvi-panel-bg)",
            borderColor: "var(--prithvi-border-dim)",
          }}
        >
          <h3 className="text-sm font-mono tracking-wider prithvi-text-electric mb-4">
            POLLUTION INTENSITY BY COMPANY
          </h3>
          <p className="text-xs opacity-50 prithvi-text-forest mb-3">
            Normalized to CPCB limits (100% = limit breached)
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="var(--prithvi-grid)" opacity={0.3} />
              <PolarAngleAxis
                dataKey="company"
                tick={{ fill: "var(--prithvi-text-dim)", fontSize: 9, fontFamily: "monospace" }}
              />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} />
              <Radar name="PM2.5" dataKey="PM25" stroke="var(--prithvi-electric-cyan)" fill="var(--prithvi-electric-cyan)" fillOpacity={0.15} strokeWidth={2} />
              <Radar name="SO2"   dataKey="SO2"  stroke="var(--prithvi-critical-red)"  fill="var(--prithvi-critical-red)"  fillOpacity={0.15} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2 text-xs font-mono justify-center">
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full" style={{ background: "var(--prithvi-electric-cyan)" }} /><span style={{ color: "var(--prithvi-electric-cyan)" }}>PM2.5</span></div>
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full" style={{ background: "var(--prithvi-critical-red)" }} /><span style={{ color: "var(--prithvi-critical-red)" }}>SO₂</span></div>
          </div>
        </motion.div>
      </div>

      {/* Detailed table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="p-6 rounded-lg border backdrop-blur-md prithvi-card-layered prithvi-inner-glow"
        style={{
          background: "var(--prithvi-panel-bg)",
          borderColor: "var(--prithvi-border-dim)",
        }}
      >
        <h3 className="text-lg font-mono tracking-wider prithvi-text-electric mb-4">
          LIVE AIR QUALITY AT FACILITY LOCATIONS
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr
                className="text-left border-b"
                style={{ borderColor: "var(--prithvi-border-dim)", color: "var(--prithvi-electric-cyan)" }}
              >
                <th className="pb-3 pr-4">FACILITY</th>
                <th className="pb-3 pr-4">LOCATION</th>
                <th className="pb-3 pr-4">PM2.5 μg/m³</th>
                <th className="pb-3 pr-4">PM10 μg/m³</th>
                <th className="pb-3 pr-4">SO₂ μg/m³</th>
                <th className="pb-3 pr-4">NO₂ μg/m³</th>
                <th className="pb-3 pr-4">EU AQI</th>
                <th className="pb-3">COMPLIANCE</th>
              </tr>
            </thead>
            <tbody>
              {industries.map((ind, idx) => (
                <motion.tr
                  key={ind.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.45 + idx * 0.05 }}
                  className="border-b hover:bg-white/5 transition-all"
                  style={{ borderColor: "var(--prithvi-border-dim)" }}
                >
                  <td className="py-3 pr-4 prithvi-text-electric font-semibold">{ind.name}</td>
                  <td className="py-3 pr-4 opacity-70 prithvi-text-forest">
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {ind.location}
                    </div>
                  </td>
                  <td className="py-3 pr-4" style={{ color: ind.pm25 > 40 ? "var(--prithvi-critical-red)" : ind.pm25 > 15 ? "var(--prithvi-warm-amber)" : "var(--prithvi-aurora-green)" }}>
                    {ind.pm25.toFixed(1)}
                  </td>
                  <td className="py-3 pr-4" style={{ color: ind.pm10 > 100 ? "var(--prithvi-critical-red)" : ind.pm10 > 60 ? "var(--prithvi-warm-amber)" : "var(--prithvi-aurora-green)" }}>
                    {ind.pm10.toFixed(1)}
                  </td>
                  <td className="py-3 pr-4" style={{ color: ind.so2 > 80 ? "var(--prithvi-critical-red)" : ind.so2 > 40 ? "var(--prithvi-warm-amber)" : "var(--prithvi-aurora-green)" }}>
                    {ind.so2.toFixed(1)}
                  </td>
                  <td className="py-3 pr-4" style={{ color: ind.no2 > 80 ? "var(--prithvi-critical-red)" : ind.no2 > 40 ? "var(--prithvi-warm-amber)" : "var(--prithvi-aurora-green)" }}>
                    {ind.no2.toFixed(1)}
                  </td>
                  <td className="py-3 pr-4 prithvi-text-ocean">{ind.eaqi}</td>
                  <td className="py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-20 h-2 rounded-full overflow-hidden" style={{ background: "var(--prithvi-grid)" }}>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${ind.compliance_score}%` }}
                          transition={{ duration: 1, delay: 0.5 + idx * 0.05 }}
                          className="h-full rounded-full"
                          style={{ background: complianceColor(ind.compliance_score) }}
                        />
                      </div>
                      <span className="font-bold" style={{ color: complianceColor(ind.compliance_score) }}>
                        {ind.compliance_score.toFixed(1)}%
                      </span>
                      <span
                        className="px-2 py-0.5 rounded text-xs"
                        style={{
                          background: `${complianceColor(ind.compliance_score)}22`,
                          color: complianceColor(ind.compliance_score),
                          border: `1px solid ${complianceColor(ind.compliance_score)}44`,
                        }}
                      >
                        {complianceLabel(ind.compliance_score)}
                      </span>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 pt-4 border-t text-xs font-mono opacity-50 prithvi-text-forest" style={{ borderColor: "var(--prithvi-border-dim)" }}>
          Data source: Open-Meteo Air Quality API (ECMWF CAMS global model) — fetched at each facility's real GPS coordinates.
          Compliance computed against CPCB NAAQS 2009 annual limits and WHO 2021 guidelines. Updated every 30 minutes.
        </div>
      </motion.div>
    </div>
  );
}
