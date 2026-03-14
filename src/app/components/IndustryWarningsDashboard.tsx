import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate } from "react-router";
import {
  AlertTriangle, CheckCircle, Send, MessageSquare,
  Factory, Shield, RefreshCw, Clock
} from "lucide-react";
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

function timeAgo(dateStr: string): string {
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function fullTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function IndustryWarningsDashboard() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const [warnings, setWarnings] = useState<IndustryWarning[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<IndustryWarning | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!loading && role !== "industry_user") navigate("/dashboard", { replace: true });
  }, [role, loading]);

  async function fetchWarnings(keepSelected = true) {
    try {
      const data = await warningsApi.myWarnings();
      setWarnings(data);
      if (keepSelected && selected) {
        const updated = data.find(w => w.id === selected.id);
        if (updated) setSelected(updated);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchWarnings(false); }, []);

  // Auto-scroll to bottom of chat when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selected?.id, selected?.replies?.length]);

  // Auto-mark as read when opening a conversation
  async function selectWarning(w: IndustryWarning) {
    setSelected(w);
    setReplyText("");
    if (!w.is_read) {
      try {
        await warningsApi.markRead(w.id);
        setWarnings(prev => prev.map(x => x.id === w.id ? { ...x, is_read: true } : x));
        setSelected({ ...w, is_read: true });
      } catch {}
    }
  }

  async function sendReply() {
    if (!replyText.trim() || !selected || sending) return;
    const msg = replyText.trim();
    setSending(true);
    try {
      const reply = await warningsApi.reply(selected.id, msg);
      setReplyText("");
      // Optimistically update the thread
      setSelected(prev => prev ? {
        ...prev, is_read: true, replies: [...prev.replies, reply]
      } : prev);
      setWarnings(prev => prev.map(w => w.id === selected.id
        ? { ...w, is_read: true, replies: [...w.replies, reply] }
        : w
      ));
    } catch {
      // silent fail
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendReply();
    }
  }

  const unreadCount = warnings.filter(w => !w.is_read).length;

  // Sidebar: preview text = last reply if exists, else warning message
  function previewText(w: IndustryWarning): string {
    if (w.replies.length > 0) {
      return `You: ${w.replies[w.replies.length - 1].message}`;
    }
    return w.message;
  }

  return (
    <div className="flex" style={{ height: "calc(100vh - 80px)" }}>
      {/* ── Left sidebar: conversation list ── */}
      <aside
        className="flex flex-col border-r flex-shrink-0"
        style={{
          width: "300px",
          background: "var(--prithvi-panel-bg)",
          borderColor: "var(--prithvi-border-dim)",
        }}
      >
        {/* Sidebar header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
          style={{ borderColor: "var(--prithvi-border-dim)", background: "var(--prithvi-panel-bg-solid)" }}
        >
          <div>
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 prithvi-text-electric" />
              <span className="text-sm font-mono tracking-wider prithvi-text-electric">NOTICES</span>
              {unreadCount > 0 && (
                <span
                  className="px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold"
                  style={{ background: "rgba(211,47,47,0.25)", color: "var(--prithvi-critical-red)" }}
                >
                  {unreadCount}
                </span>
              )}
            </div>
            {user?.industry_name && (
              <p className="text-[10px] font-mono opacity-40 prithvi-text-forest mt-0.5 truncate">
                {user.industry_name}
              </p>
            )}
          </div>
          <button
            onClick={() => fetchWarnings()}
            className="p-1.5 rounded-lg opacity-50 hover:opacity-100 transition-all"
            style={{ background: "var(--prithvi-glass)" }}
          >
            <RefreshCw className="w-3.5 h-3.5 prithvi-text-electric" />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <motion.div
                className="w-6 h-6 border-2 border-t-transparent rounded-full"
                style={{ borderColor: "var(--prithvi-electric-cyan)" }}
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              />
            </div>
          ) : warnings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <CheckCircle className="w-10 h-10 mb-3 prithvi-text-aurora opacity-60" />
              <p className="text-xs font-mono prithvi-text-aurora">No notices yet</p>
              <p className="text-[10px] mt-1 opacity-40 prithvi-text-forest">
                Notices from regional officers appear here
              </p>
            </div>
          ) : (
            <AnimatePresence>
              {warnings.map((w, idx) => {
                const isActive = selected?.id === w.id;
                const color = severityColor(w.severity);
                return (
                  <motion.button
                    key={w.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    onClick={() => selectWarning(w)}
                    className="w-full flex items-start gap-3 px-4 py-3 text-left transition-all border-b relative"
                    style={{
                      background: isActive ? "var(--prithvi-glass-bright)" : "transparent",
                      borderColor: "var(--prithvi-border-dim)",
                      borderLeft: isActive ? `3px solid ${color}` : "3px solid transparent",
                    }}
                  >
                    {/* Severity avatar */}
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: `${color}18`, border: `1px solid ${color}44` }}
                    >
                      <AlertTriangle className="w-4 h-4" style={{ color }} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-mono font-semibold prithvi-text-electric truncate">
                          {w.officer_name}
                        </span>
                        <span className="text-[9px] font-mono opacity-40 prithvi-text-forest flex-shrink-0">
                          {timeAgo(w.created_at)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span
                          className="text-[9px] font-mono uppercase px-1 rounded flex-shrink-0"
                          style={{ background: `${color}22`, color }}
                        >
                          {w.severity}
                        </span>
                        <p className="text-[11px] font-mono opacity-50 prithvi-text-electric truncate">
                          {previewText(w)}
                        </p>
                      </div>
                      {w.replies.length > 0 && (
                        <p className="text-[9px] font-mono opacity-30 prithvi-text-forest mt-0.5">
                          {w.replies.length} reply{w.replies.length !== 1 ? "s" : ""}
                        </p>
                      )}
                    </div>

                    {/* Unread dot */}
                    {!w.is_read && (
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0 mt-2"
                        style={{ background: "var(--prithvi-critical-red)" }}
                      />
                    )}
                  </motion.button>
                );
              })}
            </AnimatePresence>
          )}
        </div>
      </aside>

      {/* ── Right panel: chat view ── */}
      <div className="flex-1 flex flex-col min-w-0"
           style={{ background: "var(--prithvi-atmosphere-bg)" }}>
        {!selected ? (
          // Empty state — no conversation selected
          <div className="flex-1 flex flex-col items-center justify-center gap-4 opacity-40">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center"
              style={{ background: "var(--prithvi-glass)", border: "1px solid var(--prithvi-border-dim)" }}
            >
              <Factory className="w-9 h-9 prithvi-text-electric" />
            </div>
            <div className="text-center">
              <p className="font-mono text-sm prithvi-text-electric">Select a notice to view</p>
              <p className="text-xs font-mono prithvi-text-forest mt-1">
                Reply with your planned corrective actions
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div
              className="flex items-center gap-3 px-5 py-3 border-b flex-shrink-0 backdrop-blur-sm"
              style={{
                background: "var(--prithvi-panel-bg-solid)",
                borderColor: "var(--prithvi-border-dim)",
              }}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{
                  background: `${severityColor(selected.severity)}18`,
                  border: `2px solid ${severityColor(selected.severity)}55`,
                }}
              >
                <Shield className="w-5 h-5" style={{ color: severityColor(selected.severity) }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono font-semibold prithvi-text-electric">
                    {selected.officer_name}
                  </span>
                  <span
                    className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded"
                    style={{
                      background: `${severityColor(selected.severity)}22`,
                      color: severityColor(selected.severity),
                      border: `1px solid ${severityColor(selected.severity)}44`,
                    }}
                  >
                    {selected.severity}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[10px] font-mono opacity-40 prithvi-text-forest mt-0.5">
                  <Clock className="w-3 h-3" />
                  {fullTime(selected.created_at)}
                  {selected.replies.length > 0 && (
                    <span className="ml-2">· {selected.replies.length} reply{selected.replies.length !== 1 ? "s" : ""}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Officer's warning — received (left side) */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-3 max-w-2xl"
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{
                    background: `${severityColor(selected.severity)}18`,
                    border: `1px solid ${severityColor(selected.severity)}44`,
                  }}
                >
                  <AlertTriangle className="w-4 h-4" style={{ color: severityColor(selected.severity) }} />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-mono opacity-50 prithvi-text-forest mb-1">
                    {selected.officer_name} · Regional Officer
                  </p>
                  <div
                    className="px-4 py-3 rounded-xl rounded-tl-none"
                    style={{
                      background: `${severityColor(selected.severity)}10`,
                      border: `1px solid ${severityColor(selected.severity)}33`,
                    }}
                  >
                    <p className="text-sm font-mono prithvi-text-electric leading-relaxed whitespace-pre-wrap">
                      {selected.message}
                    </p>
                    <p className="text-[10px] font-mono opacity-40 prithvi-text-forest mt-2 text-right">
                      {fullTime(selected.created_at)}
                    </p>
                  </div>
                </div>
              </motion.div>

              {/* Replies — sent (right side) */}
              <AnimatePresence>
                {selected.replies.map((r, idx) => (
                  <motion.div
                    key={r.id}
                    initial={{ opacity: 0, y: 8, x: 20 }}
                    animate={{ opacity: 1, y: 0, x: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    className="flex items-start gap-3 justify-end max-w-2xl ml-auto"
                  >
                    <div className="flex-1 flex flex-col items-end">
                      <p className="text-[10px] font-mono opacity-50 prithvi-text-forest mb-1">
                        {user?.name ?? "You"} · Your Response
                      </p>
                      <div
                        className="px-4 py-3 rounded-xl rounded-tr-none"
                        style={{
                          background: "rgba(0,200,255,0.09)",
                          border: "1px solid rgba(0,200,255,0.25)",
                        }}
                      >
                        <p className="text-sm font-mono prithvi-text-electric leading-relaxed whitespace-pre-wrap">
                          {r.message}
                        </p>
                        <p className="text-[10px] font-mono opacity-40 prithvi-text-forest mt-2">
                          {fullTime(r.created_at)}
                        </p>
                      </div>
                    </div>
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{
                        background: "rgba(0,200,255,0.12)",
                        border: "1px solid rgba(0,200,255,0.3)",
                      }}
                    >
                      <Factory className="w-4 h-4 prithvi-text-ocean" />
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* No replies yet — call to action */}
              {selected.replies.length === 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-center py-4"
                >
                  <span
                    className="text-[11px] font-mono px-4 py-2 rounded-full"
                    style={{
                      background: "var(--prithvi-glass)",
                      border: "1px solid var(--prithvi-border-dim)",
                      color: "var(--prithvi-atmospheric-teal)",
                    }}
                  >
                    Reply below with your planned corrective action
                  </span>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Reply input */}
            <div
              className="border-t px-4 py-3 flex-shrink-0"
              style={{
                background: "var(--prithvi-panel-bg-solid)",
                borderColor: "var(--prithvi-border-dim)",
              }}
            >
              <div
                className="flex items-end gap-3 rounded-xl px-4 py-2 border"
                style={{
                  background: "var(--prithvi-glass)",
                  borderColor: replyText ? "var(--prithvi-electric-cyan)" : "var(--prithvi-border-dim)",
                }}
              >
                <textarea
                  ref={textareaRef}
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Describe your corrective action plan... (Enter to send, Shift+Enter for new line)"
                  rows={2}
                  className="flex-1 bg-transparent border-none outline-none resize-none text-sm font-mono prithvi-text-electric placeholder:opacity-30"
                  style={{ minHeight: "40px", maxHeight: "120px" }}
                />
                <button
                  onClick={sendReply}
                  disabled={!replyText.trim() || sending}
                  className="p-2 rounded-lg transition-all flex-shrink-0 disabled:opacity-30"
                  style={{
                    background: replyText.trim() ? "rgba(0,200,255,0.15)" : "transparent",
                    border: `1px solid ${replyText.trim() ? "rgba(0,200,255,0.4)" : "var(--prithvi-border-dim)"}`,
                  }}
                >
                  {sending ? (
                    <motion.div
                      className="w-4 h-4 border-2 border-t-transparent rounded-full"
                      style={{ borderColor: "var(--prithvi-electric-cyan)" }}
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                    />
                  ) : (
                    <Send className="w-4 h-4 prithvi-text-ocean" />
                  )}
                </button>
              </div>
              <p className="text-[9px] font-mono opacity-25 prithvi-text-forest mt-1 ml-1">
                Your response is logged as an official compliance action record
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
