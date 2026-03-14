import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate } from "react-router";
import { Bell, AlertTriangle, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
import { warningsApi, type IndustryWarning } from "../../api/client";
import { useAuth } from "../context/AuthContext";


function severityColor(s: string): string {
  return ({
    low:      "var(--prithvi-aurora-green)",
    medium:   "var(--prithvi-electric-cyan)",
    high:     "var(--prithvi-warm-amber)",
    critical: "var(--prithvi-critical-red)",
  }[s.toLowerCase()] ?? "var(--prithvi-electric-cyan)");
}

export function IndustryWarningsDashboard() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const [warnings, setWarnings] = useState<IndustryWarning[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<number | null>(null);

  // Gate: only industry_user role
  useEffect(() => {
    if (!loading && role !== "industry_user") {
      navigate("/dashboard", { replace: true });
    }
  }, [role, loading]);

  async function fetchWarnings() {
    setError(null);
    try {
      const data = await warningsApi.myWarnings();
      setWarnings(data);
    } catch (err: any) {
      setError(err.message ?? "Failed to load warnings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchWarnings();
  }, []);

  async function handleMarkRead(id: number) {
    setMarkingId(id);
    try {
      await warningsApi.markRead(id);
      setWarnings(prev => prev.map(w => w.id === id ? { ...w, is_read: true } : w));
    } catch {
      // silent
    } finally {
      setMarkingId(null);
    }
  }

  const unreadCount = warnings.filter(w => !w.is_read).length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-mono tracking-wider prithvi-text-electric">
              COMPLIANCE WARNINGS
            </h2>
            {unreadCount > 0 && (
              <span
                className="px-2 py-0.5 rounded-full text-xs font-mono font-bold"
                style={{ background: "rgba(211,47,47,0.2)", color: "var(--prithvi-critical-red)", border: "1px solid var(--prithvi-critical-red)" }}
              >
                {unreadCount} UNREAD
              </span>
            )}
          </div>
          <p className="text-sm mt-1 opacity-70 prithvi-text-forest">
            Formal notices issued by regional environmental officers
            {user?.industry_name && ` · ${user.industry_name}`}
          </p>
        </div>
        <button
          onClick={fetchWarnings}
          className="p-2 rounded-lg border opacity-60 hover:opacity-100 transition-all"
          style={{ borderColor: "var(--prithvi-border-dim)", background: "var(--prithvi-glass)" }}
        >
          <RefreshCw className="w-4 h-4 prithvi-text-electric" />
        </button>
      </motion.div>

      {/* Error */}
      {error && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-lg border text-xs font-mono"
          style={{ background: "rgba(211,47,47,0.1)", borderColor: "var(--prithvi-critical-red)", color: "var(--prithvi-critical-red)" }}
        >
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <motion.div
            className="w-8 h-8 border-2 border-t-transparent rounded-full"
            style={{ borderColor: "var(--prithvi-electric-cyan)" }}
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          />
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && warnings.length === 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center py-20 text-center"
        >
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mb-5"
            style={{ background: "rgba(0,255,136,0.08)", border: "2px solid var(--prithvi-aurora-green)" }}
          >
            <CheckCircle className="w-8 h-8 prithvi-text-aurora" />
          </div>
          <p className="font-mono font-semibold prithvi-text-aurora">No warnings received</p>
          <p className="text-sm mt-1 opacity-50 prithvi-text-electric">
            Your facility is in good standing. Warnings from regional officers will appear here.
          </p>
        </motion.div>
      )}

      {/* Warning cards */}
      <div className="space-y-4">
        <AnimatePresence>
          {warnings.map((w, idx) => (
            <motion.div
              key={w.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="p-5 rounded-lg border backdrop-blur-md"
              style={{
                background: w.is_read
                  ? "var(--prithvi-panel-bg)"
                  : `${severityColor(w.severity)}08`,
                borderColor: w.is_read
                  ? "var(--prithvi-border-dim)"
                  : `${severityColor(w.severity)}66`,
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {/* Severity icon */}
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{
                      background: `${severityColor(w.severity)}15`,
                      border: `1px solid ${severityColor(w.severity)}55`,
                    }}
                  >
                    <AlertTriangle className="w-4 h-4" style={{ color: severityColor(w.severity) }} />
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Header row */}
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span
                        className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase"
                        style={{
                          background: `${severityColor(w.severity)}22`,
                          color: severityColor(w.severity),
                          border: `1px solid ${severityColor(w.severity)}44`,
                        }}
                      >
                        {w.severity}
                      </span>
                      {!w.is_read && (
                        <span
                          className="px-2 py-0.5 rounded text-[10px] font-mono font-bold"
                          style={{ background: "rgba(211,47,47,0.2)", color: "var(--prithvi-critical-red)" }}
                        >
                          UNREAD
                        </span>
                      )}
                      <span className="text-xs font-mono opacity-50 prithvi-text-electric">
                        from {w.officer_name}
                      </span>
                      <span className="text-xs font-mono opacity-40 prithvi-text-forest ml-auto">
                        {new Date(w.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                      </span>
                    </div>

                    {/* Message */}
                    <p className="text-sm font-mono prithvi-text-electric leading-relaxed">
                      {w.message}
                    </p>
                  </div>
                </div>

                {/* Mark as read button */}
                {!w.is_read && (
                  <button
                    onClick={() => handleMarkRead(w.id)}
                    disabled={markingId === w.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono flex-shrink-0 transition-all disabled:opacity-50"
                    style={{
                      background: "rgba(0,255,136,0.08)",
                      color: "var(--prithvi-aurora-green)",
                      border: "1px solid var(--prithvi-aurora-green)",
                    }}
                  >
                    {markingId === w.id ? (
                      <motion.div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full"
                        animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} />
                    ) : (
                      <CheckCircle className="w-3 h-3" />
                    )}
                    Mark Read
                  </button>
                )}
                {w.is_read && (
                  <span className="flex items-center gap-1 text-xs font-mono opacity-40 prithvi-text-forest flex-shrink-0">
                    <CheckCircle className="w-3 h-3" /> Read
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {!loading && warnings.length > 0 && (
        <p className="text-xs font-mono text-center opacity-40 prithvi-text-forest">
          {warnings.length} total warning{warnings.length !== 1 ? "s" : ""} · {unreadCount} unread
        </p>
      )}
    </div>
  );
}
