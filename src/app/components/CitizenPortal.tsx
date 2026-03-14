/**
 * CitizenPortal — Standalone page for citizen users.
 * Tabs: My Reports | Community | Leaderboard
 * Clean light theme — no neon.
 */

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  Leaf, LogOut, Camera, MapPin, Send, CheckCircle,
  Clock, Eye, AlertTriangle, X, UploadCloud, TreePine,
  Trash2, Factory, AlertCircle, Plus, ChevronDown, ChevronUp,
  Heart, MessageCircle, Trophy, Users, Image as ImageIcon,
} from "lucide-react";
import {
  complaintsApi, communityApi,
  type Complaint, type CommunityPost, type CommunityComment, type LeaderboardEntry,
} from "../../api/client";
import { useAuth } from "../context/AuthContext";

// ── Design tokens ──────────────────────────────────────────────
const C = {
  navBg:      "#1b4332",
  pageBg:     "#f0f4f0",
  cardBg:     "#ffffff",
  border:     "#d1e4d8",
  primary:    "#2d6a4f",
  primaryHover: "#245a42",
  accent:     "#40916c",
  accentLight:"#d8f3dc",
  textMain:   "#1a1a1a",
  textSub:    "#4a6858",
  textMuted:  "#7a9e8a",
  danger:     "#c62828",
  dangerBg:   "#ffebee",
  warning:    "#e65100",
  warnBg:     "#fff3e0",
  info:       "#1565c0",
  infoBg:     "#e3f2fd",
  gold:       "#f9a825",
  silver:     "#78909c",
  bronze:     "#8d6e63",
};

// ── Helpers ────────────────────────────────────────────────────

function relTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diffMs / 60_000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs  < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)  return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <div
      className="rounded-full flex items-center justify-center font-bold flex-shrink-0 select-none"
      style={{ width: size, height: size, background: C.accent, color: "#fff", fontSize: size * 0.38 }}
    >
      {name?.[0]?.toUpperCase() ?? "?"}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "resolved")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
            style={{ background: C.accentLight, color: C.primary }}>
        <CheckCircle className="w-3 h-3" /> Resolved
      </span>
    );
  if (status === "under_review")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
            style={{ background: C.infoBg, color: C.info }}>
        <Eye className="w-3 h-3" /> Under Review
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
          style={{ background: C.warnBg, color: C.warning }}>
      <Clock className="w-3 h-3" /> Pending
    </span>
  );
}

// ── Activity categories ────────────────────────────────────────
const CATEGORIES = [
  { icon: TreePine,      label: "Illegal Tree Felling / Deforestation" },
  { icon: Trash2,        label: "Illegal Waste Dumping" },
  { icon: Factory,       label: "Industrial Pollution / Smoke" },
  { icon: AlertTriangle, label: "Water Body Contamination" },
  { icon: AlertCircle,   label: "Other Environmental Violation" },
];

// ══════════════════════════════════════════════════════════════
// TAB 1 — My Reports
// ══════════════════════════════════════════════════════════════

function ReportsTab({ userId }: { userId: number | undefined }) {
  const [category, setCategory]         = useState(CATEGORIES[0].label);
  const [description, setDescription]   = useState("");
  const [location, setLocation]         = useState("");
  const [photo, setPhoto]               = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting]     = useState(false);
  const [success, setSuccess]           = useState(false);
  const [formError, setFormError]       = useState<string | null>(null);
  const [showForm, setShowForm]         = useState(false);
  const fileRef  = useRef<HTMLInputElement>(null);
  const formRef  = useRef<HTMLDivElement>(null);

  const [reports, setReports]           = useState<Complaint[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [expandedId, setExpandedId]     = useState<number | null>(null);

  const loadReports = () => {
    complaintsApi.list()
      .then(setReports)
      .catch(() => {})
      .finally(() => setLoadingReports(false));
  };
  useEffect(() => { loadReports(); }, []);

  const openForm = () => {
    setShowForm(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  };

  const pickPhoto = (file: File) => {
    if (!file.type.startsWith("image/")) { setFormError("Please upload an image file."); return; }
    if (file.size > 5 * 1024 * 1024)   { setFormError("Photo must be smaller than 5 MB."); return; }
    setFormError(null);
    setPhoto(file);
    const r = new FileReader();
    r.onload = (e) => setPhotoPreview(e.target?.result as string);
    r.readAsDataURL(file);
  };
  const removePhoto = () => {
    setPhoto(null); setPhotoPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) { setFormError("Please describe what you witnessed."); return; }
    setSubmitting(true); setFormError(null);
    const fd = new FormData();
    fd.append("title", category);
    fd.append("description", description.trim());
    if (location.trim()) fd.append("location", location.trim());
    if (photo) fd.append("photo", photo);
    try {
      await complaintsApi.submit(fd);
      setSuccess(true);
      setDescription(""); setLocation(""); removePhoto();
      setCategory(CATEGORIES[0].label);
      setShowForm(false);
      loadReports();
      setTimeout(() => setSuccess(false), 5000);
    } catch (err: any) {
      setFormError(err.message ?? "Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const pending      = reports.filter(r => r.status === "pending").length;
  const under_review = reports.filter(r => r.status === "under_review").length;
  const resolved     = reports.filter(r => r.status === "resolved").length;

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { n: reports.length, label: "Total Filed",  bg: C.accentLight, col: C.primary },
          { n: pending,        label: "Pending",      bg: C.warnBg,      col: C.warning },
          { n: under_review,   label: "Under Review", bg: C.infoBg,      col: C.info },
          { n: resolved,       label: "Resolved",     bg: C.accentLight, col: C.accent },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-4" style={{ background: s.bg }}>
            <div className="text-2xl font-bold font-mono" style={{ color: s.col }}>{s.n}</div>
            <div className="text-xs mt-0.5" style={{ color: C.textSub }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Success toast */}
      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm"
            style={{ background: C.accentLight, color: C.primary, border: `1px solid ${C.border}` }}
          >
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            <span><strong>Report submitted!</strong> Authorities have been notified.</span>
            <button onClick={() => setSuccess(false)} className="ml-auto opacity-60 hover:opacity-100">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* File a report header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold" style={{ color: C.textMain }}>My Reports</h2>
        <button
          onClick={openForm}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
          style={{ background: C.primary, color: "#fff" }}
          onMouseEnter={e => (e.currentTarget.style.background = C.primaryHover)}
          onMouseLeave={e => (e.currentTarget.style.background = C.primary)}
        >
          <Plus className="w-4 h-4" /> File a Report
        </button>
      </div>

      {/* Report form */}
      <div ref={formRef}>
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="rounded-2xl overflow-hidden mb-6"
              style={{ background: C.cardBg, border: `1px solid ${C.border}`, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: C.border }}>
                <h3 className="font-bold text-base flex items-center gap-2" style={{ color: C.textMain }}>
                  <AlertTriangle className="w-4 h-4" style={{ color: C.warning }} />
                  Report Environmental Violation
                </h3>
                <button onClick={() => setShowForm(false)} className="opacity-40 hover:opacity-70 transition-opacity">
                  <X className="w-5 h-5" style={{ color: C.textMain }} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-5">
                {/* Photo upload */}
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: C.textMain }}>
                    Photo Evidence
                    <span className="ml-2 text-xs font-normal" style={{ color: C.textMuted }}>(optional, max 5 MB)</span>
                  </label>
                  {photoPreview ? (
                    <div className="relative rounded-xl overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
                      <img src={photoPreview} alt="Preview" className="w-full max-h-56 object-cover" />
                      <button
                        type="button" onClick={removePhoto}
                        className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center"
                        style={{ background: C.danger, color: "#fff" }}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                      <div className="absolute bottom-2 left-2 text-xs text-white bg-black/50 px-2 py-0.5 rounded">
                        {photo?.name}
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) pickPhoto(f); }}
                      className="w-full rounded-xl border-2 border-dashed py-8 flex flex-col items-center gap-2 transition-colors hover:border-green-500"
                      style={{ borderColor: C.border, background: C.pageBg }}
                    >
                      <UploadCloud className="w-8 h-8" style={{ color: C.accent }} />
                      <p className="text-sm font-medium" style={{ color: C.textSub }}>Click or drag photo here</p>
                      <p className="text-xs" style={{ color: C.textMuted }}>JPEG, PNG, WEBP accepted</p>
                    </button>
                  )}
                  <input ref={fileRef} type="file" accept="image/*" className="hidden"
                         onChange={e => { const f = e.target.files?.[0]; if (f) pickPhoto(f); }} />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: C.textMain }}>
                    Type of Violation
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {CATEGORIES.map(cat => {
                      const Icon = cat.icon;
                      const active = category === cat.label;
                      return (
                        <button
                          key={cat.label} type="button" onClick={() => setCategory(cat.label)}
                          className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-left transition-all"
                          style={{
                            background: active ? C.accentLight : C.pageBg,
                            border: `1px solid ${active ? C.accent : C.border}`,
                            color: active ? C.primary : C.textSub,
                            fontWeight: active ? 600 : 400,
                          }}
                        >
                          <Icon className="w-4 h-4 flex-shrink-0" />
                          <span className="text-xs leading-tight">{cat.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-semibold mb-1.5" style={{ color: C.textMain }}>
                    Description <span style={{ color: C.danger }}>*</span>
                  </label>
                  <textarea
                    value={description} onChange={e => setDescription(e.target.value)}
                    placeholder="Describe the violation — what was happening, how severe, any vehicles or people involved..."
                    rows={4} maxLength={1500} required
                    className="w-full px-4 py-3 rounded-xl text-sm resize-none outline-none transition-all"
                    style={{ background: C.pageBg, border: `1px solid ${C.border}`, color: C.textMain }}
                    onFocus={e => (e.target.style.borderColor = C.accent)}
                    onBlur={e  => (e.target.style.borderColor = C.border)}
                  />
                  <div className="text-right text-xs mt-1" style={{ color: C.textMuted }}>{description.length}/1500</div>
                </div>

                {/* Location */}
                <div>
                  <label className="block text-sm font-semibold mb-1.5" style={{ color: C.textMain }}>
                    <MapPin className="w-3.5 h-3.5 inline mr-1" />
                    Location
                    <span className="ml-2 text-xs font-normal" style={{ color: C.textMuted }}>(optional)</span>
                  </label>
                  <input
                    type="text" value={location} onChange={e => setLocation(e.target.value)}
                    placeholder="e.g. Near Sanjay Van, Vasant Vihar, Delhi"
                    maxLength={200}
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                    style={{ background: C.pageBg, border: `1px solid ${C.border}`, color: C.textMain }}
                    onFocus={e => (e.target.style.borderColor = C.accent)}
                    onBlur={e  => (e.target.style.borderColor = C.border)}
                  />
                </div>

                {/* Error */}
                <AnimatePresence>
                  {formError && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
                      style={{ background: C.dangerBg, color: C.danger, border: `1px solid #ffcdd2` }}
                    >
                      <AlertCircle className="w-4 h-4 flex-shrink-0" /> {formError}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Submit */}
                <button
                  type="submit" disabled={submitting}
                  className="w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-60"
                  style={{ background: C.primary, color: "#fff" }}
                >
                  {submitting ? (
                    <>
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                      Submitting...
                    </>
                  ) : (
                    <><Send className="w-4 h-4" /> Submit Report</>
                  )}
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Reports list */}
      {loadingReports ? (
        <div className="flex justify-center py-12">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-7 h-7 border-2 rounded-full"
            style={{ borderColor: C.accent, borderTopColor: "transparent" }} />
        </div>
      ) : reports.length === 0 ? (
        <div className="rounded-2xl py-14 flex flex-col items-center gap-3"
             style={{ background: C.cardBg, border: `1px solid ${C.border}` }}>
          <Leaf className="w-10 h-10" style={{ color: C.border }} />
          <p className="font-semibold text-sm" style={{ color: C.textSub }}>No reports yet</p>
          <p className="text-xs text-center max-w-xs" style={{ color: C.textMuted }}>
            Use the "File a Report" button above to submit your first report.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((r, i) => (
            <motion.article
              key={r.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="rounded-2xl overflow-hidden cursor-pointer"
              style={{ background: C.cardBg, border: `1px solid ${C.border}`, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}
              onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
            >
              <div className="flex items-start gap-3 p-4">
                {r.photo_data ? (
                  <img src={`data:image/jpeg;base64,${r.photo_data}`} alt="Evidence"
                       className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
                       style={{ border: `1px solid ${C.border}` }} />
                ) : (
                  <div className="w-14 h-14 rounded-lg flex-shrink-0 flex items-center justify-center"
                       style={{ background: C.pageBg, border: `1px solid ${C.border}` }}>
                    <Camera className="w-5 h-5" style={{ color: C.border }} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-semibold text-sm truncate" style={{ color: C.textMain }}>{r.title}</span>
                    <StatusBadge status={r.status} />
                  </div>
                  <p className="text-xs leading-relaxed line-clamp-2 mb-1.5" style={{ color: C.textSub }}>{r.description}</p>
                  <div className="flex items-center gap-3 flex-wrap">
                    {r.location && (
                      <span className="flex items-center gap-1 text-xs" style={{ color: C.textMuted }}>
                        <MapPin className="w-3 h-3" /> {r.location}
                      </span>
                    )}
                    <span className="text-xs" style={{ color: C.textMuted }}>{relTime(r.created_at)}</span>
                  </div>
                </div>
                <div className="flex-shrink-0" style={{ color: C.textMuted }}>
                  {expandedId === r.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </div>
              <AnimatePresence>
                {expandedId === r.id && (
                  <motion.div
                    initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
                    className="overflow-hidden"
                    style={{ borderTop: `1px solid ${C.border}` }}
                  >
                    <div className="px-5 py-4 space-y-3">
                      <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: C.textMain }}>{r.description}</p>
                      {r.photo_data && (
                        <img src={`data:image/jpeg;base64,${r.photo_data}`} alt="Full evidence"
                             className="rounded-xl max-h-64 w-full object-contain"
                             style={{ background: C.pageBg, border: `1px solid ${C.border}` }} />
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.article>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// TAB 2 — Community
// ══════════════════════════════════════════════════════════════

function CommunityTab({ user }: { user: { id: number; name: string } | null }) {
  const [posts, setPosts]           = useState<CommunityPost[]>([]);
  const [loading, setLoading]       = useState(true);
  const [postContent, setPostContent] = useState("");
  const [postPhoto, setPostPhoto]   = useState<File | null>(null);
  const [postPhotoPreview, setPostPhotoPreview] = useState<string | null>(null);
  const [posting, setPosting]       = useState(false);
  const [postError, setPostError]   = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [expandedComments, setExpandedComments] = useState<Set<number>>(new Set());
  const [comments, setComments]     = useState<Record<number, CommunityComment[]>>({});
  const [commentInput, setCommentInput] = useState<Record<number, string>>({});
  const [sendingComment, setSendingComment] = useState<number | null>(null);

  const loadPosts = () => {
    communityApi.listPosts()
      .then(setPosts)
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(() => { loadPosts(); }, []);

  const pickPostPhoto = (file: File) => {
    if (!file.type.startsWith("image/")) { setPostError("Please upload an image."); return; }
    if (file.size > 5 * 1024 * 1024)    { setPostError("Photo must be under 5 MB."); return; }
    setPostError(null);
    setPostPhoto(file);
    const r = new FileReader();
    r.onload = e => setPostPhotoPreview(e.target?.result as string);
    r.readAsDataURL(file);
  };
  const removePostPhoto = () => {
    setPostPhoto(null); setPostPhotoPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const submitPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postContent.trim()) { setPostError("Post cannot be empty."); return; }
    setPosting(true); setPostError(null);
    const fd = new FormData();
    fd.append("content", postContent.trim());
    if (postPhoto) fd.append("photo", postPhoto);
    try {
      const newPost = await communityApi.createPost(fd);
      setPosts(prev => [newPost, ...prev]);
      setPostContent(""); removePostPhoto();
    } catch (err: any) {
      setPostError(err.message ?? "Failed to post. Please try again.");
    } finally {
      setPosting(false);
    }
  };

  const toggleLike = async (postId: number) => {
    try {
      const updated = await communityApi.toggleLike(postId);
      setPosts(prev => prev.map(p => p.id === postId ? updated : p));
    } catch {}
  };

  const toggleComments = async (postId: number) => {
    const next = new Set(expandedComments);
    if (next.has(postId)) {
      next.delete(postId);
    } else {
      next.add(postId);
      if (!comments[postId]) {
        try {
          const c = await communityApi.getComments(postId);
          setComments(prev => ({ ...prev, [postId]: c }));
        } catch {}
      }
    }
    setExpandedComments(next);
  };

  const submitComment = async (postId: number) => {
    const content = (commentInput[postId] ?? "").trim();
    if (!content) return;
    setSendingComment(postId);
    try {
      const c = await communityApi.addComment(postId, content);
      setComments(prev => ({ ...prev, [postId]: [...(prev[postId] ?? []), c] }));
      setCommentInput(prev => ({ ...prev, [postId]: "" }));
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments_count: p.comments_count + 1 } : p));
    } catch {}
    setSendingComment(null);
  };

  return (
    <div className="space-y-5">
      {/* Create post */}
      <div className="rounded-2xl p-5" style={{ background: C.cardBg, border: `1px solid ${C.border}`, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
        <div className="flex gap-3">
          <Avatar name={user?.name ?? "?"} />
          <div className="flex-1">
            <form onSubmit={submitPost} className="space-y-3">
              <textarea
                value={postContent}
                onChange={e => setPostContent(e.target.value)}
                placeholder="Share what you're doing to protect the environment..."
                rows={3} maxLength={2000}
                className="w-full px-3 py-2.5 rounded-xl text-sm resize-none outline-none transition-all"
                style={{ background: C.pageBg, border: `1px solid ${C.border}`, color: C.textMain }}
                onFocus={e => (e.target.style.borderColor = C.accent)}
                onBlur={e  => (e.target.style.borderColor = C.border)}
              />
              {postPhotoPreview && (
                <div className="relative rounded-xl overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
                  <img src={postPhotoPreview} alt="Preview" className="w-full max-h-48 object-cover" />
                  <button type="button" onClick={removePostPhoto}
                    className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center"
                    style={{ background: C.danger, color: "#fff" }}>
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
              {postError && (
                <p className="text-xs px-3 py-2 rounded-lg" style={{ background: C.dangerBg, color: C.danger }}>{postError}</p>
              )}
              <div className="flex items-center justify-between">
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors"
                  style={{ color: C.accent, background: C.accentLight }}>
                  <ImageIcon className="w-4 h-4" /> Add Photo
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden"
                       onChange={e => { const f = e.target.files?.[0]; if (f) pickPostPhoto(f); }} />
                <button type="submit" disabled={posting || !postContent.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
                  style={{ background: C.primary, color: "#fff" }}>
                  {posting ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    <><Send className="w-3.5 h-3.5" /> Post</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Feed */}
      {loading ? (
        <div className="flex justify-center py-12">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-7 h-7 border-2 rounded-full"
            style={{ borderColor: C.accent, borderTopColor: "transparent" }} />
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-2xl py-14 flex flex-col items-center gap-3"
             style={{ background: C.cardBg, border: `1px solid ${C.border}` }}>
          <Users className="w-10 h-10" style={{ color: C.border }} />
          <p className="font-semibold text-sm" style={{ color: C.textSub }}>No posts yet</p>
          <p className="text-xs" style={{ color: C.textMuted }}>Be the first to share your environmental work!</p>
        </div>
      ) : (
        posts.map((post, i) => (
          <motion.div
            key={post.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="rounded-2xl overflow-hidden"
            style={{ background: C.cardBg, border: `1px solid ${C.border}`, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
          >
            {/* Post header */}
            <div className="flex items-center gap-3 p-4 pb-3">
              <Avatar name={post.author_name} />
              <div>
                <p className="font-semibold text-sm" style={{ color: C.textMain }}>{post.author_name}</p>
                <p className="text-xs" style={{ color: C.textMuted }}>{relTime(post.created_at)}</p>
              </div>
            </div>

            {/* Content */}
            <p className="px-4 pb-3 text-sm leading-relaxed" style={{ color: C.textMain }}>{post.content}</p>

            {/* Photo */}
            {post.photo_data && (
              <div className="mx-4 mb-3 rounded-xl overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
                <img
                  src={`data:${post.photo_filename?.endsWith(".png") ? "image/png" : "image/jpeg"};base64,${post.photo_data}`}
                  alt="Post photo"
                  className="w-full max-h-64 object-cover"
                />
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-1 px-4 pb-3 border-t pt-3" style={{ borderColor: C.border }}>
              <button
                onClick={() => toggleLike(post.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors"
                style={{
                  color: post.liked_by_me ? C.danger : C.textSub,
                  background: post.liked_by_me ? C.dangerBg : "transparent",
                }}
              >
                <Heart className={`w-4 h-4 ${post.liked_by_me ? "fill-current" : ""}`} />
                {post.likes_count}
              </button>
              <button
                onClick={() => toggleComments(post.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors"
                style={{ color: C.textSub }}
              >
                <MessageCircle className="w-4 h-4" />
                {post.comments_count}
              </button>
            </div>

            {/* Comments section */}
            <AnimatePresence>
              {expandedComments.has(post.id) && (
                <motion.div
                  initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
                  className="overflow-hidden"
                  style={{ borderTop: `1px solid ${C.border}` }}
                >
                  <div className="px-4 py-3 space-y-3">
                    {(comments[post.id] ?? []).map(c => (
                      <div key={c.id} className="flex gap-2">
                        <Avatar name={c.author_name} size={28} />
                        <div className="flex-1 rounded-xl px-3 py-2" style={{ background: C.pageBg }}>
                          <span className="font-semibold text-xs mr-2" style={{ color: C.primary }}>{c.author_name}</span>
                          <span className="text-xs" style={{ color: C.textMain }}>{c.content}</span>
                          <span className="ml-2 text-[10px]" style={{ color: C.textMuted }}>{relTime(c.created_at)}</span>
                        </div>
                      </div>
                    ))}

                    {/* Add comment */}
                    <div className="flex gap-2 pt-1">
                      <Avatar name={user?.name ?? "?"} size={28} />
                      <div className="flex-1 flex gap-2">
                        <input
                          value={commentInput[post.id] ?? ""}
                          onChange={e => setCommentInput(prev => ({ ...prev, [post.id]: e.target.value }))}
                          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitComment(post.id); }}}
                          placeholder="Write a comment..."
                          className="flex-1 px-3 py-1.5 rounded-xl text-sm outline-none"
                          style={{ background: C.pageBg, border: `1px solid ${C.border}`, color: C.textMain }}
                        />
                        <button
                          onClick={() => submitComment(post.id)}
                          disabled={sendingComment === post.id || !(commentInput[post.id] ?? "").trim()}
                          className="px-3 py-1.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors"
                          style={{ background: C.primary, color: "#fff" }}
                        >
                          {sendingComment === post.id ? "..." : <Send className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// TAB 3 — Leaderboard
// ══════════════════════════════════════════════════════════════

function LeaderboardTab({ currentUserId }: { currentUserId: number | undefined }) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    communityApi.leaderboard()
      .then(setEntries)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const rankColor = (rank: number) =>
    rank === 1 ? C.gold : rank === 2 ? C.silver : rank === 3 ? C.bronze : C.textSub;

  const maxScore = entries[0]?.score ?? 1;

  return (
    <div className="space-y-5">
      {/* Header banner */}
      <div className="rounded-2xl p-6" style={{ background: C.primary, color: "#fff" }}>
        <div className="flex items-center gap-3 mb-2">
          <Trophy className="w-6 h-6" style={{ color: C.gold }} />
          <h2 className="text-lg font-bold">Community Leaderboard</h2>
        </div>
        <p className="text-sm opacity-80">Citizens ranked by environmental engagement.</p>
        <div className="flex gap-4 mt-4 flex-wrap">
          {[
            { dot: "#4caf50", label: "Post published = 3 pts" },
            { dot: "#ef5350", label: "Like received = 2 pts" },
            { dot: "#42a5f5", label: "Comment received = 1 pt" },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-1.5 text-xs opacity-90">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.dot }} />
              {s.label}
            </div>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-7 h-7 border-2 rounded-full"
            style={{ borderColor: C.accent, borderTopColor: "transparent" }} />
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-2xl py-14 flex flex-col items-center gap-3"
             style={{ background: C.cardBg, border: `1px solid ${C.border}` }}>
          <Trophy className="w-10 h-10" style={{ color: C.border }} />
          <p className="font-semibold text-sm" style={{ color: C.textSub }}>No entries yet</p>
          <p className="text-xs" style={{ color: C.textMuted }}>Start posting to appear on the leaderboard!</p>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ background: C.cardBg, border: `1px solid ${C.border}` }}>
          {entries.map((e, i) => {
            const isMe = e.user_id === currentUserId;
            return (
              <motion.div
                key={e.user_id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center gap-4 px-5 py-4"
                style={{
                  borderBottom: i < entries.length - 1 ? `1px solid ${C.border}` : "none",
                  background: isMe ? C.accentLight : "transparent",
                }}
              >
                {/* Rank */}
                <div className="w-7 text-center font-bold text-lg" style={{ color: rankColor(e.rank) }}>
                  {e.rank <= 3 ? ["🥇", "🥈", "🥉"][e.rank - 1] : e.rank}
                </div>

                <Avatar name={e.name} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm truncate" style={{ color: C.textMain }}>{e.name}</span>
                    {isMe && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{ background: C.primary, color: "#fff" }}>You</span>
                    )}
                  </div>
                  {/* Score bar */}
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: C.pageBg }}>
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: C.accent }}
                      initial={{ width: 0 }}
                      animate={{ width: `${(e.score / maxScore) * 100}%` }}
                      transition={{ duration: 0.7, delay: i * 0.05 }}
                    />
                  </div>
                  {/* Stats */}
                  <div className="flex gap-3 mt-1.5 text-[11px]" style={{ color: C.textMuted }}>
                    <span>{e.posts_count} posts</span>
                    <span>{e.total_likes} likes</span>
                    <span>{e.total_comments} comments</span>
                  </div>
                </div>

                <div className="font-bold text-sm font-mono" style={{ color: C.primary }}>{e.score} pts</div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MAIN — CitizenPortal
// ══════════════════════════════════════════════════════════════

type Tab = "reports" | "community" | "leaderboard";

export function CitizenPortal() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("reports");

  const handleLogout = () => { logout(); navigate("/login"); };

  const NAV_TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "reports",     label: "My Reports",  icon: <AlertTriangle className="w-4 h-4" /> },
    { key: "community",   label: "Community",   icon: <Users className="w-4 h-4" /> },
    { key: "leaderboard", label: "Leaderboard", icon: <Trophy className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen" style={{ background: C.pageBg }}>
      {/* ── Top Nav ── */}
      <header className="sticky top-0 z-50" style={{ background: C.navBg, boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}>
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.15)" }}>
              <Leaf className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold tracking-widest text-sm text-white">PRITHVINET</span>
            <span className="text-[10px] font-medium text-white/50 tracking-widest hidden sm:inline">CITIZEN</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold"
                   style={{ background: "rgba(255,255,255,0.2)", color: "#fff" }}>
                {user?.name?.[0]?.toUpperCase() ?? "C"}
              </div>
              <span className="text-sm text-white/80">{user?.name ?? "Citizen"}</span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" /> Logout
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-3xl mx-auto px-6 flex gap-1 pb-1">
          {NAV_TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                color: tab === t.key ? C.navBg : "rgba(255,255,255,0.65)",
                background: tab === t.key ? "#fff" : "transparent",
              }}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {/* ── Content ── */}
      <main className="max-w-3xl mx-auto px-6 py-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            {tab === "reports"     && <ReportsTab userId={user?.id} />}
            {tab === "community"   && <CommunityTab user={user ? { id: user.id, name: user.name } : null} />}
            {tab === "leaderboard" && <LeaderboardTab currentUserId={user?.id} />}
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="max-w-3xl mx-auto px-6 py-6 text-center">
        <p className="text-xs" style={{ color: C.textMuted }}>
          PrithviNet Citizen Portal · Reports reviewed by regional environmental authorities
        </p>
      </footer>
    </div>
  );
}
