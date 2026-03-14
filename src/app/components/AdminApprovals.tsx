/**
 * AdminApprovals — Visible only to admins.
 * Lists pending regional officer registrations with Approve / Reject actions.
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { UserCheck, UserX, MapPin, Clock, CheckCircle, AlertCircle, Users } from "lucide-react";
import { adminApi, type PendingUser } from "../../api/client";

function relTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function AdminApprovals() {
  const [users, setUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    adminApi.pendingUsers()
      .then(setUsers)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleApprove = async (id: number, name: string) => {
    setActionId(id);
    try {
      await adminApi.approve(id);
      setUsers(prev => prev.filter(u => u.id !== id));
      showToast(`${name} approved — they can now log in.`, true);
    } catch {
      showToast("Approval failed. Please try again.", false);
    } finally {
      setActionId(null);
    }
  };

  const handleReject = async (id: number, name: string) => {
    setActionId(id);
    try {
      await adminApi.reject(id);
      setUsers(prev => prev.filter(u => u.id !== id));
      showToast(`${name}'s application was rejected and deleted.`, true);
    } catch {
      showToast("Rejection failed. Please try again.", false);
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl text-sm font-mono"
            style={{
              background: toast.ok ? "rgba(0,255,136,0.12)" : "rgba(211,47,47,0.12)",
              border: `1px solid ${toast.ok ? "var(--prithvi-aurora-green)" : "var(--prithvi-critical-red)"}`,
              color: toast.ok ? "var(--prithvi-aurora-green)" : "var(--prithvi-critical-red)",
            }}
          >
            {toast.ok
              ? <CheckCircle className="w-4 h-4 flex-shrink-0" />
              : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold font-mono tracking-wider prithvi-text-electric flex items-center gap-3">
          <UserCheck className="w-6 h-6 prithvi-text-aurora" />
          Pending Approvals
        </h1>
        <p className="text-sm mt-1 opacity-60 prithvi-text-forest font-mono">
          Regional officer registrations awaiting your review
        </p>
      </div>

      {/* Count badge */}
      {!loading && (
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border font-mono text-sm"
             style={{
               background: users.length > 0 ? "rgba(0,255,136,0.08)" : "var(--prithvi-glass)",
               borderColor: users.length > 0 ? "var(--prithvi-aurora-green)" : "var(--prithvi-border-dim)",
               color: users.length > 0 ? "var(--prithvi-aurora-green)" : "var(--prithvi-atmospheric-teal)",
             }}>
          <Users className="w-4 h-4" />
          {users.length} pending application{users.length !== 1 ? "s" : ""}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-20">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-8 h-8 border-2 rounded-full"
            style={{ borderColor: "var(--prithvi-aurora-green)", borderTopColor: "transparent" }}
          />
        </div>
      )}

      {/* Empty state */}
      {!loading && users.length === 0 && (
        <div className="rounded-2xl py-20 flex flex-col items-center gap-4 border"
             style={{ background: "var(--prithvi-glass)", borderColor: "var(--prithvi-border-dim)" }}>
          <CheckCircle className="w-12 h-12 prithvi-text-aurora opacity-40" />
          <p className="font-mono text-base prithvi-text-electric opacity-60">No pending applications</p>
          <p className="text-xs font-mono opacity-40 prithvi-text-forest">
            All regional officer registrations have been processed.
          </p>
        </div>
      )}

      {/* Applications list */}
      {!loading && users.length > 0 && (
        <div className="rounded-2xl overflow-hidden border"
             style={{ borderColor: "var(--prithvi-border-dim)", background: "var(--prithvi-glass)" }}>
          {/* Table header */}
          <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b text-xs font-mono tracking-wider prithvi-text-electric opacity-50"
               style={{ borderColor: "var(--prithvi-border-dim)" }}>
            <span className="col-span-3">NAME</span>
            <span className="col-span-4">EMAIL</span>
            <span className="col-span-2">REGION</span>
            <span className="col-span-1">APPLIED</span>
            <span className="col-span-2 text-right">ACTIONS</span>
          </div>

          {/* Rows */}
          <AnimatePresence>
            {users.map((u, i) => (
              <motion.div
                key={u.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10, height: 0 }}
                transition={{ delay: i * 0.04 }}
                className="grid grid-cols-12 gap-4 px-6 py-4 border-b items-center"
                style={{
                  borderColor: "var(--prithvi-border-dim)",
                  background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)",
                }}
              >
                {/* Avatar + name */}
                <div className="col-span-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                       style={{ background: "rgba(0,200,255,0.15)", color: "var(--prithvi-electric-cyan)", border: "1px solid var(--prithvi-electric-cyan)" }}>
                    {u.name[0]?.toUpperCase()}
                  </div>
                  <span className="font-mono text-sm prithvi-text-electric truncate">{u.name}</span>
                </div>

                {/* Email */}
                <div className="col-span-4">
                  <span className="font-mono text-xs prithvi-text-forest opacity-70 truncate block">{u.email}</span>
                </div>

                {/* Region */}
                <div className="col-span-2 flex items-center gap-1">
                  <MapPin className="w-3 h-3 flex-shrink-0" style={{ color: "var(--prithvi-electric-cyan)" }} />
                  <span className="font-mono text-xs" style={{ color: "var(--prithvi-electric-cyan)" }}>
                    {u.region ?? "—"}
                  </span>
                </div>

                {/* Time */}
                <div className="col-span-1 flex items-center gap-1">
                  <Clock className="w-3 h-3 prithvi-text-electric opacity-40" />
                  <span className="font-mono text-xs prithvi-text-electric opacity-50">{relTime(u.created_at)}</span>
                </div>

                {/* Actions */}
                <div className="col-span-2 flex items-center justify-end gap-2">
                  <button
                    onClick={() => handleApprove(u.id, u.name)}
                    disabled={actionId === u.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all disabled:opacity-50"
                    style={{ background: "rgba(0,255,136,0.12)", color: "var(--prithvi-aurora-green)", border: "1px solid var(--prithvi-aurora-green)" }}
                  >
                    {actionId === u.id ? (
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                        className="w-3 h-3 border border-current border-t-transparent rounded-full" />
                    ) : (
                      <UserCheck className="w-3 h-3" />
                    )}
                    Approve
                  </button>
                  <button
                    onClick={() => handleReject(u.id, u.name)}
                    disabled={actionId === u.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all disabled:opacity-50"
                    style={{ background: "rgba(211,47,47,0.12)", color: "var(--prithvi-critical-red)", border: "1px solid var(--prithvi-critical-red)" }}
                  >
                    <UserX className="w-3 h-3" />
                    Reject
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
