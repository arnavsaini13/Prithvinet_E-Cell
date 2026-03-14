import { motion } from "motion/react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import {
  Database,
  Download,
  Upload,
  Calendar,
  Clock,
  Archive,
  Search,
  Eye,
  FileText,
  Activity,
  HardDrive,
  Server,
  FolderOpen,
} from "lucide-react";
import { stationsApi, pollutionApi, alertsApi } from "../../api/client";
import type { Station, PollutionReading, Alert } from "../../api/client";
import { useAuth } from "../context/AuthContext";

interface ArchiveEntry {
  id: string;
  name: string;
  type: string;
  size: string;
  date: string;
  records: string;
  format: string;
  status: string;
}

interface ActivityEntry {
  action: string;
  dataset: string;
  time: string;
}

export function DataArchive() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [archiveData, setArchiveData] = useState<ArchiveEntry[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [stationCount, setStationCount] = useState(0);
  const [alertCount, setAlertCount] = useState(0);
  const [recentActivity, setRecentActivity] = useState<ActivityEntry[]>([]);
  const [rawReadings, setRawReadings] = useState<PollutionReading[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const isOfficer = role === "regional_officer" && !!user?.region;
        const [stations, readings, alerts] = await Promise.all([
          stationsApi.list(isOfficer ? user!.region! : undefined),
          pollutionApi.list(undefined, 200),
          alertsApi.list(undefined, undefined, 50).catch(() => [] as Alert[]),
        ]);
        if (cancelled) return;

        // Scope readings and alerts to officer's station if applicable
        const stationSet = new Set(stations.map((s: Station) => s.id));
        const filteredReadings = isOfficer ? readings.filter((r: PollutionReading) => stationSet.has(r.station_id)) : readings;
        const filteredAlerts = isOfficer ? alerts.filter((a: Alert) => stationSet.has(a.station_id)) : alerts;

        setStationCount(stations.length);
        setTotalRecords(filteredReadings.length);
        setAlertCount(filteredAlerts.length);
        setRawReadings(filteredReadings);

        // Group readings by station to build per-station archive entries
        const byStation = new Map<number, PollutionReading[]>();
        for (const r of filteredReadings) {
          const arr = byStation.get(r.station_id) ?? [];
          arr.push(r);
          byStation.set(r.station_id, arr);
        }

        const entries: ArchiveEntry[] = [];

        // Per-station pollution datasets
        for (const st of stations) {
          const stReadings = byStation.get(st.id) ?? [];
          if (stReadings.length === 0) continue;
          const latest = stReadings.reduce((a, b) =>
            new Date(a.timestamp) > new Date(b.timestamp) ? a : b
          );
          const sizeKb = stReadings.length * 0.12; // ~120 bytes per JSON reading
          entries.push({
            id: `st-${st.id}`,
            name: `${st.name} — Air Quality Data`,
            type: "Air Quality",
            size: sizeKb > 1024 ? (sizeKb / 1024).toFixed(1) + " MB" : sizeKb.toFixed(0) + " KB",
            date: new Date(latest.timestamp).toISOString().split("T")[0],
            records: stReadings.length.toLocaleString(),
            format: "JSON",
            status: "complete",
          });
        }

        // Water quality aggregate
        const waterReadings = filteredReadings.filter(r => r.ph > 0 || r.dissolved_oxygen > 0);
        if (waterReadings.length > 0) {
          const latestW = waterReadings.reduce((a, b) =>
            new Date(a.timestamp) > new Date(b.timestamp) ? a : b
          );
          entries.push({
            id: "water-agg",
            name: "India Water Quality Metrics",
            type: "Water Quality",
            size: (waterReadings.length * 0.08).toFixed(0) + " KB",
            date: new Date(latestW.timestamp).toISOString().split("T")[0],
            records: waterReadings.length.toLocaleString(),
            format: "JSON",
            status: "complete",
          });
        }

        // Alerts dataset
        if (filteredAlerts.length > 0) {
          const latestA = filteredAlerts.reduce((a, b) =>
            new Date(a.timestamp) > new Date(b.timestamp) ? a : b
          );
          entries.push({
            id: "alerts-all",
            name: "Environmental Alerts Archive",
            type: "Alerts",
            size: (filteredAlerts.length * 0.05).toFixed(0) + " KB",
            date: new Date(latestA.timestamp).toISOString().split("T")[0],
            records: filteredAlerts.length.toLocaleString(),
            format: "JSON",
            status: "complete",
          });
        }

        // Noise dataset
        const noiseReadings = filteredReadings.filter(r => r.noise_level > 0);
        if (noiseReadings.length > 0) {
          const latestN = noiseReadings.reduce((a, b) =>
            new Date(a.timestamp) > new Date(b.timestamp) ? a : b
          );
          entries.push({
            id: "noise-agg",
            name: "Noise Pollution Mapping",
            type: "Noise Analysis",
            size: (noiseReadings.length * 0.06).toFixed(0) + " KB",
            date: new Date(latestN.timestamp).toISOString().split("T")[0],
            records: noiseReadings.length.toLocaleString(),
            format: "JSON",
            status: "complete",
          });
        }

        setArchiveData(entries);

        // Build real activity from latest readings and alerts
        const activities: ActivityEntry[] = [];

        if (filteredReadings.length > 0) {
          const newest = filteredReadings.reduce((a, b) =>
            new Date(a.timestamp) > new Date(b.timestamp) ? a : b
          );
          const st = stations.find(s => s.id === newest.station_id);
          const ago = timeSince(new Date(newest.timestamp));
          activities.push({
            action: "New sensor data ingested",
            dataset: `${st?.name ?? 'Station #' + newest.station_id} — PM2.5: ${newest.pm25.toFixed(1)}`,
            time: ago,
          });
        }

        if (filteredAlerts.length > 0) {
          const newest = filteredAlerts.reduce((a, b) =>
            new Date(a.timestamp) > new Date(b.timestamp) ? a : b
          );
          activities.push({
            action: `Alert triggered — ${newest.pollutant.toUpperCase()} ${newest.severity}`,
            dataset: `Station #${newest.station_id} • Value: ${newest.value.toFixed(1)}`,
            time: timeSince(new Date(newest.timestamp)),
          });
        }

        activities.push({
          action: "Data sync completed",
          dataset: `${filteredReadings.length} readings across ${stations.length} station${stations.length !== 1 ? "s" : ""}`,
          time: "Just now",
        });

        // Per-station latest ingestion
        for (const st of stations.slice(0, 2)) {
          const stR = byStation.get(st.id);
          if (stR && stR.length > 0) {
            const latest = stR.reduce((a, b) =>
              new Date(a.timestamp) > new Date(b.timestamp) ? a : b
            );
            activities.push({
              action: `${st.name} data updated`,
              dataset: `CO₂: ${latest.co2.toFixed(0)} ppm • NO₂: ${latest.no2.toFixed(1)} ppb`,
              time: timeSince(new Date(latest.timestamp)),
            });
          }
        }

        setRecentActivity(activities);
      } catch (err) {
        console.error("DataArchive: fetch error", err);
      }
    }

    fetchData();
    const id = setInterval(fetchData, 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // Compute storage stats from archive data
  const totalSizeKb = archiveData.reduce((sum, d) => {
    const match = d.size.match(/([\d.]+)\s*(KB|MB|GB)/);
    if (!match) return sum;
    const val = parseFloat(match[1]);
    if (match[2] === "GB") return sum + val * 1024 * 1024;
    if (match[2] === "MB") return sum + val * 1024;
    return sum + val;
  }, 0);
  const usedMb = (totalSizeKb / 1024).toFixed(1);
  const usedPct = Math.min(100, (totalSizeKb / (100 * 1024)) * 100); // assume 100 MB capacity for visual

  const filteredData = archiveData.filter((item) => {
    const matchesFilter =
      selectedFilter === "all" ||
      item.type.toLowerCase().includes(selectedFilter.toLowerCase());
    const matchesSearch = item.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

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
            DATA ARCHIVE & STORAGE
          </h2>
          <p className="text-sm mt-1 opacity-70 prithvi-text-forest">
            Environmental data repository — {stationCount} stations • {totalRecords} readings • {alertCount} alerts
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => {
              const template = {
                station_id: 1,
                pm25: 0.0,
                pm10: 0.0,
                co2: 400.0,
                no2: 0.0,
                ph: 7.0,
                turbidity: 1.0,
                dissolved_oxygen: 8.0,
                noise_level: 40.0,
              };
              const blob = new Blob([JSON.stringify(template, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "sensor_data_template.json";
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="px-4 py-2 rounded-lg border text-xs font-mono tracking-wider transition-all hover:bg-white/5 flex items-center gap-2"
            style={{
              background: "var(--prithvi-glass)",
              borderColor: "var(--prithvi-border-dim)",
            }}
          >
            <Upload className="w-4 h-4 prithvi-text-electric" />
            UPLOAD DATA
          </button>
          <button
            onClick={() => {
              const headers = ["Dataset", "Type", "Size", "Records", "Date", "Format", "Status"];
              const rows = filteredData.map((d) => [d.name, d.type, d.size, d.records, d.date, d.format, d.status]);
              const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
              const blob = new Blob([csv], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "prithvinet_archive.csv";
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="px-4 py-2 rounded-lg border text-xs font-mono tracking-wider transition-all hover:bg-white/5 flex items-center gap-2"
            style={{
              background: "var(--prithvi-glass-bright)",
              borderColor: "var(--prithvi-border-bright)",
            }}
          >
            <Download className="w-4 h-4 prithvi-text-aurora" />
            EXPORT SELECTED
          </button>
        </div>
      </motion.div>

      {/* Storage Overview */}
      <div className="grid grid-cols-4 gap-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="p-6 rounded-lg border backdrop-blur-md prithvi-card-layered prithvi-inner-glow"
          style={{
            background: "var(--prithvi-panel-bg)",
            borderColor: "var(--prithvi-border-dim)",
          }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div
              className="p-3 rounded-lg"
              style={{ background: "var(--prithvi-glass-bright)" }}
            >
              <HardDrive className="w-6 h-6 prithvi-text-electric" />
            </div>
            <div>
              <div className="text-xs font-mono opacity-60 prithvi-text-electric">
                STATIONS
              </div>
              <div className="text-2xl font-bold font-mono prithvi-text-aurora">
                {stationCount}
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15 }}
          className="p-6 rounded-lg border backdrop-blur-md prithvi-card-layered prithvi-inner-glow"
          style={{
            background: "var(--prithvi-panel-bg)",
            borderColor: "var(--prithvi-border-dim)",
          }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div
              className="p-3 rounded-lg"
              style={{ background: "var(--prithvi-glass-bright)" }}
            >
              <Server className="w-6 h-6 prithvi-text-ocean" />
            </div>
            <div>
              <div className="text-xs font-mono opacity-60 prithvi-text-electric">
                TOTAL READINGS
              </div>
              <div className="text-2xl font-bold font-mono prithvi-text-ocean">
                {totalRecords.toLocaleString()}
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="p-6 rounded-lg border backdrop-blur-md prithvi-card-layered prithvi-inner-glow"
          style={{
            background: "var(--prithvi-panel-bg)",
            borderColor: "var(--prithvi-border-dim)",
          }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div
              className="p-3 rounded-lg"
              style={{ background: "var(--prithvi-glass-bright)" }}
            >
              <FolderOpen className="w-6 h-6 prithvi-text-aurora" />
            </div>
            <div>
              <div className="text-xs font-mono opacity-60 prithvi-text-electric">
                DATA SIZE
              </div>
              <div className="text-2xl font-bold font-mono prithvi-text-aurora">
                {usedMb} MB
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25 }}
          className="p-6 rounded-lg border backdrop-blur-md prithvi-card-layered prithvi-inner-glow"
          style={{
            background: "var(--prithvi-panel-bg)",
            borderColor: "var(--prithvi-border-dim)",
          }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div
              className="p-3 rounded-lg"
              style={{ background: "var(--prithvi-glass-bright)" }}
            >
              <Archive
                className="w-6 h-6"
                style={{ color: "var(--prithvi-warm-amber)" }}
              />
            </div>
            <div>
              <div className="text-xs font-mono opacity-60 prithvi-text-electric">
                DATASETS
              </div>
              <div
                className="text-2xl font-bold font-mono"
                style={{ color: "var(--prithvi-warm-amber)" }}
              >
                {archiveData.length}
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Storage Usage Bar */}
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
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-mono prithvi-text-electric">
            STORAGE UTILIZATION
          </span>
          <span className="text-sm font-mono font-bold prithvi-text-aurora">
            {usedMb} MB used
          </span>
        </div>
        <div
          className="h-4 rounded-full overflow-hidden"
          style={{ background: "var(--prithvi-grid)" }}
        >
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.max(5, usedPct)}%` }}
            transition={{ duration: 1, delay: 0.4 }}
            className="h-full"
            style={{
              background: `linear-gradient(to right, var(--prithvi-aurora-green), var(--prithvi-ocean-blue))`,
              boxShadow: "0 0 15px var(--prithvi-aurora-green)",
            }}
          />
        </div>
      </motion.div>

      {/* Search and Filter Bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="flex gap-4"
      >
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 prithvi-text-electric opacity-60" />
          <input
            type="text"
            placeholder="Search datasets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-lg border backdrop-blur-md font-mono text-sm transition-all"
            style={{
              background: "var(--prithvi-glass)",
              borderColor: "var(--prithvi-border-dim)",
            }}
          />
        </div>

        <div className="flex gap-2">
          {["all", "Air Quality", "Water Quality", "Alerts", "Noise"].map(
            (filter) => (
              <button
                key={filter}
                onClick={() => setSelectedFilter(filter)}
                className={`px-4 py-3 rounded-lg border text-xs font-mono tracking-wider transition-all ${
                  selectedFilter === filter ? "prithvi-glow-electric" : ""
                }`}
                style={{
                  background:
                    selectedFilter === filter
                      ? "var(--prithvi-glass-bright)"
                      : "var(--prithvi-glass)",
                  borderColor:
                    selectedFilter === filter
                      ? "var(--prithvi-border-bright)"
                      : "var(--prithvi-border-dim)",
                  color:
                    selectedFilter === filter
                      ? "var(--prithvi-electric-cyan)"
                      : "inherit",
                }}
              >
                {filter.toUpperCase()}
              </button>
            )
          )}
        </div>
      </motion.div>

      {/* Data Archive Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="rounded-lg border backdrop-blur-md prithvi-card-layered overflow-hidden"
        style={{
          background: "var(--prithvi-panel-bg)",
          borderColor: "var(--prithvi-border-dim)",
        }}
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr
                className="border-b"
                style={{ borderColor: "var(--prithvi-border-dim)" }}
              >
                <th className="text-left p-4 text-xs font-mono tracking-wider prithvi-text-electric">
                  DATASET NAME
                </th>
                <th className="text-left p-4 text-xs font-mono tracking-wider prithvi-text-electric">
                  TYPE
                </th>
                <th className="text-left p-4 text-xs font-mono tracking-wider prithvi-text-electric">
                  SIZE
                </th>
                <th className="text-left p-4 text-xs font-mono tracking-wider prithvi-text-electric">
                  RECORDS
                </th>
                <th className="text-left p-4 text-xs font-mono tracking-wider prithvi-text-electric">
                  DATE
                </th>
                <th className="text-left p-4 text-xs font-mono tracking-wider prithvi-text-electric">
                  FORMAT
                </th>
                <th className="text-left p-4 text-xs font-mono tracking-wider prithvi-text-electric">
                  STATUS
                </th>
                <th className="text-left p-4 text-xs font-mono tracking-wider prithvi-text-electric">
                  ACTIONS
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredData.length > 0 ? (
                filteredData.map((item, index) => (
                  <motion.tr
                    key={item.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + index * 0.05 }}
                    className="border-b hover:bg-white/5 transition-all"
                    style={{ borderColor: "var(--prithvi-border-dim)" }}
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <FileText className="w-4 h-4 prithvi-text-electric" />
                        <span className="font-mono text-sm prithvi-text-aurora">
                          {item.name}
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="text-xs font-mono opacity-70 prithvi-text-electric">
                        {item.type}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="text-sm font-mono prithvi-text-ocean">
                        {item.size}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="text-sm font-mono prithvi-text-forest">
                        {item.records}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3 h-3 opacity-60" />
                        <span className="text-xs font-mono opacity-70 prithvi-text-electric">
                          {item.date}
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span
                        className="px-2 py-1 rounded text-xs font-mono"
                        style={{
                          background: "var(--prithvi-glass)",
                          border: "1px solid var(--prithvi-border-dim)",
                        }}
                      >
                        {item.format}
                      </span>
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-1 rounded text-xs font-mono ${
                          item.status === "complete"
                            ? "prithvi-badge-safe"
                            : "prithvi-badge-moderate"
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            if (item.type === "Water Quality") navigate("/dashboard/ocean");
                            else if (item.type === "Alerts") navigate("/dashboard/pollution-map");
                            else navigate("/dashboard/atmosphere");
                          }}
                          className="p-2 rounded hover:bg-white/10 transition-all"
                          title="View"
                        >
                          <Eye className="w-4 h-4 prithvi-text-electric" />
                        </button>
                        <button
                          onClick={() => {
                            const stId = item.id.startsWith("st-") ? parseInt(item.id.replace("st-", "")) : null;
                            const data = stId !== null
                              ? rawReadings.filter((r) => r.station_id === stId)
                              : rawReadings;
                            const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = `${item.name.replace(/[^a-z0-9]/gi, "_")}.json`;
                            a.click();
                            URL.revokeObjectURL(url);
                          }}
                          className="p-2 rounded hover:bg-white/10 transition-all"
                          title="Download"
                        >
                          <Download className="w-4 h-4 prithvi-text-aurora" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-sm font-mono opacity-60 prithvi-text-electric">
                    {archiveData.length === 0 ? "Loading data from backend..." : "No datasets match your filter"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Activity Log */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="p-6 rounded-lg border backdrop-blur-md prithvi-card-layered"
        style={{
          background: "var(--prithvi-panel-bg)",
          borderColor: "var(--prithvi-border-dim)",
        }}
      >
        <div className="flex items-center gap-3 mb-4">
          <Activity className="w-5 h-5 prithvi-text-electric" />
          <h3 className="text-lg font-mono tracking-wider prithvi-text-electric">
            RECENT ACTIVITY
          </h3>
        </div>

        <div className="space-y-3">
          {recentActivity.length > 0 ? (
            recentActivity.map((activity, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7 + index * 0.05 }}
                className="flex items-center justify-between p-3 rounded-lg border"
                style={{
                  background: "var(--prithvi-glass)",
                  borderColor: "var(--prithvi-border-dim)",
                }}
              >
                <div className="flex items-center gap-3">
                  <Clock className="w-4 h-4 prithvi-text-electric opacity-60" />
                  <div>
                    <div className="text-sm font-mono prithvi-text-aurora">
                      {activity.action}
                    </div>
                    <div className="text-xs opacity-60 prithvi-text-electric">
                      {activity.dataset}
                    </div>
                  </div>
                </div>
                <span className="text-xs font-mono opacity-60 prithvi-text-forest">
                  {activity.time}
                </span>
              </motion.div>
            ))
          ) : (
            <div className="text-sm font-mono opacity-60 prithvi-text-electric text-center py-4">
              Loading activity from backend...
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function timeSince(date: Date): string {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "Just now";
  if (seconds < 3600) return Math.floor(seconds / 60) + " min ago";
  if (seconds < 86400) return Math.floor(seconds / 3600) + " hours ago";
  return Math.floor(seconds / 86400) + " days ago";
}
