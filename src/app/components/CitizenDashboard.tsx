import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Camera,
  MapPin,
  Send,
  CheckCircle,
  Clock,
  AlertTriangle,
  FileText,
  Upload,
  X,
  Leaf,
} from "lucide-react";
import { complaintsApi, type Complaint } from "../../api/client";

function statusColor(status: string): string {
  if (status === "resolved") return "var(--prithvi-aurora-green)";
  if (status === "under_review") return "var(--prithvi-electric-cyan)";
  return "var(--prithvi-warm-amber)";
}

function statusIcon(status: string) {
  if (status === "resolved") return CheckCircle;
  if (status === "under_review") return Clock;
  return AlertTriangle;
}

function statusLabel(status: string): string {
  if (status === "resolved") return "RESOLVED";
  if (status === "under_review") return "UNDER REVIEW";
  return "PENDING";
}

export function CitizenDashboard() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  async function loadComplaints() {
    try {
      const data = await complaintsApi.list();
      setComplaints(data);
    } catch (err) {
      console.error("CitizenDashboard: failed to load complaints", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadComplaints();
  }, []);

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setPhotoFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setPhotoPreview(null);
    }
  }

  function clearPhoto() {
    setPhotoFile(null);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    setSubmitting(true);
    setSubmitError(null);

    const formData = new FormData();
    formData.append("title", title.trim());
    formData.append("description", description.trim());
    if (location.trim()) formData.append("location", location.trim());
    if (photoFile) formData.append("photo", photoFile);

    try {
      await complaintsApi.submit(formData);
      setSubmitSuccess(true);
      setTitle("");
      setDescription("");
      setLocation("");
      clearPhoto();
      await loadComplaints();
      setTimeout(() => setSubmitSuccess(false), 4000);
    } catch (err: any) {
      setSubmitError(err.message ?? "Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

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
            CITIZEN ENVIRONMENTAL REPORTER
          </h2>
          <p className="text-sm mt-1 opacity-70 prithvi-text-forest">
            Report Anti-Environmental Activities • Tree Felling • Illegal Dumping • Industrial Violations
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-mono"
          style={{ background: "var(--prithvi-glass)", borderColor: "var(--prithvi-border-dim)" }}>
          <Leaf className="w-4 h-4" style={{ color: "var(--prithvi-aurora-green)" }} />
          <span className="prithvi-text-aurora">Your Reports: {complaints.length}</span>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 gap-6">
        {/* Complaint Submission Form */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="p-6 rounded-lg border backdrop-blur-md prithvi-card-layered"
          style={{
            background: "var(--prithvi-panel-bg)",
            borderColor: "var(--prithvi-border-dim)",
          }}
        >
          <h3 className="text-lg font-mono tracking-wider prithvi-text-electric mb-5 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            SUBMIT A REPORT
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Title */}
            <div>
              <label className="text-xs font-mono prithvi-text-electric opacity-70 mb-1 block">
                ACTIVITY TYPE / TITLE *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Illegal tree cutting near highway"
                required
                className="w-full px-3 py-2.5 rounded-lg border bg-transparent text-sm font-mono prithvi-text-electric placeholder:opacity-30 focus:outline-none transition-all"
                style={{
                  borderColor: "var(--prithvi-border-dim)",
                  background: "var(--prithvi-glass)",
                }}
                onFocus={(e) => (e.target.style.borderColor = "var(--prithvi-electric-cyan)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--prithvi-border-dim)")}
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-xs font-mono prithvi-text-electric opacity-70 mb-1 block">
                DESCRIPTION *
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what you witnessed — who, what, when, how severe..."
                required
                rows={4}
                className="w-full px-3 py-2.5 rounded-lg border bg-transparent text-sm font-mono prithvi-text-electric placeholder:opacity-30 focus:outline-none transition-all resize-none"
                style={{
                  borderColor: "var(--prithvi-border-dim)",
                  background: "var(--prithvi-glass)",
                }}
                onFocus={(e) => (e.target.style.borderColor = "var(--prithvi-electric-cyan)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--prithvi-border-dim)")}
              />
            </div>

            {/* Location */}
            <div>
              <label className="text-xs font-mono prithvi-text-electric opacity-70 mb-1 block">
                <MapPin className="w-3 h-3 inline mr-1" />
                LOCATION (optional)
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Near Nehru Park, Delhi"
                className="w-full px-3 py-2.5 rounded-lg border bg-transparent text-sm font-mono prithvi-text-electric placeholder:opacity-30 focus:outline-none transition-all"
                style={{
                  borderColor: "var(--prithvi-border-dim)",
                  background: "var(--prithvi-glass)",
                }}
                onFocus={(e) => (e.target.style.borderColor = "var(--prithvi-electric-cyan)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--prithvi-border-dim)")}
              />
            </div>

            {/* Photo Upload */}
            <div>
              <label className="text-xs font-mono prithvi-text-electric opacity-70 mb-1 block">
                <Camera className="w-3 h-3 inline mr-1" />
                PHOTO EVIDENCE (optional)
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                className="hidden"
                id="photo-upload"
              />
              {!photoPreview ? (
                <label
                  htmlFor="photo-upload"
                  className="flex flex-col items-center justify-center w-full h-28 rounded-lg border border-dashed cursor-pointer transition-all hover:opacity-80"
                  style={{
                    borderColor: "var(--prithvi-border-dim)",
                    background: "var(--prithvi-glass)",
                  }}
                >
                  <Upload className="w-6 h-6 mb-2 opacity-40 prithvi-text-electric" />
                  <span className="text-xs font-mono opacity-40 prithvi-text-electric">
                    Click to upload photo
                  </span>
                  <span className="text-[10px] font-mono opacity-30 prithvi-text-forest mt-1">
                    JPG, PNG, WEBP accepted
                  </span>
                </label>
              ) : (
                <div className="relative rounded-lg overflow-hidden" style={{ maxHeight: "180px" }}>
                  <img src={photoPreview} alt="Preview" className="w-full object-cover rounded-lg" style={{ maxHeight: "180px" }} />
                  <button
                    type="button"
                    onClick={clearPhoto}
                    className="absolute top-2 right-2 p-1 rounded-full"
                    style={{ background: "var(--prithvi-critical-red)" }}
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                  <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded text-[10px] font-mono"
                    style={{ background: "rgba(0,0,0,0.7)", color: "var(--prithvi-aurora-green)" }}>
                    {photoFile?.name}
                  </div>
                </div>
              )}
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={submitting || !title.trim() || !description.trim()}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-lg font-mono text-sm tracking-wider transition-all disabled:opacity-40"
              style={{
                background: submitting ? "var(--prithvi-glass)" : "var(--prithvi-electric-cyan)",
                color: submitting ? "var(--prithvi-text-dim)" : "#000",
              }}
            >
              <Send className="w-4 h-4" />
              {submitting ? "SUBMITTING..." : "SUBMIT REPORT"}
            </button>

            {/* Success/Error feedback */}
            <AnimatePresence>
              {submitSuccess && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-mono"
                  style={{ background: "var(--prithvi-aurora-green)22", color: "var(--prithvi-aurora-green)", border: "1px solid var(--prithvi-aurora-green)44" }}
                >
                  <CheckCircle className="w-4 h-4" />
                  Report submitted successfully! Authorities have been notified.
                </motion.div>
              )}
              {submitError && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-mono"
                  style={{ background: "var(--prithvi-critical-red)22", color: "var(--prithvi-critical-red)", border: "1px solid var(--prithvi-critical-red)44" }}
                >
                  <AlertTriangle className="w-4 h-4" />
                  {submitError}
                </motion.div>
              )}
            </AnimatePresence>
          </form>
        </motion.div>

        {/* My Reports */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="p-6 rounded-lg border backdrop-blur-md prithvi-card-layered prithvi-inner-glow"
          style={{
            background: "var(--prithvi-panel-bg)",
            borderColor: "var(--prithvi-border-dim)",
          }}
        >
          <h3 className="text-lg font-mono tracking-wider prithvi-text-electric mb-5 flex items-center gap-2">
            <Clock className="w-5 h-5" />
            MY SUBMITTED REPORTS
          </h3>

          {loading ? (
            <div className="text-center py-12 text-sm font-mono opacity-40 prithvi-text-electric">
              Loading reports...
            </div>
          ) : complaints.length === 0 ? (
            <div className="text-center py-12">
              <Leaf className="w-10 h-10 mx-auto mb-3 opacity-20 prithvi-text-electric" />
              <p className="text-sm font-mono opacity-40 prithvi-text-electric">No reports submitted yet.</p>
              <p className="text-xs font-mono opacity-30 prithvi-text-forest mt-1">
                Use the form to report environmental violations.
              </p>
            </div>
          ) : (
            <div className="space-y-3 overflow-y-auto" style={{ maxHeight: "520px" }}>
              {complaints.map((c, idx) => {
                const StatusIcon = statusIcon(c.status);
                const color = statusColor(c.status);
                return (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    className="p-4 rounded-lg border transition-all hover:bg-white/5"
                    style={{
                      background: "var(--prithvi-glass)",
                      borderColor: "var(--prithvi-border-dim)",
                    }}
                  >
                    <div className="flex items-start gap-3">
                      {/* Thumbnail */}
                      {c.photo_data ? (
                        <img
                          src={`data:image/jpeg;base64,${c.photo_data}`}
                          alt="complaint"
                          className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
                          style={{ border: "1px solid var(--prithvi-border-dim)" }}
                        />
                      ) : (
                        <div
                          className="w-14 h-14 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: "var(--prithvi-glass)", border: "1px solid var(--prithvi-border-dim)" }}
                        >
                          <Camera className="w-5 h-5 opacity-20 prithvi-text-electric" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-mono font-semibold prithvi-text-electric truncate">
                            {c.title}
                          </span>
                          <span
                            className="flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono"
                            style={{
                              background: `${color}22`,
                              color,
                              border: `1px solid ${color}44`,
                            }}
                          >
                            <StatusIcon className="w-2.5 h-2.5" />
                            {statusLabel(c.status)}
                          </span>
                        </div>
                        <p className="text-xs opacity-60 prithvi-text-forest line-clamp-2 mb-1">
                          {c.description}
                        </p>
                        <div className="flex items-center gap-3 text-[10px] font-mono opacity-40 prithvi-text-electric">
                          {c.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-2.5 h-2.5" />
                              {c.location}
                            </span>
                          )}
                          <span>{new Date(c.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>

      {/* Stats bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="grid grid-cols-3 gap-4"
      >
        {[
          {
            label: "TOTAL REPORTS",
            value: complaints.length,
            color: "var(--prithvi-electric-cyan)",
          },
          {
            label: "UNDER REVIEW",
            value: complaints.filter((c) => c.status === "under_review").length,
            color: "var(--prithvi-electric-cyan)",
          },
          {
            label: "RESOLVED",
            value: complaints.filter((c) => c.status === "resolved").length,
            color: "var(--prithvi-aurora-green)",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="p-4 rounded-lg border text-center"
            style={{
              background: "var(--prithvi-panel-bg)",
              borderColor: "var(--prithvi-border-dim)",
            }}
          >
            <div className="text-2xl font-mono font-bold mb-1" style={{ color: stat.color }}>
              {loading ? "..." : stat.value}
            </div>
            <div className="text-[10px] font-mono opacity-60 prithvi-text-electric">{stat.label}</div>
          </div>
        ))}
      </motion.div>
    </div>
  );
}
